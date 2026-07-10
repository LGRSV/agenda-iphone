/*
  Agenda Intelligence
  Enriquece as tarefas lidas pelo JARVIS sem alterar o armazenamento original.
  Assim o assistente passa a entender: atrasada, venceu hoje, hoje, futura e sem data.
*/
(() => {
  'use strict';

  const TASK_KEY = 'agenda_lagares_v3';

  const pad = n => String(n).padStart(2, '0');
  const nowParts = () => {
    const n = new Date();
    return {
      now: n,
      iso: `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`,
      time: `${pad(n.getHours())}:${pad(n.getMinutes())}`,
      minutes: n.getHours() * 60 + n.getMinutes()
    };
  };

  const timeToMinutes = value => {
    const m = /^(\d{2}):(\d{2})$/.exec(String(value || '').trim());
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  };

  const readRawTasks = () => {
    try {
      const value = JSON.parse(localStorage.getItem(TASK_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_) {
      return [];
    }
  };

  const isTreino = task => /^🏋/.test(String(task?.text || ''));

  const classify = task => {
    const n = nowParts();
    const date = String(task?.date || '').trim();
    const taskMinutes = timeToMinutes(task?.time);

    if (task?.done) {
      return {
        agendaStatus: 'concluida',
        agendaAtrasada: false,
        agendaPrioridadeTempo: 90,
        agendaMotivo: 'Tarefa já concluída.'
      };
    }

    if (!date) {
      return {
        agendaStatus: 'sem_data',
        agendaAtrasada: false,
        agendaPrioridadeTempo: 50,
        agendaMotivo: 'Tarefa pendente sem data definida.'
      };
    }

    if (date < n.iso) {
      return {
        agendaStatus: 'atrasada_dias_anteriores',
        agendaAtrasada: true,
        agendaPrioridadeTempo: 0,
        agendaMotivo: `A data da tarefa (${date}) é anterior a hoje (${n.iso}).`
      };
    }

    if (date === n.iso && taskMinutes != null && taskMinutes < n.minutes) {
      return {
        agendaStatus: 'venceu_hoje',
        agendaAtrasada: true,
        agendaPrioridadeTempo: 1,
        agendaMotivo: `Era para hoje às ${task.time}, mas agora já são ${n.time}.`
      };
    }

    if (date === n.iso && taskMinutes != null) {
      return {
        agendaStatus: 'hoje_ainda_no_horario',
        agendaAtrasada: false,
        agendaPrioridadeTempo: 10 + taskMinutes,
        agendaMotivo: `Tarefa marcada para hoje às ${task.time}.`
      };
    }

    if (date === n.iso) {
      return {
        agendaStatus: 'hoje_sem_horario',
        agendaAtrasada: false,
        agendaPrioridadeTempo: 20,
        agendaMotivo: 'Tarefa marcada para hoje, sem horário definido.'
      };
    }

    return {
      agendaStatus: 'futura',
      agendaAtrasada: false,
      agendaPrioridadeTempo: 70,
      agendaMotivo: `Tarefa futura marcada para ${date}.`
    };
  };

  const enrichTask = task => ({ ...task, ...classify(task) });

  const getEnrichedTasks = () => readRawTasks().map(enrichTask);

  const summarize = () => {
    const tasks = getEnrichedTasks().filter(t => !t.done && !isTreino(t));
    const counts = tasks.reduce((acc, task) => {
      acc[task.agendaStatus] = (acc[task.agendaStatus] || 0) + 1;
      if (task.agendaAtrasada) acc.totalAtrasadas += 1;
      return acc;
    }, { totalAtrasadas: 0 });

    return {
      agora: nowParts().iso + ' ' + nowParts().time,
      totalPendentes: tasks.length,
      totalAtrasadas: counts.totalAtrasadas,
      porStatus: counts,
      atrasadas: tasks.filter(t => t.agendaAtrasada).sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.time || '').localeCompare(String(b.time || ''))),
      proximas: tasks.filter(t => !t.agendaAtrasada && /^hoje_/.test(t.agendaStatus)).sort((a, b) => String(a.time || '99:99').localeCompare(String(b.time || '99:99')))
    };
  };

  const install = () => {
    if (!window.AgendaAPI || window.AgendaAPI.__intelWrapped) return false;

    const api = window.AgendaAPI;
    const originalGetTasks = typeof api.getTasks === 'function' ? api.getTasks.bind(api) : null;

    api.getTasksRaw = originalGetTasks || readRawTasks;
    api.getTasks = () => {
      try {
        const base = originalGetTasks ? originalGetTasks() : readRawTasks();
        return Array.isArray(base) ? base.map(enrichTask) : [];
      } catch (_) {
        return getEnrichedTasks();
      }
    };
    api.getAgendaIntelligence = summarize;
    api.__intelWrapped = true;
    return true;
  };

  if (!install()) {
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      if (install() || attempts > 40) clearInterval(timer);
    }, 250);
  }

  window.AgendaIntel = {
    classify,
    getTasks: getEnrichedTasks,
    summarize
  };
})();
