/* =========================================================================
   registros-financeiros.js — lançamento manual de SAÍDA não é tarefa.
   O painel financeiro grava lançamentos como "tarefas" (tag financeiro) com
   nota {movimento: 'entrada'|'saida', valor}. Regra combinada com o João:
     • SAÍDA lançada manualmente (ex.: Motel · R$ 206) → some da lista de
       tarefas da agenda; continua existindo no painel financeiro.
     • ENTRADA/cobrança → segue aparecendo e marcável (marcar = recebi).
     • Tarefa financeira comum (sem movimento) → intocada.
   Enhancement puro: esconde os cards após cada render; não apaga nada.
   ========================================================================= */
(() => {
  'use strict';

  const TASK_KEY = 'agenda_lagares_v3';
  const NOTES_KEY = 'agenda_notas_v1';

  const lerTarefas = () => { try { const v = JSON.parse(localStorage.getItem(TASK_KEY)); return Array.isArray(v) ? v : []; } catch (_) { return []; } };
  const lerNotas = () => { try { const v = JSON.parse(localStorage.getItem(NOTES_KEY)); return v && typeof v === 'object' ? v : {}; } catch (_) { return {}; } };

  function ehSaidaManual(id) {
    const notas = lerNotas();
    const n = notas[String(id)] || notas[id];
    if (!n || n.movimento !== 'saida') return false;
    const t = lerTarefas().find(x => String(x.id) === String(id));
    return !!t && t.tag === 'financeiro';
  }
  // Compartilhado com a gamificação (saídas ficam fora do jogo).
  window.__ehSaidaFinanceira = ehSaidaManual;

  function aplicar() {
    document.querySelectorAll('.task-card .check[data-id]').forEach(chk => {
      const card = chk.closest('.task-card');
      if (!card || card.dataset.saidaFin) return;
      if (!ehSaidaManual(chk.dataset.id)) return;
      card.dataset.saidaFin = '1';
      card.style.display = 'none';
    });
  }

  new MutationObserver(aplicar).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aplicar);
  else aplicar();
})();
