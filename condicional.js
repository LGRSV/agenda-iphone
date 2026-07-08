/* =========================================================================
   condicional.js — tarefas condicionais estilo "case" (Power Automate).
   Cada tarefa pode ter, na sua caixinha de notas, dois ramos:
     • "Se eu concluir"     -> cria a tarefa-alvo quando a origem é concluída.
     • "Se não acontecer"   -> cria a tarefa-alvo quando a data passa sem concluir.
   Os ramos ficam guardados em agenda_notas_v1[id].cond e disparam só uma vez
   (flags thenFired / elseFired). Não toca no núcleo do app: cria as tarefas
   via window.AgendaAPI.addTask, então salva e re-renderiza sozinho.
   ========================================================================= */
(() => {
  'use strict';

  const TASK_KEY = 'agenda_lagares_v3';
  const NOTES_KEY = 'agenda_notas_v1';

  const loadJSON = key => { try { return JSON.parse(localStorage.getItem(key)); } catch (_) { return null; } };
  function todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const isDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

  function run() {
    const api = window.AgendaAPI;
    const tasks = loadJSON(TASK_KEY);
    const notes = loadJSON(NOTES_KEY);
    if (!Array.isArray(tasks) || !notes || typeof notes !== 'object') return;

    const t0 = todayStr();
    let notesChanged = false;

    const isTime = s => /^\d{2}:\d{2}$/.test(String(s || ''));
    const alreadyOpen = (text, date) => tasks.some(t => !t.done && t.text === text && t.date === date);
    function createFollow(text, date, tag, time) {
      const base = isDate(date) ? date : t0;
      const d = base < t0 ? t0 : base; // se a data já passou, agenda para hoje (dia da detecção)
      const hm = isTime(time) ? time : '';
      if (alreadyOpen(text, d)) return; // evita duplicar
      if (api && typeof api.addTask === 'function') {
        api.addTask({ text, date: d, time: hm, tag: tag || 'pessoal' });
      } else {
        tasks.push({ id: 'cond-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), text, date: d, time: hm, tag: tag || 'pessoal', reminder: hm ? 0 : -1, done: false });
        localStorage.setItem(TASK_KEY, JSON.stringify(tasks));
      }
    }

    Object.keys(notes).forEach(id => {
      const note = notes[id];
      const cond = note && note.cond;
      if (!cond) return;
      const task = tasks.find(t => String(t.id) === String(id));
      if (!task) return;

      // Ramo "concluir": origem marcada como feita.
      if (task.done && String(cond.thenText || '').trim() && !cond.thenFired) {
        createFollow(cond.thenText.trim(), cond.thenDate || task.date, task.tag, cond.thenTime);
        cond.thenFired = true; notesChanged = true;
      }
      // Ramo "não acontecer": não concluída e a data já passou.
      if (!task.done && String(cond.elseText || '').trim() && !cond.elseFired && isDate(task.date) && task.date < t0) {
        createFollow(cond.elseText.trim(), cond.elseDate || t0, task.tag, cond.elseTime);
        cond.elseFired = true; notesChanged = true;
      }
    });

    if (notesChanged) localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  }

  function boot() {
    if (!window.AgendaAPI) { setTimeout(boot, 300); return; }
    run();
    // Ao marcar/desmarcar uma tarefa, reavalia os ramos condicionais.
    document.addEventListener('change', e => {
      if (e.target && e.target.matches && e.target.matches('.check[data-action="toggle"]')) setTimeout(run, 140);
    }, true);
    // Reavalia quando o app volta ao foco (para pegar virada de dia).
    document.addEventListener('visibilitychange', () => { if (!document.hidden) run(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
