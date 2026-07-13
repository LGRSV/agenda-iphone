/* =========================================================================
   painel.js — tela de "Visão geral" das ações (pendentes / concluídas).
   Botão 📊 na barra superior abre um painel com um panorama das tarefas:
   totais, em atraso, para hoje, e a divisão por categoria.
   Enhancement autossuficiente, no mesmo padrão do treino.js.
   ========================================================================= */
(() => {
  'use strict';

  const TASK_KEY = 'agenda_lagares_v3';
  const DIALOG_ID = 'painelDialog';
  const STYLE_ID = 'painelStyles';
  const TAGS = {
    trabalho: { label: 'Trabalho', color: '#4db6f4' },
    pessoal: { label: 'Pessoal', color: '#bb86fc' },
    casa: { label: 'Casa', color: '#71d6be' },
    faculdade: { label: 'Faculdade', color: '#ffb74d' },
    saude: { label: 'Academia', color: '#78d88b' },
    financeiro: { label: 'Financeiro', color: '#ff7f91' },
    outros: { label: 'Outros', color: '#aab3c2' }
  };

  let filter = 'pendentes'; // 'pendentes' | 'concluidas'

  const esc = v => { const d = document.createElement('div'); d.textContent = v == null ? '' : v; return d.innerHTML; };
  const readTasks = () => { try { const v = JSON.parse(localStorage.getItem(TASK_KEY)); return Array.isArray(v) ? v : []; } catch (_) { return []; } };
  const isTreino = t => /^🏋/.test(t.text || '');
  const tagKey = t => (TAGS[t] ? t : 'outros');
  function today() { const n = new Date(), o = n.getTimezoneOffset(); return new Date(n.getTime() - o * 60000).toISOString().slice(0, 10); }
  const shortDate = d => { const p = String(d || '').split('-'); return p.length === 3 ? `${p[2]}/${p[1]}` : ''; }
  function fullDate(d) { try { return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(d + 'T12:00:00')); } catch (_) { return d; } }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #${DIALOG_ID}{width:min(calc(100% - 24px),520px);max-height:calc(100dvh - 24px);padding:0;border:1px solid var(--line);border-radius:24px;background:var(--bg);color:var(--text);box-shadow:0 30px 90px rgba(0,0,0,.56)}
      #${DIALOG_ID}::backdrop{background:rgba(0,0,0,.6);backdrop-filter:blur(4px)}
      .pg-wrap{display:flex;flex-direction:column;max-height:calc(100dvh - 24px)}
      .pg-head{position:sticky;top:0;z-index:2;padding:18px 18px 14px;border-bottom:1px solid var(--line);background:linear-gradient(135deg,var(--surface),var(--soft))}
      .pg-eyebrow{display:block;color:var(--accent);font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;margin-bottom:5px}
      .pg-head h3{margin:0;font-size:24px;letter-spacing:-.04em}
      .pg-sub{margin:5px 0 0;color:var(--muted);font-size:13px;text-transform:capitalize}
      .pg-close{position:absolute;top:14px;right:14px;width:34px;height:34px;border:1px solid var(--line);border-radius:11px;background:var(--surface);color:var(--text);font-size:19px;line-height:1;display:grid;place-items:center}
      .pg-body{overflow-y:auto;padding:14px}
      .pg-prog{padding:15px 16px;border:1px solid var(--line);border-radius:18px;background:linear-gradient(135deg,var(--surface),var(--soft));margin-bottom:12px}
      .pg-prog-top{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
      .pg-prog-top span{color:var(--muted);font-size:13px;font-weight:650}
      .pg-prog-num{font-size:28px;font-weight:800;letter-spacing:-.05em}
      .pg-prog-num small{color:var(--muted);font-size:14px;font-weight:700}
      .pg-bar-wrap{height:9px;margin:12px 0 0;overflow:hidden;border-radius:99px;background:var(--soft2)}
      .pg-bar-wrap>div{height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--accent2),var(--accent));transition:width .4s ease}
      .pg-tiles{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}
      .pg-tile{padding:14px;border:1px solid var(--line);border-radius:16px;background:var(--surface)}
      .pg-tile b{display:block;font-size:26px;font-weight:850;letter-spacing:-.05em;line-height:1}
      .pg-tile span{display:block;margin-top:5px;color:var(--muted);font-size:12px;font-weight:700}
      .pg-tile.accent b{color:var(--accent)} .pg-tile.green b{color:#78d88b} .pg-tile.danger b{color:var(--danger)} .pg-tile.warn b{color:#ffb74d}
      .pg-seg{display:grid;grid-template-columns:1fr 1fr;gap:4px;padding:4px;margin-bottom:12px;border:1px solid var(--line);border-radius:14px;background:var(--soft)}
      .pg-seg button{min-height:38px;border:0;border-radius:10px;background:transparent;color:var(--muted);font-size:13px;font-weight:800}
      .pg-seg button.on{background:var(--surface);color:var(--text);box-shadow:0 1px 7px rgba(0,0,0,.16)}
      .pg-section{margin:0 0 8px;color:var(--faint);font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase}
      .pg-cat{display:flex;align-items:center;gap:10px;padding:7px 0}
      .pg-cat-name{width:96px;flex:0 0 auto;font-size:12px;font-weight:750;display:flex;align-items:center;gap:6px}
      .pg-cat-name i{width:8px;height:8px;border-radius:50%;background:var(--c);display:inline-block}
      .pg-cat-bar{flex:1;height:8px;border-radius:99px;background:var(--soft2);overflow:hidden}
      .pg-cat-bar>div{height:100%;border-radius:inherit;background:var(--c)}
      .pg-cat-n{width:24px;text-align:right;font-size:12px;font-weight:800;color:var(--muted)}
      .pg-list{margin-top:6px}
      .pg-item{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center;padding:10px 2px;border-top:1px solid var(--line)}
      .pg-item-t{font-size:13px;font-weight:650;line-height:1.3;overflow-wrap:anywhere}
      .pg-item.done .pg-item-t{color:var(--faint);text-decoration:line-through}
      .pg-item-d{font-size:11px;font-weight:700;color:var(--muted);white-space:nowrap}
      .pg-item-d.late{color:var(--danger)}
      .pg-empty{padding:26px 10px;text-align:center;color:var(--muted);font-size:13px}
      .pg-more{padding:10px 2px 2px;color:var(--muted);font-size:12px;font-weight:700;text-align:center}
    `;
    document.head.appendChild(s);
  }

  let dialogEl = null;
  function ensureDialog() {
    if (dialogEl) return dialogEl;
    dialogEl = document.createElement('dialog');
    dialogEl.id = DIALOG_ID;
    dialogEl.innerHTML = `
      <div class="pg-wrap">
        <div class="pg-head">
          <span class="pg-eyebrow">Visão geral</span>
          <h3>Suas ações</h3>
          <p class="pg-sub" id="pgSub"></p>
          <button class="pg-close" id="pgClose" type="button" aria-label="Fechar">×</button>
        </div>
        <div class="pg-body" id="pgBody"></div>
      </div>`;
    document.body.appendChild(dialogEl);
    dialogEl.querySelector('#pgClose').addEventListener('click', () => dialogEl.close());
    dialogEl.addEventListener('click', e => { if (e.target === dialogEl) dialogEl.close(); });
    dialogEl.addEventListener('click', e => {
      const seg = e.target.closest('[data-filter]');
      if (seg) { filter = seg.dataset.filter; render(); }
    });
    return dialogEl;
  }

  function tile(cls, num, label) {
    return `<div class="pg-tile ${cls}"><b>${num}</b><span>${label}</span></div>`;
  }

  function render() {
    const dlg = ensureDialog();
    const all = readTasks().filter(t => t && t.text && !isTreino(t));
    const t0 = today();
    const done = all.filter(t => t.done);
    const pending = all.filter(t => !t.done);
    const overdue = pending.filter(t => t.date && t.date < t0);
    const todayCount = pending.filter(t => t.date === t0).length;
    const pct = all.length ? Math.round(done.length / all.length * 100) : 0;

    dlg.querySelector('#pgSub').textContent = fullDate(t0);

    const set = filter === 'concluidas' ? done : pending;
    // por categoria
    const counts = {};
    set.forEach(t => { const k = tagKey(t.tag); counts[k] = (counts[k] || 0) + 1; });
    const cats = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    const max = Math.max(1, ...cats.map(k => counts[k]));
    const catRows = cats.length ? cats.map(k => {
      const m = TAGS[k];
      return `<div class="pg-cat" style="--c:${m.color}"><div class="pg-cat-name"><i></i>${esc(m.label)}</div>` +
        `<div class="pg-cat-bar"><div style="width:${Math.round(counts[k] / max * 100)}%"></div></div>` +
        `<div class="pg-cat-n">${counts[k]}</div></div>`;
    }).join('') : `<div class="pg-empty">Nada aqui ainda.</div>`;

    // lista
    const sorted = set.slice().sort((a, b) =>
      filter === 'concluidas'
        ? String(b.date || '').localeCompare(String(a.date || ''))
        : String(a.date || '9999').localeCompare(String(b.date || '9999')));
    const shown = sorted.slice(0, 25);
    const listRows = shown.length ? shown.map(t => {
      const late = !t.done && t.date && t.date < t0;
      return `<div class="pg-item ${t.done ? 'done' : ''}"><div class="pg-item-t">${esc(t.text)}</div>` +
        `<div class="pg-item-d ${late ? 'late' : ''}">${t.date ? shortDate(t.date) : '—'}</div></div>`;
    }).join('') : `<div class="pg-empty">${filter === 'concluidas' ? 'Nenhuma tarefa concluída ainda.' : 'Nenhuma tarefa pendente.'}</div>`;
    const more = sorted.length > shown.length ? `<div class="pg-more">+ ${sorted.length - shown.length} não exibida(s)</div>` : '';

    dlg.querySelector('#pgBody').innerHTML =
      `<div class="pg-prog"><div class="pg-prog-top"><span>Progresso geral</span><strong class="pg-prog-num">${done.length}<small>/${all.length}</small></strong></div>` +
      `<div class="pg-bar-wrap"><div style="width:${pct}%"></div></div></div>` +
      `<div class="pg-tiles">` +
      tile('accent', pending.length, 'Pendentes') +
      tile('green', done.length, 'Concluídas') +
      tile('danger', overdue.length, 'Em atraso') +
      tile('warn', todayCount, 'Para hoje') +
      `</div>` +
      `<div class="pg-seg"><button type="button" data-filter="pendentes" class="${filter === 'pendentes' ? 'on' : ''}">Pendentes</button>` +
      `<button type="button" data-filter="concluidas" class="${filter === 'concluidas' ? 'on' : ''}">Concluídas</button></div>` +
      `<p class="pg-section">Por categoria</p>${catRows}` +
      `<p class="pg-section" style="margin-top:16px">${filter === 'concluidas' ? 'Concluídas' : 'Pendentes'} (${set.length})</p>` +
      `<div class="pg-list">${listRows}${more}</div>`;
  }

  function open() { ensureStyles(); render(); const d = ensureDialog(); if (!d.open) d.showModal(); }

  function ensureButton() {
    const actions = document.querySelector('.head-actions');
    if (!actions) return;
    let b = document.getElementById('painelBtn');
    if (!b) {
      b = document.createElement('button');
      b.id = 'painelBtn';
      b.className = 'icon-btn';
      b.type = 'button';
      b.title = 'Visão geral';
      b.setAttribute('aria-label', 'Visão geral das tarefas');
      b.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 20h17"/><path d="M6 20v-7M12 20V5M18 20v-10"/></svg>';
      actions.insertBefore(b, actions.firstChild);
    }
    if (!b.dataset.painelBound) {
      b.dataset.painelBound = '1';
      b.addEventListener('click', open);
    }
  }

  function init() {
    ensureStyles();
    ensureButton();
    let frame = 0;
    new MutationObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(ensureButton); })
      .observe(document.body, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
