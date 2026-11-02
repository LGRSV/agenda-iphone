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

  function financialInvoiceItems() {
    const notes = read(NOTES_KEY, {});
    const matches = read(TASKS_KEY, [])
      .filter(task => task && task.text)
      .map(task => ({ ...task, n: notes[task.id] || {} }))
      .filter(task => task.tag === 'financeiro'
        && (!task.n.excludeFromInvoice || task.n.processando)
        && (kind(task, task.n) === 'saida' || kind(task, task.n) === 'entrada')
        && invoiceKey(task.date, task.n) === cursor);
    return dedupeInstallments(matches)
      .sort((a, b) => `${a.date}${a.time || ''}`.localeCompare(`${b.date}${b.time || ''}`));
  }

  function invoiceItems() {
    return financialInvoiceItems().filter(task => isInter(task, task.n));
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

  function visibleFinancialItems(items) {
    const byId = new Map(items.map(item => [String(item.id), item]));
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const notes = read(NOTES_KEY, {});
    read(TASKS_KEY, [])
      .filter(task => task && task.tag === 'financeiro' && String(task.date || '').startsWith(currentMonth))
      .map(task => ({ ...task, n: notes[task.id] || {} }))
      .filter(task => task.n.forma !== 'inter')
      .forEach(item => byId.set(String(item.id), item));
    pendingReceivables().forEach(item => byId.set(String(item.id), item));
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

  // ---- Gráfico de desembolso: saídas do mês (por data do lançamento) ----
  const FORMA_NOME = { inter: 'Cartão Inter', pix: 'Pix', dinheiro: 'Dinheiro', mp: 'Mercado Pago' };
  function desembolsoMes(key) {
    const notes = read(NOTES_KEY, {});
    const ref = parseKey(key);
    const dias = new Date(ref.year, ref.month, 0).getDate();
    const doMes = read(TASKS_KEY, [])
      .filter(task => task && task.text && task.tag === 'financeiro' && String(task.date || '').startsWith(`${key}-`))
      .map(task => ({ ...task, n: notes[task.id] || {} }))
      .filter(task => !isCancelled(task, task.n) && !task.n.processando && amount(task.n.valor) > 0);
    const itens = doMes.filter(task => kind(task, task.n) === 'saida');
    const recebido = Array(dias + 1).fill(0), areceber = Array(dias + 1).fill(0);
    doMes.filter(task => kind(task, task.n) === 'entrada').forEach(task => {
      const dia = Number(task.date.slice(8, 10)), valor = amount(task.n.valor);
      if (task.done) recebido[dia] += valor; else areceber[dia] += valor;
    });
    const totalRecebido = recebido.reduce((a, b) => a + b, 0), totalAReceber = areceber.reduce((a, b) => a + b, 0);
    const pago = Array(dias + 1).fill(0), apagar = Array(dias + 1).fill(0);
    const porCat = {}, porForma = {};
    itens.forEach(task => {
      const dia = Number(task.date.slice(8, 10)), valor = amount(task.n.valor);
      if (task.n.programada && !task.done) apagar[dia] += valor; else pago[dia] += valor;
      const cat = task.n.categoria || 'Sem categoria', forma = FORMA_NOME[task.n.forma] || 'Outras formas';
      porCat[cat] = (porCat[cat] || 0) + valor; porForma[forma] = (porForma[forma] || 0) + valor;
    });
    const totalPago = pago.reduce((a, b) => a + b, 0), totalAPagar = apagar.reduce((a, b) => a + b, 0);
    return { ref, dias, itens, pago, apagar, porCat, porForma, totalPago, totalAPagar, total: totalPago + totalAPagar, recebido, areceber, totalRecebido, totalAReceber, entradas: totalRecebido + totalAReceber };
  }

  function barrasHtml(mapa, total) {
    const linhas = Object.entries(mapa).sort((a, b) => b[1] - a[1]);
    const top = linhas.slice(0, 6), resto = linhas.slice(6).reduce((sum, [, v]) => sum + v, 0);
    if (resto > 0) top.push(['Outras', resto]);
    return top.map(([nome, valor]) => {
      const pct = total ? valor / total * 100 : 0;
      return `<div class="dz-bar"><div class="dz-bar-top"><span>${esc(nome)}</span><b>${money(valor)} <small>${pct.toFixed(0)}%</small></b></div><div class="dz-track"><i style="width:${Math.max(2, pct).toFixed(1)}%"></i></div></div>`;
    }).join('');
  }

  const compacto = v => v >= 1000 ? `${(v / 1000).toFixed(1).replace('.', ',')} mil` : String(Math.round(v));
  function fluxoHtml(d) {
    const W = 340, H = 180, L = 6, R = 6, T = 18, B = 22, cw = W - L - R, slot = cw / d.dias, ch = H - T - B, base = H - B;
    let maxB = 1;
    for (let i = 1; i <= d.dias; i += 1) maxB = Math.max(maxB, d.recebido[i] + d.areceber[i], d.pago[i] + d.apagar[i]);
    const yb = v => base - v / maxB * ch, bw = Math.max(1.4, slot / 2 - 1.2);
    const barras = [], valores = [];
    for (let i = 1; i <= d.dias; i += 1) {
      const x = L + (i - 1) * slot, rec = d.recebido[i], arec = d.areceber[i], pg = d.pago[i], ap = d.apagar[i];
      const rect = (xx, de, ate, estilo) => ate > de ? `<rect x="${xx.toFixed(1)}" y="${yb(ate).toFixed(1)}" width="${bw.toFixed(1)}" height="${(yb(de) - yb(ate)).toFixed(1)}" rx="1.2" ${estilo}/>` : '';
      barras.push(rect(x + .6, 0, rec, 'fill="#78d88b"'), rect(x + .6, rec, rec + arec, 'fill="rgba(120,216,139,.28)" stroke="#78d88b" stroke-dasharray="2 2" stroke-width=".8"'),
        rect(x + .6 + bw + .6, 0, pg, 'fill="#ff7f91"'), rect(x + .6 + bw + .6, pg, pg + ap, 'fill="rgba(255,127,145,.30)" stroke="#ff7f91" stroke-dasharray="2 2" stroke-width=".8"'));
      // valor escrito acima das barras grandes (a partir de 35% do maior dia)
      const e = rec + arec, sv = pg + ap;
      if (e >= maxB * .35) valores.push(`<text x="${(x + .6 + bw / 2).toFixed(1)}" y="${(yb(e) - 3).toFixed(1)}" text-anchor="middle" class="dz-val dz-val-e">${compacto(e)}</text>`);
      if (sv >= maxB * .35) valores.push(`<text x="${(x + 1.2 + bw * 1.5).toFixed(1)}" y="${(yb(sv) - 3).toFixed(1)}" text-anchor="middle" class="dz-val dz-val-s">${compacto(sv)}</text>`);
    }
    const hoje = new Date(), diaHoje = (hoje.getFullYear() === d.ref.year && hoje.getMonth() + 1 === d.ref.month) ? hoje.getDate() : 0;
    const xh = L + (diaHoje - 0.5) * slot;
    const marcaHoje = diaHoje ? `<line x1="${xh.toFixed(1)}" x2="${xh.toFixed(1)}" y1="${T}" y2="${base}" stroke="#aeb5c1" stroke-dasharray="3 3" stroke-width=".8"/><text x="${xh.toFixed(1)}" y="${T - 6}" text-anchor="middle" class="dz-hoje">hoje</text>` : '';
    const rotulos = [1, 5, 10, 15, 20, 25, d.dias].filter((v, i, a) => a.indexOf(v) === i && v <= d.dias)
      .map(i => `<text x="${(L + (i - 0.5) * slot).toFixed(1)}" y="${H - 6}" text-anchor="middle">${i}</text>`).join('');
    const res = d.entradas - d.total, nomeMes = MONTHS[d.ref.month - 1];
    const frase = res >= 0
      ? `Em ${nomeMes} entram ${money(d.entradas)} e saem ${money(d.total)}: <b class="dz-ent">sobram ${money(res)}</b>.`
      : `Em ${nomeMes} entram ${money(d.entradas)} e saem ${money(d.total)}: <b>faltam ${money(-res)}</b>.`;
    return `<section class="dz">
      <div class="dz-cards dz-cards3">
        <div><span>Entradas</span><b class="dz-ent">${money(d.entradas)}</b><small>${money(d.totalRecebido)} já recebido</small></div>
        <div><span>Saídas</span><b>${money(d.total)}</b><small>${money(d.totalPago)} já saiu</small></div>
        <div><span>${res >= 0 ? 'Sobra' : 'Falta'}</span><b class="${res >= 0 ? 'dz-ent' : ''}">${money(Math.abs(res))}</b><small>entradas − saídas</small></div>
      </div>
      <svg class="dz-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Entradas e saídas por dia">
        <line x1="${L}" x2="${W - R}" y1="${base}" y2="${base}" stroke="#3b404a"/>
        ${barras.join('')}${valores.join('')}${marcaHoje}
        <g class="dz-eixo">${rotulos}</g>
      </svg>
      <div class="dz-legenda"><span><i style="background:#78d88b"></i>Entrou</span><span><i class="dz-prog dz-prog-e"></i>Ainda vai entrar</span><span><i style="background:#ff7f91"></i>Saiu</span><span><i class="dz-prog"></i>Ainda vai sair</span></div>
      <p class="dz-frase">${frase}</p>
    </section>`;
  }

  function graficoHtml(key) {
    const d = desembolsoMes(key);
    if (!d.itens.length && !d.entradas) return '<div class="empty">Sem lançamentos neste mês.</div>';
    if (!d.itens.length) return `<h3 class="dz-h">Entrou × saiu, dia a dia</h3>${fluxoHtml(d)}<div class="empty">Sem saídas neste mês.</div>`;
    const W = 340, H = 170, L = 6, R = 6, T = 10, B = 22, cw = W - L - R, ch = H - T - B, slot = cw / d.dias;
    const maxDia = Math.max(...d.pago.map((v, i) => v + d.apagar[i]), 1);
    const hoje = new Date(), diaHoje = (hoje.getFullYear() === d.ref.year && hoje.getMonth() + 1 === d.ref.month) ? hoje.getDate() : 0;
    const barras = [];
    for (let i = 1; i <= d.dias; i += 1) {
      const x = L + (i - 1) * slot, hp = d.pago[i] / maxDia * ch, ha = d.apagar[i] / maxDia * ch, w = Math.max(1.5, slot - 2);
      if (hp > 0) barras.push(`<rect x="${(x + 1).toFixed(1)}" y="${(T + ch - hp).toFixed(1)}" width="${w.toFixed(1)}" height="${hp.toFixed(1)}" rx="1.5" fill="#ff7f91"/>`);
      if (ha > 0) barras.push(`<rect x="${(x + 1).toFixed(1)}" y="${(T + ch - hp - ha).toFixed(1)}" width="${w.toFixed(1)}" height="${ha.toFixed(1)}" rx="1.5" fill="rgba(255,127,145,.30)" stroke="#ff7f91" stroke-dasharray="2 2" stroke-width=".8"/>`);
    }
    const rotulos = [1, 5, 10, 15, 20, 25, d.dias].filter((v, i, a) => a.indexOf(v) === i && v <= d.dias)
      .map(i => `<text x="${(L + (i - 0.5) * slot).toFixed(1)}" y="${H - 6}" text-anchor="middle">${i}</text>`).join('');
    const marcaHoje = diaHoje ? `<line x1="${(L + (diaHoje - 0.5) * slot).toFixed(1)}" x2="${(L + (diaHoje - 0.5) * slot).toFixed(1)}" y1="${T}" y2="${T + ch}" stroke="#aeb5c1" stroke-dasharray="3 3" stroke-width=".8"/><text x="${(L + (diaHoje - 0.5) * slot).toFixed(1)}" y="${T - 2}" text-anchor="middle" class="dz-hoje">hoje</text>` : '';
    let maiorDia = 1;
    for (let i = 1; i <= d.dias; i += 1) if (d.pago[i] + d.apagar[i] > d.pago[maiorDia] + d.apagar[maiorDia]) maiorDia = i;
    const valMaior = d.pago[maiorDia] + d.apagar[maiorDia];
    const mes = String(d.ref.month).padStart(2, '0');
    return `<h3 class="dz-h dz-h0">Entrou × saiu, dia a dia</h3>${fluxoHtml(d)}<h3 class="dz-h">Só as saídas, dia a dia</h3><section class="dz">
      <div class="dz-cards">
        <div><span>Desembolso do mês</span><b>${money(d.total)}</b></div>
        <div><span>Já saiu</span><b>${money(d.totalPago)}</b></div>
        <div><span>Ainda vai sair</span><b>${money(d.totalAPagar)}</b></div>
        <div><span>Maior dia</span><b>${money(valMaior)}</b><small>${String(maiorDia).padStart(2, '0')}/${mes}</small></div>
      </div>
      <svg class="dz-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Saídas por dia">
        <line x1="${L}" x2="${W - R}" y1="${T + ch}" y2="${T + ch}" stroke="#3b404a"/>
        ${barras.join('')}${marcaHoje}
        <g class="dz-eixo">${rotulos}</g>
      </svg>
      <div class="dz-legenda"><span><i style="background:#ff7f91"></i>Saiu no dia</span><span><i class="dz-prog"></i>Ainda vai sair</span></div>
      <h3 class="dz-h">Por categoria</h3>${barrasHtml(d.porCat, d.total)}
      <h3 class="dz-h">Por forma de pagamento</h3>${barrasHtml(d.porForma, d.total)}
      <p class="dz-nota">Considera todas as saídas lançadas de 01/${mes} a ${String(d.dias).padStart(2, '0')}/${mes} (pela data do lançamento, inclusive compras no cartão). Canceladas ficam de fora.</p>
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
    if (heading?.tagName === 'H2') heading.textContent = filter === 'grafico' ? 'ENTRADAS, SAÍDAS E DESEMBOLSO DO MÊS' : 'LANÇAMENTOS DO PERÍODO';
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
    .dz-cards{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}
    .dz-cards>div{padding:10px 12px;border:1px solid #343841;border-radius:12px;background:#1d2026}
    .dz-cards span{display:block;color:#8f96a3;font-size:10px;font-weight:800;letter-spacing:.05em;text-transform:uppercase}
    .dz-cards b{display:block;margin-top:4px;color:#ff7f91;font-size:17px}
    .dz-cards small{color:#8f96a3;font-size:10px;font-weight:700}
    .dz-svg{width:100%;height:auto;display:block;border:1px solid #343841;border-radius:12px;background:#1d2026}
    .dz-svg text{fill:#8f96a3;font-size:8px;font-weight:700}
    .dz-svg .dz-hoje{fill:#aeb5c1;font-size:7px}
    .dz-legenda{display:flex;flex-wrap:wrap;gap:6px 12px;margin:8px 2px 4px;color:#aeb5c1;font-size:10px;font-weight:700}
    .dz-legenda i{display:inline-block;width:9px;height:9px;margin-right:5px;border-radius:2px;vertical-align:-1px}
    .dz-legenda i.dz-prog{background:rgba(255,127,145,.30);border:1px dashed #ff7f91}
    .dz-cards3{grid-template-columns:repeat(3,1fr)}
    .dz-cards3 b{font-size:14px}
    .dz-cards b.dz-ent{color:#78d88b}
    .dz-cards3 small{display:block;margin-top:2px}
    .dz-legenda i.dz-prog-e{background:rgba(120,216,139,.28);border-color:#78d88b}
    .dz-h0{margin-top:4px}
    .dz-svg .dz-val{font-size:7.5px;font-weight:800}
    .dz-svg .dz-val-e{fill:#78d88b}
    .dz-svg .dz-val-s{fill:#ff7f91}
    .dz-frase{margin:10px 2px 0;color:#d8dbe2;font-size:13px;line-height:1.45}
    .dz-frase b{color:#ff7f91}
    .dz-frase b.dz-ent{color:#78d88b}
    .dz-h{margin:16px 2px 8px;color:#aeb5c1;font-size:11px;font-weight:850;letter-spacing:.06em;text-transform:uppercase}
    .dz-bar{margin-bottom:9px}
    .dz-bar-top{display:flex;justify-content:space-between;gap:8px;font-size:12px;color:#d8dbe2}
    .dz-bar-top b{font-weight:800;white-space:nowrap}
    .dz-bar-top small{color:#8f96a3;font-weight:700}
    .dz-track{height:7px;margin-top:4px;border-radius:99px;background:#2a2e36;overflow:hidden}
    .dz-track i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#ff7f91,#ff5d73)}
    .dz-nota{margin:14px 2px 0;color:#8f96a3;font-size:10px;line-height:1.5}
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
