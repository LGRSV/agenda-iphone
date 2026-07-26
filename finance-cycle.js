/*
  Faturas do cartão Inter — Agenda Lagares

  A fatura é identificada pelo mês do vencimento, não pelo mês da compra.
  Regra-base confirmada pelo usuário:
    fatura Agosto/2026
    período 26/06/2026 a 26/07/2026
    vencimento 02/08/2026

  Depois desse marco, cada ciclo começa no dia seguinte ao fechamento anterior
  e termina no dia 26. Antes dele, o ciclo termina no dia anterior ao marco.
  Isso elimina sobreposição de lançamentos na fronteira do dia 26.
*/
(() => {
  'use strict';

  const TASKS_KEY = 'agenda_lagares_v3';
  const NOTES_KEY = 'agenda_notas_v1';
  const DIRTY_KEY = 'agenda_supabase_dirty_v1';
  const ANCHOR_KEY = '2026-08';
  const ANCHOR_START = '2026-06-26';
  const ANCHOR_END = '2026-07-26';
  const DAY_MS = 86400000;
  const MONTHS = [
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
  ];
  const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

  const read = (key, fallback) => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || '');
      return value == null ? fallback : value;
    } catch (_) {
      return fallback;
    }
  };
  const write = (key, value) => localStorage.setItem(key, JSON.stringify(value));
  const money = value => new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(Number(value) || 0);
  const amount = value => {
    const parsed = Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
  const parseKey = key => {
    const match = /^(\d{4})-(\d{2})$/.exec(String(key || ''));
    return match ? { year: Number(match[1]), month: Number(match[2]) } : null;
  };
  const keyFrom = (year, month) => {
    const date = new Date(Date.UTC(year, month - 1, 1));
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
  };
  const shiftKey = (key, delta) => {
    const parsed = parseKey(key);
    return parsed ? keyFrom(parsed.year, parsed.month + delta) : ANCHOR_KEY;
  };
  const keyDistance = (from, to) => {
    const a = parseKey(from);
    const b = parseKey(to);
    return a && b ? (b.year - a.year) * 12 + b.month - a.month : 0;
  };
  const iso = date => [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0')
  ].join('-');
  const utcDate = value => {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''));
    return match
      ? new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
      : null;
  };
  const addDays = (value, days) => {
    const date = utcDate(value);
    if (!date) return '';
    date.setUTCDate(date.getUTCDate() + days);
    return iso(date);
  };
  const dateFor = (year, month, day) => iso(new Date(Date.UTC(year, month - 1, day)));

  function cycleBounds(key) {
    const parsed = parseKey(key);
    if (!parsed) return { start: ANCHOR_START, end: ANCHOR_END };
    const distance = keyDistance(ANCHOR_KEY, key);
    if (distance === 0) return { start: ANCHOR_START, end: ANCHOR_END };

    if (distance > 0) {
      const previousDue = parseKey(shiftKey(key, -2));
      const closingMonth = parseKey(shiftKey(key, -1));
      return {
        start: dateFor(previousDue.year, previousDue.month, 27),
        end: dateFor(closingMonth.year, closingMonth.month, 26)
      };
    }

    const startingMonth = parseKey(shiftKey(key, -2));
    const nextStart = dateFor(parseKey(shiftKey(key, -1)).year, parseKey(shiftKey(key, -1)).month, 26);
    return {
      start: dateFor(startingMonth.year, startingMonth.month, 26),
      end: addDays(nextStart, -1)
    };
  }

  function invoiceKey(dateValue, note = {}) {
    if (/^\d{4}-\d{2}$/.test(String(note.invoiceMonth || ''))) return note.invoiceMonth;
    const value = String(dateValue || '').slice(0, 10);
    if (!utcDate(value)) return '';
    if (value >= ANCHOR_START && value <= ANCHOR_END) return ANCHOR_KEY;

    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);

    if (value > ANCHOR_END) return keyFrom(year, month + (day <= 26 ? 1 : 2));
    return keyFrom(year, month + (day >= 26 ? 2 : 1));
  }

  function activeInvoice(date = new Date()) {
    const today = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, '0'),
      String(date.getDate()).padStart(2, '0')
    ].join('-');

    // Entre o fechamento (dia 27) e o vencimento (dia 02), a fatura que
    // acabou de fechar permanece como principal. Depois do dia 02, a tela
    // troca automaticamente para a próxima fatura em aberto.
    const computed = invoiceKey(today);
    const day = date.getDate();
    if (today >= ANCHOR_START && (day >= 27 || day <= 2)) {
      return shiftKey(computed, -1);
    }
    return computed;
  }

  const formatShort = value => {
    const parts = String(value || '').split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}` : value;
  };
  const formatLong = value => {
    const parts = String(value || '').split('-');
    return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : value;
  };
  const labelFor = key => {
    const parsed = parseKey(key);
    return parsed ? `${MONTHS[parsed.month - 1]} de ${parsed.year}` : key;
  };
  const dueLabel = key => {
    const parsed = parseKey(key);
    return parsed ? `02/${String(parsed.month).padStart(2, '0')}/${parsed.year}` : '';
  };
  const cycleLabel = key => {
    const bounds = cycleBounds(key);
    return `${formatShort(bounds.start)} a ${formatShort(bounds.end)}`;
  };
  const kind = (task, note) => note.movimento
    || (/cobrar|sal[aá]rio|receber/i.test(task.text || '') ? 'entrada'
      : /mesada|mayara/i.test(task.text || '') ? 'saida'
        : amount(note.valor) > 0 ? 'entrada' : 'sem valor');
  const isInter = (task, note) => note.forma === 'inter'
    && (kind(task, note) === 'saida' || kind(task, note) === 'entrada');
  const isCancelled = (task, note) => Boolean(
    note.cancelado || task.flag === 'cancelado' || /cancelad[oa]/i.test(task.text || '')
  );

  let cursor = activeInvoice();
  let filter = 'todos';

  function financialInvoiceItems() {
    const notes = read(NOTES_KEY, {});
    return read(TASKS_KEY, [])
      .filter(task => task && task.text)
      .map(task => ({ ...task, n: notes[task.id] || {} }))
      .filter(task => task.tag === 'financeiro'
        && !task.n.excludeFromInvoice
        && (kind(task, task.n) === 'saida' || kind(task, task.n) === 'entrada')
        && invoiceKey(task.date, task.n) === cursor)
      .sort((a, b) => `${a.date}${a.time || ''}`.localeCompare(`${b.date}${b.time || ''}`));
  }

  function invoiceItems() {
    return financialInvoiceItems().filter(task => isInter(task, task.n));
  }

  function filteredItems(items) {
    if (filter === 'entrada') return items.filter(item => kind(item, item.n) === 'entrada');
    if (filter === 'saida') return items.filter(item => kind(item, item.n) === 'saida');
    if (filter === 'reemb') {
      return items.filter(item => /estorn|reembols|cancelad|refatur/i.test(
        `${item.text || ''} ${item.n.detail || ''}`
      ));
    }
    if (filter === 'atrasado') return [];
    return items;
  }

  function detailsHtml(item) {
    const subs = Array.isArray(item.n.subs) ? item.n.subs : [];
    if (!subs.length) return '';
    return `<div class="invoice-details"><span>Detalhamento da compra</span>${subs.map((sub, index) => `
      <label>
        <input type="checkbox" data-detail-task="${esc(item.id)}" data-detail-index="${index}" ${sub.done ? 'checked' : ''}>
        <i>${esc(sub.text || '')}</i>
      </label>`).join('')}</div>`;
  }

  function rowHtml(item) {
    const movement = kind(item, item.n);
    const value = amount(item.n.valor);
    const cancelled = isCancelled(item, item.n);
    const displayText = item.n.invoiceLabel || item.text;
    const sign = movement === 'entrada' ? '+' : '−';
    const marker = movement === 'entrada' ? '+' : '−';
    const installment = /\((\d+\/\d+)\)/.exec(displayText || '');
    const paymentLabel = movement === 'entrada'
      ? 'Entrada/crédito'
      : item.n.forma === 'inter'
        ? 'Cartão Inter'
        : item.n.forma === 'pix'
          ? `Pix${item.n.conta === 'nb' ? ' · Nubank' : item.n.conta === 'mp' ? ' · Mercado Pago' : ''}`
          : item.n.forma === 'dinheiro' ? 'Dinheiro' : 'Saída';
    return `<article class="row invoice-row${cancelled ? ' is-cancelled' : ''}">
      <span class="paidmark" aria-hidden="true">${marker}</span>
      <div>
        <div class="title">${esc(displayText)}${cancelled ? '<span class="cancel-badge">Cancelado</span>' : ''}</div>
        <div class="meta">${formatLong(item.date)}${item.time ? ` ${esc(item.time)}` : ''} · ${paymentLabel}${installment ? ` · Parcela ${installment[1]}` : ''}</div>
        ${detailsHtml(item)}
      </div>
      <div class="value ${movement === 'entrada' ? 'entrada' : 'saida'}">${sign} ${money(value)}</div>
    </article>`;
  }

  function renderList(items) {
    const list = document.querySelector('#list');
    if (!list) return;
    const visible = filteredItems(items);
    if (!visible.length) {
      list.innerHTML = '<div class="empty">Nenhum lançamento nesta fatura.</div>';
      return;
    }
    const byDate = {};
    visible.forEach(item => { (byDate[item.date] ||= []).push(item); });
    list.innerHTML = Object.keys(byDate).sort().reverse().map(date => {
      const day = utcDate(date);
      const rows = byDate[date];
      const net = rows.reduce((total, item) => {
        if (isCancelled(item, item.n)) return total;
        const value = amount(item.n.valor);
        return total + (kind(item, item.n) === 'entrada' ? -value : value);
      }, 0);
      return `<section class="day-card">
        <header class="dc-head">
          <span class="dc-date">${formatShort(date)} <em>${WEEKDAYS[day.getUTCDay()]}</em></span>
          <span class="dc-net ${net > 0 ? 'neg' : 'pos'}">${net > 0 ? '− ' : '+ '}${money(Math.abs(net))}</span>
        </header>
        ${rows.slice().reverse().map(rowHtml).join('')}
      </section>`;
    }).join('');
  }

  function render() {
    const items = invoiceItems();
    const financialItems = financialInvoiceItems();
    const active = items.filter(item => !isCancelled(item, item.n));
    const activeFinancial = financialItems.filter(item => !isCancelled(item, item.n));
    const charges = active
      .filter(item => kind(item, item.n) === 'saida')
      .reduce((sum, item) => sum + amount(item.n.valor), 0);
    const credits = active
      .filter(item => kind(item, item.n) === 'entrada')
      .reduce((sum, item) => sum + amount(item.n.valor), 0);
    const totalGeneralExpenses = activeFinancial
      .filter(item => kind(item, item.n) === 'saida')
      .reduce((sum, item) => sum + amount(item.n.valor), 0);
    const totalGeneralCredits = activeFinancial
      .filter(item => kind(item, item.n) === 'entrada')
      .reduce((sum, item) => sum + amount(item.n.valor), 0);
    const total = Math.max(0, charges - credits);
    const bounds = cycleBounds(cursor);

    const title = document.querySelector('#mn');
    if (title) title.textContent = labelFor(cursor);
    const saldoLabel = document.querySelector('.bar .muted');
    if (saldoLabel) {
      const today = new Date();
      const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      saldoLabel.textContent = `Saldo total previsto até ${formatShort(dateFor(lastDay.getFullYear(), lastDay.getMonth() + 1, lastDay.getDate()))}`;
    }
    const entradas = document.querySelector('#in');
    if (entradas) entradas.textContent = money(totalGeneralCredits);
    const saidas = document.querySelector('#out');
    if (saidas) saidas.textContent = money(totalGeneralExpenses);
    const entriesLabel = entradas?.nextElementSibling;
    if (entriesLabel) entriesLabel.textContent = 'Entradas gerais';
    const expensesLabel = saidas?.nextElementSibling;
    if (expensesLabel) expensesLabel.textContent = 'Saídas gerais';
    const semValor = document.querySelector('#nv');
    if (semValor) semValor.textContent = String(items.filter(item => !amount(item.n.valor)).length);
    const abertos = document.querySelector('#ct');
    if (abertos) abertos.textContent = String(active.filter(item => kind(item, item.n) === 'saida').length);

    const card = document.querySelector('#cartao');
    if (card) {
      card.hidden = false;
      card.setAttribute('role', 'link');
      card.setAttribute('tabindex', '0');
      card.setAttribute('aria-label', `Abrir lançamentos do cartão Inter da fatura de ${labelFor(cursor)}`);
      card.title = 'Ver lançamentos do cartão Inter';
      card.innerHTML = `<div class="ct-top">
        <span class="ct-brand">Inter Black</span>
        <span class="ct-due">Vence ${dueLabel(cursor)}</span>
      </div>
      <div class="ct-val">${money(total)}</div>
      <div class="ct-cardbot">
        <span class="ct-sub">Ciclo ${formatShort(bounds.start)}–${formatShort(bounds.end)} · ${active.length} lançamento${active.length === 1 ? '' : 's'} · toque para ver extrato ›</span>
        <span class="mc"><i></i><i></i></span>
      </div>`;
    }

    const heading = document.querySelector('#list')?.previousElementSibling;
    if (heading?.tagName === 'H2') heading.textContent = 'LANÇAMENTOS DO PERÍODO';
    document.querySelectorAll('.filters [data-f]').forEach(button => {
      button.classList.toggle('on', button.dataset.f === filter);
    });
    renderList(financialItems);
  }

  function markDirty(documentKey) {
    const dirty = read(DIRTY_KEY, {});
    dirty[documentKey] = Date.now();
    write(DIRTY_KEY, dirty);
  }

  function install() {
    const previous = document.querySelector('#prev');
    const next = document.querySelector('#next');
    const filters = document.querySelector('.filters');
    const list = document.querySelector('#list');
    if (!previous || !next || !filters || !list) return;

    previous.onclick = () => {
      cursor = shiftKey(cursor, -1);
      render();
    };
    next.onclick = () => {
      cursor = shiftKey(cursor, 1);
      render();
    };
    filters.onclick = event => {
      const button = event.target.closest('[data-f]');
      if (!button) return;
      filter = button.dataset.f;
      render();
    };
    list.onchange = event => {
      const taskId = event.target.dataset.i;
      const detailTask = event.target.dataset.detailTask;
      if (taskId) {
        const tasks = read(TASKS_KEY, []);
        const task = tasks.find(item => String(item.id) === String(taskId));
        if (task) {
          task.done = event.target.checked;
          write(TASKS_KEY, tasks);
          markDirty('tasks');
        }
      } else if (detailTask) {
        const notes = read(NOTES_KEY, {});
        const note = notes[detailTask];
        const index = Number(event.target.dataset.detailIndex);
        if (note && Array.isArray(note.subs) && note.subs[index]) {
          note.subs[index].done = event.target.checked;
          write(NOTES_KEY, notes);
          markDirty('notes');
        }
      }
      render();
    };

    const openInvoiceDetails = () => {
      location.href = `fatura-inter.html?fatura=${encodeURIComponent(cursor)}`;
    };
    const card = document.querySelector('#cartao');
    card?.addEventListener('click', openInvoiceDetails);
    card?.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openInvoiceDetails();
      }
    });

    const form = document.querySelector('#form');
    form?.addEventListener('submit', () => setTimeout(render, 80));
    window.addEventListener('agenda:remote-sync', () => setTimeout(render, 0));
    window.addEventListener('storage', event => {
      if (event.key === TASKS_KEY || event.key === NOTES_KEY) render();
    });
    render();
  }

  const style = document.createElement('style');
  style.textContent = `
    #cartao[role="link"]{cursor:pointer;transition:transform .18s ease,filter .18s ease}
    #cartao[role="link"]:hover{filter:brightness(1.08)}
    #cartao[role="link"]:active{transform:scale(.985)}
    #cartao[role="link"]:focus-visible{outline:2px solid #6ec9ff;outline-offset:3px}
    .invoice-row.is-cancelled{opacity:.82;background:linear-gradient(90deg,rgba(255,74,91,.12),transparent)}
    .cancel-badge{display:inline-flex;margin-left:7px;padding:2px 6px;border:1px solid #ff4a5b;border-radius:999px;background:rgba(255,74,91,.14);color:#ff7180;font-size:9px;font-weight:900;text-transform:uppercase;vertical-align:2px}
    .invoice-details{display:grid;gap:5px;margin-top:8px;padding:8px 9px;border:1px solid #343841;border-radius:10px;background:#181a1f}
    .invoice-details>span{color:#8f96a3;font-size:9px;font-weight:850;letter-spacing:.06em;text-transform:uppercase}
    .invoice-details label{display:flex;align-items:center;gap:7px;color:#d8dbe2;font-size:11px;line-height:1.3}
    .invoice-details input{width:16px;height:16px;margin:0;accent-color:#6ec9ff}
    .invoice-details i{font-style:normal}
    .invoice-details input:checked+i{text-decoration:line-through;color:#747b87}
  `;
  document.head.appendChild(style);

  window.AgendaFinanceCycle = {
    activeInvoice,
    cycleBounds,
    cycleLabel,
    dueLabel,
    invoiceKey,
    shiftKey
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install, { once: true });
  } else {
    install();
  }
})();
