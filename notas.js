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
  const expanded = new Set();
  let saveTimer = 0;

  const load = () => { try { const v = JSON.parse(localStorage.getItem(NOTES_KEY)); return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; } };
  const saveAll = a => localStorage.setItem(NOTES_KEY, JSON.stringify(a));
  const getNote = id => { const n = load()[id]; return { prio: n && n.prio || '', durationMin: n && n.durationMin || null, detail: n && n.detail || '', valor: n && n.valor || '', subs: n && Array.isArray(n.subs) ? n.subs : [] }; };
  const PRIOS = { alta: { label: '🚩 Alta', color: '#ffb74d' }, urgente: { label: '🔴 Urgente', color: '#ff7f91' } };
  function taskTag(id){try{const a=JSON.parse(localStorage.getItem('agenda_lagares_v3')||'[]');const t=Array.isArray(a)?a.find(x=>String(x.id)===String(id)):null;return t&&t.tag||'';}catch(_){return '';}}
  function setNote(id, note) {
    const all = load();
    const empty = !note.prio && !note.durationMin && !note.detail.trim() && !note.valor && (!note.subs || !note.subs.length);
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
      .notas-detail{width:100%;min-height:72px;padding:9px 11px;border:1px solid var(--line);border-radius:11px;background:var(--surface);color:var(--text);font-size:14px;line-height:1.45;resize:vertical;font-family:inherit;outline:0}
      .notas-detail:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(117,203,255,.2)}
      .notas-detail-row{display:flex;justify-content:flex-end;margin-top:7px}
      .notas-copy{padding:6px 13px;border:1px solid var(--line);border-radius:9px;background:var(--surface);color:var(--accent);font-size:12px;font-weight:800}
      .notas-copy:active{transform:scale(.95)}
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
      (isFin ? `<p class="notas-label">Valor (R$)</p><div class="notas-valor-row"><span>R$</span><input class="notas-valor" type="number" inputmode="decimal" step="0.01" min="0" placeholder="0,00" value="${escAttr(note.valor || '')}"></div><div class="notas-sep"></div>` : '') +
      `<p class="notas-label">Duração</p>` +
      `<div class="notas-durs">` +
      DURS.map(m => `<button class="notas-dur ${note.durationMin === m ? 'on' : ''}" type="button" data-dur="${m}">${fmtDur(m)}</button>`).join('') +
      `</div>` +
      `<div class="notas-sep"></div>` +
      `<p class="notas-label">Sub-tarefas</p>` +
      `<div class="notas-subs">${note.subs.map(subRow).join('')}</div>` +
      `<div class="notas-add"><input type="text" placeholder="Nova sub-tarefa" maxlength="200"><button type="button" data-add aria-label="Adicionar">＋</button></div>` +
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
    const prio = panel.dataset.priolevel || '';
    setNote(id, { prio, durationMin, detail, valor, subs });
    updateToggle(id);
  }
  const debouncedSave = panel => { clearTimeout(saveTimer); saveTimer = setTimeout(() => saveFromPanel(panel), 400); };

  function updateToggle(id) {
    const card = cardFor(id);
    if (!card) return;
    const btn = card.querySelector('.notas-toggle');
    if (!btn) return;
    const note = getNote(id);
    const has = !!(note.prio || note.valor || note.durationMin || note.detail.trim() || note.subs.length);
    btn.classList.toggle('has', has);
    let label = '🗒️';
    if (note.valor) label += ' R$ ' + note.valor;
    else if (note.durationMin) label += ' ' + fmtDur(note.durationMin);
    else if (note.subs.length) { const d = note.subs.filter(s => s.done).length; label += ` ${d}/${note.subs.length}`; }
    else if (note.detail.trim()) label += ' •';
    btn.textContent = label;
    // bandeira de prioridade no card
    const footer = card.querySelector('.task-footer');
    let flag = card.querySelector('.notas-flag');
    if (note.prio && PRIOS[note.prio]) {
      if (!flag && footer) { flag = document.createElement('span'); flag.className = 'notas-flag'; footer.insertBefore(flag, footer.firstChild); }
      if (flag) { flag.textContent = PRIOS[note.prio].label; flag.style.setProperty('--pc', PRIOS[note.prio].color); }
    } else if (flag) { flag.remove(); }
  }

  /* ---------------------------- expand/collapse ------------------------- */
  function expand(id) { const card = cardFor(id); if (!card) return; buildPanel(card, id).hidden = false; expanded.add(id); }
  function collapse(id) { const card = cardFor(id); const p = card && card.querySelector('.notas-panel'); if (p) p.hidden = true; expanded.delete(id); }
  const toggle = id => (expanded.has(id) ? collapse(id) : expand(id));

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
      b.textContent = '🗒️';
      footer.appendChild(b);
      updateToggle(id);
      if (expanded.has(id)) buildPanel(card, id).hidden = false;
    });
  }

  /* ------------------------------- eventos ------------------------------ */
  document.addEventListener('click', e => {
    const tog = e.target.closest('.notas-toggle');
    if (tog) { e.preventDefault(); e.stopPropagation(); toggle(tog.dataset.nid); return; }
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
    if (e.target.matches('.notas-detail') || e.target.matches('.notas-valor') || e.target.matches('.notas-sub input[type=text]')) debouncedSave(panel);
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
