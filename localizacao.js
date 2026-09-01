/* localizacao.js — o J.A.R.V.I.S sabe onde o Lagares está.

   O que faz: acompanha a posição pelo GPS do aparelho (navigator.geolocation),
   reconhece os LUGARES que o usuário ensinou ("agora estou em Casa"), registra
   VISITAS (chegada, saída, duração) e entrega um resumo compacto para o
   system prompt do Jarvis responder "onde estou", "quanto tempo fiquei no
   trabalho hoje", "que horas saí de casa".

   Limite honesto da plataforma: o iOS suspende o JavaScript de um web app em
   segundo plano — o rastreio contínuo só acontece com a Agenda ABERTA. Quando
   o app volta depois de um intervalo, a saída/chegada que aconteceu nesse meio
   tempo vira um INTERVALO de incerteza (ex.: "saiu de Casa entre 14:00 e
   19:05"), marcado com ≈ no resumo e `est*`/`*Min`/`*Max` na visita.

   Regras do motor (GPS de celular é ruidoso; cada regra evita um erro real):
   - fix com precisão pior que 150 m nunca é evidência de chegada/saída; se o
     círculo de erro cobre o lugar atual, vale só como "ainda aqui" (keep-alive).
   - CHEGADA: fixes dentro do anel de entrada por ≥ 60 s, sem estar em
     movimento (speed > 3 m/s nunca conta) — passar de carro não vira visita.
   - SAÍDA: 3 fixes (precisão ≤ 100 m) fora do anel raio+precisão+40 m por
     ≥ 45 s; ou 2 fixes precisos (≤ 50 m) cuja borda do erro já está longe.
   - o lugar atual é "grudento": um lugar vizinho mais próximo só toma o lugar
     com 3 fixes precisos (≤ 30 m) por ≥ 2 min claramente mais perto dele.
   - visita AFIRMADA pelo usuário ("estou em Casa") tem 10 min de carência e
     depois só sai com evidência forte; o centro do lugar se recentra sozinho
     no primeiro fix melhor que o usado ao criá-lo.
   - horários: saída = último fix dentro do raio (+ até 30 s), chegada = primeiro
     fix da sequência confirmada; visitas automáticas < 3 min são descartadas;
     voltar ao mesmo lugar em ≤ 15 min reabre a visita anterior.
   - GAP (app fechado > 10 min): nada é decidido no primeiro fix ao voltar; a
     máquina de estados segue normal e, quando confirma a transição, aplica o
     intervalo [fechou o app, reabriu] como incerteza. Se continua no mesmo
     lugar, a visita ganha `gaps` ("sem monitorar 23:00–08:00").

   Dados (sincronizam via supabase-shared-storage.js, aninhados em "settings"):
   - agenda_lugares_v1  = { v:1, itens:[{id,nome,lat,lng,raio,acc,criadoEm,atualizadoEm}], removidos:[{id,nome,em}] }
   - agenda_visitas_v1  = { v:1, itens:[{id,dev,lugarId,nome,chegada,saida,estChegada,chegadaMin,estSaida,saidaMax,afirmada,gaps,ultimoDentro,atualizadoEm}] }
   - agenda_local_state_v1 = estado do motor (só neste aparelho, não sincroniza)
   Os dois primeiros são OBJETOS de propósito: um array vazio cairia no guard de
   "payload vazio" do sync e dispararia a restauração da nuvem.                */
(() => {
  'use strict';

  const LK = 'agenda_lugares_v1';
  const VK = 'agenda_visitas_v1';
  const SK = 'agenda_local_state_v1';
  const SYNC_CFG = 'agenda_supabase_config_v1';

  // ---- parâmetros ----
  const MIN = 60 * 1000;
  const ACC_MAX = 150;                 // m: acima disso o fix não é evidência de nada
  const ACC_EXIT_MAX = 100;            // m: evidência de saída exige pelo menos isso
  const ACC_STRONG = 30;               // m: "fix preciso"
  const ACC_FAR = 50;                  // m: atalho de saída "longe" só com esta precisão
  const ENTER_MIN_MS = 60 * 1000;      // permanência mínima dentro para confirmar chegada
  const ENTER_MIN_FIXES = 2;
  const EXIT_FIXES = 3, EXIT_MIN_MS = 45 * 1000, EXIT_BUFFER = 40;
  const FAR_FIXES = 2, FAR_MIN_GAP_MS = 5 * 1000;
  const SWITCH_FIXES = 3, SWITCH_MIN_MS = 120 * 1000, SWITCH_MARGIN = 30; // troca Q→P grudenta
  const AFFIRM_GRACE_MS = 10 * MIN, AFFIRM_EXIT_MS = 120 * 1000;
  const RECENTER_WINDOW_MS = 10 * MIN;
  const SPEED_MOVING = 3, SPEED_STILL = 2;   // m/s
  const GAP_MS = 10 * MIN, GAP_EXPIRE_MS = 10 * MIN, GAP_CONFIRM_MS = 60 * 1000;
  const REOPEN_MS = 15 * MIN, MIN_VISITA_MS = 3 * MIN;
  const RAIO_PADRAO = 100, RAIO_MIN = 60, RAIO_MAX = 300;
  const RETENCAO_DIAS = 90, MAX_VISITAS = 600, MAX_GAPS = 20;
  const FIX_FRESCO_MS = 60 * 1000, FIX_RECENTE_MS = 15 * MIN;
  const PERSIST_SOFT_MS = 5 * MIN;     // gravar ultimoDentro/keep-alive no máximo a cada 5 min (cada gravação vira push no Supabase)
  const WATCH_OPTS = { enableHighAccuracy: true, timeout: 25000, maximumAge: 10000 };
  const ONCE_OPTS = { enableHighAccuracy: true, timeout: 20000, maximumAge: 15000 };

  // ---- utilidades ----
  const pad = n => String(n).padStart(2, '0');
  const isoDia = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const hhmm = ms => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const hojeIso = () => isoDia(new Date());
  const ontemIso = () => { const d = new Date(); d.setDate(d.getDate() - 1); return isoDia(d); };
  const novoId = () => (globalThis.crypto?.randomUUID?.() || `loc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
  const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  const titulo = s => String(s || '').trim().replace(/\s+/g, ' ').replace(/^\p{L}/u, c => c.toUpperCase());
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  function haversine(aLat, aLng, bLat, bLng) {
    const R = 6371000, r = Math.PI / 180;
    const dLat = (bLat - aLat) * r, dLng = (bLng - aLng) * r;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }
  function duracao(ms) {
    const m = Math.max(0, Math.round(ms / 60000));
    if (m < 1) return 'menos de 1 min';
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60), r = m % 60;
    return r ? `${h}h${pad(r)}` : `${h}h`;
  }
  const json = (v, fb) => { try { const x = JSON.parse(v); return x == null ? fb : x; } catch (_) { return fb; } };
  // Conta/agenda dona dos dados. Os wrappers são carimbados com ela: ao trocar
  // de conta no mesmo aparelho (prepareBlankWorkspace não zera estas chaves),
  // dados da conta anterior são ignorados em vez de vazar para a nova.
  const ownerAtual = () => String(json(localStorage.getItem(SYNC_CFG) || '{}', {}).workspaceOwnerId || '');
  function lerWrap(key) {
    const w = json(localStorage.getItem(key), null);
    if (w && typeof w === 'object' && !Array.isArray(w)) {
      if (w.owner != null && String(w.owner) !== ownerAtual()) return { v: 1, itens: [], removidos: [] }; // de outra conta
      return { v: 1, itens: Array.isArray(w.itens) ? w.itens : [], removidos: Array.isArray(w.removidos) ? w.removidos : [] };
    }
    if (Array.isArray(w)) return { v: 1, itens: w, removidos: [] }; // tolera formato antigo
    return { v: 1, itens: [], removidos: [] };
  }
  function gravarWrap(key, itens, removidos) {
    const w = { v: 1, owner: ownerAtual(), itens };
    if (removidos && removidos.length) w.removidos = removidos;
    localStorage.setItem(key, JSON.stringify(w));
  }

  // ---- estado ----
  let lugares = [], removidos = [], visitas = [];
  let state = Object.assign({ ativo: false, permissao: '', ultimoFix: null, ultimoBom: 0, ultimoCallbackTs: 0, ultimoRecebidoTs: 0, hiddenDesde: 0, gapPendente: null, dev: '' }, json(localStorage.getItem(SK), {}));
  // sequências em memória (zeram a cada carga — sem histórico não há histerese)
  let dentroSeq = null;   // {id, firstTs, lastTs, count, misses}
  let foraSeq = null;     // {firstTs, count, forte, farCount, farFirstTs}
  let trocaSeq = null;    // {id, firstTs, count}
  let watchId = null, keepAlive = 0, ultimoErro = '', ultimaGravacaoSuave = 0, ultimoStateSave = 0;
  let gapParaEntrada = null; // gap já usado na saída, guardado para a chegada seguinte herdar o mesmo intervalo
  let errosSeguidos = [];   // timestamps de POSITION_UNAVAILABLE (code 2) recentes
  let fixesGrosseiros = 0;  // fixes seguidos com precisão > 1 km ("Localização Precisa" desligada)

  function dev() {
    if (state.dev) return state.dev;
    const cfg = json(localStorage.getItem(SYNC_CFG) || '{}', {});
    state.dev = String(cfg.deviceId || '') || novoId();
    salvarState(true);
    return state.dev;
  }
  function carregar() {
    const L = lerWrap(LK), V = lerWrap(VK);
    lugares = L.itens.filter(l => l && l.id && Number.isFinite(l.lat) && Number.isFinite(l.lng));
    removidos = L.removidos;
    visitas = V.itens.filter(v => v && v.id && Number.isFinite(v.chegada));
  }
  function salvarLugares() { gravarWrap(LK, lugares, removidos); }
  function salvarVisitas() { podar(); gravarWrap(VK, visitas); ultimaGravacaoSuave = Date.now(); }
  function salvarVisitasSuave() { if (Date.now() - ultimaGravacaoSuave >= PERSIST_SOFT_MS) salvarVisitas(); }
  function salvarState(forcar) {
    if (!forcar && Date.now() - ultimoStateSave < 10000) return;
    ultimoStateSave = Date.now();
    try { localStorage.setItem(SK, JSON.stringify(state)); } catch (_) {}
  }
  function podar() {
    const limite = Date.now() - RETENCAO_DIAS * 86400000;
    visitas = visitas.filter(v => v.saida == null || v.chegada >= limite);
    if (visitas.length > MAX_VISITAS) {
      visitas.sort((a, b) => a.chegada - b.chegada);
      visitas = visitas.slice(visitas.length - MAX_VISITAS);
    }
  }
  function emitir(tipo, extra) {
    try { window.dispatchEvent(new CustomEvent('agenda:local-change', { detail: Object.assign({ tipo }, extra || {}) })); } catch (_) {}
  }

  // ---- lugares / visitas ----
  const lugarPorId = id => lugares.find(l => l.id === id) || null;
  const lugarPorNome = nome => { const n = norm(nome); return lugares.find(l => norm(l.nome) === n) || null; };
  const visitaAberta = () => { const d = dev(); return visitas.find(v => v.saida == null && (v.dev || d) === d) || null; };
  const distLugar = (l, fix) => haversine(fix.lat, fix.lng, l.lat, l.lng);
  const anelEntrada = (l, fix) => l.raio + Math.min(fix.acc, 50);
  const anelSaida = (l, fix) => l.raio + fix.acc + EXIT_BUFFER;
  function candidato(fix, excetoId) {
    let melhor = null, dMelhor = Infinity;
    for (const l of lugares) {
      if (l.id === excetoId) continue;
      const d = distLugar(l, fix);
      if (d <= anelEntrada(l, fix) && d < dMelhor) { melhor = l; dMelhor = d; }
    }
    return melhor ? { lugar: melhor, dist: dMelhor } : null;
  }
  function sobrepostos(lugar) {
    return lugares.filter(o => o.id !== lugar.id && haversine(o.lat, o.lng, lugar.lat, lugar.lng) < o.raio + lugar.raio);
  }
  // Abre uma visita — ou reabre a ÚLTIMA visita fechada deste aparelho, se foi
  // neste mesmo lugar há ≤ 15 min (saída falsa por ruído). Nunca reabre por
  // cima de outra visita que aconteceu no meio: isso criaria visitas sobrepostas.
  function abrirVisita(lugar, ts, opts) {
    opts = opts || {};
    const d = dev();
    const ultimaFechada = visitas.filter(v => v.saida != null && (v.dev || d) === d).sort((a, b) => b.saida - a.saida)[0];
    const recente = ultimaFechada && ultimaFechada.lugarId === lugar.id && ts - ultimaFechada.saida <= REOPEN_MS && ts >= ultimaFechada.chegada ? ultimaFechada : null;
    let v;
    if (recente) {
      v = recente; v.saida = null; v.estSaida = false; delete v.saidaMax;
      if (opts.afirmada) { v.afirmada = true; v.afirmadaEm = ts; }
    } else {
      v = { id: novoId(), dev: d, lugarId: lugar.id, nome: lugar.nome, chegada: ts, saida: null, estChegada: !!opts.estimada, estSaida: false, atualizadoEm: Date.now() };
      if (opts.estimada && opts.chegadaMin != null) v.chegadaMin = Math.min(opts.chegadaMin, ts);
      if (opts.afirmada) { v.afirmada = true; v.afirmadaEm = ts; }
      visitas.push(v);
    }
    v.atualizadoEm = Date.now();
    salvarVisitas(); salvarState(true);
    emitir('chegada', { visita: v });
    return v;
  }
  // Saída: usa o último fix dentro do raio (+ até 30 s) para não somar o tempo
  // que o GPS levou para "sair" do anel largo.
  function tsSaida(v, tsConfirma) {
    if (!v.ultimoDentro || v.ultimoDentro > tsConfirma) return tsConfirma;
    return v.ultimoDentro + Math.min(30 * 1000, (tsConfirma - v.ultimoDentro) / 2);
  }
  function fecharVisita(v, ts, opts) {
    if (!v || v.saida != null) return;
    opts = opts || {};
    v.saida = Math.max(v.chegada, ts);
    v.estSaida = !!opts.estimada;
    if (opts.estimada && opts.saidaMax != null) v.saidaMax = Math.max(v.saida, opts.saidaMax); else delete v.saidaMax;
    v.atualizadoEm = Date.now();
    if (!v.afirmada && !v.estChegada && !v.estSaida && v.saida - v.chegada < MIN_VISITA_MS) {
      visitas = visitas.filter(x => x !== v); // passagem rápida, não é visita
      salvarVisitas(); salvarState(true); emitir('descartada', { visita: v });
      return;
    }
    salvarVisitas(); salvarState(true);
    emitir('saida', { visita: v });
  }
  function consumirGap() { const g = state.gapPendente; state.gapPendente = null; return g; }
  // Todo callback do GPS (fix bom, ruim ou ERRO) passa por aqui ANTES de marcar
  // "vivo": é o único jeito de perceber que o JS ficou parado (app fechado).
  // Ao voltar do background o primeiro callback costuma ser um erro (GPS frio),
  // então detectar o gap só em fixes bons perderia quase todos os gaps.
  function marcarCallback(tsFix) {
    const agora = Date.now(), ate = tsFix || agora;
    const desde = Math.max(state.ultimoCallbackTs || 0, state.hiddenDesde || 0);
    if (desde && agora - desde > GAP_MS) {
      state.gapPendente = state.gapPendente ? { de: Math.min(state.gapPendente.de, desde), ate } : { de: desde, ate };
      dentroSeq = null; foraSeq = null; trocaSeq = null;
    } else if (state.gapPendente && ate - state.gapPendente.ate > GAP_EXPIRE_MS) {
      state.gapPendente = null; // já houve tempo de vida ao vivo suficiente: o que vier agora é ao vivo
    }
    state.ultimoCallbackTs = agora; state.hiddenDesde = 0;
  }

  // ---- motor ----
  function processarFix(pos) {
    const c = pos && pos.coords; if (!c) return;
    const fix = { lat: c.latitude, lng: c.longitude, acc: Number.isFinite(c.accuracy) ? c.accuracy : 999, ts: Number(pos.timestamp) || Date.now(), speed: Number.isFinite(c.speed) && c.speed >= 0 ? c.speed : null };
    if (!Number.isFinite(fix.lat) || !Number.isFinite(fix.lng)) return;
    if (fix.ts <= (state.ultimoRecebidoTs || 0)) return; // mesmo fix entregue duas vezes (watch + getCurrentPosition)
    const agora = Date.now();
    marcarCallback(fix.ts);
    state.ultimoRecebidoTs = fix.ts;
    ultimoErro = ''; state.permissao = 'ok'; errosSeguidos = [];
    // "Localização Precisa" desligada no iOS: tudo chega com 3–9 km de erro e
    // nada seria evidência de nada — avisa em vez de falhar em silêncio.
    if (fix.acc > 1000) { fixesGrosseiros += 1; if (fixesGrosseiros >= 2 && !state.precisaoBaixa) { state.precisaoBaixa = true; salvarState(true); emitir('status'); } }
    else if (fixesGrosseiros || state.precisaoBaixa) { fixesGrosseiros = 0; if (state.precisaoBaixa) { state.precisaoBaixa = false; salvarState(true); emitir('status'); } }
    const movendo = fix.speed != null && fix.speed > SPEED_MOVING;
    const parado = fix.speed == null || fix.speed <= SPEED_STILL;
    const aberta = visitaAberta();
    const L = aberta ? lugarPorId(aberta.lugarId) : null;

    // fix ruim: não é evidência; se o erro cobre o lugar atual, é "ainda aqui"
    if (fix.acc > ACC_MAX) {
      if (aberta && L && distLugar(L, fix) <= fix.acc + L.raio) { aberta.ultimaConf = fix.ts; salvarVisitasSuave(); }
      state.ultimoFixRuim = fix; salvarState(); emitir('fix-ruim', { fix }); return;
    }
    state.ultimoFix = fix; state.ultimoBom = fix.ts;

    if (aberta && L) {
      const dL = distLugar(L, fix);
      recentrar(L, fix, dL, aberta);
      const dentroRaio = dL <= L.raio;
      const dentroAnel = dL <= anelSaida(L, fix) || (L.pendenteAte && agora < L.pendenteAte);
      if (dentroRaio) { aberta.ultimoDentro = fix.ts; aberta.ultimaConf = fix.ts; salvarVisitasSuave(); }
      if (dentroAnel) {
        foraSeq = null;
        // voltou de um gap e continua aqui: registra o buraco na visita
        if (state.gapPendente && fix.ts - state.gapPendente.ate >= GAP_CONFIRM_MS) {
          const g = consumirGap(); aberta.gaps = (aberta.gaps || []).concat([{ de: g.de, ate: g.ate }]).slice(-MAX_GAPS); aberta.atualizadoEm = Date.now(); salvarVisitas();
        }
        // lugar vizinho claramente mais perto por 2 min com fixes precisos: troca
        const P = !movendo && fix.acc <= ACC_STRONG ? candidato(fix, L.id) : null;
        if (P && P.dist + SWITCH_MARGIN < dL) {
          if (!trocaSeq || trocaSeq.id !== P.lugar.id) trocaSeq = { id: P.lugar.id, firstTs: fix.ts, count: 0 };
          trocaSeq.count += 1;
          if (trocaSeq.count >= SWITCH_FIXES && fix.ts - trocaSeq.firstTs >= SWITCH_MIN_MS) {
            const t0 = trocaSeq.firstTs; trocaSeq = null;
            fecharVisita(aberta, tsSaida(aberta, t0));
            abrirVisita(P.lugar, t0);
          }
        } else trocaSeq = null;
        salvarState(); emitir('fix', { fix }); return;
      }
      trocaSeq = null;
      if (movendo && dL <= anelSaida(L, fix) + 100) { salvarState(); emitir('fix', { fix }); return; } // passando pela borda em movimento: ambíguo
      if (fix.acc > ACC_EXIT_MAX) { salvarState(); emitir('fix', { fix }); return; } // impreciso demais para provar saída
      if (aberta.afirmada && fix.ts - (aberta.afirmadaEm || aberta.chegada) < AFFIRM_GRACE_MS) { salvarState(); emitir('fix', { fix }); return; }
      if (!foraSeq) foraSeq = { firstTs: fix.ts, count: 0, forte: true, farCount: 0, farFirstTs: 0 };
      foraSeq.count += 1;
      if (!(fix.acc <= ACC_STRONG && dL - fix.acc > L.raio + EXIT_BUFFER)) foraSeq.forte = false;
      const longe = fix.acc <= ACC_FAR && dL - fix.acc > Math.max(3 * L.raio, L.raio + 300);
      if (longe) { if (!foraSeq.farFirstTs) foraSeq.farFirstTs = fix.ts; foraSeq.farCount += 1; } else { foraSeq.farCount = 0; foraSeq.farFirstTs = 0; }
      const span = fix.ts - foraSeq.firstTs;
      let confirma = false;
      if (aberta.afirmada) confirma = foraSeq.forte && foraSeq.count >= EXIT_FIXES && span >= AFFIRM_EXIT_MS;
      else confirma = (foraSeq.count >= EXIT_FIXES && span >= EXIT_MIN_MS) || (foraSeq.farCount >= FAR_FIXES && fix.ts - foraSeq.farFirstTs >= FAR_MIN_GAP_MS);
      if (confirma) {
        const t0 = foraSeq.firstTs; foraSeq = null;
        const g = state.gapPendente ? consumirGap() : null;
        if (g) { fecharVisita(aberta, g.de, { estimada: true, saidaMax: g.ate }); gapParaEntrada = g; }
        else fecharVisita(aberta, tsSaida(aberta, t0));
        avaliarEntrada(fix, movendo, parado, g);
      }
      salvarState(); emitir('fix', { fix }); return;
    }
    avaliarEntrada(fix, movendo, parado, null);
    salvarState(); emitir('fix', { fix });
  }
  function avaliarEntrada(fix, movendo, parado, gapJaConsumido) {
    const cand = movendo ? null : candidato(fix, null);
    if (cand) {
      if (!dentroSeq || dentroSeq.id !== cand.lugar.id) dentroSeq = { id: cand.lugar.id, firstTs: fix.ts, lastTs: fix.ts, count: 0, misses: 0 };
      dentroSeq.count += 1; dentroSeq.lastTs = fix.ts;
      if (dentroSeq.count >= ENTER_MIN_FIXES && fix.ts - dentroSeq.firstTs >= ENTER_MIN_MS && parado) {
        const t0 = dentroSeq.firstTs; dentroSeq = null;
        if (gapParaEntrada && fix.ts - gapParaEntrada.ate > GAP_EXPIRE_MS) gapParaEntrada = null;
        const g = gapJaConsumido || (state.gapPendente ? consumirGap() : null) || gapParaEntrada;
        gapParaEntrada = null;
        const v = g ? abrirVisita(cand.lugar, g.ate, { estimada: true, chegadaMin: g.de }) : abrirVisita(cand.lugar, t0);
        if (cand.dist <= cand.lugar.raio) v.ultimoDentro = fix.ts;
      }
    } else if (dentroSeq) {
      const P = lugarPorId(dentroSeq.id);
      // tolera um fix perdido, desde que ainda dentro do anel de saída do lugar
      if (!movendo && P && distLugar(P, fix) <= anelSaida(P, fix) && dentroSeq.misses < 1) dentroSeq.misses += 1;
      else dentroSeq = null;
    }
  }
  // O usuário afirmou estar aqui: nos 10 min seguintes, um fix parado e mais
  // preciso que o usado para criar o lugar corrige o centro (o GPS indoor do
  // primeiro fix costuma ser o pior da sessão).
  function recentrar(L, fix, dL, aberta) {
    if (!L.pendenteAte) return;
    if (Date.now() > L.pendenteAte) { delete L.pendenteAte; salvarLugares(); return; }
    if (fix.acc <= ACC_FAR && fix.acc + 5 < (L.acc || 999) && (fix.speed == null || fix.speed <= 1)) {
      L.lat = fix.lat; L.lng = fix.lng; L.acc = fix.acc; L.atualizadoEm = Date.now();
      if (fix.acc <= ACC_STRONG) delete L.pendenteAte;
      salvarLugares(); emitir('lugares', { recentrado: L.nome });
      if (aberta) { aberta.ultimoDentro = fix.ts; aberta.ultimaConf = fix.ts; }
    }
  }
  function onErro(e) {
    const code = e && e.code;
    marcarCallback(0);
    if (code === 1) { // PERMISSION_DENIED
      state.permissao = 'negada'; state.ativo = false; pararWatch(); salvarState(true);
      ultimoErro = 'permissão negada';
      emitir('erro', { erro: ultimoErro });
      return;
    }
    if (code === 3) { salvarState(); return; } // TIMEOUT do watch: só "nenhum fix novo em 25 s", o watch continua vivo
    ultimoErro = code === 2 ? 'sem sinal de GPS' : String((e && e.message) || 'erro de localização');
    if (code === 2 && state.ativo) {
      // No iOS, depois de um kCLErrorDomain 0 o watcher às vezes para de entregar:
      // 3 falhas em 2 min → re-arma o watch (sem toast, sem desligar).
      const t = Date.now(); errosSeguidos = errosSeguidos.filter(x => t - x < 2 * MIN).concat([t]);
      if (errosSeguidos.length >= 3) { errosSeguidos = []; rearmar(); }
    }
    salvarState();
    emitir('erro', { erro: ultimoErro });
  }
  function armarWatch() {
    if (!('geolocation' in navigator)) return false;
    pararWatch();
    try { watchId = navigator.geolocation.watchPosition(processarFix, onErro, WATCH_OPTS); } catch (_) { watchId = null; return false; }
    clearInterval(keepAlive);
    // Se o watch morrer em silêncio (acontece ao voltar do background no iOS),
    // pede um fix avulso e re-arma. Também mantém ultimoCallbackTs vivo.
    keepAlive = setInterval(() => {
      if (!state.ativo || document.hidden) return;
      const idade = Date.now() - (state.ultimoCallbackTs || 0);
      if (idade > 90 * 1000) { fixAvulso(); rearmar(); }
    }, 60 * 1000);
    return true;
  }
  function rearmar() { // sempre limpa o watch anterior: dois watches entregam o mesmo fix duas vezes
    try { if (watchId != null) navigator.geolocation.clearWatch(watchId); } catch (_) {}
    try { watchId = navigator.geolocation.watchPosition(processarFix, onErro, WATCH_OPTS); } catch (_) { watchId = null; }
  }
  function pararWatch() {
    try { if (watchId != null) navigator.geolocation.clearWatch(watchId); } catch (_) {}
    watchId = null; clearInterval(keepAlive); keepAlive = 0;
  }
  function fixAvulso(timeoutMs) {
    return new Promise(res => {
      if (!('geolocation' in navigator)) return res(null);
      const opts = timeoutMs ? Object.assign({}, ONCE_OPTS, { timeout: timeoutMs }) : ONCE_OPTS;
      try {
        navigator.geolocation.getCurrentPosition(p => { processarFix(p); res(state.ultimoFix); }, e => { onErro(e); res(null); }, opts);
      } catch (_) { res(null); }
    });
  }

  function ativar() {
    if (!('geolocation' in navigator)) { state.permissao = 'indisponivel'; salvarState(true); return Promise.resolve({ ok: false, msg: 'Este aparelho não oferece geolocalização ao navegador.' }); }
    state.ativo = true; salvarState(true); emitir('status');
    return new Promise(res => {
      navigator.geolocation.getCurrentPosition(p => {
        processarFix(p); armarWatch(); emitir('status');
        res({ ok: true, msg: 'Localização ligada.' });
      }, e => {
        onErro(e);
        if (e && e.code === 1) return res({ ok: false, msg: 'Permissão de localização negada. Libere em Ajustes › Privacidade › Serviços de Localização › Safari (ou o app da Agenda) e tente de novo.' });
        armarWatch(); emitir('status');
        res({ ok: true, msg: 'Localização ligada, mas ainda sem sinal de GPS — vou continuar tentando.' });
      }, ONCE_OPTS);
    });
  }
  function desativar() {
    pararWatch(); state.ativo = false; dentroSeq = null; foraSeq = null; trocaSeq = null; salvarState(true); emitir('status');
    return { ok: true, msg: 'Localização desligada.' };
  }

  // "Estou em X" (opcionalmente "cheguei às HH:MM"): ensina/atualiza o lugar e
  // registra a visita afirmada. O usuário é a verdade; o GPS só refina depois.
  async function salvarLugar(nomeBruto, opts) {
    opts = opts || {};
    const nome = titulo(nomeBruto);
    if (!nome) return { ok: false, msg: 'Preciso de um nome para o lugar, Senhor.' };
    let fix = state.ultimoFix && (Date.now() - state.ultimoFix.ts) < FIX_FRESCO_MS ? state.ultimoFix : null;
    if (!fix) fix = await fixAvulso(10000); // o Jarvis fica "LOCALIZANDO…" enquanto isso: prazo curto
    let fixVelho = false;
    if (!fix && state.ultimoFix && (Date.now() - state.ultimoFix.ts) < FIX_RECENTE_MS) { fix = state.ultimoFix; fixVelho = true; }
    if (!fix && state.ultimoFixRuim && (Date.now() - state.ultimoFixRuim.ts) < FIX_RECENTE_MS && state.ultimoFixRuim.acc <= 1000) { fix = state.ultimoFixRuim; fixVelho = Date.now() - fix.ts > FIX_FRESCO_MS; } // melhor um centro provisório que nenhum
    if (!fix && state.precisaoBaixa) return { ok: false, msg: 'A "Localização Precisa" está desligada para o Safari/Agenda — o GPS só me dá a posição com quilômetros de erro. Ligue em Ajustes › Privacidade e Segurança › Serviços de Localização › Safari (ou Agenda) › Localização Precisa, e repita.' };
    if (!fix) return { ok: false, msg: state.permissao === 'negada' ? 'Sem permissão de localização — libere nos Ajustes e repita.' : 'Não consegui obter sua posição agora (' + (ultimoErro || 'sem GPS') + '). Tente de novo em alguns segundos.' };
    const agora = Date.now();
    let chegada = agora;
    if (/^\d{2}:\d{2}$/.test(String(opts.horario || ''))) {
      const [h, m] = opts.horario.split(':').map(Number);
      const d = new Date(); d.setHours(h, m, 0, 0);
      if (d.getTime() <= agora + 5 * MIN && agora - d.getTime() < 20 * 3600000) chegada = Math.min(d.getTime(), agora);
      // nunca antes do fim da última visita fechada: visitas não podem se sobrepor
      const dv = dev();
      const ultimaFechada = visitas.filter(v => v.saida != null && (v.dev || dv) === dv).sort((a, b) => b.saida - a.saida)[0];
      if (ultimaFechada && chegada < ultimaFechada.saida) chegada = ultimaFechada.saida;
    }
    let lugar = lugarPorNome(nome), novo = false, movido = false;
    if (lugar) {
      const d = distLugar(lugar, fix);
      if (fix.acc <= ACC_STRONG && d - fix.acc > 2 * lugar.raio) { lugar.lat = fix.lat; lugar.lng = fix.lng; lugar.acc = fix.acc; movido = true; }
      else if (d > lugar.raio) lugar.pendenteAte = agora + RECENTER_WINDOW_MS; // o usuário diz que está aqui: deixa o GPS bom corrigir
      lugar.atualizadoEm = agora;
    } else {
      lugar = { id: novoId(), nome, lat: fix.lat, lng: fix.lng, raio: RAIO_PADRAO, acc: Math.round(fix.acc), criadoEm: agora, atualizadoEm: agora };
      if (fix.acc > ACC_STRONG) lugar.pendenteAte = agora + RECENTER_WINDOW_MS;
      lugares.push(lugar); novo = true;
    }
    salvarLugares();
    const aberta = visitaAberta();
    let v;
    if (aberta && aberta.lugarId === lugar.id) {
      v = aberta; v.afirmada = true; v.afirmadaEm = agora;
      if (chegada < v.chegada) { v.chegada = chegada; v.estChegada = false; delete v.chegadaMin; }
      v.atualizadoEm = agora; salvarVisitas();
    } else {
      if (aberta) fecharVisita(aberta, tsSaida(aberta, chegada));
      v = abrirVisita(lugar, chegada, { afirmada: true });
    }
    state.gapPendente = null; dentroSeq = null; foraSeq = null; trocaSeq = null; salvarState(true);
    if (!state.ativo) ativar().catch(() => {});
    emitir('lugares');
    const viz = sobrepostos(lugar);
    let msg = (novo ? `Lugar "${lugar.nome}" salvo` : movido ? `Lugar "${lugar.nome}" atualizado para a posição atual` : `Você está em "${lugar.nome}"`) +
      ` (raio ${lugar.raio} m, GPS ±${Math.round(fix.acc)} m${fixVelho ? ` — posição de ${duracao(agora - fix.ts)} atrás, o GPS não respondeu agora` : ''}${fix.acc > ACC_STRONG ? ', vou refinar o centro quando o sinal melhorar' : ''}). Chegada registrada às ${hhmm(chegada)}.`;
    if (viz.length) msg += ` Atenção: fica perto de ${viz.map(o => o.nome).join(', ')} — entre lugares vizinhos só troco com sinal bem claro ou quando você me disser.`;
    return { ok: true, lugar, novo, movido, msg };
  }
  function removerLugar(nomeBruto) {
    const lugar = lugarPorNome(nomeBruto);
    if (!lugar) return { ok: false, msg: `Não conheço um lugar chamado "${titulo(nomeBruto)}".` };
    lugares = lugares.filter(l => l.id !== lugar.id);
    removidos.push({ id: lugar.id, nome: lugar.nome, em: Date.now() });
    if (removidos.length > 50) removidos = removidos.slice(-50);
    const aberta = visitaAberta();
    if (aberta && aberta.lugarId === lugar.id) fecharVisita(aberta, Date.now());
    salvarLugares(); salvarState(true); emitir('lugares');
    return { ok: true, msg: `Lugar "${lugar.nome}" esquecido. As visitas antigas continuam no histórico.` };
  }

  // ---- consultas ----
  function onde() {
    const v = visitaAberta();
    if (v) return { lugar: v.nome, desde: v.chegada, desdeMin: v.chegadaMin, estimado: !!v.estChegada, minutos: Math.round((Date.now() - v.chegada) / 60000), afirmada: !!v.afirmada, gaps: v.gaps || [] };
    return null;
  }
  function visitasDoDia(iso) {
    const ini = new Date(iso + 'T00:00:00').getTime(), fim = ini + 86400000;
    return visitas.filter(v => v.chegada < fim && (v.saida == null || v.saida >= ini)).sort((a, b) => a.chegada - b.chegada);
  }
  // Interseção de [chegada, saida ?? agora] com a janela do dia; visita com gaps
  // conta inteira (o mais provável é que ficou) — o Jarvis avisa o intervalo.
  function totaisDoDia(iso) {
    const ini = new Date(iso + 'T00:00:00').getTime(), fim = Math.min(ini + 86400000, Date.now());
    const tot = {};
    for (const v of visitasDoDia(iso)) {
      const a = Math.max(v.chegada, ini), b = Math.min(v.saida == null ? Date.now() : v.saida, fim);
      if (b > a) tot[v.nome] = (tot[v.nome] || 0) + (b - a);
    }
    return tot;
  }
  function fmtChegada(v) { return v.estChegada && v.chegadaMin != null && v.chegada - v.chegadaMin > 5 * MIN ? `≈${hhmm(v.chegadaMin)}–${hhmm(v.chegada)}` : (v.estChegada ? '≈' : '') + hhmm(v.chegada); }
  function fmtSaida(v) { if (v.saida == null) return 'agora'; return v.estSaida && v.saidaMax != null && v.saidaMax - v.saida > 5 * MIN ? `≈${hhmm(v.saida)}–${hhmm(v.saidaMax)}` : (v.estSaida ? '≈' : '') + hhmm(v.saida); }
  function fmtDuracao(v) {
    const fim = v.saida == null ? Date.now() : v.saida;
    const incerto = (v.estChegada && v.chegadaMin != null) || (v.estSaida && v.saidaMax != null);
    return (incerto ? '≥' : '') + duracao(fim - v.chegada);
  }
  function linhaVisita(v) {
    let s = `${v.nome}: ${fmtChegada(v)}→${fmtSaida(v)} (${fmtDuracao(v)}${v.afirmada ? ', confirmada pelo usuario' : ''})`;
    if (v.gaps && v.gaps.length) s += ` [sem monitorar ${v.gaps.map(g => hhmm(g.de) + '–' + hhmm(g.ate)).join(', ')}]`;
    return s;
  }
  function statusTexto() {
    if (state.permissao === 'indisponivel') return 'INDISPONIVEL neste aparelho';
    if (state.permissao === 'negada') return 'PERMISSAO NEGADA (o usuario precisa liberar nos Ajustes do iPhone)';
    if (!state.ativo) return 'DESLIGADO (o usuario pode ligar tocando na barra de localizacao do Jarvis ou pedindo "ligar localizacao")';
    if (state.precisaoBaixa) return 'LIGADO, mas a "Localizacao Precisa" do iPhone esta desligada (erro de quilometros): o usuario precisa ligar em Ajustes › Privacidade e Seguranca › Servicos de Localizacao › Safari (ou Agenda) › Localizacao Precisa';
    const f = state.ultimoFix;
    if (!f) return 'LIGADO, aguardando o primeiro sinal de GPS' + (ultimoErro ? ` (${ultimoErro})` : '');
    return `LIGADO, ultimo fix ${hhmm(f.ts)} (±${Math.round(f.acc)} m)`;
  }
  function agoraTexto() {
    const o = onde();
    if (o) {
      const v = visitaAberta();
      let s = `em ${o.lugar} desde ${fmtChegada(v)} (ha ${duracao(Date.now() - o.desde)}${o.afirmada ? ', confirmado pelo usuario' : ''})`;
      if (!state.ativo) s += ' — rastreio DESLIGADO desde entao: nao confirmado';
      else if (state.ultimoFix && Date.now() - state.ultimoFix.ts > FIX_RECENTE_MS) s += ` — ultimo fix bom as ${hhmm(state.ultimoFix.ts)}`;
      if (o.gaps.length) s += ` [sem monitorar ${o.gaps.map(g => hhmm(g.de) + '–' + hhmm(g.ate)).join(', ')}]`;
      return s;
    }
    if (!state.ultimoFix) return 'posicao ainda desconhecida';
    const fechadas = visitas.filter(v => v.saida != null).sort((a, b) => b.saida - a.saida);
    const ult = fechadas[0];
    let perto = '';
    if (lugares.length) {
      let m = null, dm = Infinity;
      for (const l of lugares) { const d = distLugar(l, state.ultimoFix); if (d < dm) { dm = d; m = l; } }
      if (m) perto = `; lugar conhecido mais proximo: ${m.nome} a ${dm < 1000 ? Math.round(dm) + ' m' : (dm / 1000).toFixed(1) + ' km'}`;
    }
    return 'fora dos lugares conhecidos' + (ult && hojeIso() === isoDia(new Date(ult.saida)) ? ` desde ${fmtSaida(ult)} (saiu de ${ult.nome})` : '') + perto;
  }
  function resumoJarvis() {
    try {
      const hoje = hojeIso(), ontem = ontemIso();
      const vh = visitasDoDia(hoje), th = totaisDoDia(hoje), to = totaisDoDia(ontem);
      const fmtTot = t => Object.keys(t).length ? Object.entries(t).map(([n, ms]) => `${n} ${duracao(ms)}`).join('; ') : 'nada registrado';
      return [
        'LOCALIZACAO (GPS do aparelho; so rastreia com o app aberto. Legenda: ≈ = estimado; "≈14:00–19:05" = aconteceu em algum momento desse intervalo (app fechado); "≥" = duracao minima; "sem monitorar" = app fechado nesse periodo, presumido no mesmo lugar):',
        `STATUS: ${statusTexto()}`,
        `AGORA: ${agoraTexto()}`,
        `LUGARES CONHECIDOS: ${lugares.length ? lugares.map(l => `${l.nome} (raio ${l.raio} m)`).join(', ') : 'nenhum — o usuario ensina dizendo "estou em Casa"'}`,
        `VISITAS HOJE (${hoje}): ${vh.length ? vh.map(linhaVisita).join(' | ') : 'nenhuma'}`,
        `TEMPO POR LUGAR HOJE: ${fmtTot(th)}`,
        `TEMPO POR LUGAR ONTEM: ${fmtTot(to)}`
      ].join('\n');
    } catch (_) { return 'LOCALIZACAO: (indisponivel)'; }
  }
  function resumoCurto() {
    if (state.permissao === 'negada') return 'Localização bloqueada — libere nos Ajustes e toque aqui';
    if (!state.ativo) { const o = onde(); return (o ? `${o.lugar} · rastreio desligado` : 'Localização desligada') + ' — toque para ligar'; }
    if (state.precisaoBaixa) return 'Ligue a "Localização Precisa" nos Ajustes';
    const o = onde();
    if (o) return `${o.lugar} · há ${duracao(Date.now() - o.desde)}${o.estimado ? ' (≈)' : ''}`;
    if (!state.ultimoFix) return ultimoErro ? `Sem GPS (${ultimoErro})` : 'Procurando sinal de GPS…';
    return lugares.length ? 'Fora dos lugares conhecidos' : 'Diga ao Jarvis: "estou em Casa"';
  }

  // ---- sincronização entre aparelhos: união por id, vence o mais recente ----
  function unir(locais, remotos, tumbas) {
    const m = new Map();
    for (const x of remotos) if (x && x.id) m.set(x.id, x);
    for (const x of locais) { if (!x || !x.id) continue; const r = m.get(x.id); if (!r || (x.atualizadoEm || 0) > (r.atualizadoEm || 0)) m.set(x.id, x); }
    let out = [...m.values()];
    if (tumbas && tumbas.length) {
      const t = new Map(tumbas.map(r => [r.id, r.em || 0]));
      out = out.filter(x => !(t.has(x.id) && t.get(x.id) >= (x.atualizadoEm || 0)));
    }
    return out;
  }
  function unirTumbas(a, b) {
    const m = new Map();
    for (const r of [...(a || []), ...(b || [])]) { if (!r || !r.id) continue; const c = m.get(r.id); if (!c || (r.em || 0) > (c.em || 0)) m.set(r.id, r); }
    return [...m.values()].slice(-50);
  }
  function mesclarDoStorage() {
    const L = lerWrap(LK), V = lerWrap(VK);
    const tumbas = unirTumbas(removidos, L.removidos);
    const novosL = unir(lugares, L.itens, tumbas).sort((a, b) => (a.criadoEm || 0) - (b.criadoEm || 0));
    const novasV = unir(visitas, V.itens, null).sort((a, b) => a.chegada - b.chegada);
    // Um mesmo aparelho nunca tem duas visitas abertas: fica a mais recente; as
    // outras fecham na chegada dela. Aparelhos diferentes (agenda compartilhada)
    // podem ter cada um a sua.
    const porDev = new Map();
    for (const v of novasV) if (v.saida == null) { const k = v.dev || ''; (porDev.get(k) || porDev.set(k, []).get(k)).push(v); }
    for (const abertas of porDev.values()) {
      if (abertas.length < 2) continue;
      const ult = abertas[abertas.length - 1];
      for (const v of abertas) if (v !== ult) { v.saida = Math.max(v.chegada, ult.chegada); v.estSaida = true; v.atualizadoEm = Date.now(); }
    }
    const mudouL = JSON.stringify(novosL) !== JSON.stringify(L.itens) || JSON.stringify(tumbas) !== JSON.stringify(L.removidos);
    const mudouV = JSON.stringify(novasV) !== JSON.stringify(V.itens);
    lugares = novosL; removidos = tumbas; visitas = novasV;
    if (mudouL) salvarLugares();
    if (mudouV) salvarVisitas();
    emitir('sync');
  }
  window.addEventListener('agenda:remote-sync', e => {
    const k = e && e.detail && e.detail.documentKey;
    if (k && k !== 'all' && k !== 'settings' && k !== 'lugares' && k !== 'visitas') return;
    try { mesclarDoStorage(); } catch (_) {}
  });

  // ---- UI: barra de localização logo abaixo do cabeçalho do Jarvis. A barra
  // inteira é o botão liga/desliga (um 4º ícone no header não cabe em iPhone
  // de 375 px sem quebrar o título). ----
  const PIN = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.4"/></svg>';
  let bar = null, barTxt = null, barDot = null;
  function montarUI() {
    const msgs = document.getElementById('jarvis-msgs');
    if (!msgs || document.getElementById('jarvis-locbar')) return !!document.getElementById('jarvis-locbar');
    bar = document.createElement('button');
    bar.id = 'jarvis-locbar'; bar.type = 'button';
    bar.setAttribute('aria-label', 'Ligar ou desligar a localização');
    bar.style.cssText = 'display:flex;align-items:center;gap:7px;width:100%;padding:7px 16px;border:0;border-bottom:1px solid rgba(255,255,255,.05);background:rgba(117,203,255,.06);font:inherit;font-size:11px;font-weight:700;letter-spacing:.02em;text-align:left;cursor:pointer;flex:0 0 auto;';
    bar.innerHTML = '<span style="display:inline-flex;opacity:.9">' + PIN + '</span><span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"></span><span style="width:8px;height:8px;border-radius:50%;flex:0 0 auto"></span>';
    barTxt = bar.children[1]; barDot = bar.children[2];
    msgs.parentNode.insertBefore(bar, msgs);
    bar.addEventListener('click', async () => {
      if (state.ativo) { desativar(); toast('Localização desligada.'); return; }
      const r = await ativar();
      toast(r.msg);
    });
    atualizarUI();
    return true;
  }
  let uiAssinatura = '';
  function atualizarUI() {
    if (!bar) return;
    const alerta = state.permissao === 'negada' || !!state.precisaoBaixa;
    const txt = resumoCurto();
    const cor = alerta ? '#ff9c9c' : state.ativo ? '#9fd8ff' : '#8b93a3';
    const dot = alerta ? '#ff6b6b' : state.ativo ? (state.ultimoFix ? '#71d6be' : '#f2c14e') : 'rgba(255,255,255,.18)';
    const assinatura = txt + '|' + cor + '|' + dot + '|' + (state.ativo ? 1 : 0);
    if (assinatura === uiAssinatura) return; // sem mudança: não mexe no DOM (cada fix chega a ~1 Hz em movimento)
    uiAssinatura = assinatura;
    barTxt.textContent = txt;
    bar.title = state.ativo ? 'Localização ligada — toque para desligar' : 'Toque para ligar a localização';
    bar.style.color = cor;
    barDot.style.background = dot;
  }
  function toast(msg) {
    try {
      let el = document.getElementById('toast') || document.querySelector('.toast');
      if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
      el.textContent = msg; el.classList.add('show');
      clearTimeout(el.__tLoc); el.__tLoc = setTimeout(() => el.classList.remove('show'), 3200);
    } catch (_) {}
  }
  window.addEventListener('agenda:local-change', atualizarUI);
  setInterval(() => { if (state.ativo && !document.hidden) atualizarUI(); }, 60 * 1000);

  // ---- ciclo de vida ----
  function aoEsconder() { state.hiddenDesde = Date.now(); salvarState(true); }
  function aoVoltar() {
    if (!state.ativo) return;
    fixAvulso(); // fix imediato ao voltar para o app…
    rearmar();   // …e watch novo, porque o iOS costuma matar o antigo
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) aoEsconder(); else aoVoltar(); });
  window.addEventListener('pagehide', aoEsconder);
  window.addEventListener('pageshow', e => { if (e && e.persisted) aoVoltar(); });

  function boot() {
    // Troca de conta no mesmo aparelho: zera o estado do motor (o rastreio não
    // pode seguir ligado para a conta nova sem o usuário pedir).
    const owner = ownerAtual();
    if (state.owner == null || state.owner !== owner) {
      if (state.owner != null) state = { ativo: false, permissao: '', ultimoFix: null, ultimoBom: 0, ultimoCallbackTs: 0, ultimoRecebidoTs: 0, hiddenDesde: 0, gapPendente: null, dev: state.dev || '' };
      state.owner = owner; salvarState(true);
    }
    carregar(); dev();
    if (!montarUI()) {
      let n = 0; const t = setInterval(() => { n += 1; if (montarUI() || n > 40) clearInterval(t); }, 250);
    }
    if (state.ativo) {
      if (!('geolocation' in navigator)) { state.ativo = false; state.permissao = 'indisponivel'; salvarState(true); }
      // Só religa sozinho se um fix REAL já confirmou a permissão: sem isso, cada
      // recarga (clique em notificação, atualizar, login) mostraria o prompt do iOS.
      else if (state.permissao === 'ok') { armarWatch(); fixAvulso(); }
      else { state.ativo = false; salvarState(true); }
    }
    emitir('boot');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();

  window.AgendaLocal = {
    ativar, desativar, ativo: () => !!state.ativo, permissao: () => state.permissao || '',
    salvarLugar, removerLugar,
    lugares: () => lugares.map(l => ({ ...l })),
    visitas: dias => { const lim = Date.now() - (Number(dias) || 7) * 86400000; return visitas.filter(v => v.chegada >= lim || v.saida == null).map(v => ({ ...v })); },
    visitasHoje: () => visitasDoDia(hojeIso()).map(v => ({ ...v })),
    totaisHoje: () => totaisDoDia(hojeIso()),
    onde, ultimoFix: () => (state.ultimoFix ? { ...state.ultimoFix } : null),
    resumoJarvis, resumoCurto, duracao,
    _processarFix: processarFix, _onErro: onErro, _state: () => state // expostos para testes
  };
})();
