/*
  Agenda List Status
  Mostra na lista, de forma explícita, o estado temporal de cada tarefa:
  Atrasadas, hoje, futuras ou sem data — com dia da semana por texto.
*/
(() => {
  'use strict';

  const STYLE_ID = 'agendaListStatusStyles';
  const BADGE_CLASS = 'agenda-status-badge';
  const DAY_NAMES = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

  const esc = value => String(value ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const pad = value => String(value).padStart(2, '0');
  const dateText = iso => {
    if (window.AgendaIntel?.dateLabel) return window.AgendaIntel.dateLabel(iso);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    if (!m) return '';
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
    return `${DAY_NAMES[d.getDay()]}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  };

  const ensureStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .task-card.agenda-status-late {
        border: 1px solid color-mix(in srgb, var(--danger) 42%, var(--line));
        background: linear-gradient(135deg, color-mix(in srgb, var(--danger) 13%, transparent), color-mix(in srgb, var(--surface) 88%, transparent));
        box-shadow: 0 12px 30px rgba(0,0,0,.14), 0 0 0 1px color-mix(in srgb, var(--danger) 10%, transparent) inset;
      }

      .task-card.agenda-status-today,
      .task-card.agenda-status-due-today {
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

      .${BADGE_CLASS}.late {
        border-color: color-mix(in srgb, var(--danger) 48%, var(--line));
        background: color-mix(in srgb, var(--danger) 15%, transparent);
        color: var(--danger);
      }

      .${BADGE_CLASS}.today,
      .${BADGE_CLASS}.due-today {
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
    const d = task?.agendaDataTexto || dateText(task?.date);
    switch (task?.agendaGrupoData) {
      case 'atrasadas':
        return { cls: 'late', card: 'agenda-status-late', label: `Atrasada · ${d}` };
      case 'hoje':
        return { cls: task.agendaStatus === 'venceu_hoje' ? 'due-today' : 'today', card: task.agendaStatus === 'venceu_hoje' ? 'agenda-status-due-today' : 'agenda-status-today', label: task.time ? `Hoje · ${d} · ${task.time}` : `Hoje · ${d}` };
      case 'futuras':
        return { cls: 'next', card: 'agenda-status-next', label: `Futura · ${d}` };
      case 'sem_data':
        return { cls: 'no-date', card: 'agenda-status-no-date', label: 'Sem data' };
      default:
        if (task?.agendaStatus === 'atrasada_dias_anteriores') return { cls: 'late', card: 'agenda-status-late', label: `Atrasada · ${d}` };
        if (/^hoje_|venceu_hoje/.test(String(task?.agendaStatus || ''))) return { cls: 'today', card: 'agenda-status-today', label: task.time ? `Hoje · ${d} · ${task.time}` : `Hoje · ${d}` };
        if (task?.agendaStatus === 'futura') return { cls: 'next', card: 'agenda-status-next', label: `Futura · ${d}` };
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
    const id = card.querySelector('.check[data-id]')?.dataset?.id;
    if (id) {
      const byId = tasks.find(t => String(t.id) === String(id));
      if (byId) return byId;
    }
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
