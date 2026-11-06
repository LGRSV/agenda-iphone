/* Testes da lógica pura de rotas.js (filtro, polilinha, paradas/trechos/lacunas,
   mescla entre aparelhos, limites). Coordenadas FALSAS (oceano, perto de 0,0).
   Roda: node tests/rotas.test.js (sem dependências) */
'use strict';
const assert = require('assert');
const N = require('../rotas.js');
let passo = 0; const ok = msg => console.log(`${++passo} ok: ${msg}`);

const MIN = 60000;
const BASE = { lat: -0.5, lng: 0.5 };
const mv = (p, dn, de) => ({ lat: p.lat + dn / 111320, lng: p.lng + de / (111320 * Math.cos(p.lat * Math.PI / 180)) });
const CASA = { id: 'l-casa', nome: 'Casa', ...BASE, raio: 100 };
const TRAB = { id: 'l-trab', nome: 'Trabalho', ...mv(BASE, 0, 4000), raio: 120 };
const LUGARES = [CASA, TRAB];
const T0 = N.inicioDia('2026-11-02'); // segunda
const at = (h, m) => T0 + (h * 60 + (m || 0)) * MIN;
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

// gerador de dia: lista de fixes a partir de "passos"
function gerar() {
  const fixes = [];
  return {
    fixes,
    parado(p, de, ate, cada, acc, jitter) {
      for (let t = de; t <= ate; t += cada) {
        const q = jitter ? mv(p, (rnd() - 0.5) * 2 * jitter, (rnd() - 0.5) * 2 * jitter) : p;
        fixes.push({ ...q, acc: acc || 10, ts: t, speed: 0 });
      }
    },
    andar(a, b, de, ate, cada) {
      const n = Math.max(1, Math.round((ate - de) / cada));
      for (let k = 1; k <= n; k++) {
        const f = k / n;
        fixes.push({ lat: a.lat + (b.lat - a.lat) * f, lng: a.lng + (b.lng - a.lng) * f, acc: 8, ts: de + (ate - de) * f, speed: N.dist(a.lat, a.lng, b.lat, b.lng) / ((ate - de) / 1000) });
      }
    }
  };
}
function rodar(fixes, extraCtx) {
  const pts = [], ctx = Object.assign({ lugares: LUGARES, mem: {} }, extraCtx || {}), cont = {};
  for (const f of fixes) { const r = N.registrar(pts, f, ctx); cont[r] = (cont[r] || 0) + 1; }
  return { pts, cont };
}
const analisar = (pts, agora) => N.analisarDia(pts, { lugares: LUGARES, dia: '2026-11-02', agora: agora || at(23, 59) });

// 1) polilinha: exemplo oficial do Google + ida e volta
assert.strictEqual(N.codificar([[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]]), '_p~iF~ps|U_ulLnnqC_mqNvxq`@');
const dec = N.decodificar('_p~iF~ps|U_ulLnnqC_mqNvxq`@');
assert.deepStrictEqual(dec, [[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]]);
const volta = N.decodificar(N.codificar([[BASE.lat, BASE.lng], [-0.49999, 0.50001], [-0.6, 0.4]]));
assert(Math.abs(volta[1][0] - -0.49999) < 1e-9 && Math.abs(volta[2][1] - 0.4) < 1e-9);
ok('polilinha Google precisão 5: exemplo oficial e ida-e-volta');

// 2) dia típico: casa -> trabalho -> parada sem nome -> casa
const MERCADO = mv(BASE, 1500, 1500);
let g = gerar();
g.parado(CASA, at(0, 0), at(6, 52), 5 * MIN, 12, 0);
g.andar(CASA, TRAB, at(6, 52), at(7, 10), 5000);            // 4 km em 18 min
g.parado(TRAB, at(7, 10), at(11, 31), 2 * MIN, 15, 0);
g.andar(TRAB, MERCADO, at(11, 31), at(11, 40), 5000);
g.parado(MERCADO, at(11, 40), at(12, 0), 30000, 10, 8);      // 20 min parado num ponto sem lugar
g.andar(MERCADO, CASA, at(12, 0), at(12, 8), 5000);
g.parado(CASA, at(12, 8), at(13, 0), 5 * MIN, 12, 0);
let { pts, cont } = rodar(g.fixes);
let an = analisar(pts);
assert.deepStrictEqual(an.paradas.map(p => p.nome), ['Casa', 'Trabalho', '', 'Casa']);
assert.strictEqual(an.trechos.length, 3);
assert.strictEqual(an.trechos[0].de, 'Casa'); assert.strictEqual(an.trechos[0].para, 'Trabalho');
assert(Math.abs(an.trechos[0].km - 4) < 0.3, 'km casa->trabalho ' + an.trechos[0].km);
assert(Math.abs(an.trechos[0].min - 18) <= 2, 'min ' + an.trechos[0].min);
const sai = an.eventos.find(e => e.tipo === 'saida');
assert.strictEqual(sai.hora, '06:52'); assert(/^saiu de Casa/.test(sai.texto));
if (process.env.DBG) console.log(an.eventos.map(e => e.hora + ' ' + e.texto).join(' | '));
assert(an.eventos.some(e => e.tipo === 'chegada' && /Trabalho/.test(e.texto) && /^07:(0[5-9]|1[01])$/.test(e.hora)));
assert(an.eventos.some(e => e.tipo === 'chegada' && /local sem nome/.test(e.texto)));
assert(an.eventos.some(e => e.tipo === 'transito' && /^em trânsito \([34],\d km, 1\d min\)$/.test(e.texto)));
assert(cont.estadia > 50, 'dentro do lugar parado não cria pontos');
assert(pts.length < 300, 'pontos ' + pts.length);
assert.strictEqual(an.lacunas.length, 0);
ok(`dia típico: 4 paradas, 3 trechos, ${pts.length} pontos, saída 06:52, ${N.fmtKm(an.km)}`);

// 3) GPS ruidoso parado fora de lugar (precisão 40–95 m, jitter ±45 m) + leituras > 100 m
g = gerar();
for (let t = at(8); t <= at(9); t += 20000) {
  const acc = 40 + rnd() * 55, q = mv(MERCADO, (rnd() - 0.5) * 90, (rnd() - 0.5) * 90);
  g.fixes.push({ ...q, acc, ts: t, speed: null });
  if (rnd() < 0.3) g.fixes.push({ ...mv(MERCADO, 400, 0), acc: 140, ts: t + 5000, speed: null });
}
({ pts, cont } = rodar(g.fixes));
an = analisar(pts);
assert(cont.ruim > 10, 'precisão > 100 m descartada');
assert(an.km < 0.25, 'ruído parado não vira km: ' + an.km);
assert.strictEqual(an.paradas.length, 1); assert(an.paradas[0].fim - an.paradas[0].ini >= 55 * MIN);
ok(`GPS ruidoso parado: ${cont.ruim} leituras ruins descartadas, ${an.km.toFixed(2)} km falsos, 1 parada`);

// 4) parada longa (3 h) num ponto sem lugar, com fixes esparsos (nativo com distanceFilter)
g = gerar();
g.andar(CASA, MERCADO, at(9), at(9, 8), 5000);
g.parado(MERCADO, at(9, 8), at(12, 8), 40 * MIN, 15, 5);
g.andar(MERCADO, CASA, at(12, 8), at(12, 16), 5000);
({ pts } = rodar(g.fixes));
an = analisar(pts);
const longa = an.paradas.find(p => !p.nome);
if (process.env.DBG) console.log(an.eventos.map(e => e.hora + ' ' + e.texto).join(' | '));
assert(longa && Math.abs((longa.fim - longa.ini) / MIN - 180) <= 2, 'parada longa 3h');
assert.strictEqual(an.lacunas.length, 0, 'silêncio no mesmo ponto sem "sem monitorar" não é lacuna');
ok(`parada longa de 3 h sem lugar salvo: uma parada de ${Math.round((longa.fim - longa.ini) / MIN)} min`);

// 5) app fechado por 2 h (PWA): andou 8 km sem registro -> lacuna, sem linha reta
g = gerar();
g.parado(CASA, at(13), at(14, 10), 5 * MIN, 12, 0);
g.andar(CASA, mv(CASA, 500, 0), at(14, 10), at(14, 12), 5000);
const LONGE = mv(CASA, 8000, 0);
g.parado(LONGE, at(16, 12), at(16, 40), 60000, 10, 5);
const sm = [[at(14, 12) + 1000, at(16, 12) - 1000]];
({ pts } = rodar(g.fixes, { semMonitor: (a, b) => sm.some(x => x[0] < b && x[1] > a) }));
an = analisar(pts);
assert.strictEqual(an.lacunas.length, 1);
assert.strictEqual(N.hhmm(an.lacunas[0].ini), '14:12'); assert.strictEqual(N.hhmm(an.lacunas[0].fim), '16:12');
assert(an.km < 1, 'os 8 km da lacuna não contam: ' + an.km);
assert(an.trechos.every(t => t.coords.every((c, i) => i === 0 || N.dist(t.coords[i - 1][0], t.coords[i - 1][1], c[0], c[1]) < 600)), 'nenhum segmento atravessa a lacuna');
assert(an.eventos.some(e => e.tipo === 'lacuna' && e.texto === 'sem registro 14:12–16:12'));
// mesmo ponto, app fechado 2 h: lacuna "voltou ao mesmo ponto" (não finge que ficou parado)
g = gerar();
g.parado(MERCADO, at(8), at(8, 30), 60000, 10, 0);
g.parado(MERCADO, at(10, 30), at(11), 60000, 10, 0);
const sm2 = [[at(8, 31), at(10, 29)]];
({ pts } = rodar(g.fixes, { semMonitor: (a, b) => sm2.some(x => x[0] < b && x[1] > a) }));
an = analisar(pts);
assert.strictEqual(an.lacunas.length, 1); assert(an.lacunas[0].mesmoPonto);
assert(/voltou ao mesmo ponto/.test(an.eventos.find(e => e.tipo === 'lacuna').texto));
ok('app fechado 2 h: lacuna 14:12–16:12, km da lacuna fora da conta; mesmo ponto também vira lacuna');

// 6) salto de 30 km: um fix maluco no meio de um trajeto é descartado
g = gerar();
g.andar(CASA, TRAB, at(7), at(7, 18), 5000);
const idx = Math.floor(g.fixes.length / 2);
g.fixes.splice(idx, 0, { ...mv(CASA, 30000, 0), acc: 20, ts: g.fixes[idx].ts - 1000, speed: null });
({ pts, cont } = rodar(g.fixes));
an = analisar(pts);
assert.strictEqual(cont.salto, 1); assert(Math.abs(an.km - 4) < 0.3, 'km ' + an.km); assert.strictEqual(an.lacunas.length, 0);
// salto que se confirma (3 leituras coerentes lá longe): aceita e marca lacuna
g = gerar();
g.parado(CASA, at(7), at(7, 20), 60000, 10, 0);
for (let k = 1; k <= 4; k++) g.fixes.push({ ...mv(CASA, 30000, k * 20), acc: 10, ts: at(7, 20) + k * 15000, speed: 1 });
({ pts, cont } = rodar(g.fixes));
an = analisar(pts);
assert.strictEqual(cont.salto, 2); assert.strictEqual(an.lacunas.length, 1); assert(an.km < 0.5);
// 30 km depois de 2 h sem sinal é plausível (15 km/h): lacuna, não salto
g = gerar();
g.parado(CASA, at(7), at(7, 20), 60000, 10, 0);
g.parado(mv(CASA, 30000, 0), at(9, 20), at(9, 40), 60000, 10, 0);
({ pts, cont } = rodar(g.fixes));
an = analisar(pts);
assert(!cont.salto && an.lacunas.length === 1 && an.km === 0);
ok('salto de 30 km: isolado é descartado; confirmado por 3 leituras vira lacuna; depois de 2 h vira lacuna');

// 7) resumo da nuvem: sem coordenadas brutas, ida-e-volta, limite de tamanho
g = gerar();
g.parado(CASA, at(0), at(6, 52), 5 * MIN, 12, 0);
g.andar(CASA, TRAB, at(6, 52), at(7, 10), 5000);
g.parado(TRAB, at(7, 10), at(11, 31), 2 * MIN, 15, 0);
({ pts } = rodar(g.fixes));
an = analisar(pts);
let r = N.resumir(an, '2026-11-02', 'devA', at(12));
assert(JSON.stringify(r).length <= N.P.MAX_DIA);
assert(r.trechos[0].pl && !('_c' in r.trechos[0]));
const back = N.deResumo(r, '2026-11-02', { lugares: LUGARES });
assert.deepStrictEqual(back.paradas.map(p => p.nome), ['Casa', 'Trabalho']);
assert.strictEqual(back.eventos.find(e => e.tipo === 'saida').hora, '06:52');
assert(N.decodificar(r.trechos[0].pl).length >= 2);
// dia enorme em zigue-zague: cabe em 4000 caracteres
g = gerar();
let cur = CASA;
for (let k = 0; k < 600; k++) { const nx = mv(cur, (k % 2 ? 1 : -1) * 120, 60); g.andar(cur, nx, at(6) + k * 60000, at(6) + k * 60000 + 50000, 10000); cur = nx; }
({ pts } = rodar(g.fixes));
an = analisar(pts);
r = N.resumir(an, '2026-11-02', 'devA', at(23));
assert(JSON.stringify(r).length <= N.P.MAX_DIA, 'tamanho ' + JSON.stringify(r).length);
const pub = N.publico(an);
assert(!/"(la|ln|lat|lng|coords|pl)"/.test(JSON.stringify(pub)), 'API pública sem coordenadas');
ok(`resumo: ida-e-volta ok; dia de ${pts.length} pontos cabe em ${JSON.stringify(r).length} caracteres; API pública sem coordenadas`);

// 8) mescla entre aparelhos
const agora = at(23);
const rA1 = { dev: 'devA', at: at(10), km: 1, mm: 5, paradas: [], trechos: [], lacunas: [] };
const rA2 = { ...rA1, at: at(12), km: 2 };
const rB = { dev: 'devB', at: at(11), km: 7, mm: 9, paradas: [], trechos: [], lacunas: [] };
const A = { v: 1, dias: { '2026-11-02': { devA: rA2 } }, apagados: {} };
const B = { v: 1, dias: { '2026-11-02': { devA: rA1, devB: rB }, '2026-11-01': { devB: { ...rB, at: at(-5) } } }, apagados: {} };
const m1 = N.mesclar(A, B, agora), m2 = N.mesclar(B, A, agora);
assert.strictEqual(N.canon(m1), N.canon(m2), 'comutativa');
assert.strictEqual(m1.dias['2026-11-02'].devA.km, 2, 'o mais novo do mesmo aparelho vence');
assert.strictEqual(m1.dias['2026-11-02'].devB.km, 7, 'o outro aparelho não é apagado');
assert(m1.dias['2026-11-01'], 'dia que só o outro tinha fica');
assert.strictEqual(N.canon(N.mesclar(m1, m1, agora)), N.canon(m1), 'idempotente');
// lápide de dia: apaga o que é mais antigo, aceita o que vier depois
const C = { v: 1, dias: {}, apagados: { '2026-11-02': at(13) } };
const m3 = N.mesclar(m1, C, agora);
assert(!m3.dias['2026-11-02'] && m3.dias['2026-11-01']);
const m4 = N.mesclar(m3, { dias: { '2026-11-02': { devA: { ...rA1, at: at(14) } } } }, agora);
assert(m4.dias['2026-11-02'].devA, 'gravado depois da lápide fica');
assert(!N.mesclar(m1, { tudo: at(13) }, agora).dias['2026-11-02'], 'apagar tudo');
assert.strictEqual(N.melhorResumo(m1.dias['2026-11-02'], 'devA').dev, 'devA');
assert.strictEqual(N.melhorResumo(m1.dias['2026-11-02'], 'outro').dev, 'devB');
ok('mescla: comutativa, idempotente, por aparelho, lápide por dia e apagar tudo');

// 9) limites: retenção de 90 dias, polilinha só 14 dias, teto total
const grande = { v: 1, dias: {}, apagados: { '2026-01-01': 1 } };
const plGrande = N.codificar(Array.from({ length: 300 }, (_, k) => [BASE.lat + k * 1e-3, BASE.lng + (k % 7) * 1e-3]));
for (let k = 0; k < 120; k++) {
  const d = N.somaDias('2026-11-02', -k);
  grande.dias[d] = { devA: { dev: 'devA', at: at(1), km: 10, mm: 30, paradas: [{ i: 1, f: 2, nome: 'Casa', la: 0, ln: 0 }], trechos: [{ i: 2, f: 30, km: 10, de: 'Casa', para: 'Trabalho', pl: plGrande }], lacunas: [] } };
}
const pod = N.mesclar(grande, {}, agora);
const ds = Object.keys(pod.dias).sort();
assert(ds[0] >= N.somaDias('2026-11-02', -90), 'retenção 90 dias: ' + ds[0]);
assert(!pod.apagados['2026-01-01'], 'lápide velha some');
assert(ds.filter(d => pod.dias[d].devA.trechos[0].pl).every(d => d >= N.somaDias('2026-11-02', -14)), 'polilinha só nos últimos 14 dias');
assert(JSON.stringify(pod).length <= N.P.MAX_TOTAL, 'teto total ' + JSON.stringify(pod).length);
ok(`limites: ${ds.length} dias guardados, ${JSON.stringify(pod).length} caracteres no total`);

// 10) dia local (UTC-3) e semana
assert.strictEqual(N.diaLocal(Date.parse('2026-11-03T02:59:00Z')), '2026-11-02');
assert.strictEqual(N.diaLocal(Date.parse('2026-11-03T03:00:00Z')), '2026-11-03');
assert.strictEqual(N.hhmm(Date.parse('2026-11-03T09:52:00Z')), '06:52');
const dias = [];
for (let k = 0; k < 5; k++) {
  g = gerar();
  const b = T0 + k * N.DIA, h = (hh, mm) => b + (hh * 60 + (mm || 0)) * MIN;
  g.parado(CASA, h(0), h(6, 50), 10 * MIN, 12, 0);
  g.andar(CASA, TRAB, h(6, 50), h(7, 10), 5000);
  g.parado(TRAB, h(7, 10), h(12), 5 * MIN, 12, 0);
  g.andar(TRAB, CASA, h(12), h(12, 20), 5000);
  g.parado(CASA, h(12, 20), h(13), 5 * MIN, 12, 0);
  ({ pts } = rodar(g.fixes));
  dias.push(N.analisarDia(pts, { lugares: LUGARES, dia: N.diaLocal(b), agora: h(23) }));
}
const s = N.semana(dias);
assert(Math.abs(s.km - 40) < 2, 'km semana ' + s.km);
assert.strictEqual(s.tempoPorLugar[0].nome, 'Casa');
assert(Math.abs(s.tempoPorLugar.find(l => l.nome === 'Trabalho').min - 5 * 290) <= 10);
assert.strictEqual(s.trechosRepetidos[0].vezes, 5);
assert.deepStrictEqual(s.trechosRepetidos.map(t => t.de + '>' + t.para).sort(), ['Casa>Trabalho', 'Trabalho>Casa']);
ok(`dia local UTC-3 e semana: ${s.km} km, Trabalho ${s.tempoPorLugar.find(l => l.nome === 'Trabalho').min} min, trecho repetido 5x`);

// 11) parada aberta (agora) não ganha "saiu"
g = gerar();
g.andar(CASA, TRAB, at(6, 52), at(7, 10), 5000);
g.parado(TRAB, at(7, 10), at(9), 2 * MIN, 15, 0);
({ pts } = rodar(g.fixes));
an = N.analisarDia(pts, { lugares: LUGARES, dia: '2026-11-02', agora: at(9, 5) });
assert(an.paradas[an.paradas.length - 1].aberta && !an.eventos.some(e => e.tipo === 'saida' && /Trabalho/.test(e.texto)));
assert(/lá há 1h55/.test(an.eventos[an.eventos.length - 1].texto));
ok('parada em andamento: "chegou em Trabalho (lá há 1h55)", sem saída inventada');

console.log(`\nrotas: ${passo} grupos de teste passaram`);
