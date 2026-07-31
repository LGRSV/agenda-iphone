/* Recebimentos financeiros explícitos + saldos automáticos com ajuste manual. */
(() => {
  'use strict';

  const TK = 'agenda_lagares_v3';
  const NK = 'agenda_notas_v1';
  const CK = 'agenda_contas_v1';
  const BASE_REVISION = 2026072601;
  const BASE_ACCOUNTS = {
    upd: '2026-07-26',
    updMp: '2026-07-26',
    updNb: '2026-07-26',
    updPluxee: '',
    mp: 8106.91,
    nb: 0,
    pluxee: 0,
    manualBalance: false,
    autoAccrual: true,
    autoBalanceMode: true,
    manualAdjustmentMp: 0,
    manualAdjustmentNb: 0,
    manualAdjustmentPluxee: 0,
    balanceRevision: BASE_REVISION,
    receivedEntries: {}
  };
  const read = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || '') || fallback; }
    catch (_) { return fallback; }
  };
  const nativeSetItem = Storage.prototype.setItem;
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

  // Instalações antigas podem continuar em saldo manual, mas as novas usam
  // lançamentos concluídos para atualizar cada conta automaticamente.
  function protectedSetItem(key, value) {
    if (this === localStorage && String(key) === CK && !window.__allowManualAccountWrite) {
      const current = read(CK, null);
      let incoming = null;
      try { incoming = JSON.parse(value); } catch (_) {}
      if (current?.manualBalance && incoming && !incoming.autoAccrual &&
          Number(incoming.balanceRevision || 0) <= Number(current.balanceRevision || 0)) {
        incoming.mp = current.mp;
        incoming.nb = current.nb;
        incoming.upd = current.upd;
        incoming.updMp = current.updMp;
        incoming.updNb = current.updNb;
        incoming.pluxee = current.pluxee;
        incoming.updPluxee = current.updPluxee;
        incoming.manualAdjustmentPluxee = current.manualAdjustmentPluxee;
        incoming.appliedPluxee = current.appliedPluxee || {};
        incoming.pluxeeReconcileV1 = current.pluxeeReconcileV1;
        incoming.manualBalance = true;
        incoming.autoAccrual = false;
        incoming.balanceRevision = current.balanceRevision;
        incoming.receivedEntries = current.receivedEntries || {};
        value = JSON.stringify(incoming);
      }
    }
    return nativeSetItem.call(this, key, value);
  }
  protectedSetItem.__agendaManualBalances = true;
  Storage.prototype.setItem = protectedSetItem;

  const currentAccounts = read(CK, null);
  if (!currentAccounts || Number(currentAccounts.balanceRevision || 0) < BASE_REVISION) {
    window.__allowManualAccountWrite = true;
    nativeSetItem.call(localStorage, CK, JSON.stringify({
      ...(currentAccounts || {}),
      ...BASE_ACCOUNTS,
      receivedEntries: currentAccounts?.receivedEntries || {}
    }));
    window.__allowManualAccountWrite = false;
  }

  const style = document.createElement('style');
  style.textContent = `
    .receive-pending-dot{width:22px;height:22px;border-radius:7px;border:1.5px solid #ff5d73;
      color:#ff5d73;display:grid;place-items:center;font-size:12px;font-weight:900;background:#ff5d7310}
    .receive-btn{margin-top:8px;padding:7px 12px;border-radius:999px!important;border:1px solid #ff5d73!important;
      background:#ff5d7314!important;color:#ff7f91!important;font-size:11px;font-weight:850;cursor:pointer}
    .receive-btn:active{transform:scale(.96)}
    .finance-pending-tag{display:inline-block;margin-left:6px;padding:2px 7px;border-radius:999px;
      background:#ff5d7320;color:#ff7f91;border:1px solid #ff5d7366;font-size:9px;font-weight:900;letter-spacing:.04em}
    .receive-layer{position:fixed;inset:0;z-index:120;display:none;align-items:center;justify-content:center;
      padding:20px;background:rgba(0,0,0,.54);backdrop-filter:blur(5px)}
    .receive-layer.open{display:flex;animation:receiveFade .2s ease both}
    .receive-panel{width:min(360px,100%);border:1px solid #3b404a;border-radius:20px;background:#18191d;
      box-shadow:0 24px 70px rgba(0,0,0,.58);padding:18px;animation:receivePop .28s cubic-bezier(.2,.8,.2,1) both}
    .receive-panel h3{margin:0;font-size:19px}.receive-panel p{margin:7px 0 15px;color:#a6acb8;font-size:12px;line-height:1.4}
    .receive-value{font-size:25px;font-weight:900;color:#78d88b;margin-bottom:14px}
    .receive-bank{width:100%;display:flex;justify-content:space-between;align-items:center;padding:12px 13px;
      margin-top:8px;border-radius:13px!important;font-weight:850;cursor:pointer}
    .receive-bank.mp{border-color:#009ee3!important;color:#77d6ff!important}.receive-bank.nb{border-color:#9b44e5!important;color:#c98cff!important}
    .receive-bank.pluxee{border-color:#69e884!important;color:#8af59e!important}
    .receive-cancel{width:100%;padding:10px;margin-top:10px;border:0!important;background:transparent!important;color:#a6acb8!important;font-weight:800}
    @keyframes receiveFade{from{opacity:0}to{opacity:1}}@keyframes receivePop{from{opacity:0;transform:scale(.9) translateY(12px)}to{opacity:1;transform:none}}
    @media(prefers-reduced-motion:reduce){.receive-layer,.receive-panel{animation:none!important}}
  `;
  document.head.appendChild(style);

  const layer = document.createElement('div');
  layer.className = 'receive-layer';
  layer.setAttribute('role', 'dialog');
  layer.setAttribute('aria-modal', 'true');
  layer.setAttribute('aria-labelledby', 'receiveTitle');
  layer.innerHTML = `
    <section class="receive-panel">
      <h3 id="receiveTitle">Marcar como recebido</h3>
      <p id="receiveTask"></p>
      <div class="receive-value" id="receiveValue"></div>
      <p>Em qual conta o dinheiro entrou?</p>
      <button type="button" class="receive-bank mp" data-receive-bank="mp"><span>Mercado Pago</span><span>MP</span></button>
      <button type="button" class="receive-bank nb" data-receive-bank="nb"><span>Nubank</span><span>Nu</span></button>
      <button type="button" class="receive-bank pluxee" data-receive-bank="pluxee"><span>Pluxee Alimentação</span><span>Pluxee</span></button>
      <button type="button" class="receive-cancel" data-receive-close>Cancelar</button>
    </section>`;
  document.body.appendChild(layer);

  let selectedId = '';
  function closeLayer() {
    layer.classList.remove('open');
    selectedId = '';
  }
  function openLayer(id) {
    const tasks = read(TK, []);
    const notes = read(NK, {});
    const task = tasks.find(item => String(item.id) === String(id));
    if (!task) return;
    const note = notes[id] || {};
    selectedId = String(id);
    layer.querySelector('#receiveTask').textContent = task.text || 'Entrada financeira';
    layer.querySelector('#receiveValue').textContent = money(num(note.valor));
    layer.classList.add('open');
  }

  function decorateEntries() {
    document.querySelectorAll('#list .row').forEach(row => {
      const meta = row.querySelector('.meta');
      if (!row.classList.contains('done') && row.querySelector('input.check:not(:checked)') &&
          meta && !meta.querySelector('.finance-pending-tag')) {
        const tag = document.createElement('span');
        tag.className = 'finance-pending-tag';
        tag.textContent = 'PENDENTE';
        meta.appendChild(tag);
      }
      const check = row.querySelector('input.check[data-i]');
      const value = row.querySelector('.value.entrada');
      if (!check || !value || row.classList.contains('done') || row.dataset.receiveReady) return;
      row.dataset.receiveReady = '1';
      const id = check.dataset.i;
      const dot = document.createElement('span');
      dot.className = 'receive-pending-dot';
      dot.textContent = '!';
      dot.setAttribute('aria-label', 'Recebimento pendente');
      check.replaceWith(dot);
      const info = row.children[1];
      if (meta && !meta.querySelector('.finance-pending-tag')) {
        const tag = document.createElement('span');
        tag.className = 'finance-pending-tag';
        tag.textContent = 'PENDENTE';
        meta.appendChild(tag);
      }
      if (info && !info.querySelector('.receive-btn')) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'receive-btn';
        button.dataset.receiveId = id;
        button.textContent = '✓ Marcar como recebido';
        info.appendChild(button);
      }
    });
  }

  function ensureNubankVisible() {
    const card = document.querySelector('.saldo-atual-card');
    if (!card || card.querySelector('.acct.nb')) return;
    const accounts = read(CK, BASE_ACCOUNTS);
    const foot = card.querySelector('.sa-foot');
    if (!foot) return;
    const row = document.createElement('div');
    row.className = 'sa-row';
    const date = String(accounts.updNb || accounts.upd || today()).split('-').reverse().join('/');
    row.innerHTML = `<span><span class="acct nb">nu</span> Nubank <small>Atualizado em ${date}</small></span><span>${money(accounts.nb)}</span>`;
    foot.before(row);
  }

  let decorationFrame = 0;
  function scheduleDecorations() {
    cancelAnimationFrame(decorationFrame);
    decorationFrame = requestAnimationFrame(() => {
      decorateEntries();
      ensureNubankVisible();
    });
  }
  new MutationObserver(scheduleDecorations).observe(document.querySelector('.app') || document.body, {
    childList: true, subtree: true
  });
  scheduleDecorations();

  function saveAccounts(accounts) {
    window.__allowManualAccountWrite = true;
    localStorage.setItem(CK, JSON.stringify(accounts));
    window.__allowManualAccountWrite = false;
  }

  // O ajuste é um delta de saldo, nunca uma alteração nos lançamentos.
  document.addEventListener('click', event => {
    if (!event.target.closest('#conedit')) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const accounts = read(CK, { ...BASE_ACCOUNTS });
    const mp = prompt('Saldo Mercado Pago (R$):', String(accounts.mp || 0));
    if (mp === null) return;
    const nb = prompt('Saldo Nubank (R$):', String(accounts.nb || 0));
    if (nb === null) return;
    const nextMp = num(mp), nextNb = num(nb);
    accounts.manualAdjustmentMp = round((accounts.manualAdjustmentMp || 0) + nextMp - (accounts.mp || 0));
    accounts.manualAdjustmentNb = round((accounts.manualAdjustmentNb || 0) + nextNb - (accounts.nb || 0));
    accounts.mp = nextMp;
    accounts.nb = nextNb;
    accounts.upd = today();
    accounts.updMp = accounts.upd;
    accounts.updNb = accounts.upd;
    accounts.manualBalance = false;
    accounts.autoAccrual = true;
    accounts.autoBalanceMode = true;
    accounts.balanceRevision = Date.now();
    saveAccounts(accounts);
    window.dispatchEvent(new CustomEvent('agenda:remote-sync', { detail: { documentKey: 'accounts' } }));
  }, true);

  document.addEventListener('click', event => {
    const receive = event.target.closest('[data-receive-id],[data-receive-open]');
    if (receive) { openLayer(receive.dataset.receiveId || receive.dataset.receiveOpen); return; }
    if (event.target.closest('[data-receive-close]') || event.target === layer) {
      closeLayer(); return;
    }
    const bankButton = event.target.closest('[data-receive-bank]');
    if (!bankButton || !selectedId) return;
    const requestedBank = bankButton.dataset.receiveBank;
    const bank = requestedBank === 'nb' || requestedBank === 'pluxee' ? requestedBank : 'mp';
    const tasks = read(TK, []);
    const notes = read(NK, {});
    const task = tasks.find(item => String(item.id) === selectedId);
    if (!task || task.done) { closeLayer(); return; }
    const note = notes[selectedId] || {};
    const value = num(note.valor);
    const accounts = read(CK, { ...BASE_ACCOUNTS });
    accounts.receivedEntries = accounts.receivedEntries || {};
    const appliedKey = bank === 'nb' ? 'appliedNb' : bank === 'pluxee' ? 'appliedPluxee' : 'applied';
    accounts[appliedKey] = accounts[appliedKey] || {};
    if (!accounts.receivedEntries[selectedId]) {
      accounts[bank] = round((accounts[bank] || 0) + value);
      accounts.receivedEntries[selectedId] = {
        bank, value, receivedAt: new Date().toISOString()
      };
    }
    // Registra o lançamento no livro automático para o reconcile não somar
    // o mesmo recebimento duas vezes na próxima sincronização.
    accounts[appliedKey][selectedId] = value;
    accounts.appliedV = 2;
    const date = today();
    accounts.upd = date;
    accounts[bank === 'nb' ? 'updNb' : bank === 'pluxee' ? 'updPluxee' : 'updMp'] = date;
    accounts.manualBalance = false;
    accounts.autoAccrual = true;
    accounts.autoBalanceMode = true;
    accounts.balanceRevision = Date.now();
    task.done = true;
    task.syncRev = Date.now();
    note.movimento = 'entrada';
    note.conta = bank;
    note.recebidoEm = new Date().toISOString();
    notes[selectedId] = note;
    window.__allowManualAccountWrite = true;
    localStorage.setItem(TK, JSON.stringify(tasks));
    localStorage.setItem(NK, JSON.stringify(notes));
    localStorage.setItem(CK, JSON.stringify(accounts));
    window.__allowManualAccountWrite = false;
    closeLayer();
    window.dispatchEvent(new CustomEvent('agenda:remote-sync', {
      detail: { documentKey: 'all' }
    }));
  });
})();
