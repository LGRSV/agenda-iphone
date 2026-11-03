/* Harness Node: lugar salvo pelo mapa (coordenadas) + conclusão automática por presença.
   Usa o motor real (localizacao.js) para registrar a chegada e o auto-concluir.js
   com uma AgendaAPI falsa. Roda: node tests/auto-concluir.test.js (sem dependências) */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const store = new Map();
global.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const listeners = {};
global.window = {
  addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
  dispatchEvent: ev => { (listeners[ev.type] || []).forEach(fn => fn(ev)); return true; },
};
global.CustomEvent = class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } };
const toast = { textContent: '', style: {}, classList: { add() {}, remove() {} } };
global.document = {
  readyState: 'complete', hidden: false,
  addEventListener: () => {}, getElementById: id => (id === 'toast' ? toast : null), querySelector: () => null, querySelectorAll: () => [],
  createElement: () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, setAttribute() {}, addEventListener() {}, appendChild() {}, insertBefore() {} }),
  body: { appendChild() {} },
};
const RealDate = Date;
let now = new RealDate('2026-11-03T07:00:00').getTime();
global.Date = class extends RealDate {
  constructor(...a) { if (a.length) super(...a); else super(now); }
  static now() { return now; }
};
global.setInterval = () => 0; global.clearInterval = () => {}; global.setTimeout = () => 0; global.clearTimeout = () => {};
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { geolocation: { getCurrentPosition: (ok, err) => err({ code: 2 }), watchPosition: () => 1, clearWatch: () => {} } } });
const carregar = f => new Function(fs.readFileSync(path.join(__dirname, '..', f), 'utf-8'))();

// tarefas (hoje = 03/11) e AgendaAPI falsa com o mesmo efeito do completeAuto
const TK = 'agenda_lagares_v3', NK = 'agenda_notas_v1';
const ENERGISA = { lat: -10.2100, lng: -48.3300 };
const mv = (b, dn, de) => ({ lat: b.lat + dn / 111320, lng: b.lng + de / (111320 * Math.cos(b.lat * Math.PI / 180)) });
const perto = mv(ENERGISA, 40, 30); // local da tarefa a ~50 m do centro (dentro do raio)
localStorage.setItem(TK, JSON.stringify([
  { id: 'a', text: 'Reunião na Energisa', date: '2026-11-03', time: '10:00', done: false },
  { id: 'b', text: 'Entregar laudo', date: '2026-11-03', time: '', done: false },
  { id: 'c', text: 'Amanhã na Energisa', date: '2026-11-04', time: '09:00', done: false },
  { id: 'd', text: 'Sem auto', date: '2026-11-03', time: '', done: false },
  { id: 'e', text: 'Tarde na Energisa', date: '2026-11-03', time: '16:00', done: false },
  { id: 'rec-r1-2026-11-03', text: 'Ponto diário', date: '2026-11-03', time: '08:00', done: false },
  { id: 'rec-r1-2026-11-04', text: 'Ponto diário', date: '2026-11-04', time: '08:00', done: false },
  { id: 'f', text: 'Longe', date: '2026-11-03', time: '', done: false },
]));
const loc = (o, auto) => ({ nome: 'Energisa', lat: o.lat, lng: o.lng, ...(auto ? { autoConcluir: true } : {}) });
localStorage.setItem(NK, JSON.stringify({
  a: { local: loc(ENERGISA, true) },
  b: { local: loc(perto, true) },
  c: { local: loc(ENERGISA, true) },
  d: { local: loc(ENERGISA, false) },
  e: { local: loc(ENERGISA, true) },
  'rec-r1-2026-11-03': { local: loc(ENERGISA, true) },
  'rec-r1-2026-11-04': { local: loc(ENERGISA, true) },
  f: { local: { nome: 'Longe', lat: -10.30, lng: -48.40, autoConcluir: true } },
}));
const concluidas = [];
global.window.AgendaAPI = {
  completeAuto(id) {
    const ts = JSON.parse(localStorage.getItem(TK)); const t = ts.find(x => String(x.id) === String(id));
    if (!t || t.done) return false; t.done = true; t.syncRev = Date.now(); localStorage.setItem(TK, JSON.stringify(ts)); concluidas.push(String(id)); return true;
  },
};

carregar('localizacao.js');
carregar('auto-concluir.js');
const L = global.window.AgendaLocal, A = global.window.AgendaAutoConcluir;
let passo = 0; const ok = m => console.log(`${++passo} ok: ${m}`);

(async () => {
  // 1) salvar pelo mapa: coordenadas tocadas, sem visita afirmada
  const r = await L.salvarLugar('energisa', { lat: ENERGISA.lat, lng: ENERGISA.lng, raio: 120 });
  assert(r.ok && r.novo && r.lugar.nome === 'Energisa' && r.lugar.raio === 120, JSON.stringify(r));
  assert.strictEqual(L.onde(), null, 'salvar pelo mapa não pode afirmar visita');
  assert.strictEqual(L.lugares().length, 1);
  ok('salvarLugar com coordenadas cria o lugar no ponto tocado, sem afirmar presença');
  const r2 = await L.salvarLugar('Casa', { lat: -10.18, lng: -48.33, raio: 9999 });
  assert.strictEqual(r2.lugar.raio, L.RAIO.max, 'raio limitado ao máximo');
  assert(L.editarLugar(r2.lugar.id, { nome: 'Energisa' }).ok === false, 'nome repetido recusado');
  const e2 = L.editarLugar(r2.lugar.id, { nome: 'Casa da mãe', raio: 80 });
  assert(e2.ok && e2.lugar.nome === 'Casa da mãe' && e2.lugar.raio === 80);
  assert(L.removerLugar(r2.lugar.id).ok && L.lugares().length === 1);
  ok('editarLugar renomeia/muda raio; removerLugar aceita id; raio fica entre os limites');

  // 2) antes de chegar: nada
  global.window.AgendaLocal.ativar(); // sem GPS no harness: só marca ativo
  now += 10000;
  assert.deepStrictEqual(A.avaliar(), []);
  ok('sem visita: nada é concluído');

  // 3) passando de carro (rápido) não é chegada
  const fix = (p, acc, dt, speed) => { now += dt; L._processarFix({ coords: { latitude: p.lat, longitude: p.lng, accuracy: acc, speed: speed == null ? null : speed }, timestamp: now }); };
  fix(mv(ENERGISA, -600, 0), 15, 20000, 12); fix(ENERGISA, 15, 5000, 12); fix(mv(ENERGISA, 600, 0), 15, 5000, 12);
  assert.strictEqual(L.onde(), null); assert.strictEqual(concluidas.length, 0);
  ok('passar pela Energisa em movimento não conta');

  // 4) chegada real às 08:30 (≥ 60 s parado dentro): o motor emite 'chegada' e o auto-concluir age na hora
  now = new RealDate('2026-11-03T08:30:00').getTime();
  for (let i = 0; i < 6; i++) fix(mv(ENERGISA, 10, -5), 12, 15000, 0);
  assert(L.onde() && L.onde().lugar === 'Energisa', 'motor deveria registrar a chegada');
  assert.deepStrictEqual(concluidas.sort(), ['a', 'b', 'rec-r1-2026-11-03'].sort(), 'concluídas: ' + concluidas);
  ok('chegada confirmada pelo motor conclui: tarefa 10:00 (janela desde 08:00), tarefa sem horário (local a ~50 m) e só a ocorrência de HOJE da repetida');
  const notas = JSON.parse(localStorage.getItem(NK));
  assert(notas.a.autoConcluida && notas.a.autoConcluida.lugar === 'Energisa' && notas.a.autoConcluida.data === '2026-11-03' && notas.a.autoConcluida.chegada <= now);
  assert(!notas.c.autoConcluida && !notas.d.autoConcluida && !notas.e.autoConcluida && !notas.f.autoConcluida);
  assert(/Concluídas? automaticamente|concluídas automaticamente/i.test(toast.textContent), toast.textContent);
  ok('auditoria na nota (quando/onde) e aviso "✓ Concluída automaticamente"; amanhã, sem auto, fora da janela e local distante ficam');

  // 5) usuário reabre a tarefa: não conclui de novo
  const ts = JSON.parse(localStorage.getItem(TK)); ts.find(t => t.id === 'a').done = false; localStorage.setItem(TK, JSON.stringify(ts));
  now += 60000; fix(mv(ENERGISA, 5, 5), 10, 1000, 0);
  A.avaliar();
  assert(!concluidas.slice(3).includes('a'), 'reaberta não pode voltar a ser concluída');
  ok('tarefa reaberta pelo usuário é respeitada');

  // 6) continua lá: às 14:00 abre a janela da tarefa das 16:00 (presença, sem nova chegada)
  now = new RealDate('2026-11-03T13:59:00').getTime(); fix(mv(ENERGISA, 5, 5), 10, 1000, 0);
  A.avaliar(); assert(!concluidas.includes('e'), 'antes de 14:00 não');
  now = new RealDate('2026-11-03T14:01:00').getTime(); fix(mv(ENERGISA, 5, 5), 10, 1000, 0);
  A.avaliar(); assert(concluidas.includes('e'), 'às 14:01, ainda lá dentro, conclui a das 16:00');
  ok('presença contínua: conclui quando a janela (2 h antes) abre');

  // 7) janela e casamento de local (funções puras)
  const j = A.janela({ date: '2026-11-03', time: '01:00' }, now);
  assert.strictEqual(new Date(j.ini).getHours(), 0, 'janela não volta para ontem');
  assert.strictEqual(A.janela({ date: '2026-11-04', time: '' }, now), null);
  assert.strictEqual(A.lugarDaTarefa({ lat: -10.30, lng: -48.40 }, L.lugares()), null);
  ok('janela limitada ao dia e local distante não casa com lugar');
  console.log('\nTODOS OS TESTES PASSARAM');
})().catch(e => { console.error(e); process.exit(1); });
