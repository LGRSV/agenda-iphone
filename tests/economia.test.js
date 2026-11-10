/* Modo econômico da localização (localizacao.js) junto com as rotas (rotas.js).
   Ambiente falso (window/document/localStorage/navigator, relógio congelado), coordenadas FALSAS.
   Roda: node tests/economia.test.js */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
let passo = 0; const ok = m => console.log(`${++passo} ok: ${m}`);

const store = new Map();
global.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k), key: () => null, length: 0 };
const RealDate = Date;
let now = RealDate.parse('2026-11-02T21:00:00Z'); // 18:00 em Araguaína
global.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(now); } static now() { return now; } };
const ls = {}, eventos = [];
global.window = {
  localStorage: global.localStorage,
  addEventListener: (t, fn) => { (ls[t] = ls[t] || []).push(fn); },
  dispatchEvent: ev => { if (ev.type === 'agenda:local-change') eventos.push(ev.detail); (ls[ev.type] || []).forEach(fn => fn(ev)); return true; },
  setTimeout: () => 0, clearTimeout: () => {},
};
global.CustomEvent = global.window.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } };
global.setTimeout = () => 0; global.clearTimeout = () => {}; global.setInterval = () => 0; global.clearInterval = () => {};
const classes = new Set(['app-nativo']); // app nativo: o watcher em segundo plano monitora com a tela apagada
global.window.document = global.document = {
  readyState: 'complete', hidden: false,
  addEventListener: () => {}, getElementById: () => null, querySelector: () => null,
  createElement: () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, addEventListener() {}, appendChild() {}, insertBefore() {} }),
  body: { appendChild() {} },
  documentElement: { classList: { contains: c => classes.has(c), add: c => classes.add(c), remove: c => classes.delete(c) } },
};
const geo = { watches: [], clears: 0, once: [] };
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { geolocation: {
  getCurrentPosition: (okf, errf, o) => { geo.once.push(o); errf({ code: 3 }); },
  watchPosition: (okf, errf, o) => { geo.watches.push(o); return geo.watches.length; },
  clearWatch: () => { geo.clears += 1; },
} } });
localStorage.setItem('agenda_supabase_config_v1', JSON.stringify({ workspaceOwnerId: 'dono', deviceId: 'abcdef12-aaaa' }));

const carregar = f => new Function('module', fs.readFileSync(path.join(__dirname, '..', f), 'utf-8'))(undefined);
carregar('localizacao.js');
carregar('rotas.js');
const L = window.AgendaLocal, R = window.AgendaRotas;
const CASA = { lat: -0.5, lng: 0.5 };
const mv = (p, dn, de) => ({ lat: p.lat + dn / 111320, lng: p.lng + de / 111320 });
const fix = (p, acc, dt, speed) => { now += dt; L._processarFix({ coords: { latitude: p.lat, longitude: p.lng, accuracy: acc, speed: speed == null ? null : speed }, timestamp: now }); };
const hhmm = ts => new RealDate(ts - 3 * 3600000).toISOString().slice(11, 16);

(async () => {
  await new Promise(r => setImmediate(r));
  await L.salvarLugar('Casa', { lat: CASA.lat, lng: CASA.lng, raio: 100 });
  // ligar sem prompt: o harness não tem permissão real; marca ativo e arma o watch de alta precisão
  await L.ativar(); assert(geo.watches.length === 1 && geo.watches[0].enableHighAccuracy);
  // chega em casa às 18:00 e fica parado
  for (let i = 0; i < 4; i++) fix(mv(CASA, 5, 5), 12, 30000, 0);
  assert(L.onde() && L.onde().lugar === 'Casa', 'chegada');
  assert.strictEqual(L.eco(), null, 'ainda não: menos de 5 min parado');
  // 1) 5 min parado dentro do raio com fixes bons: entra no econômico
  for (let i = 0; i < 6; i++) fix(mv(CASA, 3, -4), 10, 60000, 0);
  const e = L.eco();
  assert(e && e.lugar === 'Casa' && e.distancia === 150, JSON.stringify(e));
  assert(eventos.some(x => x.tipo === 'eco' && x.eco === true && x.distancia === 150));
  assert(geo.clears >= 1, 'o watch de alta precisão foi parado');
  assert(/econômica/.test(L.resumoCurto()), L.resumoCurto());
  ok('5 min parado em lugar salvo: econômico, watch de alta precisão parado, aviso para o nativo (distanceFilter 150 m), status "econômica"');

  // 2) silêncio de 3 h (app nativo: nenhum callback porque ele não andou 150 m): não vira lacuna nem fecha a visita
  now += 3 * 3600000;
  fix(mv(CASA, 20, 10), 65, 1000, null); // leitura dentro do anel, precisão de Wi-Fi
  assert(L.eco(), 'continua econômico com leitura dentro do anel');
  assert(!L._state().gapPendente, 'silêncio do econômico não é lacuna');
  fix(mv(CASA, 150, 0), 120, 60000, null); // imprecisa a 150 m: ainda dentro do anel (100+120+40)
  assert(L.eco() && L.onde(), 'leitura imprecisa não tira do lugar nem cria visita');
  ok('3 h sem leitura no econômico: sem lacuna; leitura imprecisa dentro do anel não fecha a visita');

  // 3) sai a pé: o aparelho acorda a ~180 m; volta para alta precisão e a saída segue a regra normal
  const watchesAntes = geo.watches.length;
  const tAcorda = now + 10 * 60000;
  fix(mv(CASA, 180, 0), 10, 10 * 60000, 1.3);
  assert.strictEqual(L.eco(), null, 'saiu do econômico');
  assert(geo.watches.length > watchesAntes && geo.watches[geo.watches.length - 1].enableHighAccuracy === true, 'watch de alta precisão de volta');
  assert(eventos.some(x => x.tipo === 'eco' && x.eco === false && x.ate));
  assert(L.onde(), 'um fix só não fecha a visita');
  fix(mv(CASA, 240, 0), 8, 25000, 1.4); fix(mv(CASA, 300, 0), 8, 25000, 1.4);
  assert.strictEqual(L.onde(), null, 'saída confirmada');
  const v = L.visitas(1).find(x => x.nome === 'Casa');
  const esperado = tAcorda - Math.round(180 / 1.3 * 1000); // ~2,3 min antes de acordar
  assert(v.saida >= esperado - 5000 && v.saida <= esperado + 35000, `saída ${hhmm(v.saida)} esperada ~${hhmm(esperado)}`);
  assert(!v.estSaida && !v.descartada, 'saída normal, não estimada por lacuna');
  ok(`saída: volta para alta precisão no 1º fix fora, confirma com a regra normal; horário ${hhmm(v.saida)} ≈ ${Math.round((tAcorda - v.saida) / 1000)} s antes de acordar (andou 180 m a pé), não o início do econômico`);

  // 4) rotas: a estadia vai até a saída estimada; sem linha reta cobrindo as 3 h paradas
  const d = R.dia();
  const casa = d.paradas.find(p => p.nome === 'Casa');
  assert(casa && casa.fim && casa.min >= 180, JSON.stringify(d.paradas));
  assert(!d.trechos.some(t => t.min > 15), 'nenhum trecho longo inventado: ' + JSON.stringify(d.trechos));
  ok(`rotas: Casa ${casa.ini}–${casa.fim} (${casa.min} min), trechos só da saída: ${d.trechos.map(t => t.ini + '–' + t.fim).join(', ') || 'nenhum ainda'}`);

  // 5) econômico desligado: não entra
  L.definirEconomia(false);
  for (let i = 0; i < 6; i++) fix(mv(CASA, 3, 3), 10, 60000, 0); // volta para casa e fica
  for (let i = 0; i < 8; i++) fix(mv(CASA, 3, 3), 10, 60000, 0);
  assert(L.onde() && L.eco() === null, 'desligado: sem econômico');
  L.definirEconomia(true);
  for (let i = 0; i < 6; i++) fix(mv(CASA, 3, 3), 10, 60000, 0);
  assert(L.eco(), 'religado: entra');
  // movimento rápido dentro do raio (saindo de carro): sai do econômico na hora
  fix(mv(CASA, 40, 0), 10, 5000, 8);
  assert.strictEqual(L.eco(), null, 'velocidade de carro tira do econômico');
  ok('preferência desligada não entra; religada entra; velocidade de carro dentro do raio já volta para alta precisão');

  // 6) sem app nativo (PWA): silêncio com a página escondida continua sendo lacuna
  classes.delete('app-nativo');
  for (let i = 0; i < 7; i++) fix(mv(CASA, 3, 3), 10, 60000, 0);
  assert(L.eco(), 'PWA também entra');
  L._state().hiddenDesde = now; now += 40 * 60000;
  fix(mv(CASA, 3, 3), 10, 1000, 0);
  assert(L._state().gapPendente, 'PWA escondido = não monitorou: lacuna');
  ok('PWA: entra no econômico; tempo com a página escondida continua marcado como sem monitorar');
  console.log(`\neconomia: ${passo} grupos de teste passaram`);
})().catch(e => { console.error(e); process.exit(1); });
