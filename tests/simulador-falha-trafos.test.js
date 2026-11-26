/* Confere a lógica do simulador de taxa de falha com os valores calculados pelo Excel
   SIMULADOR_PARA_HTML.xlsx (aba 2027) e com a linha TAXA 2026 informada (aba 2026).
   Roda: node tests/simulador-falha-trafos.test.js */
'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync(__dirname + '/../simulador-falha-trafos.html', 'utf8');
const codigo = html.match(/<script id="logica">([\s\S]*?)<\/script>/)[1];
const ctx = { module: { exports: {} } };
vm.runInNewContext(codigo, ctx);
const { calcular, calcular2026, PADRAO, TAXA26_INFORMADA } = ctx.module.exports;
let passo = 0; const ok = msg => console.log(`${++passo} ok: ${msg}`);
const perto = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

// ---- aba 2027, com os dados ORIGINAIS do Excel (real 2026 nov/dez = 305/228)
const PARQUE27 = [93619,93785,93956,94115,94272,94478,94783,95050,95266,95436,95603,95746];
const TAXA_EXCEL = [0.023296553050128715,0.023031401610065574,0.023319426114351397,0.02373691760080752,0.023930753564154784,
  0.02386799043163488,0.023580177879999577,0.02354550236717517,0.023712552222198896,0.024037051008005364,0.023388387393701034,0.023562342029954254];
const excel = JSON.parse(JSON.stringify(PADRAO)); excel.real = [407,301,260,172,69,64,70,75,115,170,305,228];
const r = calcular(excel, 0, 0);
assert.deepStrictEqual(Array.from(r.parque27), PARQUE27); ok('2027: parque mês a mês igual ao Excel');
TAXA_EXCEL.forEach((t, i) => perto(r.taxa[i], t, 1e-12, `taxa mês ${i}`)); ok('2027: taxa móvel dos 12 meses igual ao Excel');
assert.strictEqual(r.totReal, 2236); assert.strictEqual(r.totFc, 2256); assert.strictEqual(r.totInst, 2294); ok('2027: totais 2.236 / 2.256 / 2.294');
perto(r.taxaAno, 0.023562342029954254, 1e-12, 'taxa ano'); assert.strictEqual(r.taxa[11], r.taxaAno); ok('2027: taxa do ano (dez) igual ao Excel');

// ---- aba 2027, com o real 2026 ATUALIZADO (nov/dez = 298/236)
const n = calcular(PADRAO, 0, 0);
const REF_NOVO = [2.3307, 2.3042, 2.333, 2.3748, 2.3941, 2.3879, 2.3591, 2.3556, 2.3723, 2.4048, 2.3472, 2.3562]; // calculado à parte em Python
REF_NOVO.forEach((t, i) => perto(n.taxa[i] * 100, t, 5e-5, `taxa nova mês ${i}`)); ok('2027 com real 2026 atualizado: taxas conferem com cálculo independente');
assert.strictEqual(n.totReal, 2237); perto(n.taxaAno, 2256 / 95746, 1e-12, 'dez 2027'); ok('2027: total real 2026 = 2.237; dez/2027 segue 2.256/95.746');

// ---- cenários 2027
const a = calcular(PADRAO, 10, 0); assert.ok(a.totFc > n.totFc && a.taxaAno > n.taxaAno); ok('forecast +10% aumenta a taxa');
const b = calcular(PADRAO, 0, 50); assert.ok(b.parqueFim > n.parqueFim && b.taxaAno < n.taxaAno); ok('mais instalações baixam a taxa');
assert.strictEqual(calcular(PADRAO, -50, 0).fc[0], 176); ok('ajuste -50% arredonda 352 -> 176');
const zero = calcular({ real: Array(12).fill(0), fc: Array(12).fill(0), parque: Array(12).fill(1000), inst: Array(12).fill(0) }, 0, 0);
assert.ok(zero.taxa.every(t => t === 0)); ok('sem falhas, taxa zero');

// ---- aba 2026
const c = calcular2026(PADRAO);
assert.strictEqual(c.tot25, 2229); assert.strictEqual(c.tot26, 2237); assert.strictEqual(c.parqueFim, 93452); ok('2026: totais 2.229 / 2.237 / parque 93.452');
perto(c.taxa[0] * 100, 2.5380, 5e-4, 'jan'); perto(c.taxa[11] * 100, 2.3938, 5e-4, 'dez'); ok('2026: jan 2,538% e dez 2,394%');
perto(c.taxaAno, 2237 / 93452, 1e-12, 'taxa ano 2026'); ok('2026: dez = total do ano ÷ parque de dezembro');
[9, 10, 11].forEach(i => perto(c.taxa[i] * 100, TAXA26_INFORMADA[i], 5e-4, `out-dez ${i}`)); ok('2026: out, nov e dez coincidem com a linha informada (3 casas)');
c.taxa.forEach((t, i) => { const d = t * 100 - TAXA26_INFORMADA[i]; assert.ok(d >= -5e-4 && d <= 0.012, `mês ${i}: dif ${d}`); }); ok('2026: jan a set ficam 0 a 0,012 p.p. acima da informada');
