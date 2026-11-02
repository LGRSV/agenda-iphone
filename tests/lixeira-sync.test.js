/* Sincronização x lixeira: um aparelho atrasado não pode ressuscitar tarefas
   apagadas em outro lugar, e restaurar da lixeira precisa continuar funcionando.
   Roda: node tests/lixeira-sync.test.js (sem dependências) */
'use strict';
const fs = require('fs'), assert = require('assert');
const src = fs.readFileSync(__dirname + '/../supabase-shared-storage.js', 'utf8');
// recorta uma função (ou const arrow) do arquivo contando chaves
function cut(start) {
  const i = src.indexOf(start); assert(i >= 0, 'não achei: ' + start);
  let j = src.indexOf('{', i), depth = 0;
  for (; j < src.length; j++) { if (src[j] === '{') depth++; else if (src[j] === '}' && --depth === 0) break; }
  let end = j + 1; if (src[end] === ';') end++;
  return src.slice(i, end);
}
const store = { trash: [], notes: {} };
const read = k => store[k];
const code = ['function noteSig', 'function collapseDuplicates', 'function trashIdSet', 'function tombstones', 'const enterrada', 'function mergeTasks'].map(cut).join('\n');
const mergeTasks = new Function('read', code + '\nreturn { mergeTasks, tombstones };')(read);

const T0 = 1793000000000;           // antes da exclusão
const APAGOU = 1793100000000;        // momento em que foi para a lixeira (em outro aparelho)
const velha = { id: 'rec-x-2026-11-30', text: 'Mesada', date: '2026-11-30', tag: 'financeiro' };            // sem syncRev
const outra = { id: 'a', text: 'Outra', date: '2026-11-03', tag: 'casa', syncRev: T0 };
const lixeiraServidor = [{ at: APAGOU, task: velha }];

// 1) aparelho atrasado: tem a tarefa local e ainda não baixou a lixeira -> não pode devolver
store.trash = [];
let r = mergeTasks.mergeTasks([velha, outra], [outra], mergeTasks.tombstones(lixeiraServidor));
assert.deepStrictEqual(r.map(t => t.id), ['a'], 'tarefa apagada voltou: ' + JSON.stringify(r.map(t => t.id)));

// 2) servidor já ressuscitado (cópia sem syncRev) e lixeira no servidor -> some no próximo envio
r = mergeTasks.mergeTasks([outra], [outra, velha], mergeTasks.tombstones(lixeiraServidor));
assert.deepStrictEqual(r.map(t => t.id), ['a']);

// 3) restaurar: a restauração grava syncRev novo (depois da exclusão) -> fica
const restaurada = { ...velha, syncRev: APAGOU + 5000 };
r = mergeTasks.mergeTasks([outra, restaurada], [outra], mergeTasks.tombstones(lixeiraServidor));
assert.deepStrictEqual(r.map(t => t.id).sort(), ['a', 'rec-x-2026-11-30']);

// 4) sem lixeira nenhuma: comportamento antigo (união por id, local vence)
store.trash = [];
const editada = { ...outra, text: 'Outra editada', syncRev: T0 + 1 };
r = mergeTasks.mergeTasks([editada], [outra], mergeTasks.tombstones([]));
assert.strictEqual(r.length, 1); assert.strictEqual(r[0].text, 'Outra editada');

// 5) lixeira deste aparelho (formato {task, at}) derruba a cópia do servidor apagada depois da última edição
store.trash = [{ at: APAGOU, task: { id: 'a' } }];
r = mergeTasks.mergeTasks([], [outra], mergeTasks.tombstones([]));
assert.deepStrictEqual(r, []);
// ...mas não derruba se a tarefa foi editada depois de ir para a lixeira
r = mergeTasks.mergeTasks([], [{ ...outra, syncRev: APAGOU + 1 }], mergeTasks.tombstones([]));
assert.strictEqual(r.length, 1);

// 6) lixeira do servidor indisponível (null): não quebra
store.trash = [];
r = mergeTasks.mergeTasks([outra], [outra], mergeTasks.tombstones(null));
assert.strictEqual(r.length, 1);

// 7) restaurar em lixeira.js grava syncRev novo
const lix = fs.readFileSync(__dirname + '/../lixeira.js', 'utf8');
assert(/tasks\.push\(\{ \.\.\.entry\.task, syncRev: Date\.now\(\) \}\)/.test(lix), 'lixeira.js não grava syncRev ao restaurar');
console.log('ok: lixeira x sincronização');
