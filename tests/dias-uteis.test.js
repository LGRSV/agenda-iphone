/* Testa as regras de recorrência 'bdays' e 'monthly_bd' do index.html.
   Roda: node tests/dias-uteis.test.js (sem dependências) */
'use strict';
const fs = require('fs'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const pick = re => { const m = src.match(re); assert(m, 'trecho não encontrado: ' + re); return m[0]; };
const code = [
  pick(/function dateAtNoon\([^\n]*?\n/),
  pick(/function iso\(d\)[^\n]*?\n/),
  pick(/function addDaysStr\([^\n]*?\n/),
  pick(/function diaUtilBR\([^\n]*?\n/),
  pick(/function antecipaDiaUtil\([^\n]*?\n/),
  pick(/function freqMatch\([^\n]*?\n/),
].join('\n');
const freqMatch = new Function(code + '\nreturn freqMatch;')();
const addDays = new Function(code + '\nreturn addDaysStr;')();

// todas as datas de [de, ate] em que a regra cai
const datas = (freq, start, de, ate) => { const o = []; for (let d = de; d <= ate; d = addDays(d, 1)) if (freqMatch(freq, d, start)) o.push(d); return o; };

// dia 15 antecipado (salário Energisa)
assert.deepStrictEqual(datas('monthly_bd', '2026-11-15', '2026-11-01', '2027-03-31'),
  ['2026-11-13', '2026-12-15', '2027-01-15', '2027-02-15', '2027-03-15']); // 15/11/26 é domingo
// dia 30 antecipado; fev não tem dia 30 -> usa o último dia (28/02/27 é domingo -> sex 26)
assert.deepStrictEqual(datas('monthly_bd', '2026-11-30', '2026-11-01', '2027-03-31'),
  ['2026-11-30', '2026-12-30', '2027-01-29', '2027-02-26', '2027-03-30']); // 30/01/27 é sábado
// dia 28 antecipado (mesada do pai)
assert.deepStrictEqual(datas('monthly_bd', '2026-11-28', '2026-11-01', '2027-02-28'),
  ['2026-11-27', '2026-12-28', '2027-01-28', '2027-02-26']);
// dia 20 antecipado (Edilma): 20/11 é feriado (Consciência Negra) e sexta
assert.deepStrictEqual(datas('monthly_bd', '2026-11-20', '2026-11-01', '2027-04-30'),
  ['2026-11-19', '2026-12-18', '2027-01-20', '2027-02-19', '2027-03-19', '2027-04-20']);
// dias úteis: novembro/2026 sem 02/11 (Finados), 15/11 (dom) e 20/11 (feriado)
const nov = datas('bdays', '2026-11-03', '2026-11-01', '2026-11-30');
assert.strictEqual(nov.length, 19); // 21 dias de semana - Finados (02) - Consciência Negra (20)
['2026-11-02', '2026-11-20', '2026-11-07', '2026-11-08'].forEach(d => assert(!nov.includes(d), d));
assert(nov.includes('2026-11-03') && nov.includes('2026-11-19') && nov.includes('2026-11-23'));
// Sexta-feira Santa 2027 = 26/03; Natal; Ano-Novo
['2027-03-26', '2026-12-25', '2027-01-01', '2027-04-21', '2027-05-01', '2027-09-07'].forEach(d => assert(!freqMatch('bdays', d, '2026-11-03'), d));
// as regras antigas continuam iguais
assert(freqMatch('weekdays', '2026-11-02', '2026-11-02'));
assert(freqMatch('monthly', '2026-12-15', '2026-11-15'));
assert(freqMatch('month_last_weekday', '2026-11-30', '2026-07-31'));
console.log('ok: regras de dia útil');
