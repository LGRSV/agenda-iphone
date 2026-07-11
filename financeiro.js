/* Painel financeiro — visão de valores das tarefas financeiras. */
(() => {
  'use strict';

  const TASK_KEY = 'agenda_lagares_v3';
  const NOTES_KEY = 'agenda_notas_v1';
  const DIALOG_ID = 'financeiroDialog';
  const STYLE_ID = 'financeiroStyles';
  let dialogEl;

  const esc = value => { const d = document.createElement('div'); d.textContent = value == null ? '' : value; return d.innerHTML; };
  const load = key => { try { const raw = localStorage.getItem(key); return JSON.parse(raw || (key === TASK_KEY ? '[]' : '{}')); } catch (_) { return key === TASK_KEY ? [] : {}; } };
  const money = value => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
  const parseMoney = value => {
    const raw = String(value ?? '').trim().replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '');
    const number = Number(raw);
    return Number.isFinite(number) ? number : 0;
  };
  const today = () => {
    const now = new Date(), offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60000).toISOString().slice(0, 10);
  };
  const shortDate = value => {
    const p = String(value || '').split('-');
    return p.length === 3 ? p[2] + '/' + p[1] : '—';
  };

  function readFinancial() {
    const tasks = load(TASK_KEY);
    const notes = load(NOTES_KEY);
    return (Array.isArray(tasks) ? tasks : [])
      .filter(task => task && task.tag === 'financeiro' && task.text)
      .map(task => ({ ...task, valor: parseMoney(notes?.[task.id]?.valor), note: notes?.[task.id] || {} }))
      .filter(task => task.valor > 0);
  }

  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${DIALOG_ID}{width:min(calc(100% - 24px),520px);max-height:calc(100dvh - 24px);padding:0;border:1px solid var(--line);border-radius:24px;background:var(--bg);color:var(--text);box-shadow:0 30px 90px rgba(0,0,0,.56)}
      #${DIALOG_ID}::backdrop{background:rgba(0,0,0,.6);backdrop-filter:blur(4px)}
      .fin-wrap{display:flex;flex-direction:column;max-height:calc(100dvh - 24px)}
      .fin-head{position:sticky;top:0;z-index:2;padding:18px 18px 14px;border-bottom:1px solid var(--line);background:linear-gradient(135deg,var(--surface),var(--soft))}
      .fin-eye{display:block;color:#ff7f91;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;margin-bottom:5px}
      .fin-head h3{margin:0;font-size:24px;letter-spacing:-.04em}.fin-sub{margin:5px 0 0;color:var(--muted);font-size:13px}
      .fin-close{position:absolute;top:14px;right:14px;width:34px;height:34px;border:1px solid var(--line);border-radius:11px;background:var(--surface);color:var(--text);font-size:19px;display:grid;place-items:center}
      .fin-body{overflow-y:auto;padding:14px}.fin-hero{padding:16px;border:1px solid color-mix(in srgb,#ff7f91 35%,var(--line));border-radius:19px;background:linear-gradient(135deg,color-mix(in srgb,#ff7f91 18%,var(--surface)),var(--surface));margin-bottom:12px}
      .fin-hero span,.fin-label{display:block;color:var(--muted);font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}.fin-hero b{display:block;margin-top:6px;color:#ff9aaa;font-size:30px;letter-spacing:-.05em}
      .fin-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:15px}.fin-tile{padding:13px;border:1px solid var(--line);border-radius:16px;background:var(--surface)}.fin-tile b{display:block;font-size:20px;letter-spacing:-.045em}.fin-tile span{display:block;margin-top:5px;color:var(--muted);font-size:11px;font-weight:750}.fin-tile.ok b{color:#78d88b}.fin-tile.warn b{color:#ffb74d}.fin-tile.danger b{color:var(--danger)}
      .fin-section{margin:18px 0 7px;color:var(--faint);font-size:11px;font-weight:800;letter-spacing:.07em;text-transform:uppercase}.fin-list{border-top:1px solid var(--line)}.fin-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;padding:11px 2px;border-bottom:1px solid var(--line)}.fin-row-title{font-size:13px;font-weight:700;line-height:1.3;overflow-wrap:anywhere}.fin-row-meta{margin-top:4px;color:var(--muted);font-size:11px;font-weight:700}.fin-row-value{font-size:13px;font-weight:850;white-space:nowrap}.fin-row-value.late{color:var(--danger)}.fin-empty{padding:22px 8px;text-align:center;color:var(--muted);font-size:13px}
    `;
    document.head.appendChild(style);
  }

  function ensureDialog() {
    if (dialogEl) return dialogEl;
    dialogEl = document.createElement('dialog');
    dialogEl.id = DIALOG_ID;
    dialogEl.innerHTML = `<div class="fin-wrap"><div class="fin-head"><span class="fin-eye">Financeiro</span><h3>Indicadores financeiros</h3><p class="fin-sub" id="finSub"></p><button class="fin-close" type="button" aria-label="Fechar">×</button></div><div class="fin-body" id="finBody"></div></div>`;
    document.body.appendChild(dialogEl);
    dialogEl.querySelector('.fin-close').addEventListener('click', () => dialogEl.close());
    dialogEl.addEventListener('click', event => { if (event.target === dialogEl) dialogEl.close(); });
    return dialogEl;
  }

  function render() {
    const dialog = ensureDialog();
    const items = readFinancial(), t0 = today(), month = t0.slice(0, 7);
    const pending = items.filter(item => !item.done);
    const done = items.filter(item => item.done);
    const overdue = pending.filter(item => item.date && item.date < t0);
    const monthItems = pending.filter(item => String(item.date || '').startsWith(month));
    const sum = list => list.reduce((total, item) => total + item.valor, 0);
    const openRows = pending.slice().sort((a,b) => String(a.date || '9999').localeCompare(String(b.date || '9999'))).slice(0, 12);
    const rows = openRows.length ? openRows.map(item => {
      const late = item.date && item.date < t0;
      return `<div class="fin-row"><div><div class="fin-row-title">${esc(item.text)}</div><div class="fin-row-meta">${shortDate(item.date)}${item.time ? ' · ' + item.time : ''}</div></div><div class="fin-row-value ${late ? 'late' : ''}">${money(item.valor)}</div></div>`;
    }).join('') : '<div class="fin-empty">Nenhuma pendência financeira com valor informado.</div>';

    dialog.querySelector('#finSub').textContent = 'Valores registrados nas tarefas financeiras';
    dialog.querySelector('#finBody').innerHTML =
      `<section class="fin-hero"><span>Em aberto</span><b>${money(sum(pending))}</b></section>` +
      `<section class="fin-grid"><div class="fin-tile ok"><b>${money(sum(done))}</b><span>Concluído / recebido</span></div><div class="fin-tile warn"><b>${money(sum(monthItems))}</b><span>Pendente neste mês</span></div><div class="fin-tile danger"><b>${money(sum(overdue))}</b><span>Em atraso</span></div><div class="fin-tile"><b>${pending.length}</b><span>Lançamentos em aberto</span></div></section>` +
      `<p class="fin-section">Próximos lançamentos</p><div class="fin-list">${rows}</div>`;
  }

  function open() { ensureStyles(); render(); const dialog = ensureDialog(); if (!dialog.open) dialog.showModal(); }
  const DOLLAR_ICON = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v18"/><path d="M16.5 7.5c-.7-1.2-2.2-2-4.1-2-2.3 0-4.1 1.2-4.1 3s1.6 2.6 4.1 3.2c2.5.6 4.1 1.4 4.1 3.2s-1.8 3-4.1 3c-1.9 0-3.5-.8-4.3-2"/></svg>';

  function ensureButton() {
    const actions = document.querySelector('.head-actions');
    if (!actions || document.getElementById('financeiroBtn')) return;
    const button = document.createElement('button');
    button.id = 'financeiroBtn'; button.className = 'icon-btn'; button.type = 'button';
    button.title = 'Painel financeiro'; button.setAttribute('aria-label', 'Abrir painel financeiro');
    button.innerHTML = DOLLAR_ICON;
    actions.insertBefore(button, actions.firstChild);
    button.addEventListener('click', open);
  }

  function init() {
    ensureStyles(); ensureButton();
    let frame = 0;
    new MutationObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(ensureButton); }).observe(document.body, { childList:true, subtree:true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();