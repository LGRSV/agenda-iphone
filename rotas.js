/* rotas.js — histórico de rotas do dia: por onde o usuário andou, onde parou e
   quanto tempo ficou, dia a dia, para ter um parâmetro no fim da semana.

   Não é navegação nem "melhor caminho": só registra o que o GPS viu.

   De onde vêm os pontos: do motor de lugares (localizacao.js), que dispara
   'agenda:local-change' com tipo 'fix' para cada leitura aceita (precisão
   ≤ 150 m). Este módulo NÃO altera chegada/saída de lugares: só escuta.

   Limite honesto: no PWA o iOS suspende o JavaScript em segundo plano, então a
   rota só fica completa no app nativo (BackgroundGeolocation, nativo.js) com a
   localização em "Sempre". O que não foi gravado (app fechado, localização
   desligada) vira LACUNA ("sem registro 14:10–15:40"); nunca se desenha uma
   linha reta inventada entre dois pontos distantes no tempo.

   Filtro de ruído (cada regra evita um erro real de GPS de celular):
   - precisão pior que 100 m: descartado;
   - salto impossível (> 300 m a mais de 70 m/s): descartado; se 3 leituras
     seguidas concordam entre si, o novo lugar vale e o meio vira lacuna;
   - parado (menos de max(25 m, 0,8 × precisão) do último ponto) ou dentro do
     raio do mesmo lugar salvo sem estar em movimento: não cria ponto novo, só
     estende a estadia do último ponto (campo f = visto até);
   - silêncio > 10 min com deslocamento > 500 m, ou num intervalo em que o app
     não estava monitorando: lacuna.

   Dados:
   - pontos brutos: SÓ neste aparelho (IndexedDB 'agenda-rotas', um registro por
     dia local, retenção de 90 dias); nunca vão para a nuvem;
   - agenda_rotas_v1 (sincroniza aninhado em "settings", supabase-shared-storage.js):
       { v:1, owner, dias:{ 'AAAA-MM-DD': { <aparelho>: resumo } }, apagados:{ dia: ts }, tudo: ts }
       resumo = { dev, at, km, mm (min em movimento),
                  paradas:[{ i, f, nome, id?, la, ln }],          i/f = minutos desde 00:00 local
                  trechos:[{ i, f, km, de, para, pl? }],         pl = Google polyline (precisão 5)
                  lacunas:[[i, f]] }
     Mescla por dia E por aparelho (o mais novo de cada aparelho vence), com
     lápides por dia e "apagar tudo": dois aparelhos nunca apagam um ao outro.
     Limites: ≤ 4000 caracteres por dia (simplifica a linha até caber),
     polilinha só nos últimos 14 dias, 90 dias no total, ≤ 120 kB no objeto.
   - agenda_rotas_estado_v1: estado deste aparelho (intervalos sem monitorar).
   - agenda_rotas_geo_v1: cache dos endereços consultados no Nominatim.
   Dia local = America/Araguaina (UTC−3, sem horário de verão).               */
(function (root) {
  'use strict';

  // ------------------------------------------------------------ núcleo puro
  const MIN = 60000, H = 3600000, DIA = 86400000;
  const TZ = -3 * H;
  const P = {
    ACC_MAX: 100, DIST_MIN: 25, V_MAX: 70, SALTO_MIN: 300, SUSP_N: 3, SUSP_MS: 5 * MIN,
    GAP_MS: 10 * MIN, GAP_DIST: 500, MESMO_PONTO: 300,
    STAY_R: 100, STAY_MIN: 6 * MIN, JUNTAR_MS: 10 * MIN, JUNTAR_KM: 0.4, TRECHO_MIN_KM: 0.08,
    RETENCAO: 90, PL_DIAS: 14, MAX_DIA: 4000, MAX_TOTAL: 120000, MAX_PTS: 20000, MAX_ITENS: 40,
    NUVEM_MS: 5 * MIN, ABERTA_MS: 20 * MIN, PICO_MIN: 80, PICO_MS: 3 * MIN
  };
  const diaLocal = ts => new Date(ts + TZ).toISOString().slice(0, 10);
  const inicioDia = iso => Date.parse(iso + 'T00:00:00Z') - TZ;
  const hhmm = ts => new Date(ts + TZ).toISOString().slice(11, 16);
  const somaDias = (iso, n) => new Date(Date.parse(iso + 'T12:00:00Z') + n * DIA).toISOString().slice(0, 10);
  const r6 = v => Math.round(v * 1e6) / 1e6, r4 = v => Math.round(v * 1e4) / 1e4;
  function dist(aLat, aLng, bLat, bLng) {
    const R = 6371000, r = Math.PI / 180;
    const dLat = (bLat - aLat) * r, dLng = (bLng - aLng) * r;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }
  const dpt = (a, b) => dist(a.la, a.ln, b.la, b.ln);
  function duracao(ms) {
    const m = Math.max(0, Math.round(ms / MIN));
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60), r = m % 60;
    return r ? `${h}h${String(r).padStart(2, '0')}` : `${h}h`;
  }
  // JSON com chaves em ordem: comparar estados sem depender da ordem de inserção
  const canon = o => JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v)) ? Object.keys(v).sort().reduce((a, x) => { a[x] = v[x]; return a; }, {}) : v);
  const fmtKm = km => (Math.round(km * 10) / 10).toFixed(1).replace('.', ',') + ' km';

  // Google encoded polyline, precisão 5
  function encNum(v) {
    v = v < 0 ? ~(v << 1) : v << 1;
    let s = '';
    while (v >= 0x20) { s += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; }
    return s + String.fromCharCode(v + 63);
  }
  function codificar(coords) {
    let la = 0, ln = 0, out = '';
    for (const c of coords) {
      const A = Math.round(c[0] * 1e5), B = Math.round(c[1] * 1e5);
      out += encNum(A - la) + encNum(B - ln); la = A; ln = B;
    }
    return out;
  }
  function decodificar(str) {
    const out = []; let i = 0, la = 0, ln = 0;
    str = String(str || '');
    while (i < str.length) {
      const v = [0, 0];
      for (let k = 0; k < 2; k++) {
        let r = 0, sh = 0, b;
        do { b = str.charCodeAt(i++) - 63; r |= (b & 0x1f) << sh; sh += 5; } while (b >= 0x20 && i < str.length);
        v[k] = (r & 1) ? ~(r >> 1) : (r >> 1);
      }
      la += v[0]; ln += v[1];
      out.push([la / 1e5, ln / 1e5]);
    }
    return out;
  }
  // Douglas-Peucker em metros (projeção local): tol em metros
  function simplificar(coords, tol) {
    if (coords.length <= 2) return coords.slice();
    const lat0 = coords[0][0] * Math.PI / 180, kx = 111320 * Math.cos(lat0), ky = 110540;
    const xy = coords.map(c => [c[1] * kx, c[0] * ky]);
    const keep = new Uint8Array(coords.length); keep[0] = keep[coords.length - 1] = 1;
    const pilha = [[0, coords.length - 1]];
    while (pilha.length) {
      const [a, b] = pilha.pop();
      const [ax, ay] = xy[a], [bx, by] = xy[b], dx = bx - ax, dy = by - ay, L2 = dx * dx + dy * dy;
      let maxD = -1, idx = -1;
      for (let i = a + 1; i < b; i++) {
        const [px, py] = xy[i];
        let t = L2 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
        const qx = ax + t * dx - px, qy = ay + t * dy - py, d = Math.sqrt(qx * qx + qy * qy);
        if (d > maxD) { maxD = d; idx = i; }
      }
      if (maxD > tol) { keep[idx] = 1; pilha.push([a, idx], [idx, b]); }
    }
    return coords.filter((_, i) => keep[i]);
  }

  function lugarEm(la, ln, lugares) {
    let melhor = null, dm = Infinity;
    for (const l of lugares || []) {
      if (!l || !Number.isFinite(l.lat) || !Number.isFinite(l.lng)) continue;
      const d = dist(la, ln, l.lat, l.lng);
      if (d <= (l.raio || 100) && d < dm) { melhor = l; dm = d; }
    }
    return melhor;
  }

  // Recebe um fix {lat,lng,acc,ts,speed} e decide se vira ponto, estende o
  // último ou é descartado. Muta pts. ctx = {lugares, mem, semMonitor(a,b)}.
  function registrar(pts, fix, ctx) {
    ctx = ctx || {};
    const mem = ctx.mem || (ctx.mem = {});
    if (!fix || !Number.isFinite(fix.lat) || !Number.isFinite(fix.lng) || !Number.isFinite(fix.ts)) return 'invalido';
    const acc = Number.isFinite(fix.acc) ? fix.acc : 999;
    if (acc > P.ACC_MAX) return 'ruim';
    const ponto = (t, q) => { const p = { t, la: r6(fix.lat), ln: r6(fix.lng), a: Math.round(acc), f: fix.ts }; if (q) p.q = 1; return p; };
    const p = pts[pts.length - 1];
    if (!p) { pts.push(ponto(fix.ts, false)); return 'novo'; }
    if (fix.ts <= p.f) return 'velho';
    if (pts.length >= P.MAX_PTS) return 'cheio';
    const d = dist(p.la, p.ln, fix.lat, fix.lng), dt = fix.ts - p.f;
    if (d > P.SALTO_MIN && d / Math.max(1, dt / 1000) > P.V_MAX) {
      const s = mem.susp;
      const coerente = s && fix.ts - s.ult.ts <= P.SUSP_MS &&
        dist(s.ult.lat, s.ult.lng, fix.lat, fix.lng) <= Math.max(P.SALTO_MIN, P.V_MAX * (fix.ts - s.ult.ts) / 1000);
      if (coerente) { s.n += 1; s.ult = fix; } else mem.susp = { n: 1, pri: fix, ult: fix };
      if (mem.susp.n >= P.SUSP_N) { const t0 = mem.susp.pri.ts; mem.susp = null; pts.push(ponto(t0, true)); return 'lacuna'; }
      return 'salto';
    }
    mem.susp = null;
    const semMon = dt > P.GAP_MS && typeof ctx.semMonitor === 'function' && !!ctx.semMonitor(p.f, fix.ts);
    if (dt > P.GAP_MS && (d > P.GAP_DIST || semMon)) { pts.push(ponto(fix.ts, true)); return 'lacuna'; }
    const parado = !(fix.speed > 2);
    if (parado) {
      const Lf = lugarEm(fix.lat, fix.lng, ctx.lugares);
      if (Lf && Lf === lugarEm(p.la, p.ln, ctx.lugares)) { p.f = fix.ts; return 'estadia'; }
    }
    if (d < Math.max(P.DIST_MIN, 0.8 * acc)) { p.f = fix.ts; return 'parado'; }
    pts.push(ponto(fix.ts, false));
    return 'novo';
  }

  // Pico de GPS: 1 a 3 leituras que "saem" ≥ 80 m e voltam ao mesmo ponto (≤ 35% da
  // ida, mín. 40 m) em ≤ 3 min, sem parar lá. Comum dentro de prédio (Wi-Fi/celular):
  // a leitura cai no quarteirão vizinho por alguns segundos. Não é deslocamento real.
  function limparPicos(pts) {
    const out = pts.slice();
    for (let k = 1; k < out.length - 1; k++) {
      const a = out[k - 1];
      for (let m = k; m < Math.min(out.length - 1, k + 3); m++) {
        const b = out[m + 1];
        if (b.q || out[m].q || b.t - a.f > P.PICO_MS) break;
        let ida = 0;
        for (let x = k; x <= m; x++) ida = Math.max(ida, dpt(a, out[x]));
        const parouLa = out.slice(k, m + 1).reduce((s, p) => s + (p.f - p.t), 0) >= P.STAY_MIN / 2;
        if (ida >= P.PICO_MIN && !parouLa && dpt(a, b) <= Math.max(40, 0.35 * ida)) {
          a.f = Math.max(a.f, out[m].f);
          out.splice(k, m - k + 1); k -= 1; break;
        }
      }
    }
    return out;
  }

  // Lê os pontos de um dia e devolve paradas, trechos, lacunas e a linha do tempo.
  function analisarDia(pts, opts) {
    opts = opts || {};
    pts = limparPicos((pts || []).filter(p => p && Number.isFinite(p.t) && Number.isFinite(p.la) && Number.isFinite(p.ln)).map(p => ({ ...p, f: Math.max(p.t, Number(p.f) || p.t) })));
    const n = pts.length, lugares = opts.lugares || [];
    let stays = [];
    for (let i = 0; i < n;) {
      // cresce a estadia enquanto o próximo ponto está perto do centro dela (não do 1º ponto:
      // com GPS ruidoso o 1º ponto pode estar na borda e quebrar a estadia em pedaços)
      // Peso = tempo parado no ponto: o centro gruda onde ele ficou e não "anda" junto com
      // os pontos de quem está chegando; depois corta as pontas longe do centro final.
      const w = k => 1 + (pts[k].f - pts[k].t) / 20000;
      let j = i, sla = pts[i].la * w(i), sln = pts[i].ln * w(i), sw = w(i);
      // dentro do raio do mesmo lugar salvo também é a mesma estadia (prédio grande, GPS
      // escorregando para a borda): senão vira "saiu/chegou" e um trecho no vizinho
      const Lc = lugarEm(pts[i].la, pts[i].ln, lugares);
      const mesma = q => dist(sla / sw, sln / sw, q.la, q.ln) <= P.STAY_R || (!!Lc && lugarEm(q.la, q.ln, lugares) === Lc);
      while (j + 1 < n && !pts[j + 1].q && mesma(pts[j + 1])) { j++; sla += pts[j].la * w(j); sln += pts[j].ln * w(j); sw += w(j); }
      // ponta que só passou (< 20 s no ponto) a mais de 50 m do centro é do trecho, não da parada
      const ponta = k => { const d = dist(sla / sw, sln / sw, pts[k].la, pts[k].ln); return d > P.STAY_R || (d > 50 && pts[k].f - pts[k].t < 20000); };
      let a = i, b = j;
      while (a < b && ponta(a)) a++;
      while (b > a && ponta(b)) b--;
      if (pts[b].f - pts[a].t >= P.STAY_MIN) { stays.push({ i: a, j: b }); i = j + 1; } else i++;
    }
    const centro = s => {
      let la = 0, ln = 0, w = 0;
      for (let k = s.i; k <= s.j; k++) { const pw = 1 + (pts[k].f - pts[k].t) / MIN; la += pts[k].la * pw; ln += pts[k].ln * pw; w += pw; }
      s.la = la / w; s.ln = ln / w;
      let L = lugarEm(s.la, s.ln, lugares);
      if (!L) { // ponto médio fora do raio: tenta com folga de 50 m
        let dm = Infinity;
        for (const l of lugares) { const d = dist(s.la, s.ln, l.lat, l.lng); if (d <= (l.raio || 100) + 50 && d < dm) { L = l; dm = d; } }
      }
      s.lugar = L || null;
    };
    stays.forEach(centro);
    const kmEntre = (a, b) => { let km = 0; for (let k = a + 1; k <= b; k++) km += dpt(pts[k - 1], pts[k]) / 1000; return km; };
    const temQuebra = (a, b) => { for (let k = a + 1; k <= b; k++) if (pts[k].q) return true; return false; };
    // junta estadias vizinhas no mesmo lugar separadas por ruído
    const juntas = [];
    for (const s of stays) {
      const u = juntas[juntas.length - 1];
      if (u && !temQuebra(u.j, s.i) && pts[s.i].t - pts[u.j].f <= P.JUNTAR_MS && kmEntre(u.j, s.i) <= P.JUNTAR_KM &&
          ((u.lugar && s.lugar && u.lugar.id === s.lugar.id) || (!u.lugar && !s.lugar && dist(u.la, u.ln, s.la, s.ln) <= 150))) {
        u.j = s.j; centro(u);
      } else juntas.push(s);
    }
    stays = juntas;
    const stayOf = new Array(n).fill(-1);
    stays.forEach((s, k) => { for (let x = s.i; x <= s.j; x++) stayOf[x] = k; });
    const paradas = stays.map(s => ({
      tipo: 'parada', ini: pts[s.i].t, fim: pts[s.j].f, nome: s.lugar ? s.lugar.nome : '', lugarId: s.lugar ? s.lugar.id : null,
      la: s.la, ln: s.ln
    }));
    const trechos = [], lacunas = [];
    let cur = null;
    const fechar = () => { if (cur) { trechos.push(cur); cur = null; } };
    for (let k = 1; k < n; k++) {
      const a = pts[k - 1], b = pts[k];
      if (stayOf[k] >= 0 && stayOf[k] === stayOf[k - 1]) { fechar(); continue; }
      if (b.q) {
        fechar();
        lacunas.push({ tipo: 'lacuna', ini: a.f, fim: b.t, mesmoPonto: dpt(a, b) <= P.MESMO_PONTO });
        continue;
      }
      if (cur && stayOf[k - 1] >= 0) fechar();
      if (!cur) cur = { tipo: 'trecho', a: k - 1, b: k, ini: a.f, fim: b.t, km: 0, deS: stayOf[k - 1] };
      cur.b = k; cur.fim = b.t; cur.km += dpt(a, b) / 1000; cur.paraS = stayOf[k];
    }
    fechar();
    const nomeStay = k => (k >= 0 ? (paradas[k].nome || 'parada sem nome') : '');
    const trs = trechos.filter(t => t.km >= P.TRECHO_MIN_KM).map(t => ({
      tipo: 'trecho', ini: t.ini, fim: t.fim, km: t.km, min: (t.fim - t.ini) / MIN,
      de: nomeStay(t.deS), para: t.paraS >= 0 ? nomeStay(t.paraS) : '',
      coords: pts.slice(t.a, t.b + 1).map(p => [p.la, p.ln])
    }));
    return montar(paradas, trs, lacunas, opts);
  }

  // Junta paradas/trechos/lacunas numa linha do tempo com eventos em texto.
  function montar(paradas, trechos, lacunas, opts) {
    opts = opts || {};
    const itens = [...paradas, ...trechos, ...lacunas].sort((x, y) => x.ini - y.ini || (x.tipo === 'parada' ? 1 : -1));
    itens.forEach((it, k) => { it.k = k; it.dur = Math.max(0, it.fim - it.ini); });
    const dia = opts.dia || (itens[0] ? diaLocal(itens[0].ini) : '');
    const d0 = dia ? inicioDia(dia) : 0;
    const ult = itens[itens.length - 1];
    if (ult && ult.tipo === 'parada' && opts.agora && dia === diaLocal(opts.agora) && opts.agora - ult.fim <= P.ABERTA_MS) ult.aberta = true;
    const nomeP = p => p.nome || (p.endereco ? `local sem nome (${p.endereco})` : 'local sem nome');
    const eventos = [];
    const ev = (ts, tipo, texto, k) => eventos.push({ ts, hora: hhmm(ts), tipo, texto, k });
    itens.forEach((it, k) => {
      if (it.tipo === 'parada') {
        // 1º registro do dia não é chegada: só se sabe que ele já estava lá
        if (k === 0) ev(it.ini, 'inicio', it.ini - d0 <= 5 * MIN ? `em ${nomeP(it)} desde o início do dia` : `em ${nomeP(it)} (primeiro registro do dia)`, k);
        else ev(it.ini, 'chegada', `${it.nome ? 'chegou em' : 'parou em'} ${nomeP(it)}`, k);
        if (it.aberta) eventos[eventos.length - 1].texto += ` (lá há ${duracao(opts.agora - it.ini)})`;
        else if (it === ult && it.fim < d0 + DIA - 2 * MIN) ev(it.fim, 'fim', `último registro em ${nomeP(it)} (${duracao(it.dur)} lá)`, k); // dados acabam aqui: não é saída
        else if (it.fim < d0 + DIA - 2 * MIN) ev(it.fim, 'saida', `saiu de ${nomeP(it)} (ficou ${duracao(it.dur)})`, k);
      } else if (it.tipo === 'trecho') {
        ev(it.ini, 'transito', `em trânsito (${fmtKm(it.km)}, ${duracao(it.dur)})`, k);
      } else {
        ev(it.ini, 'lacuna', `sem registro ${hhmm(it.ini)}–${hhmm(it.fim)}${it.mesmoPonto ? ' (voltou ao mesmo ponto)' : ''}`, k);
      }
    });
    eventos.sort((a, b) => a.ts - b.ts);
    const km = trechos.reduce((s, t) => s + t.km, 0);
    const minMov = trechos.reduce((s, t) => s + (t.fim - t.ini) / MIN, 0);
    return { dia, itens, paradas, trechos, lacunas, eventos, km, minMov };
  }

  // Resumo compacto que vai para a nuvem (sem pontos brutos).
  function resumir(an, dia, dev, agora) {
    const d0 = inicioDia(dia), m = ts => Math.max(0, Math.min(1440, Math.round((ts - d0) / MIN)));
    const base = {
      dev, at: agora, km: Math.round(an.km * 100) / 100, mm: Math.round(an.minMov),
      paradas: an.paradas.slice(-P.MAX_ITENS).map(p => {
        const o = { i: m(p.ini), f: m(p.fim), nome: p.nome || '', la: r4(p.la), ln: r4(p.ln) };
        if (p.lugarId) o.id = p.lugarId;
        return o;
      }),
      trechos: an.trechos.slice(-P.MAX_ITENS).map(t => ({ i: m(t.ini), f: m(t.fim), km: Math.round(t.km * 100) / 100, de: t.de || '', para: t.para || '', _c: t.coords || [] })),
      lacunas: an.lacunas.slice(-P.MAX_ITENS).map(l => [m(l.ini), m(l.fim)])
    };
    const montarR = tol => ({ ...base, trechos: base.trechos.map(t => { const o = { ...t }; delete o._c; if (tol != null && t._c.length >= 2) o.pl = codificar(simplificar(t._c, tol)); return o; }) });
    for (const tol of [8, 15, 30, 60, 120, 250, 500]) {
      const r = montarR(tol);
      if (JSON.stringify(r).length <= P.MAX_DIA) return r;
    }
    const r = montarR(null); // sem linha: fica só com os números
    while (JSON.stringify(r).length > P.MAX_DIA && (r.paradas.length > 1 || r.trechos.length > 1)) {
      if (r.trechos.length >= r.paradas.length) r.trechos.shift(); else r.paradas.shift();
    }
    return r;
  }
  // Resumo da nuvem -> mesma forma de analisarDia (para outro aparelho ver)
  function deResumo(r, dia, opts) {
    const d0 = inicioDia(dia), ts = mm => d0 + (Number(mm) || 0) * MIN;
    const paradas = (r.paradas || []).map(p => ({ tipo: 'parada', ini: ts(p.i), fim: ts(p.f), nome: p.nome || '', lugarId: p.id || null, la: p.la, ln: p.ln }));
    const trechos = (r.trechos || []).map(t => ({ tipo: 'trecho', ini: ts(t.i), fim: ts(t.f), km: Number(t.km) || 0, min: (Number(t.f) - Number(t.i)) || 0, de: t.de || '', para: t.para || '', coords: t.pl ? decodificar(t.pl) : [] }));
    const lacunas = (r.lacunas || []).map(l => ({ tipo: 'lacuna', ini: ts(l[0]), fim: ts(l[1]), mesmoPonto: false }));
    const an = montar(paradas, trechos, lacunas, { ...(opts || {}), dia });
    // os números do dia vêm do resumo (calculados nos pontos brutos, sem o arredondamento dos minutos)
    if (Number.isFinite(r.km)) an.km = r.km;
    if (Number.isFinite(r.mm)) an.minMov = r.mm;
    return an;
  }

  function normWrap(w) {
    w = w && typeof w === 'object' && !Array.isArray(w) ? w : {};
    return {
      dias: w.dias && typeof w.dias === 'object' && !Array.isArray(w.dias) ? w.dias : {},
      apagados: w.apagados && typeof w.apagados === 'object' && !Array.isArray(w.apagados) ? w.apagados : {},
      tudo: Number(w.tudo) || 0, owner: w.owner
    };
  }
  function podar(o, agora) {
    const lim = diaLocal(agora - P.RETENCAO * DIA), limPl = diaLocal(agora - P.PL_DIAS * DIA);
    for (const d of Object.keys(o.dias)) {
      if (d < lim) { delete o.dias[d]; continue; }
      if (d < limPl) for (const r of Object.values(o.dias[d])) for (const t of r.trechos || []) delete t.pl;
    }
    for (const d of Object.keys(o.apagados)) if (d < lim) delete o.apagados[d];
    let dias = Object.keys(o.dias).sort();
    while (JSON.stringify(o).length > P.MAX_TOTAL && dias.length) {
      const comPl = dias.find(d => Object.values(o.dias[d]).some(r => (r.trechos || []).some(t => t.pl)));
      if (comPl && comPl !== dias[dias.length - 1]) { for (const r of Object.values(o.dias[comPl])) for (const t of r.trechos || []) delete t.pl; continue; }
      if (dias.length === 1) break;
      delete o.dias[dias.shift()];
    }
    return o;
  }
  // União por dia e por aparelho; lápide de dia / "apagar tudo" vencem o que é mais antigo.
  function mesclar(a, b, agora) {
    const A = normWrap(a), B = normWrap(b);
    const out = { v: 1, dias: {}, apagados: {}, tudo: Math.max(A.tudo, B.tudo) };
    for (const src of [A.apagados, B.apagados]) for (const [d, t] of Object.entries(src)) out.apagados[d] = Math.max(out.apagados[d] || 0, Number(t) || 0);
    for (const src of [A.dias, B.dias]) for (const [d, devs] of Object.entries(src)) {
      if (!devs || typeof devs !== 'object') continue;
      const lim = Math.max(out.tudo, out.apagados[d] || 0);
      for (const [dv, r] of Object.entries(devs)) {
        if (!r || typeof r !== 'object' || (Number(r.at) || 0) <= lim) continue;
        const cur = out.dias[d] && out.dias[d][dv];
        if (!cur || (Number(r.at) || 0) > (Number(cur.at) || 0)) (out.dias[d] = out.dias[d] || {})[dv] = JSON.parse(JSON.stringify(r));
      }
    }
    if (!out.tudo) delete out.tudo;
    out.dias = Object.keys(out.dias).sort().reduce((acc, d) => { acc[d] = out.dias[d]; return acc; }, {});
    const owner = A.owner != null ? A.owner : B.owner;
    if (owner != null) out.owner = owner;
    return podar(out, agora || Date.now());
  }
  // Escolhe o resumo de um dia: o deste aparelho, senão o mais completo.
  function melhorResumo(devs, dev) {
    if (!devs) return null;
    if (dev && devs[dev]) return devs[dev];
    return Object.values(devs).sort((x, y) => ((y.km || 0) + (y.paradas || []).length) - ((x.km || 0) + (x.paradas || []).length))[0] || null;
  }

  // Números de uma lista de dias analisados (sem coordenadas).
  function semana(analises) {
    const porLugar = new Map(), trechos = new Map();
    const dias = analises.map(an => {
      for (const p of an.paradas) {
        const nome = p.nome || 'locais sem nome';
        porLugar.set(nome, (porLugar.get(nome) || 0) + (p.fim - p.ini) / MIN);
      }
      for (const t of an.trechos) {
        if (!t.de || !t.para || t.de === t.para) continue;
        const k = `${t.de} → ${t.para}`;
        const c = trechos.get(k) || { de: t.de, para: t.para, vezes: 0, km: 0, min: 0 };
        c.vezes += 1; c.km += t.km; c.min += (t.fim - t.ini) / MIN; trechos.set(k, c);
      }
      return { dia: an.dia, km: Math.round(an.km * 10) / 10, minMov: Math.round(an.minMov), paradas: an.paradas.length, comDados: an.itens.length > 0 };
    });
    return {
      dias,
      km: Math.round(dias.reduce((s, d) => s + d.km, 0) * 10) / 10,
      minMov: dias.reduce((s, d) => s + d.minMov, 0),
      tempoPorLugar: [...porLugar.entries()].map(([nome, min]) => ({ nome, min: Math.round(min) })).sort((a, b) => b.min - a.min),
      trechosRepetidos: [...trechos.values()].map(c => ({ de: c.de, para: c.para, vezes: c.vezes, kmMedio: Math.round(c.km / c.vezes * 10) / 10, minMedio: Math.round(c.min / c.vezes) }))
        .sort((a, b) => b.vezes - a.vezes || b.kmMedio - a.kmMedio)
    };
  }
  // Versão pública de um dia: horários e números, nenhuma coordenada.
  function publico(an, extra) {
    const h = ts => hhmm(ts), mins = ms => Math.round(ms / MIN);
    return Object.assign({
      dia: an.dia, km: Math.round(an.km * 10) / 10, minMov: Math.round(an.minMov),
      paradas: an.paradas.map(p => ({ nome: p.nome || 'parada sem nome', lugarId: p.lugarId || null, ini: h(p.ini), fim: p.aberta ? null : h(p.fim), min: mins(p.fim - p.ini), endereco: p.endereco || undefined })),
      trechos: an.trechos.map(t => ({ de: t.de || '', para: t.para || '', ini: h(t.ini), fim: h(t.fim), km: Math.round(t.km * 10) / 10, min: mins(t.fim - t.ini) })),
      lacunas: an.lacunas.map(l => ({ ini: h(l.ini), fim: h(l.fim), min: mins(l.fim - l.ini) })),
      eventos: an.eventos.map(e => ({ hora: e.hora, ts: e.ts, tipo: e.tipo, texto: e.texto }))
    }, extra || {});
  }

  const N = { P, MIN, DIA, canon, diaLocal, inicioDia, hhmm, somaDias, dist, duracao, fmtKm, codificar, decodificar, simplificar, lugarEm,
    registrar, limparPicos, analisarDia, montar, resumir, deResumo, mesclar, podar, melhorResumo, semana, publico };
  if (typeof module === 'object' && module && module.exports) { module.exports = N; return; }

  // ------------------------------------------------------------ navegador
  const W = root, LS = W.localStorage;
  const RK = 'agenda_rotas_v1', EK = 'agenda_rotas_estado_v1', GK = 'agenda_rotas_geo_v1', PK = 'agenda_rotas_pts_v1';
  const SYNC_CFG = 'agenda_supabase_config_v1', LK = 'agenda_lugares_v1';
  const json = (v, fb) => { try { const x = JSON.parse(v); return x == null ? fb : x; } catch (_) { return fb; } };
  const ownerAtual = () => String(json(LS.getItem(SYNC_CFG) || '{}', {}).workspaceOwnerId || '');
  const agoraMs = () => Date.now();
  let est = Object.assign({ dev: '', ocultoDesde: 0, ocultoBg: false, desligadoDesde: 0, semMon: [], nuvemEm: 0, sig: null }, json(LS.getItem(EK), {}));
  if (!Array.isArray(est.semMon)) est.semMon = [];
  const salvarEst = () => { try { LS.setItem(EK, JSON.stringify(est)); } catch (_) {} };
  function devId() {
    if (!est.dev) {
      const c = json(LS.getItem(SYNC_CFG) || '{}', {});
      const base = String(c.deviceId || (W.crypto && W.crypto.randomUUID ? W.crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)));
      est.dev = base.replace(/[^a-z0-9]/gi, '').slice(0, 8) || 'aparelho';
      salvarEst();
    }
    return est.dev;
  }
  function addSemMon(a, b) {
    if (!(b > a)) return;
    const lim = agoraMs() - 3 * DIA;
    est.semMon = est.semMon.filter(x => Array.isArray(x) && x[1] >= lim).concat([[a, b]]).slice(-30);
    salvarEst();
  }
  const semMonitor = (a, b) => est.semMon.some(x => x[0] < b && x[1] > a);
  // fundo monitorado só quando nativo.js está nesta página (classe app-nativo)
  const bgMonitorado = () => !!(W.document && W.document.documentElement && W.document.documentElement.classList && W.document.documentElement.classList.contains('app-nativo'));
  const nativo = () => { try { return !!(W.Capacitor && W.Capacitor.isNativePlatform && W.Capacitor.isNativePlatform()); } catch (_) { return false; } };
  function lugares() {
    try { if (W.AgendaLocal && typeof W.AgendaLocal.lugares === 'function') return W.AgendaLocal.lugares(); } catch (_) {}
    const w = json(LS.getItem(LK), null);
    return w && Array.isArray(w.itens) ? w.itens.filter(l => l && Number.isFinite(l.lat) && Number.isFinite(l.lng)) : [];
  }
  function lerWrap() {
    const w = json(LS.getItem(RK), null);
    if (!w || typeof w !== 'object' || Array.isArray(w)) return { v: 1, dias: {}, apagados: {} };
    if (w.owner != null && String(w.owner) !== ownerAtual()) return { v: 1, dias: {}, apagados: {} };
    const n = normWrap(w), o = { v: 1, dias: n.dias, apagados: n.apagados };
    if (n.tudo) o.tudo = n.tudo;
    return o;
  }
  function gravarWrap(w) {
    w.owner = ownerAtual();
    try { LS.setItem(RK, JSON.stringify(w)); } catch (_) {}
  }
  let wrap = lerWrap();

  // ---- pontos brutos (IndexedDB; sem IndexedDB, só o dia de hoje no localStorage)
  const pt2a = p => [p.t, p.la, p.ln, p.a, p.f - p.t, p.q ? 1 : 0];
  const a2pt = a => { const p = { t: a[0], la: a[1], ln: a[2], a: a[3], f: a[0] + (a[4] || 0) }; if (a[5]) p.q = 1; return p; };
  let dbP = null;
  function abrirDb() {
    if (!dbP) dbP = new Promise((res, rej) => {
      if (!W.indexedDB) { rej(new Error('sem IndexedDB')); return; }
      const r = W.indexedDB.open('agenda-rotas', 1);
      r.onupgradeneeded = () => { if (!r.result.objectStoreNames.contains('dias')) r.result.createObjectStore('dias', { keyPath: 'dia' }); };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    return dbP;
  }
  function idb(modo, fn) {
    return abrirDb().then(db => new Promise((res, rej) => {
      const tx = db.transaction('dias', modo), rq = fn(tx.objectStore('dias'));
      let out; if (rq) rq.onsuccess = () => { out = rq.result; };
      tx.oncomplete = () => res(out); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error);
    }));
  }
  async function lerPts(dia) {
    try {
      const r = await idb('readonly', st => st.get(dia));
      return r && r.owner === ownerAtual() && Array.isArray(r.pts) ? r.pts.map(a2pt) : null;
    } catch (_) {
      const r = json(LS.getItem(PK), null);
      return r && r.dia === dia && r.owner === ownerAtual() && Array.isArray(r.pts) ? r.pts.map(a2pt) : null;
    }
  }
  async function gravarPts(dia, pts) {
    const rec = { dia, owner: ownerAtual(), at: agoraMs(), pts: pts.map(pt2a) };
    try { await idb('readwrite', st => st.put(rec)); }
    catch (_) { try { LS.setItem(PK, JSON.stringify(rec)); } catch (__) {} }
  }
  async function apagarPts(dia) {
    try { await idb('readwrite', st => st.delete(dia)); } catch (_) {}
    const r = json(LS.getItem(PK), null); if (r && (!dia || r.dia === dia)) LS.removeItem(PK);
  }
  async function diasLocais() { try { return (await idb('readonly', st => st.getAllKeys())) || []; } catch (_) { return []; } }
  async function podarLocal() {
    const lim = diaLocal(agoraMs() - P.RETENCAO * DIA);
    for (const d of await diasLocais()) {
      const t = Math.max(wrap.tudo || 0, wrap.apagados[d] || 0);
      if (d < lim) { await apagarPts(d); continue; }
      if (t && d !== hoje.dia) {
        const pts = await lerPts(d);
        if (pts) { const resto = pts.filter(p => p.t > t); if (!resto.length) await apagarPts(d); else if (resto.length !== pts.length) await gravarPts(d, resto); }
      }
    }
  }

  // ---- gravação ----
  let hoje = { dia: '', pts: [], carregado: false };
  let fila = [];
  const mem = {};
  let tGravar = 0, tNuvem = 0;
  const ctx = () => ({ lugares: lugares(), mem, semMonitor });
  const emitir = () => { try { W.dispatchEvent(new W.CustomEvent('agenda:rotas-change', { detail: { dia: hoje.dia } })); } catch (_) {} };
  function agendarGravar() {
    if (tGravar) return;
    tGravar = W.setTimeout(() => { tGravar = 0; gravarPts(hoje.dia, hoje.pts); }, 15000);
  }
  function gravarAgora() { if (tGravar) { W.clearTimeout(tGravar); tGravar = 0; } if (hoje.dia && hoje.pts.length) return gravarPts(hoje.dia, hoje.pts); }
  function atualizarNuvem(dia, pts, forcar) {
    const agora = agoraMs();
    if (!dia || !pts || !pts.length) return false;
    if (!forcar && agora - (est.nuvemEm || 0) < P.NUVEM_MS) return false;
    const an = analisarDia(pts, { lugares: lugares(), dia, agora });
    if (!an.paradas.length && !an.trechos.length && !an.lacunas.length) return false;
    const r = resumir(an, dia, devId(), agora);
    // só regrava (= push no Supabase) se algo mudou de verdade: parada/trecho/lacuna nova,
    // ou o fim da estadia atual andou mais 15 min. Ficar parado o dia todo não gera envio a cada 5 min.
    const sig = JSON.stringify([r.paradas.map(p => [p.i, p.nome, Math.floor(p.f / 15)]), r.trechos.map(t => [t.i, t.f, t.km]), r.lacunas]);
    est.nuvemEm = agora;
    if (est.sig && est.sig.dia === dia && est.sig.s === sig) { salvarEst(); return false; }
    wrap = mesclar(wrap, { dias: { [dia]: { [devId()]: r } } }, agora);
    delete wrap.owner;
    gravarWrap(wrap);
    est.sig = { dia, s: sig }; salvarEst();
    return true;
  }
  function agendarNuvem() {
    if (tNuvem) return;
    const falta = Math.max(1000, P.NUVEM_MS - (agoraMs() - (est.nuvemEm || 0)));
    tNuvem = W.setTimeout(() => { tNuvem = 0; atualizarNuvem(hoje.dia, hoje.pts, false) && emitir(); }, falta);
  }
  function virarDia(novo, fix) {
    const antigo = hoje.dia, pts = hoje.pts, ult = pts[pts.length - 1];
    const novos = [];
    if (ult) {
      const acc = Number.isFinite(fix.acc) ? fix.acc : 999;
      const perto = dist(ult.la, ult.ln, fix.lat, fix.lng) < Math.max(P.DIST_MIN, 0.8 * acc);
      const lug = lugares(), Lf = lugarEm(fix.lat, fix.lng, lug);
      const mesmoLugar = Lf && Lf === lugarEm(ult.la, ult.ln, lug);
      const silencio = fix.ts - ult.f > P.GAP_MS && semMonitor(ult.f, fix.ts);
      if ((perto || mesmoLugar) && !silencio) {
        // parado atravessando a meia-noite: a estadia é dividida entre os dois dias
        const meia = inicioDia(novo);
        if (ult.f < meia) ult.f = meia - 1;
        novos.push({ t: meia, la: ult.la, ln: ult.ln, a: ult.a, f: meia });
      }
    }
    if (antigo && pts.length) { gravarPts(antigo, pts); atualizarNuvem(antigo, pts, true); }
    hoje = { dia: novo, pts: novos, carregado: true };
  }
  function aoFix(fix) {
    if (!fix) return;
    if (!hoje.carregado) { if (fila.length < 500) fila.push(fix); return; }
    const dia = diaLocal(fix.ts);
    if (hoje.dia && dia < hoje.dia) return; // leitura atrasada de outro dia: ignora
    if (dia !== hoje.dia) virarDia(dia, fix);
    if (est.ultimoDia !== hoje.dia) { est.ultimoDia = hoje.dia; salvarEst(); }
    const r = registrar(hoje.pts, fix, ctx());
    if (r === 'novo' || r === 'lacuna' || r === 'parado' || r === 'estadia') {
      agendarGravar();
      if (r !== 'parado' && r !== 'estadia') emitir();
      if (agoraMs() - (est.nuvemEm || 0) >= P.NUVEM_MS) { if (atualizarNuvem(hoje.dia, hoje.pts, false)) emitir(); } else agendarNuvem();
    }
  }
  function aplicarApagadosHoje() {
    const t = Math.max(wrap.tudo || 0, wrap.apagados[hoje.dia] || 0);
    if (!t || !hoje.pts.length) return;
    const resto = hoje.pts.filter(p => p.t > t);
    if (resto.length !== hoje.pts.length) { hoje.pts = resto; gravarAgora() || apagarPts(hoje.dia); est.sig = null; salvarEst(); }
  }
  function mesclarDoStorage() {
    const st = lerWrap();
    const m = mesclar(wrap, st, agoraMs()); delete m.owner;
    wrap = m;
    if (canon(m) !== canon(st)) gravarWrap(m);
    aplicarApagadosHoje();
    podarLocal();
    emitir();
  }

  // ---- monitoramento: o que não foi visto vira lacuna ----
  function aoEsconder() {
    if (!est.ocultoDesde) { est.ocultoDesde = agoraMs(); est.ocultoBg = bgMonitorado(); salvarEst(); }
    gravarAgora();
    if (atualizarNuvem(hoje.dia, hoje.pts, false)) emitir();
  }
  function aoVoltar() {
    if (!est.ocultoDesde) return;
    if (!est.ocultoBg) addSemMon(est.ocultoDesde, agoraMs());
    est.ocultoDesde = 0; salvarEst();
  }
  function conferirMotor() {
    const L = W.AgendaLocal; if (!L || typeof L.ativo !== 'function') return;
    const on = !!L.ativo();
    if (!on && !est.desligadoDesde) { est.desligadoDesde = agoraMs(); salvarEst(); }
    else if (on && est.desligadoDesde) { addSemMon(est.desligadoDesde, agoraMs()); est.desligadoDesde = 0; salvarEst(); }
  }
  // Saída do modo econômico (localizacao.js): sem leituras no meio, mas o motor sabe que ele
  // ficou parado até ~`ate`. A estadia vai até lá (atravessando a meia-noite, se preciso),
  // e o trecho seguinte começa na saída, não no último ponto de horas atrás.
  function aoEco(d) {
    if (d.eco || !Number.isFinite(d.ate) || !hoje.carregado) return;
    let p = hoje.pts[hoje.pts.length - 1];
    if (!p || d.ate <= p.f) return;
    const dia = diaLocal(d.ate);
    if (hoje.dia && dia < hoje.dia) return;
    if (dia !== hoje.dia) { virarDia(dia, { lat: p.la, lng: p.ln, acc: p.a, ts: d.ate }); p = hoje.pts[hoje.pts.length - 1]; if (!p) return; }
    p.f = Math.max(p.f, d.ate);
    agendarGravar();
  }
  W.addEventListener('agenda:local-change', e => {
    const d = e && e.detail; if (!d) return;
    if (d.tipo === 'fix' && d.fix) aoFix(d.fix);
    else if (d.tipo === 'eco') aoEco(d);
    else conferirMotor();
  });
  W.addEventListener('agenda:remote-sync', e => {
    const k = e && e.detail && e.detail.documentKey;
    if (k && k !== 'all' && k !== 'settings' && k !== 'rotas') return;
    try { mesclarDoStorage(); } catch (_) {}
  });
  if (W.document) {
    W.document.addEventListener('visibilitychange', () => { if (W.document.hidden) aoEsconder(); else aoVoltar(); });
    W.addEventListener('pagehide', aoEsconder);
    W.addEventListener('pageshow', e => { if (e && e.persisted) aoVoltar(); });
  }

  // ---- leitura ----
  const geoCache = () => { const g = json(LS.getItem(GK), {}); return g && typeof g === 'object' ? g : {}; };
  const geoChave = (la, ln) => `${Number(la).toFixed(4)},${Number(ln).toFixed(4)}`;
  function comEnderecos(an) {
    const g = geoCache();
    for (const p of an.paradas) if (!p.nome && Number.isFinite(p.la)) { const e = g[geoChave(p.la, p.ln)]; if (e && e.t) p.endereco = e.t; }
    return an;
  }
  function analise(iso) {
    iso = iso || diaLocal(agoraMs());
    const opts = { lugares: lugares(), dia: iso, agora: agoraMs() };
    let an = null, fonte = '';
    if (iso === hoje.dia && hoje.carregado && hoje.pts.length) { an = analisarDia(hoje.pts, opts); fonte = 'aparelho'; }
    if (!an || !an.itens.length) {
      const r = melhorResumo(wrap.dias[iso], devId());
      if (r) { an = deResumo(r, iso, opts); fonte = r.dev === devId() ? 'resumo deste aparelho' : 'resumo de outro aparelho'; }
    }
    if (!an) { an = montar([], [], [], opts); fonte = 'sem dados'; }
    // recalcula os eventos com os endereços em cache das paradas sem nome
    comEnderecos(an);
    const re = montar(an.paradas, an.trechos, an.lacunas, opts);
    re.fonte = fonte;
    return re;
  }
  async function detalhe(iso) {
    iso = iso || diaLocal(agoraMs());
    if (iso !== hoje.dia) {
      const pts = await lerPts(iso);
      if (pts && pts.length) {
        const opts = { lugares: lugares(), dia: iso, agora: agoraMs() };
        const an = comEnderecos(analisarDia(pts, opts));
        const re = montar(an.paradas, an.trechos, an.lacunas, opts); re.fonte = 'aparelho';
        return re;
      }
    }
    return analise(iso);
  }
  function apiSemana(fim) {
    fim = fim || diaLocal(agoraMs());
    const lista = [];
    for (let k = 6; k >= 0; k--) lista.push(analise(somaDias(fim, -k)));
    const s = semana(lista); s.ini = somaDias(fim, -6); s.fim = fim;
    return s;
  }
  function apagarDia(iso) {
    const agora = agoraMs();
    wrap.apagados[iso] = agora; delete wrap.dias[iso];
    gravarWrap(wrap);
    if (iso === hoje.dia) { hoje.pts = []; est.sig = null; salvarEst(); }
    apagarPts(iso);
    emitir();
  }
  async function apagarTudo() {
    const agora = agoraMs();
    wrap = { v: 1, dias: {}, apagados: {}, tudo: agora };
    gravarWrap(wrap);
    hoje.pts = []; est.sig = null; salvarEst();
    for (const d of await diasLocais()) await apagarPts(d);
    apagarPts('');
    emitir();
  }
  function resumoJarvis() {
    try {
      const an = analise(), s = apiSemana();
      const h = an.dia.slice(8, 10) + '/' + an.dia.slice(5, 7);
      let txt = `ROTAS (${h}): `;
      txt += an.itens.length ? `${fmtKm(an.km)} em ${duracao(an.minMov * MIN)} de deslocamento. Linha do tempo: ` + an.eventos.slice(-25).map(e => `${e.hora} ${e.texto}`).join('; ') + '.' : 'nada registrado hoje.';
      const lug = s.tempoPorLugar.slice(0, 4).map(l => `${l.nome} ${duracao(l.min * MIN)}`).join(', ');
      const rep = s.trechosRepetidos.slice(0, 3).map(t => `${t.de}→${t.para} ${t.vezes}x`).join(', ');
      txt += `\nROTAS 7 DIAS: ${fmtKm(s.km)}${lug ? '; tempo por lugar: ' + lug : ''}${rep ? '; trechos frequentes: ' + rep : ''}. (Rota só fica completa no app nativo com localização "Sempre"; "sem registro" = app fechado ou sem GPS.)`;
      return txt;
    } catch (_) { return 'ROTAS: (indisponível)'; }
  }
  function lembrarEndereco(la, ln, texto) {
    const g = geoCache(); g[geoChave(la, ln)] = { t: String(texto || '').slice(0, 160), em: agoraMs() };
    const ks = Object.keys(g); if (ks.length > 300) ks.sort((a, b) => (g[a].em || 0) - (g[b].em || 0)).slice(0, ks.length - 300).forEach(k => delete g[k]);
    try { LS.setItem(GK, JSON.stringify(g)); } catch (_) {}
  }

  W.AgendaRotas = {
    dia: iso => { const a = analise(iso); return publico(a, { fonte: a.fonte }); },
    semana: apiSemana,
    detalhe, analise, apagarDia, apagarTudo, resumoJarvis,
    endereco: (la, ln) => { const e = geoCache()[geoChave(la, ln)]; return e ? e.t : ''; },
    lembrarEndereco,
    status: () => ({ ativo: !!(W.AgendaLocal && W.AgendaLocal.ativo && W.AgendaLocal.ativo()), nativo: nativo(), fundo: bgMonitorado(), pontosHoje: hoje.pts.length, carregado: hoje.carregado }),
    diasComDados: () => Object.keys(wrap.dias).sort(),
    mesclar: (a, b) => mesclar(a, b, agoraMs()),
    nucleo: N,
    _aoFix: aoFix, _aoEco: aoEco, _estado: () => ({ est, hoje, wrap }) // para testes
  };

  async function boot() {
    devId();
    // a página foi descarregada enquanto escondida: ninguém monitorou esse tempo
    if (est.ocultoDesde) { addSemMon(est.ocultoDesde, agoraMs()); est.ocultoDesde = 0; salvarEst(); }
    const dia = diaLocal(agoraMs());
    let pts = null;
    try { pts = await lerPts(dia); } catch (_) {}
    hoje = { dia, pts: pts || [], carregado: true };
    // o app fechou antes da meia-noite: fecha o resumo do último dia gravado
    if (est.ultimoDia && est.ultimoDia < dia) {
      const velho = est.ultimoDia; est.ultimoDia = dia; salvarEst();
      try { const pv = await lerPts(velho); if (pv && pv.length) atualizarNuvem(velho, pv, true); } catch (_) {}
    }
    aplicarApagadosHoje();
    conferirMotor();
    const f = fila; fila = []; f.forEach(aoFix);
    podarLocal();
    emitir();
  }
  boot();
})(typeof window !== 'undefined' ? window : this);
