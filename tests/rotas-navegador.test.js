/* Testa a camada do navegador de rotas.js com window/localStorage falsos (sem
   IndexedDB: usa o fallback do localStorage). Coordenadas FALSAS.
   Roda: node tests/rotas-navegador.test.js */
'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert');
let passo = 0; const ok = msg => console.log(`${++passo} ok: ${msg}`);

const store = new Map(); const escritas = {};
global.localStorage = {
  getItem: k => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => { store.set(k, String(v)); escritas[k] = (escritas[k] || 0) + 1; },
  removeItem: k => store.delete(k),
};
const ls = {};
const RealDate = Date;
let now = RealDate.parse('2026-11-02T09:00:00Z'); // 06:00 local
global.Date = class extends RealDate { constructor(...a) { if (a.length) super(...a); else super(now); } static now() { return now; } };
const timers = [];
global.window = {
  localStorage: global.localStorage,
  addEventListener: (t, fn) => { (ls[t] = ls[t] || []).push(fn); },
  dispatchEvent: ev => { (ls[ev.type] || []).forEach(fn => fn(ev)); return true; },
  CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init && init.detail; } },
  setTimeout: (fn, ms) => { timers.push({ fn, at: now + ms }); return timers.length; },
  clearTimeout: () => {},
};
const docLs = {};
global.window.document = global.document = {
  hidden: false,
  addEventListener: (t, fn) => { (docLs[t] = docLs[t] || []).push(fn); },
  documentElement: { classList: { contains: () => false } },
};
const lugares = [{ id: 'l1', nome: 'Casa', lat: -0.5, lng: 0.5, raio: 100 }];
let ativo = true;
global.window.AgendaLocal = { lugares: () => lugares, ativo: () => ativo };
localStorage.setItem('agenda_supabase_config_v1', JSON.stringify({ workspaceOwnerId: 'dono-teste', deviceId: 'abcdef12-3456' }));

new Function('module', fs.readFileSync(path.join(__dirname, '..', 'rotas.js'), 'utf-8'))(undefined);
const R = global.window.AgendaRotas;
assert(R && typeof R.dia === 'function');
const mv = (dn, de) => ({ lat: -0.5 + dn / 111320, lng: 0.5 + de / 111320 });
const fix = (p, dt, acc, speed) => { now += dt; window.dispatchEvent(new window.CustomEvent('agenda:local-change', { detail: { tipo: 'fix', fix: { ...p, acc: acc || 10, ts: now, speed: speed == null ? null : speed } } })); };
const esconder = () => { document.hidden = true; (docLs.visibilitychange || []).forEach(f => f()); };
const mostrar = () => { document.hidden = false; (docLs.visibilitychange || []).forEach(f => f()); };

(async () => {
  await new Promise(r => setImmediate(r));
  assert(R.status().carregado);
  // em casa 30 min, anda 3 km, para 10 min
  for (let k = 0; k < 6; k++) fix(mv(0, 0), 5 * 60000);
  for (let k = 1; k <= 60; k++) fix(mv(k * 50, 0), 10000, 8, 5);
  for (let k = 0; k < 10; k++) fix(mv(3000, 0), 60000);
  const d = R.dia();
  assert.strictEqual(d.dia, '2026-11-02');
  assert.strictEqual(d.paradas[0].nome, 'Casa');
  assert(d.trechos.length === 1 && Math.abs(d.trechos[0].km - 3) < 0.3);
  assert(d.eventos.some(e => e.tipo === 'saida' && e.hora === '06:30'), JSON.stringify(d.eventos));
  assert(!/"(la|ln|lat|lng|coords|pl)"/.test(JSON.stringify(d)), 'API sem coordenadas');
  ok(`AgendaRotas.dia(): ${d.eventos.map(e => e.hora + ' ' + e.texto).join(' | ')}`);

  const w = JSON.parse(store.get('agenda_rotas_v1'));
  assert.strictEqual(w.owner, 'dono-teste');
  assert(w.dias['2026-11-02'].abcdef12, 'resumo deste aparelho na chave de settings');
  assert(!JSON.stringify(w).includes('"t":'), 'sem pontos brutos na nuvem');
  const minutos = (now - RealDate.parse('2026-11-02T09:00:00Z')) / 60000;
  assert(escritas.agenda_rotas_v1 <= Math.floor(minutos / 5) + 1, 'gravações espaçadas: ' + escritas.agenda_rotas_v1);
  const brutos = JSON.parse(store.get('agenda_rotas_pts_v1') || 'null');
  ok(`nuvem: ${escritas.agenda_rotas_v1} gravações em ${Math.round((now - RealDate.parse('2026-11-02T09:00:00Z')) / 60000)} min; ${JSON.stringify(w).length} caracteres; brutos só no aparelho${brutos ? '' : ' (pendentes no timer)'}`);

  // app escondido no PWA por 2 h e volta 8 km longe: lacuna
  esconder(); now += 2 * 3600000; mostrar();
  fix(mv(11000, 0), 1000); fix(mv(11000, 30), 60000); fix(mv(11000, 30), 6 * 60000);
  const d2 = R.dia();
  assert.strictEqual(d2.lacunas.length, 1, JSON.stringify(d2.lacunas));
  assert(d2.km < 3.5, 'lacuna não soma km');
  ok(`PWA fechado 2 h: ${d2.eventos.filter(e => e.tipo === 'lacuna').map(e => e.hora + ' ' + e.texto)}`);

  // outro aparelho manda o mesmo dia pela nuvem: os dois ficam
  const remoto = JSON.parse(store.get('agenda_rotas_v1'));
  remoto.dias['2026-11-02'].outroAp = { dev: 'outroAp', at: now, km: 1, mm: 2, paradas: [], trechos: [], lacunas: [] };
  remoto.dias['2026-11-01'] = { outroAp: { dev: 'outroAp', at: now, km: 5, mm: 9, paradas: [{ i: 600, f: 660, nome: 'Casa' }], trechos: [{ i: 540, f: 600, km: 5, de: 'Casa', para: 'Casa' }], lacunas: [] } };
  delete remoto.dias['2026-11-02'].abcdef12; // cópia velha do servidor sem o deste aparelho
  store.set('agenda_rotas_v1', JSON.stringify(remoto));
  window.dispatchEvent(new window.CustomEvent('agenda:remote-sync', { detail: { documentKey: 'all' } }));
  const w2 = JSON.parse(store.get('agenda_rotas_v1'));
  assert(w2.dias['2026-11-02'].abcdef12 && w2.dias['2026-11-02'].outroAp && w2.dias['2026-11-01'], 'mescla por dia e aparelho');
  const antes = escritas.agenda_rotas_v1;
  window.dispatchEvent(new window.CustomEvent('agenda:remote-sync', { detail: { documentKey: 'all' } }));
  assert.strictEqual(escritas.agenda_rotas_v1, antes, 'sync repetido não regrava (sem laço de push)');
  assert.strictEqual(R.dia('2026-11-01').fonte, 'resumo de outro aparelho');
  const sem = R.semana('2026-11-02');
  assert(sem.dias.length === 7 && sem.km > 5);
  assert(/ROTAS \(02\/11\)/.test(R.resumoJarvis()));
  ok(`mescla via sync mantém os dois aparelhos; semana ${sem.km} km; Jarvis: ${R.resumoJarvis().split('\n')[0].slice(0, 90)}…`);

  // shared-storage usa AgendaRotas.mesclar no envio
  const m = R.mesclar(JSON.parse(store.get('agenda_rotas_v1')), remoto);
  assert(m.dias['2026-11-02'].abcdef12 && m.owner === 'dono-teste');

  // apagar um dia
  R.apagarDia('2026-11-02');
  assert.strictEqual(R.dia('2026-11-02').eventos.length, 0);
  const w3 = JSON.parse(store.get('agenda_rotas_v1'));
  assert(w3.apagados['2026-11-02'] && !w3.dias['2026-11-02'] && w3.dias['2026-11-01']);
  // o servidor ainda tinha o dia: a lápide vence
  store.set('agenda_rotas_v1', JSON.stringify(remoto));
  window.dispatchEvent(new window.CustomEvent('agenda:remote-sync', { detail: { documentKey: 'all' } }));
  assert(!JSON.parse(store.get('agenda_rotas_v1')).dias['2026-11-02'], 'dia apagado não ressuscita pelo sync');
  await R.apagarTudo();
  const w4 = JSON.parse(store.get('agenda_rotas_v1'));
  assert(w4.tudo && !Object.keys(w4.dias).length);
  ok('apagar dia e apagar tudo: lápides vencem a cópia antiga do servidor');

  // virada do dia: estadia atravessa a meia-noite e o dia anterior é fechado
  now = RealDate.parse('2026-11-03T02:40:00Z'); // 23:40 local
  fix(mv(0, 0), 0); fix(mv(0, 0), 10 * 60000); fix(mv(0, 0), 20 * 60000); // 00:10 do dia 3
  assert.strictEqual(R.status().pontosHoje >= 1, true);
  const d3 = R.dia('2026-11-03');
  assert(d3.paradas[0] && d3.paradas[0].ini === '00:00', JSON.stringify(d3.paradas));
  ok('virada do dia: a estadia em Casa começa 00:00 no dia novo');
  console.log(`\nrotas (navegador): ${passo} grupos de teste passaram`);
})().catch(e => { console.error(e); process.exit(1); });
