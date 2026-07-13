/* =========================================================================
   notas.js — caixinha expansível embaixo de cada atividade.
   Ao tocar no botão, expande e revela:
     • Duração da atividade (chips rápidos)
     • Sub-tarefas com checkbox (adicionar/marcar/remover)
     • Detalhamento em texto livre + botão Copiar
   Guardado por tarefa em localStorage separado; não toca no núcleo do app.
   Mesmo padrão de enhancement do treino.js / painel.js.
   ========================================================================= */
(() => {
  'use strict';

  const NOTES_KEY = 'agenda_notas_v1';
  const STYLE_ID = 'notasStyles';
  const DURS = [15, 30, 45, 60, 90, 120];
  let detailDialog = null;
  let activePanel = null;
  let saveTimer = 0;

  const load = () => { try { const v = JSON.parse(localStorage.getItem(NOTES_KEY)); return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; } };
  const saveAll = a => localStorage.setItem(NOTES_KEY, JSON.stringify(a));
  const getNote = id => { const n = load()[id]; return { prio: n && n.prio || '', durationMin: n && n.durationMin || null, detail: n && n.detail || '', valor: n && n.valor || '', parcPagas: n && n.parcPagas || '', parcRest: n && n.parcRest || '', cond: n && n.cond || null, subs: n && Array.isArray(n.subs) ? n.subs : [] }; };
  const hasCond = c => !!(c && (String(c.thenText || '').trim() || String(c.elseText || '').trim()));
  const PRIOS = { alta: { label: 'Alta', color: '#ffb74d' }, urgente: { label: 'Urgente', color: '#ff7f91' } };
  const NOTE_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:4px"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>';
  function taskTag(id){try{const a=JSON.parse(localStorage.getItem('agenda_lagares_v3')||'[]');const t=Array.isArray(a)?a.find(x=>String(x.id)===String(id)):null;return t&&t.tag||'';}catch(_){return '';}}
  function setNote(id, note) {
    const all = load();
    const empty = !note.prio && !note.durationMin && !note.detail.trim() && !note.valor && !note.parcPagas && !note.parcRest && !hasCond(note.cond) && (!note.subs || !note.subs.length);
    if (empty) delete all[id]; else all[id] = note;
    saveAll(all);
  }
  const escAttr = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const subId = () => 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function fmtDur(min) {
    if (!min) return '';
    const h = Math.floor(min / 60), m = min % 60;
    return h ? (m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`) : `${m}min`;
  }
  function toast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2200);
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      .notas-toggle{margin-left:auto;display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--muted);font-size:11px;font-weight:800;line-height:1;transition:transform .13s ease}
      .notas-toggle:active{transform:scale(.94)}
      .notas-toggle.has{border-color:var(--accent);color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,transparent)}
      .notas-panel{grid-column:1/-1;margin-top:10px;padding:12px 13px;border:1px solid var(--line);border-radius:14px;background:var(--soft)}
      .notas-panel[hidden]{display:none}
      .notas-label{color:var(--faint);font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;margin:0 0 8px}
      .notas-durs{display:flex;flex-wrap:wrap;gap:6px}
      .notas-dur{padding:6px 11px;border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--text);font-size:12px;font-weight:800;line-height:1}
      .notas-dur.on{border-color:var(--accent);background:var(--accent);color:var(--accentInk)}
      .notas-prios{display:flex;flex-wrap:wrap;gap:6px}
      .notas-prio{padding:6px 11px;border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--text);font-size:12px;font-weight:800;line-height:1}
      .notas-prio.on{border-color:var(--accent);background:var(--accent);color:var(--accentInk)}
      .notas-prio.p-alta.on{border-color:#ffb74d;background:#ffb74d;color:#3a2a06}
      .notas-prio.p-urgente.on{border-color:#ff7f91;background:#ff7f91;color:#3a0a12}
      .notas-flag{display:inline-flex;align-items:center;padding:3px 8px;border-radius:999px;font-size:10px;font-weight:800;line-height:1;color:var(--pc,#ffb74d);border:1px solid color-mix(in srgb,var(--pc,#ffb74d) 50%,var(--line));background:color-mix(in srgb,var(--pc,#ffb74d) 16%,transparent)}
      .notas-sep{height:1px;background:var(--line);margin:12px 0}
      .notas-sub{display:grid;grid-template-columns:22px 1fr 26px;gap:8px;align-items:center;margin-bottom:6px}
      .notas-check{appearance:none;width:20px;height:20px;flex:0 0 auto;border:1.5px solid var(--faint);border-radius:6px;background:transparent;display:grid;place-items:center;color:var(--accentInk);font-size:12px;font-weight:900}
      .notas-check:checked{border-color:var(--accent);background:var(--accent)}
      .notas-check:checked::after{content:"✓"}
      .notas-sub input[type=text]{width:100%;min-height:34px;padding:6px 9px;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--text);font-size:14px}
      .notas-sub.done input[type=text]{color:var(--faint);text-decoration:line-through}
      .notas-del{border:0;background:transparent;color:var(--faint);font-size:19px;line-height:1;padding:2px;border-radius:7px}
      .notas-del:active{color:var(--danger);background:var(--soft2)}
      .notas-add{display:grid;grid-template-columns:1fr auto;gap:8px;margin:8px 0 2px}
      .notas-add input{min-height:36px;padding:7px 10px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--text);font-size:14px}
      .notas-add button{padding:0 13px;border:1px solid var(--accent);border-radius:10px;background:var(--accent);color:var(--accentInk);font-size:18px;font-weight:800}
      .notas-valor-row{display:flex;align-items:center;gap:9px;margin-bottom:2px}
      .notas-valor-row span{font-size:15px;font-weight:800;color:var(--accent)}
      .notas-valor{flex:1;min-height:42px;padding:9px 11px;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:var(--text);font-size:16px;font-weight:700}
      .notas-valor:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(117,203,255,.2)}
      .notas-parc-row{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:2px}
      .notas-parc{display:flex;flex-direction:column;gap:5px;margin:0}
      .notas-parc>span{font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--faint)}
      .notas-parc input{min-height:42px;padding:9px 11px;border:1px solid var(--line);border-radius:12px;background:var(--surface);color:var(--text);font-size:16px;font-weight:700}
      .notas-parc input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(117,203,255,.2)}
      .notas-cond-branch{margin-bottom:10px}
      .notas-cond-cap{display:block;font-size:11px;font-weight:800;color:var(--text);margin-bottom:6px}
      .notas-cond-cap b{color:var(--accent);font-weight:800}
      .notas-cond-fields{display:grid;grid-template-columns:1fr 128px 92px;gap:7px}
      .notas-cond-fields input{min-height:40px;padding:8px 10px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--text);font-size:14px}
      .notas-cond-fields input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(117,203,255,.2)}
      .notas-cond-fields .notas-cond-txt{grid-column:1/-1}
      .notas-cond-hint{margin:2px 0 0;color:var(--faint);font-size:10.5px;line-height:1.4}
      @media(max-width:430px){.notas-cond-fields{grid-template-columns:1fr 1fr}.notas-cond-fields .notas-cond-txt{grid-column:1/-1}}
      .notas-detail{width:100%;min-height:72px;padding:9px 11px;border:1px solid var(--line);border-radius:11px;background:var(--surface);color:var(--text);font-size:14px;line-height:1.45;resize:vertical;font-family:inherit;outline:0}
      .notas-detail:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(117,203,255,.2)}
      .notas-detail-row{display:flex;justify-content:flex-end;margin-top:7px}
      .notas-copy{padding:6px 13px;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--accent);font-size:12px;font-weight:800}
      .notas-copy:active{transform:scale(.95)}
      #notasDialog{width:min(calc(100% - 24px),520px);max-height:calc(100dvh - 24px);padding:0;overflow:hidden;border:1px solid var(--line);border-radius:23px;background:var(--surface);color:var(--text);box-shadow:0 28px 70px rgba(0,0,0,.52)}
      #notasDialog::backdrop{background:rgba(0,0,0,.56);backdrop-filter:blur(3px)}
      #notasDialog[open]{animation:notasDialogIn .24s cubic-bezier(.2,.85,.2,1) both}
      .notas-modal{display:flex;flex-direction:column;max-height:calc(100dvh - 24px)}
      .notas-modal-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 16px 13px;border-bottom:1px solid var(--line);background:var(--soft)}
      .notas-modal-head h3{min-width:0;margin:0;overflow:hidden;font-size:17px;letter-spacing:-.03em;white-space:nowrap;text-overflow:ellipsis}
      .notas-modal-close{display:grid;place-items:center;width:32px;height:32px;flex:0 0 auto;padding:0;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--text);font-size:22px;line-height:1}
      .notas-modal-content{overflow-y:auto;padding:12px 14px 16px;-webkit-overflow-scrolling:touch}
      #notasDialog .notas-panel{margin:0;padding:0;border:0;border-radius:0;background:transparent}
      @keyframes notasDialogIn{from{opacity:0;transform:scale(.82) translateY(14px)}to{opacity:1;transform:scale(1) translateY(0)}}
      @media(prefers-reduced-motion:reduce){#notasDialog[open]{animation:none}}
    `;
    document.head.appendChild(s);
  }

  /* ------------------------------ helpers ------------------------------- */
  const cardId = card => { const c = card.querySelector('.check[data-id]'); return c ? c.dataset.id : null; };
  const cardFor = id => [...document.querySelectorAll('.task-card')].find(c => cardId(c) === id) || null;

  function subRow(sub) {
    return `<div class="notas-sub ${sub.done ? 'done' : ''}" data-sid="${escAttr(sub.id)}">` +
      `<input class="notas-check" type="checkbox" ${sub.done ? 'checked' : ''} aria-label="Concluir sub-tarefa">` +
      `<input type="text" value="${escAttr(sub.text)}" maxlength="200" placeholder="Sub-tarefa">` +
      `<button class="notas-del" type="button" aria-label="Remover sub-tarefa">×</button></div>`;
  }

  function buildPanel(card, id) {
    let panel = card.querySelector('.notas-panel');
    if (panel) return panel;
    const note = getNote(id);
    panel = document.createElement('div');
    panel.className = 'notas-panel';
    panel.hidden = true;
    panel.dataset.nid = id;
    panel.dataset.durmin = note.durationMin ? String(note.durationMin) : '';
    panel.dataset.priolevel = note.prio || '';
    const isFin = taskTag(id) === 'financeiro';
    const prioChips = `<button class="notas-prio ${!note.prio ? 'on' : ''}" type="button" data-prio="">Normal</button>` +
      Object.keys(PRIOS).map(k => `<button class="notas-prio p-${k} ${note.prio === k ? 'on' : ''}" type="button" data-prio="${k}">${PRIOS[k].label}</button>`).join('');
    panel.innerHTML =
      `<p class="notas-label">Prioridade</p><div class="notas-prios">${prioChips}</div><div class="notas-sep"></div>` +
      (isFin ? `<p class="notas-label">Valor (R$)</p><div class="notas-valor-row"><span>R$</span><input class="notas-valor" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0,00" value="${escAttr(note.valor || '')}"></div>` +
        `<p class="notas-label">Parcelas (opcional)</p><div class="notas-parc-row"><label class="notas-parc"><span>Pagas</span><input class="notas-parc-pagas" type="number" inputmode="numeric" min="0" step="1" placeholder="0" value="${escAttr(note.parcPagas || '')}"></label><label class="notas-parc"><span>Restantes</span><input class="notas-parc-rest" type="number" inputmode="numeric" min="0" step="1" placeholder="0" value="${escAttr(note.parcRest || '')}"></label></div><div class="notas-sep"></div>` : '') +
      `<p class="notas-label">Duração</p>` +
      `<div class="notas-durs">` +
      DURS.map(m => `<button class="notas-dur ${note.durationMin === m ? 'on' : ''}" type="button" data-dur="${m}">${fmtDur(m)}</button>`).join('') +
      `</div>` +
      `<div class="notas-sep"></div>` +
      `<p class="notas-label">Sub-tarefas</p>` +
      `<div class="notas-subs">${note.subs.map(subRow).join('')}</div>` +
      `<div class="notas-add"><input type="text" placeholder="Nova sub-tarefa" maxlength="200"><button type="button" data-add aria-label="Adicionar">＋</button></div>` +
      `<div class="notas-sep"></div>` +
      `<p class="notas-label">Condicional (opcional)</p>` +
      (function(){const cond=note.cond||{};return `<div class="notas-cond">` +
        `<div class="notas-cond-branch"><span class="notas-cond-cap">Se eu <b>concluir</b> esta tarefa, criar:</span><div class="notas-cond-fields"><input class="notas-cond-then notas-cond-txt" type="text" maxlength="200" placeholder="Nova tarefa" value="${escAttr(cond.thenText || '')}"><input class="notas-cond-then-date" type="date" value="${escAttr(cond.thenDate || '')}"><input class="notas-cond-then-time" type="time" value="${escAttr(cond.thenTime || '')}"></div></div>` +
        `<div class="notas-cond-branch"><span class="notas-cond-cap">Se <b>não acontecer</b> (passar da data), criar:</span><div class="notas-cond-fields"><input class="notas-cond-else notas-cond-txt" type="text" maxlength="200" placeholder="Nova tarefa" value="${escAttr(cond.elseText || '')}"><input class="notas-cond-else-date" type="date" value="${escAttr(cond.elseDate || '')}"><input class="notas-cond-else-time" type="time" value="${escAttr(cond.elseTime || '')}"></div></div>` +
        `<p class="notas-cond-hint">A nova tarefa é criada sozinha ao concluir (ramo "concluir") ou quando a data passar sem concluir (ramo "não acontecer"). Sem data preenchida, usa a data desta tarefa; o horário é opcional.</p>` +
        `</div>`;})() +
      `<div class="notas-sep"></div>` +
      `<p class="notas-label">Detalhes</p>` +
      `<textarea class="notas-detail" placeholder="Anotações, recados, cupons…" maxlength="4000"></textarea>` +
      `<div class="notas-detail-row"><button class="notas-copy" type="button">Copiar</button></div>`;
    card.appendChild(panel);
    panel.querySelector('.notas-detail').value = note.detail;
    return panel;
  }

  // reconstrói a nota a partir do painel (fonte da verdade enquanto aberto)
  function saveFromPanel(panel) {
    const id = panel.dataset.nid;
    if (!id) return;
    const subs = [...panel.querySelectorAll('.notas-sub')].map(r => ({
      id: r.dataset.sid,
      text: r.querySelector('input[type=text]').value,
      done: r.querySelector('.notas-check').checked
    })).filter(s => s.text.trim() !== '' || s.done);
    const detail = panel.querySelector('.notas-detail').value;
    const durationMin = panel.dataset.durmin ? Number(panel.dataset.durmin) : null;
    const vEl = panel.querySelector('.notas-valor');
    const valor = vEl ? vEl.value.trim() : (getNote(id).valor || '');
    const pEl = panel.querySelector('.notas-parc-pagas');
    const rEl = panel.querySelector('.notas-parc-rest');
    const prev = getNote(id);
    const parcPagas = pEl ? pEl.value.trim() : (prev.parcPagas || '');
    const parcRest = rEl ? rEl.value.trim() : (prev.parcRest || '');
    const prio = panel.dataset.priolevel || '';
    const gv = sel => { const el = panel.querySelector(sel); return el ? el.value.trim() : ''; };
    const thenText = gv('.notas-cond-then'), thenDate = gv('.notas-cond-then-date'), thenTime = gv('.notas-cond-then-time');
    const elseText = gv('.notas-cond-else'), elseDate = gv('.notas-cond-else-date'), elseTime = gv('.notas-cond-else-time');
    const prevCond = prev.cond || {};
    let cond = null;
    if (thenText || elseText) {
      cond = {
        thenText, thenDate, thenTime, thenFired: prevCond.thenText === thenText ? !!prevCond.thenFired : false,
        elseText, elseDate, elseTime, elseFired: prevCond.elseText === elseText ? !!prevCond.elseFired : false
      };
    }
    setNote(id, { prio, durationMin, detail, valor, parcPagas, parcRest, cond, subs });
    updateToggle(id);
  }
  const debouncedSave = panel => { clearTimeout(saveTimer); saveTimer = setTimeout(() => saveFromPanel(panel), 400); };

  function updateToggle(id) {
    const card = cardFor(id);
    if (!card) return;
    const btn = card.querySelector('.notas-toggle');
    if (!btn) return;
    const note = getNote(id);
    const has = !!(note.prio || note.valor || note.parcPagas || note.parcRest || hasCond(note.cond) || note.durationMin || note.detail.trim() || note.subs.length);
    btn.classList.toggle('has', has);
    let label = has ? '' : 'Detalhes';
    if (note.valor || note.parcPagas || note.parcRest) {
      if (note.valor) label += ' R$ ' + note.valor;
      if (note.parcPagas || note.parcRest) { const p = Number(note.parcPagas || 0), r = Number(note.parcRest || 0); label += ` · ${p}/${p + r} parc`; }
    }
    else if (note.durationMin) label += ' ' + fmtDur(note.durationMin);
    else if (note.subs.length) { const d = note.subs.filter(s => s.done).length; label += ` ${d}/${note.subs.length}`; }
    else if (hasCond(note.cond)) label += ' condicional';
    else if (note.detail.trim()) label += ' •';
    btn.innerHTML = NOTE_SVG;
    btn.appendChild(document.createTextNode(label.trim() ? label.replace(/^ /, '') : ''));
    // bandeira de prioridade no card
    const footer = card.querySelector('.task-footer');
    let flag = card.querySelector('.notas-flag');
    if (note.prio && PRIOS[note.prio]) {
      if (!flag && footer) { flag = document.createElement('span'); flag.className = 'notas-flag'; footer.insertBefore(flag, footer.firstChild); }
      if (flag) { flag.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>'; flag.appendChild(document.createTextNode(PRIOS[note.prio].label)); flag.style.setProperty('--pc', PRIOS[note.prio].color); }
    } else if (flag) { flag.remove(); }
  }

  /* ---------------------------- detalhes em pop-up ---------------------- */
  function ensureDetailDialog() {
    if (detailDialog) return detailDialog;
    detailDialog = document.createElement('dialog');
    detailDialog.id = 'notasDialog';
    detailDialog.innerHTML = '<section class="notas-modal" aria-label="Detalhes da tarefa"><header class="notas-modal-head"><h3 id="notasDialogTitle">Detalhes da tarefa</h3><button class="notas-modal-close" type="button" aria-label="Fechar detalhes">×</button></header><div class="notas-modal-content"></div></section>';
    document.body.appendChild(detailDialog);
    detailDialog.querySelector('.notas-modal-close').addEventListener('click', () => detailDialog.close());
    detailDialog.addEventListener('click', event => { if (event.target === detailDialog) detailDialog.close(); });
    detailDialog.addEventListener('close', () => {
      if (!activePanel) return;
      saveFromPanel(activePanel);
      const card = cardFor(activePanel.dataset.nid);
      activePanel.hidden = true;
      if (card) card.appendChild(activePanel);
      activePanel = null;
    });
    return detailDialog;
  }

  function openDetails(id) {
    const card = cardFor(id);
    if (!card) return;
    const dialog = ensureDetailDialog();
    if (dialog.open) dialog.close();
    const panel = buildPanel(card, id);
    panel.hidden = false;
    activePanel = panel;
    dialog.querySelector('#notasDialogTitle').textContent = card.querySelector('.task-title')?.textContent || 'Detalhes da tarefa';
    dialog.querySelector('.notas-modal-content').replaceChildren(panel);
    dialog.showModal();
  }

  const toggle = id => openDetails(id);

  function installToggles() {
    document.querySelectorAll('.task-card').forEach(card => {
      const id = cardId(card);
      if (!id || String(id).startsWith('treino-')) return; // treino tem painel próprio
      const footer = card.querySelector('.task-footer');
      if (!footer || footer.querySelector('.notas-toggle')) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'notas-toggle';
      b.dataset.nid = id;
      b.innerHTML = NOTE_SVG;
      footer.appendChild(b);
      updateToggle(id);
    });
  }

  /* ------------------------------- eventos ------------------------------ */
  document.addEventListener('click', e => {
    const tog = e.target.closest('.notas-toggle');
    if (tog) { e.preventDefault(); e.stopPropagation(); toggle(tog.dataset.nid); return; }
    // clicar no título da tarefa também abre a caixinha (descrição + sub-tarefas)
    const title = e.target.closest('.task-title');
    if (title) {
      const card = title.closest('.task-card');
      const id = card && cardId(card);
      if (id && !String(id).startsWith('treino-')) { e.preventDefault(); e.stopPropagation(); toggle(id); return; }
    }
    const panel = e.target.closest('.notas-panel');
    if (!panel) return;
    const dur = e.target.closest('[data-dur]');
    if (dur) {
      const v = dur.dataset.dur;
      const cur = panel.dataset.durmin || '';
      panel.dataset.durmin = cur === v ? '' : v;
      panel.querySelectorAll('.notas-dur').forEach(x => x.classList.toggle('on', x.dataset.dur === panel.dataset.durmin));
      saveFromPanel(panel); return;
    }
    const prioBtn = e.target.closest('[data-prio]');
    if (prioBtn) {
      const v = prioBtn.dataset.prio || '';
      panel.dataset.priolevel = v;
      panel.querySelectorAll('.notas-prio').forEach(x => x.classList.toggle('on', (x.dataset.prio || '') === v));
      saveFromPanel(panel); return;
    }
    if (e.target.closest('[data-add]')) {
      const inp = panel.querySelector('.notas-add input');
      const text = inp.value.trim();
      if (!text) return;
      panel.querySelector('.notas-subs').insertAdjacentHTML('beforeend', subRow({ id: subId(), text, done: false }));
      inp.value = '';
      saveFromPanel(panel); return;
    }
    const del = e.target.closest('.notas-del');
    if (del) { del.closest('.notas-sub').remove(); saveFromPanel(panel); return; }
    if (e.target.closest('.notas-copy')) {
      const txt = panel.querySelector('.notas-detail').value;
      if (!txt.trim()) { toast('Nada para copiar.'); return; }
      const done = () => toast('Detalhes copiados.');
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(done).catch(() => fallbackCopy(panel, done));
      else fallbackCopy(panel, done);
    }
  }, true);

  function fallbackCopy(panel, done) {
    const ta = panel.querySelector('.notas-detail');
    ta.focus(); ta.select();
    try { document.execCommand('copy'); done(); } catch (_) { toast('Copie manualmente.'); }
  }

  document.addEventListener('change', e => {
    if (!e.target.matches('.notas-check')) return;
    const row = e.target.closest('.notas-sub');
    row.classList.toggle('done', e.target.checked);
    saveFromPanel(e.target.closest('.notas-panel'));
  });
  document.addEventListener('input', e => {
    const panel = e.target.closest('.notas-panel');
    if (!panel) return;
    if (e.target.matches('.notas-detail') || e.target.matches('.notas-valor') || e.target.matches('.notas-parc-pagas') || e.target.matches('.notas-parc-rest') || e.target.matches('.notas-cond-then') || e.target.matches('.notas-cond-then-date') || e.target.matches('.notas-cond-then-time') || e.target.matches('.notas-cond-else') || e.target.matches('.notas-cond-else-date') || e.target.matches('.notas-cond-else-time') || e.target.matches('.notas-sub input[type=text]')) debouncedSave(panel);
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.matches('.notas-add input')) {
      e.preventDefault();
      const panel = e.target.closest('.notas-panel');
      panel.querySelector('[data-add]').click();
    }
  });

  function init() {
    ensureStyles();
    installToggles();
    let frame = 0;
    new MutationObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(installToggles); })
      .observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
