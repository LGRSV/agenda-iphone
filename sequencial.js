/* sequencial.js — Modo Sequencial: rotina do dia em ordem cronológica, com
   cronômetro de sessão, relógio em tempo real e XP ao concluir cada tarefa.
   Ativado pelo ícone de cronômetro ao lado do menu principal, ou pelo atalho
   que aparece logo abaixo do seletor Dia/Mês/Lista. Script autônomo — não
   depende de nenhum outro enhancement script para funcionar. */
(() => {
  'use strict';

  const TASK_KEY = 'agenda_lagares_v3';
  const STYLE_ID = 'seqModeStyles';

  // Mesma tabela de XP usada em gamificacao.js — mantenha os dois em sincronia.
  const XP_TAGS = { trabalho: 25, faculdade: 30, saude: 20, financeiro: 15, pessoal: 10, casa: 10, outros: 10 };
  const XP_BONUS = [
    [50, t => t.includes('jarvis')],
    [40, t => t.includes('vera')],
    [35, t => t.includes('equipamento especial')]
  ];
  const TAG_LABELS = { trabalho: 'Trabalho', faculdade: 'Faculdade', saude: 'Saúde', financeiro: 'Financeiro', pessoal: 'Pessoal', casa: 'Casa', outros: 'Outros' };

  const xpFor = task => {
    const text = String(task.text || '').toLowerCase();
    for (const [xp, test] of XP_BONUS) if (test(text)) return xp;
    return XP_TAGS[task.tag] || 10;
  };

  const CLOCK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8.5"/><path d="M12 9v4l3 2M9 2h6"/></svg>';
  const CHECK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg>';
  const STAR_SVG = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></svg>';

  const esc = s => String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const readTasks = () => {
    try { const v = JSON.parse(localStorage.getItem(TASK_KEY)); return Array.isArray(v) ? v : []; }
    catch (_) { return []; }
  };
  const readNotes = () => {
    try { const v = JSON.parse(localStorage.getItem('agenda_notas_v1')); return v && typeof v === 'object' ? v : {}; }
    catch (_) { return {}; }
  };
  const isFinRecord = (task, notes) => {
    if (!task || task.tag !== 'financeiro') return false;
    const n = notes[String(task.id)] || notes[task.id];
    return !!(n && n.movimento === 'saida');
  };
  const todayStr = () => { const n = new Date(); return new Date(n.getTime() - n.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const pad = n => String(n).padStart(2, '0');

  let sessionStart = null;
  let tickId = null;
  let sessionXp = 0;

  const ensureStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #seqTimerBtn{position:relative}
      #seqTimerBtn svg{width:20px;height:20px}
      #seqTimerBtn.seq-running{color:var(--accent);border-color:var(--accent)}
      #seqTimerBtn .seq-dot{position:absolute;top:6px;right:6px;width:7px;height:7px;border-radius:50%;background:var(--accent);opacity:0;transition:opacity .2s ease}
      #seqTimerBtn.seq-running .seq-dot{opacity:1;animation:seqPulseDot 1.4s ease-in-out infinite}
      @keyframes seqPulseDot{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.6);opacity:.4}}

      .seq-entry-btn{display:flex;align-items:center;gap:8px;width:100%;margin:0 0 14px;padding:11px 14px;border:1px dashed var(--accent);border-radius:14px;background:color-mix(in srgb,var(--accent) 8%,var(--surface));color:var(--accent);font-size:12.5px;font-weight:800;transition:transform .14s ease}
      .seq-entry-btn svg{width:16px;height:16px;flex:0 0 auto}
      .seq-entry-btn:active{transform:scale(.98)}

      #seqDialog{width:min(calc(100% - 20px),520px);max-height:calc(100dvh - 28px)}
      #seqDialog .seq-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:18px 18px 12px;border-bottom:1px solid var(--line)}
      #seqDialog .seq-eyebrow{display:block;color:var(--accent);font-size:11px;font-weight:800;letter-spacing:.1em;text-transform:uppercase}
      #seqDialog .seq-clock-row{display:flex;align-items:baseline;gap:14px;margin-top:4px;flex-wrap:wrap}
      #seqDialog .seq-clock{font-size:26px;font-weight:800;letter-spacing:-.03em}
      #seqDialog .seq-stopwatch{color:var(--muted);font-size:13px;font-weight:750}
      #seqDialog .seq-close{border:0;background:transparent;color:var(--muted);font-size:22px;line-height:1;padding:4px}
      #seqDialog .seq-progress-wrap{padding:14px 18px 4px}
      #seqDialog .seq-progress{height:10px;border-radius:999px;background:var(--soft2);overflow:hidden}
      #seqDialog .seq-progress>i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--accent2),var(--accent));transition:width .35s ease}
      #seqDialog .seq-progress-label{display:flex;justify-content:space-between;gap:10px;margin-top:7px;color:var(--muted);font-size:11px;font-weight:750}
      #seqDialog .seq-body{padding:8px 12px 20px;overflow-y:auto}
      #seqDialog .seq-empty{padding:44px 18px;text-align:center;color:var(--muted);font-size:13px}
      #seqDialog .seq-empty strong{display:block;margin-bottom:6px;color:var(--text);font-size:16px}
      .seq-timeline{position:relative;padding-left:20px}
      .seq-timeline:before{content:"";position:absolute;left:5px;top:6px;bottom:6px;width:2px;background:var(--line);border-radius:2px}
      .seq-item{position:relative;display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:12px;margin-bottom:8px;border:1px solid var(--line);border-radius:16px;background:var(--surface);animation:seqItemIn .28s ease both;transition:opacity .25s ease,transform .25s ease,border-color .2s ease,box-shadow .2s ease}
      @keyframes seqItemIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
      .seq-item:before{content:"";position:absolute;left:-19px;top:18px;width:9px;height:9px;border-radius:50%;background:var(--line);border:2px solid var(--bg)}
      .seq-item.seq-current{border-color:var(--accent);box-shadow:0 0 0 1px color-mix(in srgb,var(--accent) 55%,transparent),0 10px 26px rgba(0,0,0,.28)}
      .seq-item.seq-current:before{background:var(--accent)}
      .seq-item.seq-done{opacity:.55}
      .seq-item.seq-done:before{background:#78d88b}
      .seq-item-main{min-width:0}
      .seq-item-time{display:block;color:var(--accent);font-size:11px;font-weight:850;letter-spacing:.03em}
      .seq-item-title{display:block;margin-top:2px;font-size:14px;font-weight:700;overflow-wrap:anywhere}
      .seq-item.seq-done .seq-item-title{text-decoration:line-through;color:var(--faint)}
      .seq-item-tag{display:block;margin-top:4px;color:var(--muted);font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.04em}
      .seq-btn-done{width:40px;height:40px;flex:0 0 auto;border:1.5px solid var(--line);border-radius:50%;background:var(--soft);color:var(--muted);display:grid;place-items:center;transition:transform .14s ease,border-color .14s ease,background .14s ease,color .14s ease}
      .seq-btn-done svg{width:18px;height:18px}
      .seq-btn-done:active{transform:scale(.9)}
      .seq-item.seq-done .seq-btn-done{border-color:#78d88b;background:#78d88b;color:#06210f}
      .seq-finish{margin:6px 4px 0;padding:20px 16px;text-align:center;border:1px dashed var(--accent);border-radius:18px;background:color-mix(in srgb,var(--accent) 10%,var(--surface));color:var(--text);font-size:13px;font-weight:650}
      .seq-finish b{display:block;font-size:17px;color:var(--accent);margin-bottom:4px}
      .seq-xp-toast{position:fixed;left:50%;bottom:calc(92px + env(safe-area-inset-bottom));transform:translateX(-50%) translateY(14px);background:var(--surface);border:1px solid var(--accent);color:var(--text);border-radius:999px;padding:9px 18px;font-size:14px;font-weight:850;z-index:99999;opacity:0;transition:all .25s ease;box-shadow:0 10px 26px rgba(0,0,0,.35);display:flex;align-items:center;gap:8px;pointer-events:none}
      .seq-xp-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
      .seq-xp-toast svg{width:16px;height:16px;color:var(--accent)}
      @media(prefers-reduced-motion:reduce){.seq-item,.seq-xp-toast{transition:none;animation:none}}
    `;
    document.head.appendChild(style);
  };

  const updateProgress = (done, total) => {
    const bar = document.getElementById('seqProgressBar');
    const label = document.getElementById('seqProgressLabel');
    if (!bar || !label) return;
    const pct = total ? Math.round(done / total * 100) : 0;
    bar.style.width = pct + '%';
    label.textContent = total ? `${done} de ${total} concluídas` : 'Nada agendado para hoje';
  };

  const updateXpLabel = () => {
    const el = document.getElementById('seqXpLabel');
    if (el) el.textContent = `+${sessionXp} XP na sessão`;
  };

  const itemHtml = (task, isCurrent) => {
    const xp = xpFor(task);
    const tagLabel = TAG_LABELS[task.tag] || 'Outros';
    const time = /^\d{2}:\d{2}$/.test(task.time || '') ? task.time : 'sem horário';
    return `<div class="seq-item ${task.done ? 'seq-done' : ''} ${isCurrent ? 'seq-current' : ''}" data-id="${esc(task.id)}">
      <div class="seq-item-main">
        <span class="seq-item-time">${time}</span>
        <span class="seq-item-title">${esc(task.text)}</span>
        <span class="seq-item-tag">${tagLabel} · +${xp} XP</span>
      </div>
      <button type="button" class="seq-btn-done" data-action="seq-complete" data-id="${esc(task.id)}" ${task.done ? 'disabled' : ''} aria-label="Concluir tarefa">${CHECK_SVG}</button>
    </div>`;
  };

  const render = () => {
    const dialog = document.getElementById('seqDialog');
    const body = dialog && dialog.querySelector('.seq-body');
    if (!body) return;
    const notes = readNotes();
    const today = todayStr();
    const items = readTasks()
      .filter(t => t && t.text && t.date === today && !isFinRecord(t, notes))
      .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99') || Number(a.done) - Number(b.done));

    if (!items.length) {
      body.innerHTML = '<div class="seq-empty"><strong>Nada agendado para hoje</strong>Adicione tarefas com horário na agenda para montar sua sequência.</div>';
      updateProgress(0, 0);
      return;
    }

    const doneCount = items.filter(t => t.done).length;
    updateProgress(doneCount, items.length);
    const firstPendingIdx = items.findIndex(t => !t.done);
    const timeline = items.map((t, i) => itemHtml(t, i === firstPendingIdx)).join('');
    const finish = doneCount === items.length
      ? `<div class="seq-finish"><b>Sequência concluída</b>Todas as tarefas de hoje foram feitas — +${sessionXp} XP nesta sessão.</div>`
      : '';
    body.innerHTML = `<div class="seq-timeline">${timeline}</div>${finish}`;
  };

  const xpToast = amount => {
    document.querySelectorAll('.seq-xp-toast').forEach(n => n.remove());
    const toast = document.createElement('div');
    toast.className = 'seq-xp-toast';
    toast.innerHTML = `${STAR_SVG}+${amount} XP`;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 260); }, 1100);
  };

  const onBodyClick = event => {
    const btn = event.target.closest('[data-action="seq-complete"]');
    if (!btn || btn.disabled) return;
    const id = btn.dataset.id;
    const task = readTasks().find(t => String(t.id) === String(id));
    if (!task) return;
    const xp = xpFor(task);
    const ok = window.AgendaAPI && typeof window.AgendaAPI.completeById === 'function' && window.AgendaAPI.completeById(id);
    if (!ok) return;
    sessionXp += xp;
    updateXpLabel();
    xpToast(xp);
    btn.disabled = true;
    setTimeout(render, 240);
  };

  const tick = () => {
    const clockEl = document.getElementById('seqClock');
    if (clockEl) clockEl.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (!sessionStart) return;
    const s = Math.floor((Date.now() - sessionStart) / 1000);
    const label = `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
    const swEl = document.getElementById('seqStopwatch');
    if (swEl) swEl.textContent = `sessão ${label}`;
    const btn = document.getElementById('seqTimerBtn');
    if (btn) btn.title = `Modo sequencial ativo · ${label}`;
  };

  const startSession = () => {
    sessionStart = Date.now();
    sessionXp = 0;
    updateXpLabel();
    tick();
    clearInterval(tickId);
    tickId = setInterval(tick, 1000);
    const btn = document.getElementById('seqTimerBtn');
    if (btn) btn.classList.add('seq-running');
  };

  const stopSession = () => {
    clearInterval(tickId);
    tickId = null;
    sessionStart = null;
    const btn = document.getElementById('seqTimerBtn');
    if (btn) { btn.classList.remove('seq-running'); btn.title = 'Modo sequencial'; }
  };

  const ensureDialog = () => {
    let dialog = document.getElementById('seqDialog');
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.id = 'seqDialog';
    dialog.innerHTML = `
      <div class="seq-head">
        <div>
          <span class="seq-eyebrow">Modo sequencial</span>
          <div class="seq-clock-row"><span class="seq-clock" id="seqClock">--:--:--</span><span class="seq-stopwatch" id="seqStopwatch">sessão 00:00</span></div>
        </div>
        <button type="button" class="seq-close" id="seqCloseBtn" aria-label="Fechar">&times;</button>
      </div>
      <div class="seq-progress-wrap">
        <div class="seq-progress"><i id="seqProgressBar" style="width:0%"></i></div>
        <div class="seq-progress-label"><span id="seqProgressLabel">0 de 0 concluídas</span><span id="seqXpLabel">+0 XP na sessão</span></div>
      </div>
      <div class="seq-body"></div>`;
    document.body.appendChild(dialog);
    dialog.querySelector('#seqCloseBtn').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.addEventListener('close', stopSession);
    dialog.querySelector('.seq-body').addEventListener('click', onBodyClick);
    return dialog;
  };

  const openSequential = () => {
    const dialog = ensureDialog();
    if (dialog.open) return;
    render();
    dialog.showModal();
    startSession();
  };

  const ensureButton = () => {
    if (document.getElementById('seqTimerBtn')) return;
    const actions = document.querySelector('.head-actions');
    if (!actions) return;
    const btn = document.createElement('button');
    btn.id = 'seqTimerBtn';
    btn.type = 'button';
    btn.className = 'icon-btn';
    btn.title = 'Modo sequencial';
    btn.setAttribute('aria-label', 'Ativar modo sequencial');
    btn.innerHTML = CLOCK_SVG + '<span class="seq-dot"></span>';
    const moreBtn = document.getElementById('moreMenuBtn');
    if (moreBtn) actions.insertBefore(btn, moreBtn); else actions.appendChild(btn);
    btn.addEventListener('click', openSequential);
  };

  const ensureEntry = () => {
    if (document.getElementById('seqEntryBtn')) return;
    const tabs = document.getElementById('viewTabs');
    if (!tabs || !tabs.parentNode) return;
    const btn = document.createElement('button');
    btn.id = 'seqEntryBtn';
    btn.type = 'button';
    btn.className = 'seq-entry-btn';
    btn.innerHTML = `${CLOCK_SVG}<span>Modo sequencial · rotina gamificada</span>`;
    tabs.parentNode.insertBefore(btn, tabs.nextSibling);
    btn.addEventListener('click', openSequential);
  };

  const install = () => {
    ensureStyles();
    ensureButton();
    ensureEntry();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  new MutationObserver(install).observe(document.documentElement, { childList: true, subtree: true });
})();
