/* =========================================================================
   desktop.js — visual de computador + "Instalar no computador".
   1) Com janela larga e mouse (a mesma media do desktop.css), junta
      cabeçalho, progresso, abas e filtros numa lateral (<aside class="dk-side">)
      e escreve as tarefas dentro das células do mês. Os elementos só mudam
      de pai: ids e eventos continuam os mesmos. Abaixo disso desfaz tudo.
   2) Item "Instalar no computador" no menu ⋯. Com o beforeinstallprompt, abre a
      instalação do navegador; sem ele (Chrome já com atalho, Edge, diálogo recusado),
      no computador mostra o passo a passo. Some dentro da janela do app instalado.
      No celular só aparece quando o navegador oferece a instalação (como antes).
   Lê as tarefas do localStorage, como o calendario-cheio.js; não toca no núcleo.
   ========================================================================= */
(() => {
  'use strict';
  const doc = document;
  const $ = id => doc.getElementById(id);
  const MQ = window.matchMedia ? window.matchMedia('(min-width:1100px) and (hover:hover) and (pointer:fine)') : null;
  const isDesk = () => !!(MQ && MQ.matches);

  /* ---------------- 1. Layout de desktop ---------------- */
  const app = doc.querySelector('main.app');
  let side = null;

  function wrap() {
    if (!app || side) return;
    const content = $('viewContent');
    if (!content || content.parentNode !== app) return;
    side = doc.createElement('aside');
    side.className = 'dk-side';
    side.setAttribute('aria-label', 'Resumo e navegação');
    // tudo o que vem antes do conteúdo (cabeçalho, progresso, abas, filtros e o que outros scripts puseram ali)
    const items = [];
    for (let n = app.firstChild; n && n !== content; n = n.nextSibling) items.push(n);
    app.insertBefore(side, content);
    items.forEach(n => side.appendChild(n));
    doc.documentElement.classList.add('dk-desktop');
  }

  function unwrap() {
    if (!side) return;
    while (side.firstChild) app.insertBefore(side.firstChild, side);
    side.remove();
    side = null;
    doc.documentElement.classList.remove('dk-desktop');
    doc.querySelectorAll('.dk-cal-list,.dk-month-nav').forEach(n => n.remove());
    doc.querySelectorAll('.calendar-day.dk-filled').forEach(n => n.classList.remove('dk-filled'));
  }

  // --- tarefas escritas nas células do mês ---
  const TAGS = { trabalho: '#4db6f4', pessoal: '#bb86fc', casa: '#71d6be', faculdade: '#ffb74d', saude: '#78d88b', financeiro: '#ff7f91', outros: '#aab3c2' };
  const tagKey = v => {
    v = String(v || '').trim().toLowerCase();
    if (TAGS[v]) return v;
    if (/work|trabalho|energisa/.test(v)) return 'trabalho';
    if (/casa|home/.test(v)) return 'casa';
    if (/faculdade|college|estudo/.test(v)) return 'faculdade';
    if (/academia|saúde|saude|health/.test(v)) return 'saude';
    if (/finance|dinheiro/.test(v)) return 'financeiro';
    if (/pessoal|personal/.test(v)) return 'pessoal';
    return 'outros';
  };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pd = n => String(n).padStart(2, '0');
  const todayIso = () => { const d = new Date(); return d.getFullYear() + '-' + pd(d.getMonth() + 1) + '-' + pd(d.getDate()); };
  const readJson = (k, def) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? def : v; } catch (_) { return def; } };

  // mesmo critério do matches() do index.html
  function filterFn() {
    const chip = doc.querySelector('#filters .chip.active');
    const f = chip ? chip.dataset.filter : 'all';
    const hoje = todayIso();
    const lembrete = t => t && t.kind === 'lembrete';
    const expediente = t => {
      if (!t.time || !t.date) return false;
      const g = new Date(t.date + 'T12:00:00').getDay();
      if (g < 1 || g > 5) return false;
      return (t.time >= '07:30' && t.time <= '11:30') || (t.time >= '13:30' && t.time <= '17:30');
    };
    return t => {
      if (f === 'work') return tagKey(t.tag) === 'trabalho' || expediente(t);
      if (f === 'late') return !t.done && !lembrete(t) && !!t.date && t.date < hoje;
      if (f === 'all') return true;
      return f === 'open' ? !t.done : !!t.done;
    };
  }

  function byDate() {
    const list = readJson('agenda_lagares_v3', []);
    const notes = readJson('agenda_notas_v1', {}) || {};
    const ok = filterFn();
    const map = {};
    if (!Array.isArray(list)) return map;
    list.forEach(t => {
      if (!t || !t.text || !/^\d{4}-\d{2}-\d{2}$/.test(String(t.date || ''))) return;
      const note = notes[String(t.id)];
      if (tagKey(t.tag) === 'financeiro' && note && note.movimento === 'saida') return; // saída manual do financeiro não aparece na agenda
      if (!ok(t)) return;
      (map[t.date] = map[t.date] || []).push(t);
    });
    Object.values(map).forEach(a => a.sort((x, y) => (x.time || '99:99').localeCompare(y.time || '99:99') || Number(!!x.done) - Number(!!y.done) || String(x.text).localeCompare(String(y.text))));
    return map;
  }

  function fillMonth() {
    if (!side) return;
    const grid = doc.querySelector('#viewContent .month-grid');
    if (!grid) return;
    addMonthNav();
    const cells = grid.querySelectorAll('.calendar-day[data-calendar-date]');
    if (!cells.length) return;
    // linhas que cabem na célula: a altura vem do --dk-cell do desktop.css (min-height já calculado);
    // cabeçalho da célula ~40px, cada linha 20px
    const cellH = parseFloat(getComputedStyle(cells[0]).minHeight) || Math.max(78, (window.innerHeight - 260) / 6);
    const max = Math.max(2, Math.min(6, Math.floor((cellH - 40) / 20)));
    const map = byDate();
    const hoje = todayIso();
    cells.forEach(cell => {
      const items = map[cell.dataset.calendarDate] || [];
      const old = cell.querySelector('.dk-cal-list');
      // sem tarefas no armazenamento para o dia: fica o visual original do núcleo
      if (!items.length) { if (old) old.remove(); cell.classList.remove('dk-filled'); return; }
      const shown = items.length > max ? items.slice(0, max - 1) : items;
      const rest = items.length - shown.length;
      const html = shown.map(t => {
        const late = !t.done && t.kind !== 'lembrete' && t.date < hoje;
        return `<span class="dk-ev${t.done ? ' dk-done' : ''}${late ? ' dk-late' : ''}" style="--tag:${TAGS[tagKey(t.tag)]}" title="${esc((t.time ? t.time + ' · ' : '') + t.text)}">${t.time ? `<b>${esc(t.time)}</b>` : ''}<span>${esc(t.text)}</span></span>`;
      }).join('') + (rest > 0 ? `<span class="dk-more">+${rest} mais</span>` : '');
      // igual ao que já está lá: não mexe (evita laço com o observador)
      if (old && old.dataset.dkSig === html && cell.classList.contains('dk-filled')) return;
      if (old) old.remove();
      const box = doc.createElement('span');
      box.className = 'dk-cal-list';
      box.dataset.dkSig = html;
      box.innerHTML = html;
      cell.appendChild(box);
      cell.classList.add('dk-filled');
    });
  }

  // setas de mês para o mouse: usam o mesmo caminho do gesto (roda horizontal), sem mexer no núcleo
  function shiftMonth(dir) {
    const surface = doc.querySelector('#viewContent .month-swipe-surface');
    if (!surface) return;
    let ev;
    try { ev = new WheelEvent('wheel', { deltaX: dir * 120, deltaY: 0, bubbles: true, cancelable: true }); }
    catch (_) { return; }
    surface.dispatchEvent(ev);
  }

  function addMonthNav() {
    const bar = doc.querySelector('#viewContent .month-toolbar');
    if (!bar || bar.querySelector('.dk-month-nav')) return;
    const nav = doc.createElement('div');
    nav.className = 'dk-month-nav';
    nav.innerHTML = '<button class="nav-btn" type="button" data-dk-month="-1" aria-label="Mês anterior" title="Mês anterior (←)">‹</button>' +
      '<button class="nav-btn" type="button" data-dk-month="1" aria-label="Próximo mês" title="Próximo mês (→)">›</button>';
    nav.addEventListener('click', e => {
      const b = e.target.closest('[data-dk-month]');
      if (!b) return;
      e.preventDefault(); e.stopPropagation();
      shiftMonth(Number(b.dataset.dkMonth));
    });
    // não deixa o clique virar "arrastar mês" no pointerdown do núcleo
    nav.addEventListener('pointerdown', e => e.stopPropagation());
    bar.appendChild(nav);
  }

  // ← → trocam o mês quando nada de texto/janela está em foco
  doc.addEventListener('keydown', e => {
    if (!side || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    const a = doc.activeElement;
    if (a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable)) return;
    if (doc.querySelector('dialog[open]') || $('calFull')) return;
    if (!doc.querySelector('#viewContent .month-swipe-surface')) return;
    e.preventDefault();
    shiftMonth(e.key === 'ArrowLeft' ? -1 : 1);
  });

  let pend = 0;
  const schedule = () => { clearTimeout(pend); pend = setTimeout(fillMonth, 0); };

  function apply() {
    if (isDesk()) { wrap(); schedule(); } else unwrap();
  }

  if (app) {
    apply();
    if (MQ) {
      if (MQ.addEventListener) MQ.addEventListener('change', apply);
      else if (MQ.addListener) MQ.addListener(apply);
    }
    const content = $('viewContent');
    // subtree: outros scripts também redesenham partes do mês; o que nós mesmos inserimos é ignorado
    const ours = n => n.nodeType === 1 && (n.classList.contains('dk-cal-list') || n.classList.contains('dk-month-nav') || !!(n.closest && n.closest('.dk-cal-list')));
    if (content) new MutationObserver(list => {
      if (!side) return;
      const onlyOurs = list.every(m => { const n = [...m.addedNodes, ...m.removedNodes]; return n.length > 0 && n.every(ours); });
      if (!onlyOurs) schedule();
    }).observe(content, { childList: true, subtree: true });
    const filters = $('filters');
    if (filters) filters.addEventListener('click', () => { if (side) setTimeout(schedule, 30); });
    let rz = 0;
    window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => { if (side) fillMonth(); }, 150); });
    window.addEventListener('storage', e => { if (side && e.key && /agenda_lagares_v3|agenda_notas_v1/.test(e.key)) schedule(); });
  }

  /* ---------------- 2. Instalar no computador (PWA) ---------------- */
  // janela do app instalado (ou "Abrir como janela"): não há o que instalar
  const standalone = () => navigator.standalone === true ||
    !!(window.matchMedia && ['standalone', 'window-controls-overlay', 'minimal-ui', 'fullscreen'].some(m => window.matchMedia('(display-mode: ' + m + ')').matches));
  const fino = () => !!(window.matchMedia && window.matchMedia('(hover:hover) and (pointer:fine)').matches);
  let offer = null;
  const BTN_ID = 'instalarAppBtn';
  const ICON = '<svg viewBox="0 0 24 24"><path d="M3 5h18v11H3z"/><path d="M8 20h8"/><path d="M12 16v4"/><path d="M12 7.5v5.5"/><path d="m9.5 10.5 2.5 2.5 2.5-2.5"/></svg>';

  function removeInstall() { const b = $(BTN_ID); if (b) b.remove(); }

  // passo a passo quando o navegador não oferece o botão de instalar
  function ajuda() {
    let d = $('instalarAjuda');
    if (!d) {
      d = doc.createElement('dialog');
      d.id = 'instalarAjuda';
      d.setAttribute('aria-labelledby', 'instalarAjudaTitulo');
      const li = 'margin:0 0 7px';
      d.innerHTML = '<section class="modal"><h3 id="instalarAjudaTitulo">Instalar no computador</h3>' +
        '<p>A Agenda vira um aplicativo com janela própria e atalho no menu Iniciar e na barra de tarefas. Ela abre já com a sua conta: o login é o mesmo deste navegador.</p>' +
        '<ol style="margin:14px 0 0;padding-left:20px;color:var(--text);font-size:13px;line-height:1.45">' +
        '<li style="' + li + '"><b>Chrome:</b> clique no ícone de instalar no fim da barra de endereço (um monitor com seta) ou abra o menu <b>⋮</b> &gt; <b>Transmitir, salvar e compartilhar</b> &gt; <b>Instalar página como app</b>.</li>' +
        '<li style="' + li + '"><b>Edge:</b> menu <b>⋯</b> &gt; <b>Aplicativos</b> &gt; <b>Instalar este site como aplicativo</b>.</li>' +
        '<li style="margin:0">Se ela já estiver instalada, abra pelo atalho da Agenda (no Chrome, também em <b>chrome://apps</b>).</li></ol>' +
        '<div class="actions"><button class="secondary" type="button" data-fechar>Entendi</button></div></section>';
      d.addEventListener('click', e => { if (e.target === d || (e.target.closest && e.target.closest('[data-fechar]'))) d.close(); });
      doc.body.appendChild(d);
    }
    try { d.showModal(); } catch (_) { d.setAttribute('open', ''); }
  }

  function showInstall() {
    // no celular, só com a oferta do navegador (comportamento de antes); no computador, sempre, fora da janela do app
    if (standalone() || (!offer && !fino())) { removeInstall(); return; }
    const menu = $('quickMenu');
    if (!menu || $(BTN_ID)) return;
    const b = doc.createElement('button');
    b.id = BTN_ID;
    b.type = 'button';
    b.title = 'Instalar a Agenda como aplicativo (abre em janela própria, já com a sua conta)';
    b.innerHTML = '<span class="menu-option-icon">' + ICON + '</span><span>' + (fino() ? 'Instalar no computador' : 'Instalar como app') + '</span>';
    const ref = $('telaInicioBtn');
    if (ref && ref.parentNode === menu) menu.insertBefore(b, ref.nextSibling);
    else menu.appendChild(b);
    b.addEventListener('click', async () => {
      const ev = offer;
      if (!ev) { ajuda(); return; }
      offer = null; // o prompt() só pode ser chamado uma vez por evento
      let ok = false;
      try {
        await ev.prompt();
        const choice = ev.userChoice ? await ev.userChoice : null;
        ok = !!(choice && choice.outcome === 'accepted');
      } catch (_) {}
      // recusou: no computador o item fica (o próximo clique mostra o passo a passo ou a nova oferta do navegador)
      if (ok || !fino()) removeInstall();
    });
  }

  // 17/11: balão automático "Instalar a Agenda neste computador?" (só no computador, fora do app instalado e quando o
  // navegador oferece a instalação). "Agora não" esconde por 7 dias; recusar o diálogo do navegador também.
  const BALAO_KEY = 'agenda_instalar_balao_ate';
  function balaoLiberado() { try { return Date.now() > Number(localStorage.getItem(BALAO_KEY) || 0); } catch (_) { return true; } }
  function adiarBalao(dias) { try { localStorage.setItem(BALAO_KEY, String(Date.now() + dias * 864e5)); } catch (_) {} }
  function fecharBalao() { const x = $('instalarBalao'); if (x) x.remove(); }
  function mostrarBalao() {
    if (!offer || !fino() || standalone() || !balaoLiberado() || $('instalarBalao') || !doc.body) return;
    const box = doc.createElement('div');
    box.id = 'instalarBalao';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', 'Instalar a Agenda neste computador');
    box.style.cssText = 'position:fixed;z-index:70;left:50%;bottom:24px;transform:translateX(-50%);width:min(460px,calc(100vw - 32px));' +
      'display:flex;gap:12px;align-items:center;padding:14px 16px;border:1px solid var(--line);border-radius:18px;' +
      'background:var(--surface);color:var(--text);box-shadow:0 18px 50px rgba(0,0,0,.45)';
    box.innerHTML = '<span class="menu-option-icon" style="flex:0 0 28px;width:28px;height:28px">' + ICON + '</span>' +
      '<div style="flex:1;min-width:0"><strong style="display:block;font-size:14px">Instalar a Agenda neste computador?</strong>' +
      '<span style="display:block;margin-top:2px;color:var(--muted);font-size:12px;line-height:1.35">Abre em janela própria, com atalho na barra de tarefas, e já entra logada.</span></div>' +
      '<div style="display:flex;gap:6px;flex:0 0 auto">' +
      '<button class="secondary" type="button" data-depois style="min-height:36px;padding:6px 10px;font-size:12px">Agora não</button>' +
      '<button class="primary" type="button" data-instalar style="min-height:36px;padding:6px 12px;font-size:12px">Instalar</button></div>';
    box.querySelector('[data-depois]').addEventListener('click', () => { adiarBalao(7); fecharBalao(); });
    box.querySelector('[data-instalar]').addEventListener('click', async () => {
      fecharBalao();
      const ev = offer;
      if (!ev) { ajuda(); return; }
      offer = null; // o prompt() só pode ser chamado uma vez por evento
      try {
        await ev.prompt();
        const c = ev.userChoice ? await ev.userChoice : null;
        if (c && c.outcome === 'accepted') removeInstall(); else adiarBalao(7);
      } catch (_) {}
    });
    doc.body.appendChild(box);
  }

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); // sem a mini-barra do navegador: a oferta vira o balão abaixo e o item do menu ⋯
    offer = e;
    showInstall();
    setTimeout(mostrarBalao, 2500);
  });
  window.addEventListener('appinstalled', () => { offer = null; removeInstall(); fecharBalao(); });
  showInstall();
  // o menu pode ser remontado por outros scripts: confere ao abrir
  doc.addEventListener('click', e => { if (e.target && e.target.closest && e.target.closest('#moreMenuBtn')) setTimeout(showInstall, 0); }, true);
})();
