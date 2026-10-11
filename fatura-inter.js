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

  function projectPlan(entries, key = cursor) {
    const base = entries.slice().sort((a,b) => {
      const explicit = Number(Boolean(b.n.invoiceMonth)) - Number(Boolean(a.n.invoiceMonth));
      return explicit || a.installment.current - b.installment.current || String(a.date).localeCompare(String(b.date));
    })[0];
    const anchor = base.n.invoiceMonth || invoiceKey(base.date,base.n);
    const projectedNumber = base.installment.current + keyDistance(anchor,key);
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

  function itemsFor(key) {
    const notes = read(NOTES_KEY, {});
    const source = read(TASKS_KEY, []).map(task => ({...task,n:notes[task.id] || {}}))
      .filter(task => task?.tag === 'financeiro' && !task.n.excludeFromInvoice && task.n.forma === 'inter' && kind(task,task.n) === 'saida' && !cancelled(task,task.n));
    const credits = read(TASKS_KEY, []).map(task => ({...task,n:notes[task.id] || {},credit:true}))
      .filter(task => task?.tag === 'financeiro' && !task.n.excludeFromInvoice && task.n.forma === 'inter' && kind(task,task.n) === 'entrada' && task.n.refaturamentoType === 'refund' && !cancelled(task,task.n))
      .filter(task => invoiceKey(task.date,task.n) === key);
    const { plans, regular } = installmentPlans(source);
    const projected = [...plans.values()].map(entries => projectPlan(entries, key)).filter(Boolean);
    const oneTime = regular.filter(task => invoiceKey(task.date,task.n) === key);
    return oneTime.concat(projected,credits).sort((a,b) => `${b.date}${b.time || ''}`.localeCompare(`${a.date}${a.time || ''}`));
  }
  const items = () => itemsFor(cursor);

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
      return `<section class="day"><header class="day-head"><span>${short(date)} · ${weekday}</span><b>${subtotal < 0 ? '+ ' : '− '}${money(Math.abs(subtotal))}</b></header>${rows.map(item => `<article class="row ${item.credit ? 'credit' : ''}"><i class="dot"></i><div><div class="title">${esc(item.n.invoiceLabel || item.text)}${badges(item)}${lancBadge(item)}</div><div class="meta">${item.time ? `${esc(item.time)} · ` : ''}${metaOf(item)}</div>${item.n.estornoInfo ? `<div class="meta par">${esc(item.n.estornoInfo)}</div>` : ''}${detailsHtml(item)}</div><strong class="value">${item.credit ? '+ ' : '− '}${money(amount(item.n.valor))}</strong></article>`).join('')}</section>`;
    }).join('') : '<div class="empty">Nenhum lançamento do cartão Inter nesta fatura.</div>';
    renderResumo(data);
    document.querySelector('#updated').textContent = `Fatura ${label()} · atualização automática pela agenda`;
  }

  // ---- Resumo da fatura e visão do ano: tipo (consumo, refaturamento...), compra x estorno e categoria.
  // Os campos faturaTipo, categoria, lancamento e estornoInfo ficam na nota de cada lançamento; sem eles,
  // o tipo é deduzido pelo nome e pelo crédito, e a categoria fica como "Sem categoria".
  const TIPOS = [
    ['consumo','Consumo','o que você comprou'],
    ['refat','Refaturamento','passado na maquininha do Mercado Pago; não é consumo'],
    ['encargos','IOF','imposto sobre compra em moeda estrangeira'],
    ['saldo','Saldo de fatura anterior','valor que passou de uma fatura para a seguinte'],
    ['ajustes','Créditos do banco','resgate de pontos e outros créditos que não devolvem compra']
  ];
  const TIPO_NOME = Object.fromEntries(TIPOS.map(t => [t[0], t[1]]));
  const LANCS = [['compra','Compras'],['estorno','Estornos'],['estorno_desfeito','Estornos desfeitos']];
  const nameOf = item => String(item.n.invoiceLabel || item.text || '');
  const tipoOf = item => TIPO_NOME[item.n.faturaTipo] ? item.n.faturaTipo
    : /refaturamento/i.test(nameOf(item)) ? 'refat'
    : /^iof\b/i.test(nameOf(item)) ? 'encargos'
    : /^saldo da fatura/i.test(nameOf(item)) ? 'saldo' : 'consumo';
  const lancOf = item => {
    const tipo = tipoOf(item);
    if (tipo !== 'consumo' && tipo !== 'refat') return '';
    if (['compra','estorno','estorno_desfeito'].includes(item.n.lancamento)) return item.n.lancamento;
    return item.credit ? 'estorno' : /^revers[aã]o de cr[eé]dito/i.test(nameOf(item)) ? 'estorno_desfeito' : 'compra';
  };
  const catOf = item => String(item.n.categoria || '') || 'Sem categoria';
  const cents = value => Math.round(value * 100);
  const signedCents = item => (item.credit ? -1 : 1) * cents(amount(item.n.valor));
  const fromCents = value => value / 100;
  const pct = (part, whole) => { const p = whole ? part / whole * 100 : 0; return `${part && Math.abs(p) < 0.05 ? '<0,1' : p.toLocaleString('pt-BR',{maximumFractionDigits:1})}%`; };
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const MONTH_SHORT = MONTHS.map(m => m.slice(0,3));
  const monthShort = key => `${MONTH_SHORT[Number(key.slice(5,7)) - 1]}/${key.slice(2,4)}`;

  function lancBadge(item) {
    const lanc = lancOf(item);
    if (lanc === 'estorno') return '<span class="invoice-badge estorno">Estorno</span>';
    if (lanc === 'estorno_desfeito') return '<span class="invoice-badge desfeito">Estorno desfeito</span>';
    if (lanc === 'compra' && item.n.estornoInfo) return `<span class="invoice-badge estornada">${/voltou a ser cobrado/.test(item.n.estornoInfo) ? 'Estornada e cobrada de novo' : 'Estornada'}</span>`;
    return '';
  }
  function metaOf(item) {
    const tipo = tipoOf(item);
    if (tipo === 'consumo') return esc(catOf(item));
    if (tipo === 'refat') return item.credit ? 'Refaturamento · crédito na fatura' : 'Refaturamento';
    return esc(TIPO_NOME[tipo]);
  }

  function resumo(list) {
    const tipos = Object.fromEntries(TIPOS.map(t => [t[0], 0]));
    const ce = { consumo:{}, refat:{} };
    ['consumo','refat'].forEach(t => LANCS.forEach(([l]) => { ce[t][l] = { n:0, v:0, items:[] }; }));
    const cats = new Map();
    list.forEach(item => {
      const tipo = tipoOf(item), v = signedCents(item), lanc = lancOf(item);
      tipos[tipo] += v;
      if (lanc) { const box = ce[tipo][lanc]; box.n += 1; box.v += v; box.items.push(item); }
      if (tipo === 'consumo') {
        const cat = catOf(item);
        if (!cats.has(cat)) cats.set(cat, { nome:cat, v:0, items:[] });
        const c = cats.get(cat); c.v += v; c.items.push(item);
      }
    });
    return { tipos, ce, cats:[...cats.values()].sort((a,b) => b.v - a.v), total:Object.values(tipos).reduce((a,b) => a + b, 0) };
  }

  function barraHtml(tipos, ce) {
    const parts = TIPOS.filter(t => tipos[t[0]] !== 0), pos = parts.filter(t => tipos[t[0]] > 0);
    const base = pos.reduce((a,t) => a + tipos[t[0]], 0), total = parts.reduce((a,t) => a + tipos[t[0]], 0), neg = parts.filter(t => tipos[t[0]] < 0);
    const detail = t => { const c = ce && ce[t]; if (!c || (!c.estorno.n && !c.estorno_desfeito.n)) return '';
      return `<small>compras ${money(fromCents(c.compra.v))} − estornos ${money(fromCents(-c.estorno.v))}${c.estorno_desfeito.n ? ` + estornos desfeitos ${money(fromCents(c.estorno_desfeito.v))}` : ''}</small>`; };
    return `<div class="stack">${pos.map(t => `<i class="k-${t[0]}" style="width:${tipos[t[0]] / base * 100}%" title="${t[1]}"></i>`).join('')}</div>
      <ul class="legend">${parts.map(t => `<li><span class="sw k-${t[0]}"></span><span>${t[1]}<small>${t[2]}</small>${detail(t[0])}</span><span class="v">${money(fromCents(tipos[t[0]]))}<small>${pct(tipos[t[0]], total)} do total</small></span></li>`).join('')}
      ${neg.length ? `<li class="legend-note"><span></span><small>${neg.map(t => t[1]).join(' e ')} ${neg.length > 1 ? 'são negativos e reduzem' : 'é negativo e reduz'} o total. A barra mostra só as partes positivas; os percentuais são sobre ${money(fromCents(total))}.</small><span></span></li>` : ''}</ul>`;
  }

  function ceHtml(ce, tipos) {
    return ['consumo','refat'].filter(t => LANCS.some(([l]) => ce[t][l].n)).map(t => `<div class="ce" data-tipo="${t}"><h3>${TIPO_NOME[t]}</h3>${LANCS.filter(([l]) => l !== 'estorno_desfeito' || ce[t][l].n).map(([l, nome]) =>
      `<div class="ln" data-lanc="${l}"><span>${nome}<small>${ce[t][l].n ? plural(ce[t][l].n,'lançamento','lançamentos') : 'nenhum'}</small></span><b>${money(fromCents(ce[t][l].v))}</b></div>`).join('')}
      <div class="ln tot" data-lanc="liquido"><span>Líquido</span><b>${money(fromCents(tipos[t]))}</b></div></div>`).join('');
  }

  function miniRow(item, extra = '') {
    return `<li class="${item.credit ? 'credit' : ''}"><span class="d">${short(item.date)}</span><span>${esc(nameOf(item))}${lancBadge(item)}${item.n.estornoInfo ? `<small>${esc(item.n.estornoInfo)}</small>` : ''}${extra}</span><b class="val" data-v="${fromCents(signedCents(item))}">${signedCents(item) < 0 ? '+ ' : '− '}${money(fromCents(Math.abs(signedCents(item))))}</b></li>`;
  }
  function miniList(list, extra) {
    const dev = list.filter(i => ['estorno','estorno_desfeito'].includes(lancOf(i))), rest = list.filter(i => !dev.includes(i));
    const order = arr => arr.slice().sort((a,b) => Math.abs(signedCents(b)) - Math.abs(signedCents(a)));
    return `<ul class="mini">${order(rest).map(i => miniRow(i, extra ? extra(i) : '')).join('')}${dev.length && rest.length ? `<li class="sub">${dev.some(i => lancOf(i) === 'estorno_desfeito') ? 'Estornos e estornos desfeitos' : dev.length === 1 ? 'Estorno' : 'Estornos'}</li>` : ''}${order(dev).map(i => miniRow(i, extra ? extra(i) : '')).join('')}</ul>`;
  }
  const countsOf = list => { const n = { compra:0, estorno:0, estorno_desfeito:0 }; list.forEach(i => { const l = lancOf(i); if (l) n[l] += 1; });
    return [n.compra ? plural(n.compra,'compra','compras') : '', n.estorno ? plural(n.estorno,'estorno','estornos') : '', n.estorno_desfeito ? plural(n.estorno_desfeito,'estorno desfeito','estornos desfeitos') : ''].filter(Boolean).join(' · '); };

  function renderResumo(data) {
    const r = resumo(data), box = document.querySelector('#resumo');
    if (!data.length) { box.hidden = true; return; }
    box.hidden = false;
    document.querySelector('#barra').innerHTML = barraHtml(r.tipos, r.ce);
    document.querySelector('#ceGrid').innerHTML = ceHtml(r.ce, r.tipos);
    const devs = ['consumo','refat'].flatMap(t => r.ce[t].estorno.items.concat(r.ce[t].estorno_desfeito.items));
    document.querySelector('#ceNota').textContent = devs.length
      ? 'Estorno é dinheiro que o banco devolveu de uma compra; estorno desfeito é quando o banco cancela o estorno e cobra de novo. Os estornos já estão descontados nos totais.'
      : 'Nenhum estorno nesta fatura: todos os lançamentos são compras.';
    const totC = r.tipos.consumo, max = Math.max(1, ...r.cats.map(c => c.v));
    document.querySelector('#catsTitle').textContent = `CONSUMO POR CATEGORIA · ${money(fromCents(totC))}`;
    document.querySelector('#catsBox').hidden = !r.cats.length;
    document.querySelector('#cats').innerHTML = r.cats.map(c => `<details><summary><span class="nm">${esc(c.nome)}<small>${countsOf(c.items)}</small></span><span class="v">${money(fromCents(c.v))}<small>${pct(c.v, totC)}</small></span><span class="track"><i style="width:${Math.max(0, c.v) / max * 100}%"></i></span></summary>${miniList(c.items)}</details>`).join('');
  }

  // ---- Visão do ano: as 12 faturas do ano (fechadas, a aberta e as seguintes, só com o que já está lançado)
  const params = new URLSearchParams(location.search);
  let YEAR = /^\d{4}$/.test(params.get('ano') || '') ? Number(params.get('ano')) : Number(activeInvoice().slice(0,4));
  const ST = { fechada:'fechada', aberta:'aberta', prevista:'só o que já está lançado' };
  function anoData() {
    const ativo = activeInvoice();
    return Array.from({ length:12 }, (_, i) => {
      const key = keyFrom(YEAR, i + 1), list = itemsFor(key);
      return { key, list, r:resumo(list), st:key < ativo ? 'fechada' : key === ativo ? 'aberta' : 'prevista' };
    });
  }
  function renderAno() {
    const meses = anoData(), sum = f => meses.reduce((a,m) => a + f(m), 0);
    const tipos = Object.fromEntries(TIPOS.map(t => [t[0], sum(m => m.r.tipos[t[0]])]));
    const ce = { consumo:{}, refat:{} };
    ['consumo','refat'].forEach(t => LANCS.forEach(([l]) => { ce[t][l] = { n:sum(m => m.r.ce[t][l].n), v:sum(m => m.r.ce[t][l].v), items:[] }; }));
    const somaFaturas = sum(m => m.r.total), saldo = tipos.saldo, total = somaFaturas - saldo;
    const st = k => sum(m => m.st === k ? m.r.total - m.r.tipos.saldo : 0);
    const partes = [['fechada','Faturas fechadas',`${meses.filter(m => m.st === 'fechada').length} até agora`], ['aberta','Fatura aberta', meses.filter(m => m.st === 'aberta').map(m => monthShort(m.key)).join(', ') || '—'], ['prevista','Faturas seguintes','só parcelas e lançamentos já feitos']].map(p => [...p, st(p[0])]).filter(p => p[3] !== 0);
    document.querySelector('#anoTotal').textContent = money(fromCents(total));
    document.querySelector('#anoSub').textContent = `Soma das 12 faturas de ${YEAR}, sem contar duas vezes o saldo que passou de uma fatura para a seguinte.`;
    document.querySelector('#anoStatus').innerHTML = `<div class="stack">${partes.map(p => `<i class="k-${p[0]}" style="width:${Math.max(0, p[3]) / Math.max(1, total) * 100}%"></i>`).join('')}</div>
      <ul class="legend">${partes.map(p => `<li><span class="sw k-${p[0]}"></span><span>${p[1]}<small>${esc(p[2])}</small></span><span class="v">${money(fromCents(p[3]))}<small>${pct(p[3], total)} do total</small></span></li>`).join('')}</ul>
      <p class="note">Compras novas ainda podem entrar nas faturas abertas e seguintes, então o total do ano ainda vai subir. A conta é por fatura: a de janeiro traz compras do fim de ${YEAR - 1}.</p>`;
    const t2 = { ...tipos }; t2.saldo = 0;
    document.querySelector('#anoBarra').innerHTML = barraHtml(t2, ce);
    document.querySelector('#anoCe').innerHTML = ceHtml(ce, t2);
    const maxC = Math.max(1, ...meses.map(m => m.r.tipos.consumo));
    document.querySelector('#anoBars').innerHTML = meses.map(m => `<button type="button" data-key="${m.key}" aria-label="${monthShort(m.key)}, ${ST[m.st]}: consumo ${money(fromCents(m.r.tipos.consumo))}. Abrir a fatura"><span class="lbl">${(m.r.tipos.consumo / 100000).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1})}</span><span class="col k-${m.st}" style="height:${Math.max(0, m.r.tipos.consumo) / maxC * 100}%"></span></button>`).join('');
    document.querySelector('#anoBarsX').innerHTML = meses.map(m => `<span>${MONTH_SHORT[Number(m.key.slice(5,7)) - 1]}</span>`).join('');
    document.querySelectorAll('#anoBars button').forEach(b => b.addEventListener('click', () => { cursor = b.dataset.key; setView('fatura'); window.scrollTo({ top:0 }); }));
    const cel = v => (v / 100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
    const outros = r => r.tipos.encargos + r.tipos.ajustes;
    document.querySelector('#anoTab').innerHTML = `<thead><tr><th>Fatura</th><th>Situação</th><th>Consumo</th><th>Refaturamento</th><th>IOF e créditos</th><th>Saldo anterior</th><th>Total</th></tr></thead><tbody>${meses.map(m =>
      `<tr><td>${monthShort(m.key)}</td><td class="st">${ST[m.st]}</td><td>${cel(m.r.tipos.consumo)}</td><td>${cel(m.r.tipos.refat)}</td><td>${cel(outros(m.r))}</td><td>${cel(m.r.tipos.saldo)}</td><td>${cel(m.r.total)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td>Soma</td><td></td><td>${cel(tipos.consumo)}</td><td>${cel(tipos.refat)}</td><td>${cel(tipos.encargos + tipos.ajustes)}</td><td>${cel(saldo)}</td><td>${cel(somaFaturas)}</td></tr>
      <tr><td colspan="6" class="st">Total do ano, sem o saldo repassado</td><td>${cel(total)}</td></tr></tfoot>`;
    const cats = new Map();
    meses.forEach((m, i) => m.r.cats.forEach(c => { if (!cats.has(c.nome)) cats.set(c.nome, { nome:c.nome, v:0, mes:Array(12).fill(0), items:[] }); const x = cats.get(c.nome); x.v += c.v; x.mes[i] += c.v; x.items.push(...c.items); }));
    const lista = [...cats.values()].sort((a,b) => b.v - a.v), maxCat = Math.max(1, ...lista.map(c => c.v));
    document.querySelector('#anoCatsTitle').textContent = `CONSUMO POR CATEGORIA EM ${YEAR} · ${money(fromCents(tipos.consumo))}`;
    document.querySelector('#anoCats').innerHTML = lista.map(c => { const mx = Math.max(1, ...c.mes);
      return `<details><summary><span class="nm">${esc(c.nome)}<small>${countsOf(c.items)}</small></span><span class="v">${money(fromCents(c.v))}<small>${pct(c.v, tipos.consumo)}</small></span><span class="track"><i style="width:${Math.max(0, c.v) / maxCat * 100}%"></i></span>
        <span class="spark" aria-hidden="true">${c.mes.map((v, i) => `<i class="${v > 0 ? `k-${meses[i].st}` : 'z'}" style="height:${v > 0 ? Math.max(8, v / mx * 100) : 8}%"></i>`).join('')}</span></summary>
        <ul class="mini months">${meses.map((m, i) => `<li><span class="d">${MONTH_SHORT[i]}</span><span>${monthShort(m.key)}<small>${ST[m.st]}</small></span><b class="val" data-v="${fromCents(c.mes[i])}">${money(fromCents(c.mes[i]))}</b></li>`).join('')}</ul></details>`; }).join('');
    document.querySelector('#anoLabel').textContent = String(YEAR);
    document.querySelector('#anoBrand').textContent = `Inter Black · ${YEAR}`;
    document.querySelector('#anoBarraTitle').textContent = `PARA ONDE FOI O DINHEIRO EM ${YEAR}`;
    document.querySelector('#anoCeTitle').textContent = `COMPRAS E ESTORNOS EM ${YEAR}`;
    document.querySelector('#anoBars').setAttribute('aria-label', `Consumo por fatura de ${YEAR}, em R$ mil`);
    document.querySelector('#updated').textContent = `Ano ${YEAR} · ${meses.length} faturas · atualização automática pela agenda`;
  }

  let view = params.get('visao') === 'ano' ? 'ano' : 'fatura';
  function setView(next) {
    view = next;
    document.querySelectorAll('#views button').forEach(b => b.setAttribute('aria-selected', String(b.dataset.view === view)));
    document.querySelector('#viewFatura').hidden = view !== 'fatura';
    document.querySelector('#viewAno').hidden = view !== 'ano';
    document.querySelector('#tabAno').textContent = `Ano ${YEAR}`;
    const url = new URL(location.href);
    if (view === 'ano') { url.searchParams.set('visao', 'ano'); url.searchParams.set('ano', String(YEAR)); }
    else { url.searchParams.delete('visao'); url.searchParams.delete('ano'); url.searchParams.set('fatura', cursor); }
    history.replaceState(null,'',url);
    draw();
  }
  function draw() { if (view === 'ano') renderAno(); else render(); }
  document.querySelectorAll('#views button').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
  document.querySelector('#prevYear').addEventListener('click', () => { YEAR -= 1; setView('ano'); });
  document.querySelector('#nextYear').addEventListener('click', () => { YEAR += 1; setView('ano'); });

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
  window.addEventListener('agenda:remote-sync', draw);
  window.addEventListener('storage', event => { if (event.key === TASKS_KEY || event.key === NOTES_KEY) draw(); });
  const badgeStyle = document.createElement('style');
  badgeStyle.textContent = '.invoice-badge{display:inline-flex;margin-left:7px;padding:2px 6px;border-radius:999px;font-size:9px;font-weight:900;text-transform:uppercase;vertical-align:2px}.invoice-badge.subscription{border:1px solid #6ec9ff;background:rgba(110,201,255,.13);color:#82d2ff}.invoice-badge.refunded{border:1px solid #78d88b;background:rgba(120,216,139,.13);color:#8ce59d}.invoice-badge.estorno{border:1px solid #78d88b;background:rgba(120,216,139,.13);color:#8ce59d}.invoice-badge.estornada{border:1px dashed #78d88b;color:#8ce59d}.invoice-badge.desfeito{border:1px solid #ffb36b;background:rgba(255,179,107,.12);color:#ffc185}';
  document.head.appendChild(badgeStyle);
  setView(view);
})();
