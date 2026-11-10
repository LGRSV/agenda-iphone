/* Testes de sugestoes-compras.js e das funções puras de estabelecimentos.js.
   Dados e coordenadas FALSOS. Roda: node tests/sugestoes-compras.test.js */
'use strict';
const assert = require('assert');
const S = require('../sugestoes-compras.js');
const E = require('../estabelecimentos.js');
let passo = 0; const ok = m => console.log(`${++passo} ok: ${m}`);
const MIN = 60000;
const DIA = '2026-11-02';
const T = hhmm => S.tsHora(DIA, hhmm);

// 1) nome do estabelecimento: só o que vem do detalhe importado; nunca o texto do lançamento
assert.strictEqual(S.estabelecimento({ detail: 'Cartão X · Farmácia · Open Finance (DROGARIA EXEMPLO 4888)' }), 'Drogaria Exemplo');
assert.strictEqual(S.estabelecimento({ detail: 'Cartão X · Mercado Pago · Open Finance (MP LOJADOBAIRRO)' }), 'Lojadobairro');
assert.strictEqual(S.estabelecimento({ detail: 'comprei remédio X' }), '');
assert.strictEqual(S.tipoCategoria({ categoria: 'Farmácia e saúde' }), 'Farmácia');
assert.strictEqual(S.tipoCategoria({ categoria: 'Mercado e padaria' }), 'Mercado');
ok('estabelecimento vem do detalhe importado ou do tipo da categoria');

// 2) compras do dia
const tarefas = [
  { id: 'a', date: DIA, time: '19:42', text: 'Remédio para tal coisa' },               // com hora, só categoria
  { id: 'b', date: DIA, time: '', text: 'Produto íntimo (1/3)' },                      // sem hora, com estabelecimento
  { id: 'c', date: DIA, time: '', text: 'Salário' },                                   // entrada: fora
  { id: 'd', date: '2026-11-01', time: '19:40', text: 'Outro dia' },                   // outro dia: fora
  { id: 'e', date: DIA, time: '', text: 'Sem nada' },                                  // sem estabelecimento nem categoria: fora
];
const notas = {
  a: { movimento: 'saida', valor: '22.45', forma: 'pluxee', categoria: 'Farmácia e saúde' },
  b: { movimento: 'saida', valor: '11.47', lancamento: 'compra', detail: 'Cartão · Open Finance (DROGARIA EXEMPLO 12)' },
  c: { movimento: 'entrada', valor: '1000' },
  d: { movimento: 'saida', valor: '5', categoria: 'Mercado' },
  e: { movimento: 'saida', valor: '9' },
};
const compras = S.comprasDoDia(tarefas, notas, DIA);
assert.deepStrictEqual(compras.map(c => c.id), ['a', 'b']);
assert.strictEqual(compras[0].nome, ''); assert.strictEqual(compras[0].tipo, 'Farmácia'); assert.strictEqual(compras[0].hora, T('19:42'));
assert.strictEqual(compras[1].nome, 'Drogaria Exemplo'); assert.strictEqual(compras[1].hora, null);
assert(!JSON.stringify(compras).includes('Remédio') && !JSON.stringify(compras).includes('íntimo'), 'o texto do lançamento nunca entra');
ok('compras do dia: só saídas do dia com estabelecimento ou tipo; o texto do lançamento não é usado');

// 3) casamento com as paradas
const P = (i, f, nome, la) => ({ ini: T(i), fim: T(f), nome: nome || '', la: la == null ? -0.5 : la, ln: 0.5 });
const paradas = [P('07:10', '11:30', 'Trabalho'), P('19:35', '19:52', ''), P('20:05', '20:20', '', -0.51)];
let sug = S.sugerir(paradas, compras, DIA);
const exata = sug.filter(s => s.exato);
assert.strictEqual(exata.length, 1); assert.strictEqual(exata[0].parada.ini, T('19:35')); assert.strictEqual(exata[0].nome, 'Farmácia');
assert.strictEqual(sug.filter(s => s.aproximado).length, 2, 'sem hora: vale para as 2 paradas sem nome do dia');
assert(sug[0].exato, 'exatas primeiro');
assert(!sug.some(s => s.parada.nome), 'parada com nome não recebe sugestão');
ok('com hora: casa só com a parada da hora (19:42 em 19:35–19:52); sem hora: aproximado nas paradas sem nome');

// 4) ignorar e excesso de paradas sem nome
sug = S.sugerir(paradas, compras, DIA, new Set([exata[0].chave]));
assert(!sug.some(s => s.exato));
const muitas = [P('08:00', '08:10'), P('09:00', '09:10'), P('10:00', '10:10'), P('12:00', '12:10')];
assert.strictEqual(S.sugerir(muitas, [compras[1]], DIA).length, 0, 'sem hora e 4 paradas sem nome: não chuta');
assert.strictEqual(S.sugerir([P('19:30', '19:31')], [compras[0]], DIA).length, 0, 'parada de 1 min não conta');
ok('ignorada some; sem hora com muitas paradas não sugere; parada curta não conta');

// 5) estabelecimentos.js: leitura do Overpass e do Nominatim
const ov = { elements: [
  { type: 'node', lat: -0.5004, lon: 0.5, tags: { name: 'Farmácia Teste', amenity: 'pharmacy' } },
  { type: 'way', center: { lat: -0.5001, lon: 0.5 }, tags: { name: 'Padaria Teste', shop: 'bakery' } },
  { type: 'node', lat: -0.5001, lon: 0.5, tags: { name: 'Padaria Teste', shop: 'bakery' } },
  { type: 'node', lat: -0.5002, lon: 0.5, tags: { amenity: 'bench' } },
] };
const l = E.lerOverpass(ov, -0.5, 0.5);
assert.deepStrictEqual(l.map(x => x.nome), ['Padaria Teste', 'Farmácia Teste']);
assert.strictEqual(l[0].tipo, 'Padaria'); assert.strictEqual(l[1].tipo, 'Farmácia'); assert(l[0].dist < l[1].dist);
const rv = E.lerReverso({ name: 'Farmácia Teste', category: 'amenity', type: 'pharmacy', lat: '-0.5001', lon: '0.5', address: { road: 'Rua A', suburb: 'Centro' } }, -0.5, 0.5);
assert(rv.estabelecimento && rv.nome === 'Farmácia Teste' && rv.tipo === 'Farmácia' && rv.endereco === 'Rua A · Centro' && rv.dist <= 12);
const rv2 = E.lerReverso({ name: 'Rua A', category: 'highway', type: 'residential', lat: '-0.5', lon: '0.5', address: { road: 'Rua A' } }, -0.5, 0.5);
assert(!rv2.estabelecimento && rv2.nome === '' && rv2.endereco === 'Rua A');
assert(/around:150,-0\.500000,0\.500000\)\[name\]\[~"\^\(amenity\|shop/.test(E.consultaOverpass(-0.5, 0.5, 150)));
assert.strictEqual(E.linkGoogle(-0.5, 0.5), 'https://www.google.com/maps/search/?api=1&query=-0.5,0.5');
assert.strictEqual(E.linkApple(-0.5, 0.5, 'A & B'), 'https://maps.apple.com/?ll=-0.5,0.5&q=A%20%26%20B');
ok('estabelecimentos: Overpass sem repetidos e por distância; reverso separa estabelecimento de rua; links Google/Apple');

console.log(`\nsugestoes-compras: ${passo} grupos de teste passaram`);
