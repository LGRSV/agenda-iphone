/* lembrete-persistente.js — lembretes que insistem até a tarefa ser feita.

   Como funciona: uma tarefa "satélite" ganha, na sua nota, o campo
   `lembreteDe` apontando para o id da tarefa principal. Enquanto a principal
   estiver pendente, o satélite continua na agenda e o push do servidor toca
   normalmente. Assim que a principal é concluída, este script conclui os
   satélites — e o cron do servidor ignora tarefa concluída, então os avisos
   que ainda não chegaram simplesmente param.

   Funciona em qualquer par de tarefas, não só na receita: basta a nota do
   satélite ter `lembreteDe`. */
(() => {
  'use strict';

  const TK = 'agenda_lagares_v3';
  const NK = 'agenda_notas_v1';

  const read = (key, fallback) => {
    try { const v = JSON.parse(localStorage.getItem(key) || ''); return v ?? fallback; }
    catch (_) { return fallback; }
  };

  function ciclo() {
    const tarefas = read(TK, []);
    const notas = read(NK, {});
    if (!Array.isArray(tarefas) || !notas || typeof notas !== 'object') return;

    // ids das tarefas já concluídas
    const concluidas = new Set(
      tarefas.filter(t => t && t.done && t.id != null).map(t => String(t.id))
    );
    if (!concluidas.size) return;

    let mudou = false;
    tarefas.forEach(t => {
      if (!t || t.done || t.id == null) return;
      const pai = String((notas[t.id] || {}).lembreteDe || '');
      if (!pai || !concluidas.has(pai)) return;
      t.done = true;
      // vence a cópia local antiga de outro aparelho na sincronização
      t.syncRev = Date.now();
      mudou = true;
    });

    if (!mudou) return;
    localStorage.setItem(TK, JSON.stringify(tarefas));
    // acorda a agenda para redesenhar (e o storage-patch cuida do envio)
    try { window.dispatchEvent(new CustomEvent('agenda:remote-sync', { detail: { documentKey: 'tasks' } })); }
    catch (_) {}
  }

  // roda ao abrir, logo após qualquer marcação, ao voltar ao app e de tempos em tempos
  const agenda = () => setTimeout(ciclo, 400);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', agenda);
  else agenda();
  document.addEventListener('change', event => {
    const alvo = event.target;
    if (alvo && alvo.matches && alvo.matches('.task-card .check[data-id], #list .row input.check[data-i]')) agenda();
  }, true);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ciclo(); });
  setInterval(ciclo, 60000);
})();
