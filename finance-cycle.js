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

  function dedupeInstallments(items) {
    const regular = [];
    const grouped = new Map();
    items.forEach(item => {
      const group = item.n.installmentGroup;
      if (!group) {
        regular.push(item);
        return;
      }
      const previous = grouped.get(group);
      const explicit = item.n.invoiceMonth === cursor ? 1 : 0;
      const previousExplicit = previous?.n.invoiceMonth === cursor ? 1 : 0;
      if (!previous || explicit > previousExplicit
        || (explicit === previousExplicit && String(item.date) < String(previous.date))) {
        grouped.set(group, item);
      }
    });
    return regular.concat([...grouped.values()]);
  }

  function financialInvoiceItems(key = cursor) {
    const notes = read(NOTES_KEY, {});
    const matches = read(TASKS_KEY, [])
      .filter(task => task && task.text)
      .map(task => ({ ...task, n: notes[task.id] || {} }))
      .filter(task => task.tag === 'financeiro'
        && (!task.n.excludeFromInvoice || task.n.processando)
        && (kind(task, task.n) === 'saida' || kind(task, task.n) === 'entrada')
        && invoiceKey(task.date, task.n) === key);
    return dedupeInstallments(matches)
      .sort((a, b) => `${a.date}${a.time || ''}`.localeCompare(`${b.date}${b.time || ''}`));
  }

  function invoiceItems(key = cursor) {
    return financialInvoiceItems(key).filter(task => isInter(task, task.n));
  }

  // A tela inicial também precisa mostrar cobranças ainda abertas do mês em
  // curso, mesmo quando elas não caem em uma regra específica da fatura.
  function pendingReceivables() {
    const notes = read(NOTES_KEY, {});
    const calendarKey = cycleBounds(cursor).end.slice(0, 7);
    return read(TASKS_KEY, [])
      .filter(task => task && task.text && !task.done && String(task.date || '').startsWith(calendarKey))
      .map(task => ({ ...task, n: notes[task.id] || {} }))
      .filter(task => task.tag === 'financeiro'
        && kind(task, task.n) === 'entrada'
        && !isCancelled(task, task.n))
      .sort((a, b) => `${a.date}${a.time || ''}`.localeCompare(`${b.date}${b.time || ''}`));
  }

  // Lista do período: compras do cartão desta fatura + todo o resto do dia 03
  // ao dia 02 (o período fecha no vencimento da fatura).
  function visibleFinancialItems(items) {
    const byId = new Map(items.filter(item => item.n.forma === 'inter').map(item => [String(item.id), item]));
    const { ini, fim } = periodoDe(cursor);
    const notes = read(NOTES_KEY, {});
    read(TASKS_KEY, [])
      .filter(task => task && task.tag === 'financeiro' && String(task.date || '') >= ini && String(task.date || '') <= fim)
      .map(task => ({ ...task, n: notes[task.id] || {} }))
      .filter(task => task.n.forma !== 'inter')
      .forEach(item => byId.set(String(item.id), item));
    return [...byId.values()].sort((a, b) => `${a.date}${a.time || ''}`.localeCompare(`${b.date}${b.time || ''}`));
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
    return `<div class="invoice-details"><span>Itens desta saída</span><div class="invoice-detail-boxes">${subs.map(sub =>
      `<span class="invoice-detail-box">${esc(sub.text || '')}</span>`
    ).join('')}</div></div>`;
  }

  function rowHtml(item) {
    const movement = kind(item, item.n);
    const value = amount(item.n.valor);
    const cancelled = isCancelled(item, item.n);
    const processing = Boolean(item.n.processando);
    const pendingReceive = movement === 'entrada' && !item.done && !cancelled;
    const displayText = item.n.invoiceLabel || item.text;
    const lifecycleBadge = cancelled
      ? '<span class="cancel-badge">Cancelado</span>'
      : processing ? '<span class="processing-badge">Em processamento</span>'
        : pendingReceive ? '<span class="pending-badge">Pendente</span>' : '';
    const subscriptionBadge = item.n.assinatura
      ? '<span class="subscription-badge">Assinatura</span>' : '';
    const refundBadge = item.n.estornado
      ? '<span class="refund-badge">Estorno aceito</span>' : '';
    const statusBadge = lifecycleBadge + subscriptionBadge + refundBadge;
    const sign = movement === 'entrada' ? '+' : '−';
    const marker = movement === 'entrada' ? '+' : '−';
    const installment = /\((\d+\/\d+)\)/.exec(displayText || '');
    const paymentLabel = movement === 'entrada'
      ? `Entrada/crédito${item.n.conta === 'nb' ? ' · Nubank' : item.n.conta === 'mp' ? ' · Mercado Pago' : ''}`
      : item.n.forma === 'inter'
        ? 'Cartão Inter'
        : item.n.forma === 'pix'
          ? `Pix${item.n.conta === 'nb' ? ' · Nubank' : item.n.conta === 'mp' ? ' · Mercado Pago' : ''}`
          : item.n.forma === 'dinheiro' ? 'Dinheiro'
            : item.n.forma === 'pluxee' ? 'Pluxee Alimentação' : 'Saída';
    return `<article class="row invoice-row${cancelled ? ' is-cancelled' : ''}${processing ? ' is-processing' : ''}">
      <span class="paidmark" aria-hidden="true">${marker}</span>
      <div>
        <div class="title">${esc(displayText)}${statusBadge}</div>
        <div class="meta">${formatLong(item.date)}${item.time ? ` ${esc(item.time)}` : ''} · ${paymentLabel}${installment ? ` · Parcela ${installment[1]}` : ''}</div>
        ${detailsHtml(item)}
        ${pendingReceive ? `<div class="receive-actions"><button type="button" data-receive-open="${esc(item.id)}">✓ Marcar como recebido</button></div>` : ''}
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
        if (isCancelled(item, item.n) || item.n.processando || (kind(item, item.n) === 'entrada' && !item.done)) return total;
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

  // ---- Período do dia 03 ao dia 02: fecha no vencimento da fatura Inter ----
  const hojeLocal = () => { const h = new Date(); return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, '0')}-${String(h.getDate()).padStart(2, '0')}`; };
  const compacto = v => v >= 1000 ? `${(v / 1000).toFixed(1).replace('.', ',')} mil` : String(Math.round(v));
  const ddmm = d => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
  function periodoDe(key) {
    const ref = parseKey(key), ant = parseKey(shiftKey(key, -1));
    return { ini: dateFor(ant.year, ant.month, 3), fim: dateFor(ref.year, ref.month, 2) };
  }
  // O mesmo valor do cartão "Inter Black": compras menos créditos da fatura.
  function faturaDe(key) {
    const ativos = invoiceItems(key).filter(t => !isCancelled(t, t.n) && !t.n.processando);
    const soma = k => ativos.filter(t => kind(t, t.n) === k).reduce((s, t) => s + amount(t.n.valor), 0);
    return { total: Math.max(0, soma('saida') - soma('entrada')), itens: ativos };
  }
  // Saldo = dinheiro no Mercado Pago (Giro) + Nubank, o mesmo do card "Saldo atual em conta".
  const saldoHoje = () => { const c = read('agenda_contas_v1', {}); return (Number(c.mp) || 0) + (Number(c.nb) || 0); };

  function periodoResumo(key, nivel = 0) {
    const { ini, fim } = periodoDe(key);
    const hoje = hojeLocal();
    const notes = read(NOTES_KEY, {});
    const lanc = read(TASKS_KEY, [])
      .filter(t => t && t.text && t.tag === 'financeiro' && String(t.date || '') >= ini && String(t.date || '') <= fim)
      .map(t => ({ ...t, n: notes[t.id] || {} }))
      .filter(t => !isCancelled(t, t.n) && !t.n.processando && amount(t.n.valor) > 0 && t.n.forma !== 'inter'
        && (kind(t, t.n) === 'entrada' || kind(t, t.n) === 'saida'))
      .map(t => {
        const ent = kind(t, t.n) === 'entrada';
        // entrada só conta como recebida quando marcada; saída já saiu se a data passou (ou foi marcada)
        const feito = ent ? !!t.done : (!!t.done || (t.date <= hoje && !t.n.programada));
        return { date: t.date, valor: amount(t.n.valor), ent, feito, cat: t.n.categoria || 'Sem categoria' };
      });
    const fat = faturaDe(key);
    // a fatura entra inteira no vencimento (considerada paga a partir do dia)
    if (fat.total > 0) lanc.push({ date: fim, valor: fat.total, ent: false, feito: hoje >= fim, fatura: true });
    const soma = f => lanc.filter(f).reduce((s, x) => s + x.valor, 0);
    const entradas = soma(x => x.ent), saidas = soma(x => !x.ent);
    const fase = hoje > fim ? 'passado' : hoje < ini ? 'futuro' : 'atual';
    let base = 0, receber, pagar, atrasadas = 0;
    if (fase === 'atual') {
      base = saldoHoje();
      receber = soma(x => x.ent && !x.feito && x.date >= hoje);
      atrasadas = soma(x => x.ent && !x.feito && x.date < hoje);
      pagar = soma(x => !x.ent && !x.feito && x.date >= hoje);
    } else if (fase === 'futuro') {
      base = nivel < 24 ? periodoResumo(shiftKey(key, -1), nivel + 1).sobra : 0;
      receber = entradas; pagar = saidas;
    } else {
      receber = soma(x => x.ent && x.feito); pagar = saidas; atrasadas = soma(x => x.ent && !x.feito);
    }
    return { key, ini, fim, hoje, fase, lanc, fat, entradas, saidas, base, receber, pagar, atrasadas, sobra: base + receber - pagar };
  }

  function categoriasHtml(r) {
    const mapa = {};
    r.lanc.filter(x => !x.ent && !x.fatura).forEach(x => { mapa[x.cat] = (mapa[x.cat] || 0) + x.valor; });
    r.fat.itens.filter(t => kind(t, t.n) === 'saida').forEach(t => { const c = t.n.categoria || 'Sem categoria'; mapa[c] = (mapa[c] || 0) + amount(t.n.valor); });
    const linhas = Object.entries(mapa).sort((a, b) => b[1] - a[1]);
    if (!linhas.length) return '';
    const top = linhas.slice(0, 5), resto = linhas.slice(5).reduce((s, [, v]) => s + v, 0);
    if (resto > 0) top.push(['Outras', resto]);
    const max = top[0][1] || 1;
    return `<h3 class="dz-h">Para onde vai</h3>${top.map(([nome, v]) =>
      `<div class="dz-bar"><div class="dz-bar-top"><span>${esc(nome)}</span><b>${money(v)}</b></div><div class="dz-track"><i style="width:${Math.max(3, v / max * 100).toFixed(1)}%"></i></div></div>`).join('')}`;
  }

  function graficoHtml(key) {
    const r = periodoResumo(key);
    const dias = [];
    for (let d = r.ini; d && d <= r.fim; d = addDays(d, 1)) dias.push(d);
    const dia = Object.fromEntries(dias.map(d => [d, { ef: 0, ep: 0, sf: 0, sp: 0, fat: 0 }]));
    r.lanc.forEach(x => { const o = dia[x.date]; if (!o) return; if (x.fatura) o.fat = x.valor; o[(x.ent ? 'e' : 's') + (x.feito ? 'f' : 'p')] += x.valor; });
    // escala pelos dias comuns; a fatura, se for maior, fica cortada no topo com o valor escrito
    let maxB = 1;
    dias.forEach(d => { const o = dia[d]; maxB = Math.max(maxB, o.ef + o.ep, o.sf + o.sp - o.fat); });
    const W = 340, H = 176, L = 6, R = 6, T = 20, B = 22, cw = W - L - R, slot = cw / dias.length, ch = H - T - B, base = H - B;
    const alt = v => Math.min(ch, v / maxB * ch), bw = Math.max(1.4, slot / 2 - 1.2);
    const partes = [];
    dias.forEach((d, i) => {
      const o = dia[d], x = L + i * slot;
      const rect = (xx, de, ate, estilo) => ate > de ? `<rect x="${xx.toFixed(1)}" y="${(base - alt(ate)).toFixed(1)}" width="${bw.toFixed(1)}" height="${(alt(ate) - alt(de)).toFixed(1)}" rx="1.2" ${estilo}/>` : '';
      partes.push(rect(x + .6, 0, o.ef, 'fill="#78d88b"'), rect(x + .6, o.ef, o.ef + o.ep, 'class="dz-prev-e"'),
        rect(x + 1.2 + bw, 0, o.sf, 'fill="#ff7f91"'), rect(x + 1.2 + bw, o.sf, o.sf + o.sp, 'class="dz-prev-s"'));
      const e = o.ef + o.ep, sv = o.sf + o.sp;
      if (e >= maxB * .4) partes.push(`<text x="${(x + .6 + bw / 2).toFixed(1)}" y="${(base - alt(e) - 3).toFixed(1)}" text-anchor="middle" class="dz-val dz-val-e">${compacto(e)}</text>`);
      if (o.fat) partes.push(`<text x="${(x + 1.2 + bw * 1.5).toFixed(1)}" y="${(base - alt(sv) - 3).toFixed(1)}" text-anchor="end" class="dz-val dz-val-s">fatura ${compacto(o.fat)}</text>`);
      else if (sv >= maxB * .4) partes.push(`<text x="${(x + 1.2 + bw * 1.5).toFixed(1)}" y="${(base - alt(sv) - 3).toFixed(1)}" text-anchor="middle" class="dz-val dz-val-s">${compacto(sv)}</text>`);
      if (d === r.hoje) partes.push(`<line x1="${(x + slot / 2).toFixed(1)}" x2="${(x + slot / 2).toFixed(1)}" y1="${T}" y2="${base}" class="dz-hoje-l"/><text x="${(x + slot / 2).toFixed(1)}" y="${T - 8}" text-anchor="middle" class="dz-hoje">hoje</text>`);
    });
    const marcas = [0, 7, 14, 21, dias.length - 1].filter((v, i, a) => a.indexOf(v) === i && v < dias.length)
      .map(i => `<text x="${(L + (i + .5) * slot).toFixed(1)}" y="${H - 6}" text-anchor="middle">${ddmm(dias[i])}</text>`).join('');
    const card = (rotulo, valor, cls = '') => `<div><span>${rotulo}</span><b class="${cls}">${money(valor)}</b></div>`;
    const cards = r.fase === 'passado'
      ? card('Entrou', r.receber, 'dz-ent') + card('Saiu', r.pagar)
      : card(r.fase === 'atual' ? 'Tenho hoje' : 'Começo', r.base, 'dz-base') + card('Vou receber', r.receber, 'dz-ent') + card('Vou pagar', r.pagar);
    const rotuloSobra = r.fase === 'passado' ? 'Resultado' : `Sobra em ${ddmm(r.fim)}`;
    const atraso = r.atrasadas > 0 ? `<p class="dz-nota">${money(r.atrasadas)} de entradas atrasadas fora da conta</p>` : '';
    if (!r.lanc.length && !r.base) return '<div class="empty">Sem lançamentos neste período.</div>';
    return `<section class="dz">
      <div class="dz-cards ${r.fase === 'passado' ? 'dz-c2' : 'dz-c3'}">${cards}</div>
      <div class="dz-sobra ${r.sobra < 0 ? 'neg' : ''}"><span>${rotuloSobra}</span><b>${r.sobra < 0 ? '− ' : ''}${money(Math.abs(r.sobra))}</b></div>
      ${atraso}
      <svg class="dz-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Entradas e saídas por dia de ${ddmm(r.ini)} a ${ddmm(r.fim)}">
        <line x1="${L}" x2="${W - R}" y1="${base}" y2="${base}" class="dz-eixo-l"/>
        ${partes.join('')}
        <g class="dz-eixo">${marcas}</g>
      </svg>
      <div class="dz-legenda"><span><i class="dz-q-e"></i>Entrada</span><span><i class="dz-q-s"></i>Saída</span><span><i class="dz-q-p"></i>Previsto</span></div>
      ${categoriasHtml(r)}
    </section>`;
  }

  function render() {
    const items = invoiceItems();
    const financialItems = financialInvoiceItems();
    const active = items.filter(item => !isCancelled(item, item.n) && !item.n.processando);
    const visibleFinancial = visibleFinancialItems(financialItems);
    const activeFinancial = visibleFinancial.filter(item => !isCancelled(item, item.n) && !item.n.processando);
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
    const periodo = periodoResumo(cursor);
    fixar('#in', money(periodo.entradas));
    fixar('#out', money(periodo.saidas));
    fixar('#saldo', `${periodo.sobra < 0 ? '− ' : ''}${money(Math.abs(periodo.sobra))}`);
    fixar('.saldo-previsto-card .muted', periodo.fase === 'passado' ? 'Resultado do período' : `Previsto em ${ddmm(periodo.fim)}`);
    const entriesLabel = document.querySelector('#in')?.nextElementSibling;
    if (entriesLabel) entriesLabel.textContent = 'Entradas';
    const expensesLabel = document.querySelector('#out')?.nextElementSibling;
    if (expensesLabel) expensesLabel.textContent = 'Saídas';
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
        <span class="ct-sub">${formatShort(bounds.start)}–${formatShort(bounds.end)} ›</span>
        <span class="mc"><i></i><i></i></span>
      </div>`;
    }

    const heading = document.querySelector('#list')?.previousElementSibling;
    if (heading?.tagName === 'H2') heading.textContent = `${ddmm(periodo.ini)} a ${ddmm(periodo.fim)}`;
    document.querySelectorAll('.filters [data-f]').forEach(button => {
      button.classList.toggle('on', button.dataset.f === filter);
    });
    if (filter === 'grafico') {
      const list = document.querySelector('#list');
      if (list) list.innerHTML = graficoHtml(cursor);
    } else {
      renderList(visibleFinancial);
    }
  }

  const fixos = new Map();
  function fixar(sel, txt) {
    fixos.set(sel, txt);
    const el = document.querySelector(sel);
    if (el && el.textContent !== txt) el.textContent = txt;
  }
  new MutationObserver(() => fixos.forEach((txt, sel) => {
    const el = document.querySelector(sel);
    if (el && el.textContent !== txt) el.textContent = txt;
  })).observe(document.documentElement, { childList: true, subtree: true, characterData: true });

  function markDirty(documentKey) {
    const dirty = read(DIRTY_KEY, {});
    dirty[documentKey] = Date.now();
    write(DIRTY_KEY, dirty);
  }

  // O painel financeiro antigo ainda renderiza o mesmo #cartao usando o mês
  // do calendário. A fatura usa o ciclo de fechamento, então os dois valores
  // competiam a cada sincronização. Esta trava deixa somente esta rotina
  // escrever o cartão Inter; o restante do painel antigo segue funcionando.
  function guardLegacyInterCard() {
    const card = document.querySelector('#cartao');
    if (!card || card.dataset.invoiceCardGuard === '1') return;
    card.dataset.invoiceCardGuard = '1';
    const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
    const isLegacyMarkup = value => String(value || '').includes('neste mês · fatura');
    if (descriptor?.get && descriptor?.set) {
      Object.defineProperty(card, 'innerHTML', {
        configurable: true,
        get: () => descriptor.get.call(card),
        set: value => { if (!isLegacyMarkup(value)) descriptor.set.call(card, value); }
      });
      return;
    }
    // Fallback para navegadores que não expõem o descritor de innerHTML.
    new MutationObserver(() => {
      if (isLegacyMarkup(card.innerHTML)) requestAnimationFrame(render);
    }).observe(card, { childList: true, subtree: true });
  }

  function install() {
    const previous = document.querySelector('#prev');
    const next = document.querySelector('#next');
    const filters = document.querySelector('.filters');
    const list = document.querySelector('#list');
    if (!previous || !next || !filters || !list) return;

    guardLegacyInterCard();

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
      if (taskId) {
        const tasks = read(TASKS_KEY, []);
        const task = tasks.find(item => String(item.id) === String(taskId));
        if (task) {
          task.done = event.target.checked;
          write(TASKS_KEY, tasks);
          markDirty('tasks');
        }
      }
      render();
    };
    list.onclick = event => {
      const button = event.target.closest('[data-receive]');
      if (!button) return;
      const taskId = String(button.dataset.receive || '');
      const account = button.dataset.receiveAccount === 'nb' ? 'nb' : 'mp';
      const tasks = read(TASKS_KEY, []);
      const task = tasks.find(item => String(item.id) === taskId);
      if (!task || task.done) return;
      const notes = read(NOTES_KEY, {});
      notes[taskId] = {
        ...(notes[taskId] || {}),
        movimento: 'entrada',
        forma: 'pix',
        conta: account,
        recebidoEm: new Date().toISOString()
      };
      task.done = true;
      write(TASKS_KEY, tasks);
      write(NOTES_KEY, notes);
      markDirty('tasks');
      markDirty('notes');
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
    .invoice-row.is-processing{background:linear-gradient(90deg,rgba(255,164,70,.15),transparent)}
    .cancel-badge{display:inline-flex;margin-left:7px;padding:2px 6px;border:1px solid #ff4a5b;border-radius:999px;background:rgba(255,74,91,.14);color:#ff7180;font-size:9px;font-weight:900;text-transform:uppercase;vertical-align:2px}
    .processing-badge{display:inline-flex;margin-left:7px;padding:2px 6px;border:1px solid #ffae55;border-radius:999px;background:rgba(255,164,70,.15);color:#ffc06f;font-size:9px;font-weight:900;text-transform:uppercase;vertical-align:2px}
    .pending-badge{display:inline-flex;margin-left:7px;padding:2px 6px;border:1px solid #ff5d73;border-radius:999px;background:rgba(255,93,115,.14);color:#ff7f91;font-size:9px;font-weight:900;text-transform:uppercase;vertical-align:2px}
    .subscription-badge{display:inline-flex;margin-left:7px;padding:2px 6px;border:1px solid #6ec9ff;border-radius:999px;background:rgba(110,201,255,.13);color:#82d2ff;font-size:9px;font-weight:900;text-transform:uppercase;vertical-align:2px}
    .refund-badge{display:inline-flex;margin-left:7px;padding:2px 6px;border:1px solid #78d88b;border-radius:999px;background:rgba(120,216,139,.13);color:#8ce59d;font-size:9px;font-weight:900;text-transform:uppercase;vertical-align:2px}
    .dz-cards{display:grid;gap:8px;margin-bottom:8px}
    .dz-c3{grid-template-columns:repeat(3,1fr)}
    .dz-c2{grid-template-columns:1fr 1fr}
    .dz-cards>div{padding:10px 11px;border:1px solid var(--ar-line,#2a2f33);border-radius:12px;background:var(--ar-paper,#111314)}
    .dz-cards span{display:block;color:var(--ar-muted,#9aa4ab);font-size:10px;font-weight:800;letter-spacing:.04em;text-transform:uppercase}
    .dz-cards b{display:block;margin-top:3px;color:#ff7f91;font-size:clamp(12px,3.5vw,15px);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .dz-cards b.dz-ent{color:#78d88b}
    .dz-cards b.dz-base{color:var(--ar-fg,#e7eaeb)}
    .dz-sobra{display:flex;justify-content:space-between;align-items:baseline;padding:12px 14px;margin-bottom:10px;border:1px solid var(--ar-line,#2a2f33);border-radius:12px;background:var(--ar-paper,#111314)}
    .dz-sobra span{color:var(--ar-muted,#9aa4ab);font-size:12px;font-weight:800}
    .dz-sobra b{color:#78d88b;font-size:22px;font-weight:850}
    .dz-sobra.neg b{color:#ff7f91}
    .dz-svg{width:100%;height:auto;display:block;border:1px solid var(--ar-line,#2a2f33);border-radius:12px;background:var(--ar-paper,#111314)}
    .dz-svg text{fill:var(--ar-muted,#9aa4ab);font-size:8px;font-weight:700}
    .dz-svg .dz-val{font-size:7.5px;font-weight:800}
    .dz-svg .dz-val-e{fill:#78d88b}
    .dz-svg .dz-val-s{fill:#ff7f91}
    .dz-svg .dz-hoje{fill:var(--ar-fg,#e7eaeb);font-size:7px}
    .dz-svg .dz-hoje-l{stroke:var(--ar-muted,#9aa4ab);stroke-dasharray:3 3;stroke-width:.8}
    .dz-svg .dz-eixo-l{stroke:var(--ar-line,#2a2f33)}
    .dz-svg .dz-prev-e{fill:rgba(120,216,139,.25);stroke:#78d88b;stroke-dasharray:2 2;stroke-width:.8}
    .dz-svg .dz-prev-s{fill:rgba(255,127,145,.25);stroke:#ff7f91;stroke-dasharray:2 2;stroke-width:.8}
    .dz-legenda{display:flex;gap:14px;margin:8px 2px 0;color:var(--ar-muted,#9aa4ab);font-size:10px;font-weight:700}
    .dz-legenda i{display:inline-block;width:9px;height:9px;margin-right:5px;border-radius:2px;vertical-align:-1px}
    .dz-q-e{background:#78d88b}.dz-q-s{background:#ff7f91}.dz-q-p{border:1px dashed var(--ar-muted,#9aa4ab)}
    .dz-nota{margin:-2px 2px 10px;color:var(--ar-muted,#9aa4ab);font-size:11px}
    .dz-h{margin:18px 2px 8px;color:var(--ar-muted,#9aa4ab);font-size:11px;font-weight:850;letter-spacing:.06em;text-transform:uppercase}
    .dz-bar{margin-bottom:9px}
    .dz-bar-top{display:flex;justify-content:space-between;gap:8px;font-size:12px;color:var(--ar-fg,#e7eaeb)}
    .dz-bar-top b{font-weight:800;white-space:nowrap}
    .dz-track{height:6px;margin-top:4px;border-radius:99px;background:#1c2124;overflow:hidden}
    .dz-track i{display:block;height:100%;border-radius:inherit;background:#ff7f91}
    .receive-actions{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin-top:8px;color:#aeb5c1;font-size:10px;font-weight:800}
    .receive-actions button{border:1px solid #ff5d73;border-radius:999px;background:rgba(255,93,115,.12);color:#ff7f91;padding:7px 11px;font:inherit;cursor:pointer}
    .invoice-details{display:grid;gap:5px;margin-top:8px;padding:8px 9px;border:1px solid #343841;border-radius:10px;background:#181a1f}
    .invoice-details>span{color:#8f96a3;font-size:9px;font-weight:850;letter-spacing:.06em;text-transform:uppercase}
    .invoice-detail-boxes{display:flex;flex-wrap:wrap;gap:6px}
    .invoice-detail-box{display:inline-flex;align-items:center;min-height:28px;padding:5px 8px;border:1px solid #3a414d;border-radius:8px;background:#20242c;color:#d8dbe2;font-size:11px;line-height:1.3}
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
