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
  const badges = item => [
    item.n.assinatura ? '<span class="invoice-badge subscription">Assinatura</span>' : '',
    item.n.estornado ? '<span class="invoice-badge refunded">Estorno aceito</span>' : ''
  ].join('');

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
  let cursor = parseKey(requested) ? requested : activeInvoice();
  const label = () => { const p = parseKey(cursor); return p ? `${MONTHS[p.month-1]} de ${p.year}` : cursor; };
  const short = value => { const p = String(value || '').split('-'); return p.length === 3 ? `${p[2]}/${p[1]}` : value; };

  function installment(item) {
    const display = String(item.n.invoiceLabel || item.text || '');
    const match = /\((\d+)\s*\/\s*(\d+)\)/.exec(display);
    if (match) return { current:Number(match[1]), total:Number(match[2]) };
    const paid = Number(item.n.parcPagas), rest = Number(item.n.parcRest);
    return Number.isFinite(paid) && paid > 0 && Number.isFinite(rest) && rest >= 0 ? { current:paid, total:paid + rest } : null;
  }

  const normalizedInstallmentName = item => String(item.n.invoiceLabel || item.text || '')
    .replace(/\s*\(\d+\s*\/\s*\d+\)\s*$/,'').trim().toLocaleLowerCase('pt-BR');

  function installmentPlans(source) {
    const parsed = source.map(item => ({...item, installment:installment(item)}));
    const autoCounts = new Map();
    parsed.filter(item => item.installment && !item.n.installmentGroup && !item.n.invoiceMonth).forEach(item => {
      const signature = `${normalizedInstallmentName(item)}|${item.installment.total}|${amount(item.n.valor).toFixed(2)}`;
      autoCounts.set(signature,(autoCounts.get(signature) || 0) + 1);
    });
    const plans = new Map(), regular = [];
    parsed.forEach(item => {
      if (!item.installment) { regular.push(item); return; }
      const signature = `${normalizedInstallmentName(item)}|${item.installment.total}|${amount(item.n.valor).toFixed(2)}`;
      const key = item.n.installmentGroup
        ? `group:${item.n.installmentGroup}`
        : item.n.invoiceMonth || (autoCounts.get(signature) || 0) > 1
          ? `series:${signature}`
          : `item:${item.id}`;
      (plans.get(key) || plans.set(key,[]).get(key)).push(item);
    });
    return { plans, regular };
  }

  function projectPlan(entries) {
    const base = entries.slice().sort((a,b) => {
      const explicit = Number(Boolean(b.n.invoiceMonth)) - Number(Boolean(a.n.invoiceMonth));
      return explicit || a.installment.current - b.installment.current || String(a.date).localeCompare(String(b.date));
    })[0];
    const anchor = base.n.invoiceMonth || invoiceKey(base.date,base.n);
    const projectedNumber = base.installment.current + keyDistance(anchor,cursor);
    if (projectedNumber < 1 || projectedNumber > base.installment.total) return null;
    const original = entries.slice().sort((a,b) => String(a.date).localeCompare(String(b.date)))[0];
    const installmentEntry = entries.find(item => item.installment.current === projectedNumber) || base;
    const originalDate = String(original.date);
    const baseLabel = String(base.n.invoiceLabel || base.text || '').replace(/\s*\(\d+\s*\/\s*\d+\)\s*$/,'');
    const projectedLabel = `${baseLabel} (${projectedNumber}/${base.installment.total})`;
    return {
      ...original,
      date:originalDate,
      time:original.time || '',
      text:projectedLabel,
      n:{...original.n,...installmentEntry.n,invoiceLabel:projectedLabel,parcPagas:String(projectedNumber),parcRest:String(base.installment.total-projectedNumber)}
    };
  }

  function items() {
    const notes = read(NOTES_KEY, {});
    const source = read(TASKS_KEY, []).map(task => ({...task,n:notes[task.id] || {}}))
      .filter(task => task?.tag === 'financeiro' && !task.n.excludeFromInvoice && task.n.forma === 'inter' && kind(task,task.n) === 'saida' && !cancelled(task,task.n));
    const credits = read(TASKS_KEY, []).map(task => ({...task,n:notes[task.id] || {},credit:true}))
      .filter(task => task?.tag === 'financeiro' && !task.n.excludeFromInvoice && task.n.forma === 'inter' && kind(task,task.n) === 'entrada' && task.n.refaturamentoType === 'refund' && !cancelled(task,task.n))
      .filter(task => invoiceKey(task.date,task.n) === cursor);
    const { plans, regular } = installmentPlans(source);
    const projected = [...plans.values()].map(projectPlan).filter(Boolean);
    const oneTime = regular.filter(task => invoiceKey(task.date,task.n) === cursor);
    return oneTime.concat(projected,credits).sort((a,b) => `${b.date}${b.time || ''}`.localeCompare(`${a.date}${a.time || ''}`));
  }

  function detailsHtml(item) {
    const subs = Array.isArray(item.n.subs) ? item.n.subs : [];
    if (!subs.length) return item.n.detail ? `<div class="detail">${esc(item.n.detail)}</div>` : '';
    return `<div class="detail invoice-details"><span>Itens desta saída</span><div class="invoice-detail-boxes">${subs.map(sub =>
      `<span class="invoice-detail-box">${esc(sub.text || '')}</span>`
    ).join('')}</div></div>`;
  }

  function render() {
    const data = items(), total = data.reduce((sum,item) => sum + (item.credit ? -1 : 1) * amount(item.n.valor),0), bounds = cycleBounds(cursor);
    document.querySelector('#invoiceMonth').textContent = label();
    document.querySelector('#due').textContent = `Vence 02/${cursor.slice(5,7)}/${cursor.slice(0,4)}`;
    document.querySelector('#total').textContent = money(total);
    document.querySelector('#period').textContent = `Fatura de ${label()} · ciclo ${short(bounds.start)}–${short(bounds.end)}`;
    document.querySelector('#count').textContent = `${data.length} lançamento${data.length === 1 ? '' : 's'}`;
    const groups = {};
    data.forEach(item => { (groups[item.date] ||= []).push(item); });
    document.querySelector('#list').innerHTML = data.length ? Object.keys(groups).sort().reverse().map(date => {
      const rows = groups[date], subtotal = rows.reduce((sum,item) => sum + (item.credit ? -1 : 1) * amount(item.n.valor),0), weekday = WEEKDAYS[new Date(`${date}T12:00:00`).getDay()];
      return `<section class="day"><header class="day-head"><span>${short(date)} · ${weekday}</span><b>${subtotal < 0 ? '+ ' : '− '}${money(Math.abs(subtotal))}</b></header>${rows.map(item => `<article class="row ${item.credit ? 'credit' : ''}"><i class="dot"></i><div><div class="title">${esc(item.n.invoiceLabel || item.text)}${badges(item)}</div><div class="meta">${item.time ? `${esc(item.time)} · ` : ''}${item.credit ? 'Crédito na fatura Inter' : 'Cartão de crédito Inter'}</div>${detailsHtml(item)}</div><strong class="value">${item.credit ? '+ ' : '− '}${money(amount(item.n.valor))}</strong></article>`).join('')}</section>`;
    }).join('') : '<div class="empty">Nenhum lançamento do cartão Inter nesta fatura.</div>';
    document.querySelector('#updated').textContent = `Fatura ${label()} · atualização automática pela agenda`;
  }

  function moveInvoice(delta) {
    cursor = shiftKey(cursor,delta);
    const url = new URL(location.href);
    url.searchParams.set('fatura',cursor);
    history.replaceState(null,'',url);
    const card = document.querySelector('#invoiceCard');
    card.classList.remove('changing');
    void card.offsetWidth;
    card.classList.add('changing');
    render();
  }

  document.querySelector('#prevInvoice').addEventListener('click',() => moveInvoice(-1));
  document.querySelector('#nextInvoice').addEventListener('click',() => moveInvoice(1));
  window.addEventListener('agenda:remote-sync', render);
  window.addEventListener('storage', event => { if (event.key === TASKS_KEY || event.key === NOTES_KEY) render(); });
  const badgeStyle = document.createElement('style');
  badgeStyle.textContent = '.invoice-badge{display:inline-flex;margin-left:7px;padding:2px 6px;border-radius:999px;font-size:9px;font-weight:900;text-transform:uppercase;vertical-align:2px}.invoice-badge.subscription{border:1px solid #6ec9ff;background:rgba(110,201,255,.13);color:#82d2ff}.invoice-badge.refunded{border:1px solid #78d88b;background:rgba(120,216,139,.13);color:#8ce59d}';
  document.head.appendChild(badgeStyle);
  render();
})();
