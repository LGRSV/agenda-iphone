/* Testes da lógica pura de acessos.js: data e hora ditadas, telefones, resumo da Saúde (URL do Atalhos,
   mescla, semana) e mensagens de erro/permissão. Dados FALSOS. Roda: node tests/acessos.test.js */
'use strict';
const assert = require('assert');
const A = require('../acessos.js');
let passo = 0; const ok = msg => console.log(`${++passo} ok: ${msg}`);

const HOJE = new Date(2026, 10, 9, 10, 0); // segunda, 09/11/2026 10:00
const dit = t => A.interpretarDitado(t, HOJE);
const igual = (t, esperado) => {
  const r = dit(t);
  for (const k of Object.keys(esperado)) assert.strictEqual(r[k], esperado[k], `"${t}" -> ${k}: ${JSON.stringify(r)}`);
  ok(`"${t}" -> ${r.texto} | ${r.data} ${r.hora || '(sem hora)'}${r.horaDuvida ? ' (hora ambígua)' : ''}`);
};

// ---- data e hora ditadas
igual('Pagar a conta de luz amanhã às 9', { texto: 'Pagar a conta de luz', data: '2026-11-10', hora: '09:00' });
igual('Reunião com o Carlos sexta às 14h30', { texto: 'Reunião com o Carlos', data: '2026-11-13', hora: '14:30' });
igual('ligar para o dentista às 3 da tarde', { texto: 'Ligar para o dentista', data: '2026-11-09', hora: '15:00' });
igual('Comprar pão', { texto: 'Comprar pão', data: '2026-11-09', hora: '', temData: false });
igual('Médico dia 20 às 8 e meia', { texto: 'Médico', data: '2026-11-20', hora: '08:30' });
igual('Buscar as crianças às 3', { data: '2026-11-09', hora: '', horaDuvida: true });
assert.match(dit('Buscar as crianças às 3').texto, /às 3/); ok('hora ambígua fica no texto');
igual('Almoço com a Ana ao meio-dia', { texto: 'Almoço com a Ana', hora: '12:00' });
igual('Treino depois de amanhã às 7 da noite', { texto: 'Treino', data: '2026-11-11', hora: '19:00' });
igual('Pagar boleto 15/12', { texto: 'Pagar boleto', data: '2026-12-15', hora: '' });
igual('Pagar boleto 05/01', { data: '2027-01-05' });
igual('Enviar relatório daqui a 3 dias', { texto: 'Enviar relatório', data: '2026-11-12' });
igual('Renovar CNH dia 5', { texto: 'Renovar CNH', data: '2026-12-05' });
igual('Consulta dia 3 de março às 10h', { texto: 'Consulta', data: '2027-03-03', hora: '10:00' });
igual('me lembra de tomar o remédio às 22:00', { texto: 'Tomar o remédio', hora: '22:00', data: '2026-11-09' });
igual('Lembrar de pagar o aluguel na segunda que vem', { texto: 'Pagar o aluguel', data: '2026-11-16' });
igual('Pegar a segunda via do boleto', { texto: 'Pegar a segunda via do boleto', data: '2026-11-09', temData: false });
igual('Corrida amanhã às seis da manhã', { texto: 'Corrida', data: '2026-11-10', hora: '06:00' });
igual('Jantar hoje às 20 horas', { texto: 'Jantar', data: '2026-11-09', hora: '20:00' });
igual('tarefa: revisar planilha às 9:15 na quarta-feira', { texto: 'Revisar planilha', data: '2026-11-11', hora: '09:15' });
igual('Comprar 2 pães', { texto: 'Comprar 2 pães', hora: '' });
igual('Dormir à meia-noite', { texto: 'Dormir', hora: '00:00' });
igual('', { texto: '', data: '2026-11-09', hora: '' });
igual('Reunião às 31h', { texto: 'Reunião às 31h', hora: '' });

// ---- telefones
assert.deepStrictEqual(A.linksTelefone('(63) 99999-0000'), { tel: 'tel:+5563999990000', whatsapp: 'https://wa.me/5563999990000', digitos: '5563999990000' }); ok('celular com DDD vira +55');
assert.strictEqual(A.linksTelefone('+55 63 3333-0000').digitos, '556333330000'); ok('internacional mantém DDI');
assert.strictEqual(A.linksTelefone('0 41 63 99999-0000').digitos, '5563999990000'); ok('tira 0 + código da operadora');
assert.strictEqual(A.linksTelefone('063 3333-0000').digitos, '556333330000'); ok('tira o 0 do DDD');
assert.strictEqual(A.linksTelefone('+1 (555) 010-0000').digitos, '15550100000'); ok('número de fora sem 55');
assert.strictEqual(A.linksTelefone('190'), null); ok('número curto não vira link');
assert.strictEqual(A.linksTelefone(''), null); ok('vazio');

// ---- Saúde: URL do Atalhos
const url = q => A.lerUrlSaude('agenda-lgrsv://saude?' + q, HOJE);
assert.deepStrictEqual(url('passos=8123&sono=7.5'), { data: '2026-11-09', passos: 8123, sonoMin: 450 }); ok('passos e sono em horas');
assert.deepStrictEqual(url('passos=8.123&sono=7%2C5'), { data: '2026-11-09', passos: 8123, sonoMin: 450 }); ok('milhar com ponto e decimal com vírgula');
assert.deepStrictEqual(url('passos=1200%0A3400%0A500&sonoMin=200%0A250'), { data: '2026-11-09', passos: 5100, sonoMin: 450 }); ok('listas do Atalhos são somadas');
assert.deepStrictEqual(url('data=2026-11-08&sono=7h30'), { data: '2026-11-08', sonoMin: 450 }); ok('data explícita e 7h30');
assert.deepStrictEqual(url('data=ontem&sono=6:45'), { data: '2026-11-08', sonoMin: 405 }); ok('data=ontem e 6:45');
assert.deepStrictEqual(url('sono=7 h 30 min'), { data: '2026-11-09', sonoMin: 450 }); ok('"7 h 30 min"');
assert.deepStrictEqual(url('sono=480'), { data: '2026-11-09', sonoMin: 480 }); ok('sono > 24 é minuto');
assert.strictEqual(url('passos=abc'), null); ok('passos inválidos: nada');
assert.strictEqual(url('passos=999999999'), null); ok('passos absurdos: nada');
assert.strictEqual(url('sono=30h'), null); ok('sono > 24 h: nada');
assert.strictEqual(url('passos=-5'), null); ok('negativo: nada');
assert.strictEqual(A.lerUrlSaude('agenda-lgrsv://', HOJE), null); ok('volta do LocalDevVPN não é Saúde');
assert.strictEqual(A.lerUrlSaude('https://exemplo.invalid/saude?passos=10', HOJE), null); ok('outro esquema: nada');
assert.strictEqual(A.lerUrlSaude('agenda-lgrsv://outra?passos=10', HOJE), null); ok('outro caminho: nada');

// ---- Saúde: mescla e semana (só números agregados por dia)
let est = A.saudeMesclar(null, { data: '2026-11-09', passos: 8000 }, HOJE);
est = A.saudeMesclar(est, { data: '2026-11-09', sonoMin: 420 }, HOJE);
assert.strictEqual(est.dias['2026-11-09'].passos, 8000); assert.strictEqual(est.dias['2026-11-09'].sonoMin, 420); ok('passos e sono do mesmo dia se juntam');
est = A.saudeMesclar(est, { data: '2026-11-09', passos: 9000 }, HOJE);
assert.strictEqual(est.dias['2026-11-09'].passos, 9000); assert.strictEqual(est.dias['2026-11-09'].sonoMin, 420); ok('número novo substitui só o campo dele');
est = A.saudeMesclar(est, { data: '2026-07-01', passos: 1 }, HOJE);
assert.ok(!est.dias['2026-07-01']); ok('mais de 90 dias sai');
assert.deepStrictEqual(Object.keys(est.dias['2026-11-09']).sort(), ['em', 'passos', 'sonoMin']); ok('sem pontos brutos: só passos, sonoMin e carimbo');
est = A.saudeMesclar(est, { data: '2026-11-07', passos: 5000, sonoMin: 360 }, HOJE);
const sem = A.saudeSemana(est, HOJE);
assert.strictEqual(sem.dias.length, 7); assert.strictEqual(sem.dias[0].data, '2026-11-03'); assert.strictEqual(sem.dias[6].data, '2026-11-09');
assert.strictEqual(sem.mediaPassos, 7000); assert.strictEqual(sem.mediaSonoMin, 390); ok('semana: 7 dias e médias só dos dias com número');
assert.deepStrictEqual(A.saudeSemana(null, HOJE).mediaPassos, null); ok('semana vazia');

// ---- permissão negada e app antigo
assert.match(A.mensagemErro({ code: 'SEM_PERMISSAO', message: 'Sem permissão para os contatos. Libere em Ajustes > Agenda > Contatos.' }), /Ajustes > Agenda > Contatos/); ok('permissão negada: diz onde liberar');
assert.match(A.mensagemErro({ code: 'SEM_PERMISSAO' }, 'o calendário'), /o calendário/); ok('permissão negada sem texto');
assert.match(A.mensagemErro({ message: '"AgendaAcesso.contatosBuscar()" is not implemented on ios' }), /Atualize o app/); ok('app antigo: pede atualizar');
assert.match(A.mensagemErro({ code: 'UNIMPLEMENTED' }), /Atualize o app/); ok('UNIMPLEMENTED');
assert.match(A.mensagemErro({ code: 'SEM_MODELO_LOCAL' }), /no aparelho/); ok('sem modelo local');
assert.strictEqual(A.mensagemErro(null), 'Não deu certo. Tente de novo.'); ok('erro vazio');

console.log(`\n${passo} testes passaram.`);
