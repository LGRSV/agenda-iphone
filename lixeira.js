/* =========================================================================
   lixeira.js — tarefas apagadas (ver / restaurar / apagar de vez).
   Botão de lixeira (contorno azul) na barra superior, visível só quando há
   algo apagado. As tarefas removidas ficam guardadas em agenda_lixeira_v1
   (o core grava lá ao excluir). Restaurar devolve a tarefa à agenda com a
   mesma id — as anotações/subtarefas voltam junto. Enhancement autossuficiente.
   ========================================================================= */
(() => {
  'use strict';

  const TASK_KEY = 'agenda_lagares_v3';
  const TRASH_KEY = 'agenda_lixeira_v1';
  const DIALOG_ID = 'lixDialog';
  const STYLE_ID = 'lixStyles';
  const KEEP_DAYS = 30; // apaga sozinho depois disso
  const TAGS = {
    trabalho: { label: 'Trabalho', color: '#4db6f4' }, pessoal: { label: 'Pessoal', color: '#bb86fc' },
    casa: { label: 'Casa', color: '#71d6be' }, faculdade: { label: 'Faculdade', color: '#ffb74d' },
    saude: { label: 'Academia', color: '#78d88b' }, financeiro: { label: 'Financeiro', color: '#ff7f91' },
    outros: { label: 'Outros', color: '#aab3c2' }
  };

  const esc = v => { const d = document.createElement('div'); d.textContent = v == null ? '' : v; return d.innerHTML; };
  const readTrash = () => { try { const v = JSON.parse(localStorage.getItem(TRASH_KEY)); return Array.isArray(v) ? v : []; } catch (_) { return []; } };
  const writeTrash = a => { try { localStorage.setItem(TRASH_KEY, JSON.stringify(a)); } catch (_) {} };
  const readTasks = () => { try { const v = JSON.parse(localStorage.getItem(TASK_KEY)); return Array.isArray(v) ? v : []; } catch (_) { return []; } };
  const tagKey = t => (TAGS[t] ? t : 'outros');
  const shortDate = d => { const p = String(d || '').split('-'); return p.length === 3 ? `${p[2]}/${p[1]}` : ''; };
  function ago(ts) {
    const diff = Date.now() - (ts || 0), min = Math.round(diff / 60000);
    if (min < 1) return 'agora'; if (min < 60) return `há ${min} min`;
    const h = Math.round(min / 60); if (h < 24) return `há ${h} h`;
    const d = Math.round(h / 24); return `há ${d} dia${d > 1 ? 's' : ''}`;
  }

  function purgeOld() {
    const cut = Date.now() - KEEP_DAYS * 86400000;
    const arr = readTrash(), kept = arr.filter(e => (e.at || 0) >= cut);
    if (kept.length !== arr.length) writeTrash(kept);
    return kept;
  }

  // ---- estilos ---------------------------------------------------------
  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #lixBtn{color:var(--accent);border-color:color-mix(in srgb,var(--accent) 45%,var(--line))}
      #lixBtn[hidden]{display:none}
      #lixBtn:active{transform:scale(.94)}
      #${DIALOG_ID}{width:min(calc(100% - 28px),480px);max-height:calc(100dvh - 28px);padding:0;border:1px solid var(--line);border-radius:24px;background:var(--surface);color:var(--text);box-shadow:0 30px 90px rgba(0,0,0,.56)}
      #${DIALOG_ID}::backdrop{background:rgba(0,0,0,.6);backdrop-filter:blur(4px)}
      .lix-wrap{display:flex;flex-direction:column;max-height:calc(100dvh - 28px)}
      .lix-head{position:sticky;top:0;z-index:2;padding:18px 18px 14px;border-bottom:1px solid var(--line);background:linear-gradient(135deg,var(--surface),var(--soft))}
      .lix-eyebrow{display:block;color:var(--accent);font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;margin-bottom:5px}
      .lix-head h3{margin:0;font-size:23px;letter-spacing:-.04em}
      .lix-sub{margin:5px 0 0;color:var(--muted);font-size:13px}
      .lix-close{position:absolute;top:14px;right:14px;width:34px;height:34px;border:1px solid var(--line);border-radius:11px;background:var(--surface);color:var(--text);font-size:19px;line-height:1;display:grid;place-items:center}
      .lix-body{overflow-y:auto;padding:12px 14px 6px}
      .lix-item{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:center;padding:12px 4px;border-top:1px solid var(--line)}
      .lix-item:first-child{border-top:0}
      .lix-t{font-size:14px;font-weight:650;line-height:1.35;overflow-wrap:anywhere}
      .lix-meta{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin-top:5px}
      .lix-pill{display:inline-flex;align-items:center;gap:5px;padding:3px 7px 3px 6px;border:1px solid color-mix(in srgb,var(--c) 44%,var(--line));border-radius:999px;background:color-mix(in srgb,var(--c) 14%,transparent);font-size:10px;font-weight:800;line-height:1}
      .lix-pill:before{content:"";width:6px;height:6px;border-radius:50%;background:var(--c)}
      .lix-when{color:var(--muted);font-size:11px;font-weight:700}
      .lix-acts{display:flex;gap:6px;flex:0 0 auto}
      .lix-btn{display:grid;place-items:center;width:38px;height:38px;border:1px solid var(--line);border-radius:11px;background:var(--soft);color:var(--text)}
      .lix-btn.restore{color:var(--accent);border-color:color-mix(in srgb,var(--accent) 45%,var(--line))}
      .lix-btn.kill{color:var(--danger);border-color:color-mix(in srgb,var(--danger) 40%,var(--line))}
      .lix-btn:active{transform:scale(.93)}
      .lix-empty{padding:34px 14px;text-align:center;color:var(--muted);font-size:13px}
      .lix-foot{padding:12px 14px calc(14px + env(safe-area-inset-bottom));border-top:1px solid var(--line);display:flex;justify-content:space-between;gap:10px;align-items:center}
      .lix-note{color:var(--muted);font-size:11px}
      .lix-clear{padding:9px 13px;border:1px solid color-mix(in srgb,var(--danger) 40%,var(--line));border-radius:12px;background:transparent;color:var(--danger);font-size:13px;font-weight:750}
      .lix-clear[hidden]{display:none}
    `;
    document.head.appendChild(s);
  }

  const svg = p => `<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const TRASH_ICON = svg('<path d="M4 7h16"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/><path d="M6.5 7l.8 12a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-12"/><path d="M10 11v6M14 11v6"/>');
  const RESTORE_ICON = svg('<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>');
  const KILL_ICON = svg('<path d="M18 6 6 18M6 6l12 12"/>');

  // ---- interface -------------------------------------------------------
  let dialogEl = null;
  function ensureDialog() {
    if (dialogEl) return dialogEl;
    ensureStyles();
    dialogEl = document.createElement('dialog');
    dialogEl.id = DIALOG_ID;
    dialogEl.innerHTML = `
      <div class="lix-wrap">
        <div class="lix-head">
          <span class="lix-eyebrow">Lixeira</span>
          <h3>Tarefas apagadas</h3>
          <p class="lix-sub" id="lixSub"></p>
          <button class="lix-close" id="lixClose" type="button" aria-label="Fechar">×</button>
        </div>
        <div class="lix-body" id="lixBody"></div>
        <div class="lix-foot">
          <span class="lix-note">Somem sozinhas após ${KEEP_DAYS} dias.</span>
          <button class="lix-clear" id="lixClear" type="button" hidden>Esvaziar</button>
        </div>
      </div>`;
    document.body.appendChild(dialogEl);
    dialogEl.querySelector('#lixClose').addEventListener('click', () => dialogEl.close());
    dialogEl.addEventListener('click', e => { if (e.target === dialogEl) dialogEl.close(); });
    dialogEl.addEventListener('click', e => {
      const restore = e.target.closest('[data-restore]');
      if (restore) { doRestore(Number(restore.dataset.restore)); return; }
      const kill = e.target.closest('[data-kill]');
      if (kill) { doKill(Number(kill.dataset.kill)); return; }
      if (e.target.closest('#lixClear')) doClear();
    });
    return dialogEl;
  }

  function render() {
    const dlg = ensureDialog();
    const arr = purgeOld();
    dlg.querySelector('#lixSub').textContent = arr.length ? `${arr.length} item${arr.length > 1 ? 's' : ''} recuperável${arr.length > 1 ? 'is' : ''}` : 'Vazia';
    dlg.querySelector('#lixClear').hidden = !arr.length;
    const body = dlg.querySelector('#lixBody');
    if (!arr.length) { body.innerHTML = `<div class="lix-empty">Nada apagado por aqui. 🧹</div>`; return; }
    // mais recentes primeiro
    const rows = arr.map((e, i) => ({ e, i })).sort((a, b) => (b.e.at || 0) - (a.e.at || 0));
    body.innerHTML = rows.map(({ e, i }) => {
      const t = e.task || {}; const m = TAGS[tagKey(t.tag)];
      const when = ago(e.at); const d = t.date ? ` · ${shortDate(t.date)}${t.time ? ' ' + t.time : ''}` : '';
      return `<div class="lix-item">
        <div><div class="lix-t">${esc(t.text || '(sem título)')}</div>
        <div class="lix-meta"><span class="lix-pill" style="--c:${m.color}">${esc(m.label)}</span><span class="lix-when">apagada ${when}${d}</span></div></div>
        <div class="lix-acts">
          <button class="lix-btn restore" type="button" data-restore="${i}" title="Restaurar" aria-label="Restaurar tarefa">${RESTORE_ICON}</button>
          <button class="lix-btn kill" type="button" data-kill="${i}" title="Apagar de vez" aria-label="Apagar de vez">${KILL_ICON}</button>
        </div></div>`;
    }).join('');
  }

  function doRestore(idx) {
    const arr = readTrash(); const entry = arr[idx]; if (!entry || !entry.task) return;
    const tasks = readTasks();
    if (!tasks.some(t => t.id === entry.task.id)) tasks.push(entry.task);
    try { localStorage.setItem(TASK_KEY, JSON.stringify(tasks)); } catch (_) {}
    arr.splice(idx, 1); writeTrash(arr);
    try { sessionStorage.setItem('agenda_lix_flash', 'restore'); } catch (_) {}
    location.reload();
  }

  function doKill(idx) {
    const arr = readTrash(); if (!arr[idx]) return;
    if (!confirm('Apagar de vez? Isso não pode ser desfeito.')) return;
    arr.splice(idx, 1); writeTrash(arr);
    render(); refreshButton();
  }

  function doClear() {
    if (!readTrash().length) return;
    if (!confirm('Esvaziar a lixeira? Isso não pode ser desfeito.')) return;
    writeTrash([]); render(); refreshButton();
  }

  function open() { ensureStyles(); render(); const d = ensureDialog(); if (!d.open) d.showModal(); }

  function toast(msg) {
    const t = document.querySelector('.toast');
    if (t) { t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2600); }
  }

  function refreshButton() {
    const b = document.getElementById('lixBtn');
    if (b) b.hidden = purgeOld().length === 0;
  }

  function ensureButton() {
    const actions = document.querySelector('.head-actions');
    if (!actions) return;
    if (!document.getElementById('lixBtn')) {
      const b = document.createElement('button');
      b.id = 'lixBtn';
      b.className = 'icon-btn';
      b.type = 'button';
      b.title = 'Lixeira';
      b.setAttribute('aria-label', 'Lixeira — tarefas apagadas');
      b.innerHTML = TRASH_ICON;
      actions.insertBefore(b, actions.firstChild);
      b.addEventListener('click', open);
    }
    refreshButton();
  }

  function init() {
    ensureStyles();
    ensureButton();
    let frame = 0;
    new MutationObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(ensureButton); })
      .observe(document.body, { childList: true, subtree: true });
    try {
      if (sessionStorage.getItem('agenda_lix_flash')) {
        sessionStorage.removeItem('agenda_lix_flash');
        setTimeout(() => toast('Tarefa restaurada'), 400);
      }
    } catch (_) {}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
