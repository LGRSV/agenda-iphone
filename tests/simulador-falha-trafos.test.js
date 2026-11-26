/* Confere a lógica do simulador de taxa de falha com os valores calculados pelo Excel
   SIMULADOR_PARA_HTML.xlsx (Planilha1, linhas PARQUE 2027 e TAXA 2027). Roda: node tests/simulador-falha-trafos.test.js */
'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const html = fs.readFileSync(__dirname + '/../simulador-falha-trafos.html', 'utf8');
const codigo = html.match(/<script id="logica">([\s\S]*?)<\/script>/)[1];
const ctx = { module: { exports: {} } };
vm.runInNewContext(codigo, ctx);
const { calcular, PADRAO } = ctx.module.exports;
let passo = 0; const ok = msg => console.log(`${++passo} ok: ${msg}`);

// valores do Excel (cache do arquivo)
const PARQUE27 = [93619,93785,93956,94115,94272,94478,94783,95050,95266,95436,95603,95746];
const TAXA = [0.023296553050128715,0.023031401610065574,0.023319426114351397,0.02373691760080752,0.023930753564154784,
  0.02386799043163488,0.023580177879999577,0.02354550236717517,0.023712552222198896,0.024037051008005364,0.023388387393701034,0.023562342029954254];

const r = calcular(PADRAO, 0, 0);
assert.deepStrictEqual(Array.from(r.parque27), PARQUE27); ok('parque 2027 mês a mês igual ao Excel');
TAXA.forEach((t, i) => assert.ok(Math.abs(r.taxa[i] - t) < 1e-12, `taxa mês ${i}: ${r.taxa[i]} vs ${t}`)); ok('taxa móvel dos 12 meses igual ao Excel');
assert.strictEqual(r.totReal, 2236); ok('total real 2026 = 2.236');
assert.strictEqual(r.totFc, 2256); ok('total forecast 2027 = 2.256');
assert.strictEqual(r.totInst, 2294); ok('total instalado = 2.294');
assert.ok(Math.abs(r.taxaAno - 0.023562342029954254) < 1e-12); ok('taxa do ano (N7) igual ao Excel');
assert.strictEqual(r.taxa[11], r.taxaAno); ok('dez = total do ano');

// cenários
const a = calcular(PADRAO, 10, 0);
assert.ok(a.totFc > r.totFc && a.taxaAno > r.taxaAno); ok('forecast +10% aumenta a taxa');
const b = calcular(PADRAO, 0, 50);
assert.ok(b.parqueFim > r.parqueFim && b.taxaAno < r.taxaAno); ok('mais instalações aumentam o parque e baixam a taxa');
const z = calcular(PADRAO, -50, 0);
assert.strictEqual(z.fc[0], 176); ok('ajuste -50% arredonda 352 -> 176');
const zero = calcular({ real: Array(12).fill(0), fc: Array(12).fill(0), parque: Array(12).fill(1000), inst: Array(12).fill(0) }, 0, 0);
assert.ok(zero.taxa.every(t => t === 0)); ok('sem falhas, taxa zero');
