/* Card e livro automático do saldo Pluxee Alimentação. */
(() => {
  'use strict';

  const TK = 'agenda_lagares_v3';
  const NK = 'agenda_notas_v1';
  const CK = 'agenda_contas_v1';
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || '') || fallback; }
    catch (_) { return fallback; }
  };
  const round = value => Math.round((Number(value) || 0) * 100) / 100;
  const num = value => {
    let text = String(value ?? '').trim();
    if (text.includes(',')) text = text.replace(/\./g, '').replace(',', '.');
    const parsed = Number(text);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const money = value => new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL'
  }).format(Number(value) || 0);
  const today = () => {
    const date = new Date();
    const pad = value => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };
  const formatDate = value => value
    ? String(value).split('-').reverse().join('/')
    : 'sem atualização';

  function saveAccounts(accounts) {
    window.__allowManualAccountWrite = true;
    localStorage.setItem(CK, JSON.stringify(accounts));
    window.__allowManualAccountWrite = false;
  }

  function ensureSlide() {
    const pager = document.querySelector('#pager');
    const energisaPrev = document.querySelector('#eprev');
    if (!pager || !energisaPrev) return null;
    let slide = document.querySelector('#pluxee');
    if (!slide) {
      slide = document.createElement('div');
      slide.className = 'slide pluxee';
      slide.id = 'pluxee';
      slide.setAttribute('aria-label', 'Saldo Pluxee Alimentação');
      energisaPrev.after(slide);
    }
    const dots = document.querySelector('#dots');
    if (dots && dots.children.length < pager.children.length) {
      while (dots.children.length < pager.children.length) {
        const dot = document.createElement('span');
        dot.className = 'dot';
        dots.appendChild(dot);
      }
    }
    if (!pager.dataset.pluxeeDots) {
      pager.dataset.pluxeeDots = '1';
      pager.addEventListener('scroll', () => {
        const allDots = [...document.querySelectorAll('#dots .dot')];
        const index = Math.round(pager.scrollLeft / Math.max(1, pager.clientWidth));
        allDots.forEach((dot, itemIndex) => dot.classList.toggle('on', itemIndex === index));
      }, { passive: true });
    }
    return slide;
  }

  function renderCard() {
    const slide = ensureSlide();
    if (!slide) return;
    const accounts = read(CK, {});
    slide.innerHTML = `
      <div class="pluxee-head">
        <span class="pluxee-food">♨ Alimentação</span>
        <strong>pluxee</strong>
      </div>
      <div class="pluxee-body">
        <span class="pluxee-x" aria-hidden="true"></span>
        <div>
          <small>Saldo disponível</small>
          <b>${money(accounts.pluxee || 0)}</b>
        </div>
      </div>
      <div class="pluxee-foot">
        <span>Automático · atualizado em ${formatDate(accounts.updPluxee)}</span>
        <button type="button" id="pluxeeEdit">Ajustar</button>
      </div>`;
  }

  function currentLedger() {
    const tasks = read(TK, []);
    const notes = read(NK, {});
    const ledger = {};
    tasks.forEach(task => {
      if (!task || task.tag !== 'financeiro') return;
      const note = notes[task.id] || {};
      if (note.conta !== 'pluxee' && note.forma !== 'pluxee') return;
      const value = num(note.valor);
      if (!(value > 0)) return;
      const isEntry = note.movimento === 'entrada';
      if (isEntry && task.done) ledger[task.id] = value;
      if (!isEntry && (!note.programada || task.done)) ledger[task.id] = -value;
    });
    return ledger;
  }

  function reconcile() {
    const accounts = read(CK, {});
    const current = currentLedger();
    const applied = accounts.appliedPluxee || {};
    let changed = false;

    if (!accounts.pluxeeReconcileV1) {
      if (!Number.isFinite(Number(accounts.pluxee))) {
        accounts.pluxee = round(Object.values(current).reduce((sum, value) => sum + value, 0));
      }
      accounts.appliedPluxee = { ...current };
      accounts.pluxeeReconcileV1 = true;
      changed = true;
    } else {
      Object.keys(current).forEach(id => {
        if (current[id] === applied[id]) return;
        accounts.pluxee = round((accounts.pluxee || 0) + current[id] - (applied[id] || 0));
        applied[id] = current[id];
        changed = true;
      });
      Object.keys(applied).forEach(id => {
        if (id in current) return;
        accounts.pluxee = round((accounts.pluxee || 0) - applied[id]);
        delete applied[id];
        changed = true;
      });
      accounts.appliedPluxee = applied;
    }
    if (changed) {
      accounts.updPluxee = today();
      accounts.autoAccrual = true;
      accounts.autoBalanceMode = true;
      accounts.balanceRevision = Date.now();
      saveAccounts(accounts);
    }
    renderCard();
  }

  function decorateRows() {
    const tasks = read(TK, []);
    const notes = read(NK, {});
    const pluxeeTitles = new Set(tasks
      .filter(task => {
        const note = notes[task.id] || {};
        return note.forma === 'pluxee' || note.conta === 'pluxee';
      })
      .map(task => task.text));
    document.querySelectorAll('#list .row').forEach(row => {
      const title = row.querySelector('.title');
      const meta = row.querySelector('.meta');
      if (!title || !meta || !pluxeeTitles.has(title.textContent.trim())) return;
      if (!meta.querySelector('.pluxee-tx-tag')) {
        const tag = document.createElement('span');
        tag.className = 'pluxee-tx-tag';
        tag.textContent = 'PLUXEE';
        meta.append(' ', tag);
      }
    });
  }

  const style = document.createElement('style');
  style.textContent = `
    .slide.pluxee{background:linear-gradient(145deg,#78f28b,#5fe77b 58%,#50d96e);color:#15233d;
      border-color:#8ff59f;position:relative;overflow:hidden}
    .pluxee-head,.pluxee-foot{position:relative;z-index:2;display:flex;align-items:center;justify-content:space-between}
    .pluxee-head{font-size:17px;font-weight:900}.pluxee-head strong{font-size:28px;letter-spacing:-1.5px}
    .pluxee-food{display:flex;gap:7px;align-items:center}.pluxee-body{position:relative;z-index:2;display:flex;
      justify-content:flex-end;align-items:flex-end;min-height:92px;padding-top:12px;text-align:right}
    .pluxee-body small{display:block;font-size:11px;font-weight:800;opacity:.68}.pluxee-body b{display:block;
      font-size:31px;line-height:1.08;margin-top:3px}.pluxee-x{position:absolute;left:14px;bottom:2px;width:78px;height:78px}
    .pluxee-x::before,.pluxee-x::after{content:"";position:absolute;left:31px;top:-4px;width:24px;height:88px;
      border-radius:8px;background:#fff}.pluxee-x::before{transform:rotate(45deg)}.pluxee-x::after{transform:rotate(-45deg)}
    .pluxee-foot{margin-top:10px;padding-top:9px;border-top:1px solid #15233d2b;font-size:10px;font-weight:800}
    .pluxee-foot button{border:1px solid #15233d66!important;background:#ffffff55!important;color:#15233d!important;
      border-radius:999px!important;padding:6px 10px!important;font-size:10px;font-weight:900}
    .pluxee-tx-tag{display:inline-block;padding:2px 6px;border:1px solid #69e88488;border-radius:999px;
      color:#83ef97;font-size:9px;font-weight:900;letter-spacing:.04em}
    @media(max-width:560px){.pluxee-head strong{font-size:25px}.pluxee-body b{font-size:28px}}
  `;
  document.head.appendChild(style);

  const paymentSelect = document.querySelector('#fp');
  if (paymentSelect && !paymentSelect.querySelector('option[value="pluxee"]')) {
    const option = document.createElement('option');
    option.value = 'pluxee';
    option.textContent = 'Saldo Pluxee';
    paymentSelect.appendChild(option);
    paymentSelect.closest('form')?.addEventListener('submit', () => {
      setTimeout(reconcile, 0);
    });
  }

  document.addEventListener('click', event => {
    if (!event.target.closest('#pluxeeEdit')) return;
    const accounts = read(CK, {});
    const value = prompt('Saldo Pluxee Alimentação (R$):', String(accounts.pluxee || 0));
    if (value === null) return;
    const next = num(value);
    accounts.manualAdjustmentPluxee = round(
      (accounts.manualAdjustmentPluxee || 0) + next - (accounts.pluxee || 0)
    );
    accounts.pluxee = next;
    accounts.updPluxee = today();
    accounts.autoAccrual = true;
    accounts.autoBalanceMode = true;
    accounts.balanceRevision = Date.now();
    saveAccounts(accounts);
    renderCard();
    window.dispatchEvent(new CustomEvent('agenda:remote-sync', {
      detail: { documentKey: 'accounts' }
    }));
  });

  let frame = 0;
  new MutationObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      ensureSlide();
      decorateRows();
    });
  }).observe(document.querySelector('.app') || document.body, { childList: true, subtree: true });
  window.addEventListener('agenda:remote-sync', event => {
    const key = event?.detail?.documentKey;
    if (key && !['tasks', 'notes', 'accounts', 'all'].includes(key)) return;
    reconcile();
    decorateRows();
  });
  window.addEventListener('storage', event => {
    if ([TK, NK, CK].includes(event.key)) reconcile();
  });

  reconcile();
  decorateRows();
})();
