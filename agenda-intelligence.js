/*
  Agenda Intelligence
  Enriquece as tarefas lidas pelo JARVIS sem alterar o armazenamento original.
  Regra central: atrasadas = datas anteriores a hoje; hoje = somente hoje; futuras = depois de hoje.
*/
(() => {
  'use strict';

  const TASK_KEY = 'agenda_lagares_v3';
  const DAY_NAMES = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

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

  const parseLocalDate = iso => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '').trim());
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  };

  const dateLabel = iso => {
    const d = parseLocalDate(iso);
    if (!d) return '';
    return `${DAY_NAMES[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
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

  const isTreino = task => /^(🏋️?|treino\b)/i.test(String(task?.text || '').trim());

  const baseMeta = (task, group, status, atrasada, motivo, prioridade) => {
    const date = String(task?.date || '').trim();
    return {
      agendaGrupoData: group,
      agendaStatus: status,
      agendaAtrasada: atrasada,
      agendaPrioridadeTempo: prioridade,
      agendaMotivo: motivo,
      agendaDataTexto: dateLabel(date),
      agendaEhTreino: isTreino(task)
    };
  };

  const classify = task => {
    const n = nowParts();
    const date = String(task?.date || '').trim();
    const taskMinutes = timeToMinutes(task?.time);

    if (task?.done) {
      return baseMeta(task, 'concluidas', 'concluida', false, 'Tarefa já concluída.', 90);
    }

    if (!date) {
      return baseMeta(task, 'sem_data', 'sem_data', false, 'Tarefa pendente sem data definida.', 50);
    }

    if (date < n.iso) {
      return baseMeta(task, 'atrasadas', 'atrasada_dias_anteriores', true, `A data da tarefa (${dateLabel(date)}) é anterior a hoje (${dateLabel(n.iso)}).`, 0);
    }

    if (date === n.iso) {
      if (taskMinutes != null && taskMinutes < n.minutes) {
        return baseMeta(task, 'hoje', 'venceu_hoje', false, `É uma tarefa de hoje (${dateLabel(date)}) às ${task.time}; o horário já passou, mas ela continua no grupo de hoje.`, 10 + taskMinutes);
      }
      if (taskMinutes != null) {
        return baseMeta(task, 'hoje', 'hoje_ainda_no_horario', false, `Tarefa marcada para hoje (${dateLabel(date)}) às ${task.time}.`, 10 + taskMinutes);
      }
      return baseMeta(task, 'hoje', 'hoje_sem_horario', false, `Tarefa marcada para hoje (${dateLabel(date)}), sem horário definido.`, 20);
    }

    return baseMeta(task, 'futuras', 'futura', false, `Tarefa futura marcada para ${dateLabel(date)}.`, 70);
  };

  const enrichTask = task => ({ ...task, ...classify(task) });

  const getEnrichedTasks = () => readRawTasks().map(enrichTask);

  const byDateTime = (a, b) => String(a.date || '').localeCompare(String(b.date || '')) || String(a.time || '99:99').localeCompare(String(b.time || '99:99'));

  const summarize = () => {
    const tasks = getEnrichedTasks().filter(t => !t.done);
    const agendaTasks = tasks.filter(t => !t.agendaEhTreino);
    const treinos = tasks.filter(t => t.agendaEhTreino);
    const make = list => ({
      atrasadas: list.filter(t => t.agendaGrupoData === 'atrasadas').sort(byDateTime),
      hoje: list.filter(t => t.agendaGrupoData === 'hoje').sort(byDateTime),
      futuras: list.filter(t => t.agendaGrupoData === 'futuras').sort(byDateTime),
      semData: list.filter(t => t.agendaGrupoData === 'sem_data').sort(byDateTime)
    });
    const agenda = make(agendaTasks);
    const treino = make(treinos);

    return {
      agora: nowParts().iso + ' ' + nowParts().time,
      hojeTexto: dateLabel(nowParts().iso),
      totalPendentes: agendaTasks.length,
      totalAtrasadas: agenda.atrasadas.length,
      totalHoje: agenda.hoje.length,
      totalFuturas: agenda.futuras.length,
      agenda,
      treinos: treino,
      porStatus: {
        atrasadas: agenda.atrasadas.length,
        hoje: agenda.hoje.length,
        futuras: agenda.futuras.length,
        semData: agenda.semData.length,
        treinosAtrasados: treino.atrasadas.length,
        treinosHoje: treino.hoje.length,
        treinosFuturos: treino.futuras.length
      },
      atrasadas: agenda.atrasadas,
      proximas: agenda.hoje
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
    summarize,
    dateLabel
  };
})();
