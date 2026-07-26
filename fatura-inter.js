(() => {
  'use strict';

  const TASKS_KEY = 'agenda_lagares_v3';
  const NOTES_KEY = 'agenda_notas_v1';
  const ANCHOR_KEY = '2026-08';
  const ANCHOR_START = '2026-06-26';
  const ANCHOR_END = '2026-07-26';
  const MONTHS = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const WEEKDAYS = ['dom','seg','ter','qua','qui','sex','sáb'];
  const read = (key, fallback) => { try { const value = JSON.parse(localStorage.getItem(key) || ''); return value == null ? fallback : value; } catch (_) { return fallback; } };
  const amount = value => { const parsed = Number(String(value ?? '').replace(',', '.')); return Number.isFinite(parsed) ? parsed : 0; };
  const money = value => new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(value || 0);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const parseKey = key => /^\d{4}-\d{2}$/.test(String(key || '')) ? { year:Number(key.slice(0,4)), month:Number(key.slice(5,7)) } : null;
  const keyFrom = (year, month) => { const date = new Date(Date.UTC(year, month - 1, 1)); return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2,'0')}`; };
  const shiftKey = (key, delta) => { const parsed = parseKey(key); return parsed ? keyFrom(parsed.year, parsed.month + delta) : ANCHOR_KEY; };
  const keyDistance = (from, to) => { const a = parseKey(from), b = parseKey(to); return a && b ? (b.year-a.year)*12+b.month-a.month : 0; };
  const dateFor = (year, month, day) => `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  const kind = (task, note) => note.movimento || (/cobrar|sal[aá]rio|receber/i.test(task.text || '') ? 'entrada' : /mesada|mayara/i.test(task.text || '') ? 'saida' : amount(note.valor) > 0 ? 'entrada' : 'sem valor');
  const cancelled = (task, note) => Boolean(note.cancelado || task.flag === 'cancelado' || /cancelad[oa]/i.test(task.text || ''));

  function invoiceKey(dateValue, note = {}) {
    if (/^\d{4}-\d{2}$/.test(String(note.invoiceMonth || ''))) return note.invoiceMonth;
    const value = String(dateValue || '').slice(0,10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
    if (value >= ANCHOR_START && value <= ANCHOR_END) return ANCHOR_KEY;
    const [year, month, day] = value.split('-').map(Number);
    return keyFrom(year, month + (value > ANCHOR_END ? (day <= 26 ? 1 : 2) : (day >= 26 ? 2 : 1)));
  }

  function activeInvoice(date = new Date()) {
    const today = dateFor(date.getFullYear(), date.getMonth() + 1, date.getDate());
    const computed = invoiceKey(today);
    return today >= ANCHOR_START && (date.getDate() >= 27 || date.getDate() <= 2) ? shiftKey(computed, -1) : computed;
  }

  function cycleBounds(key) {
    const parsed = parseKey(key), distance = keyDistance(ANCHOR_KEY, key);
    if (!parsed || distance === 0) return { start:ANCHOR_START, end:ANCHOR_END };
    if (distance > 0) {
      const previousDue = parseKey(shiftKey(key,-2)), closingMonth = parseKey(shiftKey(key,-1));
      return { start:dateFor(previousDue.year, previousDue.month, 27), end:dateFor(closingMonth.year, closingMonth.month, 26) };
    }
    const starting = parseKey(shiftKey(key,-2)), previous = parseKey(shiftKey(key,-1));
    const end = new Date(Date.UTC(previous.year, previous.month - 1, 25));
    return { start:dateFor(starting.year, starting.month, 26), end:dateFor(end.getUTCFullYear(),end.getUTCMonth()+1,end.getUTCDate()) };
  }

  const query = new URLSearchParams(location.search);
  const requested = query.get('fatura');
  const cursor = parseKey(requested) ? requested : activeInvoice();
  const label = () => { const p = parseKey(cursor); return p ? `${MONTHS[p.month-1]} de ${p.year}` : cursor; };
  const short = value => { const p = String(value || '').split('-'); return p.length === 3 ? `${p[2]}/${p[1]}` : value; };

  function items() {
    const notes = read(NOTES_KEY, {});
    return read(TASKS_KEY, []).map(task => ({...task,n:notes[task.id] || {}}))
      .filter(task => task?.tag === 'financeiro' && !task.n.excludeFromInvoice && task.n.forma === 'inter' && kind(task,task.n) === 'saida' && !cancelled(task,task.n) && invoiceKey(task.date,task.n) === cursor)
      .sort((a,b) => `${b.date}${b.time || ''}`.localeCompare(`${a.date}${a.time || ''}`));
  }

  function render() {
    const data = items(), total = data.reduce((sum,item) => sum + amount(item.n.valor),0), bounds = cycleBounds(cursor);
    document.querySelector('#due').textContent = `Vence 02/${cursor.slice(5,7)}/${cursor.slice(0,4)}`;
    document.querySelector('#total').textContent = money(total);
    document.querySelector('#period').textContent = `Fatura de ${label()} · ciclo ${short(bounds.start)}–${short(bounds.end)}`;
    document.querySelector('#count').textContent = `${data.length} lançamento${data.length === 1 ? '' : 's'}`;
    const groups = {};
    data.forEach(item => { (groups[item.date] ||= []).push(item); });
    document.querySelector('#list').innerHTML = data.length ? Object.keys(groups).sort().reverse().map(date => {
      const rows = groups[date], subtotal = rows.reduce((sum,item) => sum + amount(item.n.valor),0), weekday = WEEKDAYS[new Date(`${date}T12:00:00`).getDay()];
      return `<section class="day"><header class="day-head"><span>${short(date)} · ${weekday}</span><b>− ${money(subtotal)}</b></header>${rows.map(item => `<article class="row"><i class="dot"></i><div><div class="title">${esc(item.n.invoiceLabel || item.text)}</div><div class="meta">${item.time ? `${esc(item.time)} · ` : ''}Cartão de crédito Inter</div>${item.n.detail ? `<div class="detail">${esc(item.n.detail)}</div>` : ''}</div><strong class="value">− ${money(amount(item.n.valor))}</strong></article>`).join('')}</section>`;
    }).join('') : '<div class="empty">Nenhuma saída do cartão Inter nesta fatura.</div>';
    document.querySelector('#updated').textContent = `Fatura ${label()} · atualização automática pela agenda`;
  }

  window.addEventListener('agenda:remote-sync', render);
  window.addEventListener('storage', event => { if (event.key === TASKS_KEY || event.key === NOTES_KEY) render(); });
  render();
})();
