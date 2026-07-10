/*
  Agenda List Status
  Mostra na lista, de forma explícita, o estado temporal de cada tarefa:
  Atrasada, venceu hoje, hoje, futura ou sem data.
*/
(() => {
  'use strict';

  const STYLE_ID = 'agendaListStatusStyles';
  const BADGE_CLASS = 'agenda-status-badge';

  const esc = value => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  const ensureStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .task-card.agenda-status-late,
      .task-card.agenda-status-due-today {
        border: 1px solid color-mix(in srgb, var(--danger) 42%, var(--line));
        background: linear-gradient(135deg, color-mix(in srgb, var(--danger) 13%, transparent), color-mix(in srgb, var(--surface) 88%, transparent));
        box-shadow: 0 12px 30px rgba(0,0,0,.14), 0 0 0 1px color-mix(in srgb, var(--danger) 10%, transparent) inset;
      }

      .task-card.agenda-status-today {
        border: 1px solid color-mix(in srgb, #ffb74d 38%, var(--line));
        background: linear-gradient(135deg, color-mix(in srgb, #ffb74d 12%, transparent), color-mix(in srgb, var(--surface) 88%, transparent));
      }

      .task-card.agenda-status-next {
        border: 1px solid color-mix(in srgb, var(--accent) 28%, var(--line));
      }

      .${BADGE_CLASS} {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 3px 7px;
        border-radius: 999px;
        border: 1px solid var(--line);
        font-size: 10px;
        font-weight: 850;
        line-height: 1;
        letter-spacing: .01em;
        white-space: nowrap;
      }

      .${BADGE_CLASS}::before {
        content: "";
        width: 6px;
        height: 6px;
        flex: 0 0 auto;
        border-radius: 50%;
        background: currentColor;
      }

      .${BADGE_CLASS}.late,
      .${BADGE_CLASS}.due-today {
        border-color: color-mix(in srgb, var(--danger) 48%, var(--line));
        background: color-mix(in srgb, var(--danger) 15%, transparent);
        color: var(--danger);
      }

      .${BADGE_CLASS}.today {
        border-color: color-mix(in srgb, #ffb74d 52%, var(--line));
        background: color-mix(in srgb, #ffb74d 16%, transparent);
        color: #ffb74d;
      }

      .${BADGE_CLASS}.next {
        border-color: color-mix(in srgb, var(--accent) 46%, var(--line));
        background: color-mix(in srgb, var(--accent) 13%, transparent);
        color: var(--accent);
      }

      .${BADGE_CLASS}.no-date {
        color: var(--muted);
        background: color-mix(in srgb, var(--soft2) 64%, transparent);
      }
    `;
    document.head.appendChild(style);
  };

  const statusMeta = task => {
    switch (task?.agendaStatus) {
      case 'atrasada_dias_anteriores':
        return { cls: 'late', card: 'agenda-status-late', label: 'Atrasada' };
      case 'venceu_hoje':
        return { cls: 'due-today', card: 'agenda-status-due-today', label: 'Venceu hoje' };
      case 'hoje_ainda_no_horario':
        return { cls: 'today', card: 'agenda-status-today', label: task.time ? `Hoje ${task.time}` : 'Hoje' };
      case 'hoje_sem_horario':
        return { cls: 'today', card: 'agenda-status-today', label: 'Hoje' };
      case 'futura':
        return { cls: 'next', card: 'agenda-status-next', label: task.date ? `Futura ${task.date.slice(8,10)}/${task.date.slice(5,7)}` : 'Futura' };
      case 'sem_data':
        return { cls: 'no-date', card: 'agenda-status-no-date', label: 'Sem data' };
      default:
        return null;
    }
  };

  const getTasks = () => {
    try {
      if (window.AgendaAPI?.getTasks) return window.AgendaAPI.getTasks();
      if (window.AgendaIntel?.getTasks) return window.AgendaIntel.getTasks();
    } catch (_) {}
    return [];
  };

  const findTaskForCard = (card, tasks) => {
    const title = card.querySelector('.task-title')?.textContent || '';
    const normalized = esc(title);
    if (!normalized) return null;
    return tasks.find(t => esc(t.text) === normalized) || tasks.find(t => esc(t.text).includes(normalized) || normalized.includes(esc(t.text)));
  };

  const clearCard = card => {
    card.classList.remove('agenda-status-late', 'agenda-status-due-today', 'agenda-status-today', 'agenda-status-next', 'agenda-status-no-date');
    card.querySelectorAll(`.${BADGE_CLASS}`).forEach(el => el.remove());
  };

  const paint = () => {
    ensureStyles();
    const tasks = getTasks().filter(t => t && !t.done);
    const cards = [...document.querySelectorAll('.task-card')];

    for (const card of cards) {
      clearCard(card);
      const task = findTaskForCard(card, tasks);
      const meta = statusMeta(task);
      if (!task || !meta) continue;

      card.classList.add(meta.card);
      const footer = card.querySelector('.task-footer') || card.querySelector('.task-main');
      if (!footer) continue;

      const badge = document.createElement('span');
      badge.className = `${BADGE_CLASS} ${meta.cls}`;
      badge.textContent = meta.label;
      badge.title = task.agendaMotivo || meta.label;
      footer.appendChild(badge);
    }
  };

  let frame = 0;
  const schedulePaint = () => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(paint);
  };

  window.addEventListener('storage', schedulePaint);
  document.addEventListener('click', () => setTimeout(schedulePaint, 80), true);
  document.addEventListener('change', () => setTimeout(schedulePaint, 80), true);

  const observer = new MutationObserver(schedulePaint);
  observer.observe(document.body, { childList: true, subtree: true });

  setInterval(schedulePaint, 60000);
  setTimeout(schedulePaint, 300);
  setTimeout(schedulePaint, 1200);
})();
