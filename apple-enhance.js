(() => {
  const TASK_KEY = 'agenda_lagares_v3';
  const CONFIG_KEY = 'agenda_lagares_config_v1';
  const $ = selector => document.querySelector(selector);
  const esc = value => {
    const element = document.createElement('div');
    element.textContent = value || '';
    return element.innerHTML;
  };
  const iso = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const dateOf = value => {
    const [year, month, day] = String(value).split('-').map(Number);
    return new Date(year, month - 1, day);
  };
  const mins = time => /^\d\d:\d\d$/.test(time || '') ? Number(time.slice(0, 2)) * 60 + Number(time.slice(3)) : null;
  const safe = (key, fallback) => {
    try { return JSON.parse(localStorage.getItem(key) || '') || fallback; }
    catch { return fallback; }
  };
  const cap = value => value ? value[0].toUpperCase() + value.slice(1) : value;

  const style = document.createElement('style');
  style.id = 'apple-enhance-style';
  style.textContent = `
    :root{--apple-ease:cubic-bezier(.22,.61,.36,1)}
    .tools #agendaSequentialBtn{font-size:0;position:relative;overflow:hidden}
    .tools #agendaSequentialBtn svg{width:21px;height:21px;stroke:currentColor;stroke-width:2;fill:none;stroke-linecap:round;stroke-linejoin:round}
    .round,.icon,.tabs button,.daycell,.stat,.eventcard,.wevent,.week-day,.group,.fab{transition:transform .2s var(--apple-ease),background .2s ease,border-color .2s ease,box-shadow .2s ease,opacity .2s ease}
    .round:active,.icon:active,.tabs button:active,.daycell:active,.stat:active,.fab:active{transform:scale(.93)}
    #calendarBody.apple-motion,#dayDetail.apple-motion{animation:appleCalendarIn .34s var(--apple-ease) both}
    #calendarBody.apple-from-left{animation-name:appleFromLeft}
    #calendarBody.apple-from-right{animation-name:appleFromRight}
    #calendarBody .daycell{animation:appleCascade .34s var(--apple-ease) both;animation-delay:calc(min(var(--apple-index,0),18) * 11ms)}
    #calendarBody .eventcard,#calendarBody .wevent,#calendarBody .group{animation:appleCascade .30s var(--apple-ease) both;animation-delay:calc(min(var(--apple-index,0),12) * 18ms)}
    .daycell:hover{background:color-mix(in srgb,var(--accent-soft) 62%,transparent)}
    .eventcard:hover,.wevent:hover{transform:translateY(-1px);box-shadow:0 5px 15px rgba(0,0,0,.13)}
    @keyframes appleCalendarIn{from{opacity:.01;transform:translateY(9px) scale(.992)}to{opacity:1;transform:none}}
    @keyframes appleFromLeft{from{opacity:.01;transform:translateX(-24px)}to{opacity:1;transform:none}}
    @keyframes appleFromRight{from{opacity:.01;transform:translateX(24px)}to{opacity:1;transform:none}}
    @keyframes appleCascade{from{opacity:.01;transform:translateY(8px) scale(.985)}to{opacity:1;transform:none}}
    #appleSchedule{position:fixed;z-index:90;inset:0;display:flex;align-items:flex-end;background:rgba(0,0,0,.56);backdrop-filter:blur(5px);opacity:0;pointer-events:none;transition:opacity .26s ease}
    #appleSchedule.open{opacity:1;pointer-events:auto}
    .as-sheet{width:100%;max-height:95dvh;display:flex;flex-direction:column;border-radius:25px 25px 0 0;background:var(--bg);color:var(--ink);transform:translateY(32px);transition:transform .34s var(--apple-ease)}
    #appleSchedule.open .as-sheet{transform:translateY(0)}
    .as-grab{width:42px;height:4px;margin:9px auto 2px;border-radius:99px;background:var(--line)}
    .as-head{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 16px 12px;border-bottom:1px solid var(--line);background:var(--surface)}
    .as-head h2{margin:0;font-size:22px;letter-spacing:-.04em}.as-head p{margin:3px 0 0;color:var(--muted);font-size:12px}
    .as-close{display:grid;place-items:center;width:36px;height:36px;border:1px solid var(--line);border-radius:50%;background:var(--surface2);color:var(--ink);font-size:23px;line-height:1}
    .as-search{display:flex;gap:8px;padding:10px 14px;background:var(--surface)}
    .as-search input{flex:1;min-height:40px;padding:0 12px;border:1px solid var(--line);border-radius:12px;background:var(--surface2);color:var(--ink);outline:none}
    .as-filters{display:flex;gap:7px;overflow:auto;padding:0 14px 10px;background:var(--surface)}
    .as-filters button{flex:0 0 auto;min-height:32px;padding:0 10px;border:1px solid var(--line);border-radius:999px;background:var(--surface2);color:var(--muted);font-size:12px;font-weight:800}
    .as-filters button.active{border-color:var(--accent);background:var(--accent);color:#fff}
    .as-list{overflow:auto;padding:12px 14px calc(26px + env(safe-area-inset-bottom));scroll-behavior:smooth}
    .as-day{position:relative;padding:0 0 17px 23px}.as-day:before{content:"";position:absolute;top:34px;bottom:-4px;left:7px;width:1px;background:var(--line)}.as-day:last-child:before{display:none}
    .as-dayhead{position:relative;margin:0 0 8px -23px;padding-left:23px}.as-dayhead:before{content:"";position:absolute;left:2px;top:6px;width:11px;height:11px;border:2px solid var(--accent);border-radius:50%;background:var(--bg)}.as-dayhead b{font-size:15px}.as-dayhead span{display:block;margin-top:2px;color:var(--muted);font-size:11px}
    .as-event{position:relative;display:grid;grid-template-columns:47px 1fr 39px;gap:8px;align-items:start;margin:0 0 7px;padding:10px;border-left:4px solid var(--event,#0a84ff);border-radius:12px;background:var(--surface);box-shadow:0 3px 10px rgba(0,0,0,.08);animation:appleCascade .32s var(--apple-ease) both;animation-delay:calc(min(var(--apple-index,0),15) * 18ms)}
    .as-event.done{opacity:.6}.as-event.done .as-title{text-decoration:line-through}.as-time{padding-top:3px;color:var(--muted);font-size:11px;font-weight:800}.as-title{font-size:13px;font-weight:800;line-height:1.35}.as-meta{margin-top:3px;color:var(--muted);font-size:11px;line-height:1.35}.as-edit{min-height:31px;border:1px solid var(--line);border-radius:8px;background:var(--surface2);color:var(--ink);font-size:11px;font-weight:800}.as-empty{padding:36px 18px;text-align:center;color:var(--muted);font-size:13px}.as-empty b{display:block;margin-bottom:5px;color:var(--ink)}
  `;
  document.head.append(style);

  function normalize(item) {
    if (!item || !item.text) return null;
    let date = item.date;
    if (!date && item.day) {
      const [day, month] = String(item.day).split('/').map(Number);
      if (day && month) date = `2026-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    if (!date) return null;
    return {
      id: String(item.id || ''),
      text: String(item.text),
      notes: String(item.notes || ''),
      date: String(date),
      time: /^\d\d:\d\d$/.test(item.time || '') ? item.time : '',
      duration: Math.max(5, Number(item.duration) || 60),
      allDay: Boolean(item.allDay),
      kind: item.kind === 'event' ? 'event' : 'task',
      calendar: item.calendar || calendarId(item.category),
      priority: item.priority || 'normal',
      done: Boolean(item.done),
      alert: Number.isFinite(Number(item.alert)) ? Number(item.alert) : 15,
      repeat: ['daily','weekdays','weekly','monthly','yearly'].includes(item.repeat) ? item.repeat : 'none',
      repeatUntil: item.repeatUntil || ''
    };
  }

  function calendarId(value) {
    const v = String(value || '').toLowerCase();
    if (/trabalho|energisa/.test(v)) return 'work';
    if (/casa/.test(v)) return 'home';
    if (/saúde|saude/.test(v)) return 'health';
    if (/finance/.test(v)) return 'finance';
    if (/faculdade/.test(v)) return 'college';
    return 'personal';
  }

  function getConfig() {
    const raw = safe(CONFIG_KEY, {});
    const calendars = Array.isArray(raw.calendars) && raw.calendars.length ? raw.calendars : [
      { id:'work', name:'Trabalho', color:'#0a84ff' }, { id:'personal', name:'Pessoal', color:'#bf5af2' },
      { id:'home', name:'Casa', color:'#64d2ff' }, { id:'health', name:'Saúde', color:'#30d158' },
      { id:'finance', name:'Financeiro', color:'#ff9f0a' }, { id:'college', name:'Faculdade', color:'#ff375f' }
    ];
    const visible = raw.visible || {};
    calendars.forEach(calendar => { if (visible[calendar.id] === undefined) visible[calendar.id] = true; });
    return { calendars, visible, routineEnabled: raw.routineEnabled !== false, morningStart: raw.morningStart || raw.ms || '07:30', morningEnd: raw.morningEnd || raw.me || '11:30', afternoonStart: raw.afternoonStart || raw.as || '13:30', afternoonEnd: raw.afternoonEnd || raw.ae || '17:30' };
  }

  function occurs(task, date) {
    if (date < task.date || (task.repeatUntil && date > task.repeatUntil)) return false;
    if (task.repeat === 'none') return date === task.date;
    const start = dateOf(task.date), current = dateOf(date);
    if (task.repeat === 'daily') return true;
    if (task.repeat === 'weekdays') return current.getDay() > 0 && current.getDay() < 6;
    if (task.repeat === 'weekly') return start.getDay() === current.getDay();
    if (task.repeat === 'monthly') return start.getDate() === current.getDate();
    if (task.repeat === 'yearly') return start.getDate() === current.getDate() && start.getMonth() === current.getMonth();
    return false;
  }

  function formatDay(date) {
    const value = dateOf(date);
    return {
      title: cap(value.toLocaleDateString('pt-BR', { weekday:'long', day:'2-digit', month:'long' })),
      short: cap(value.toLocaleDateString('pt-BR', { day:'2-digit', month:'short' }))
    };
  }

  function buildOccurrences(days, state) {
    const config = getConfig();
    const tasks = safe(TASK_KEY, []).map(normalize).filter(Boolean);
    const byCalendar = id => config.calendars.find(calendar => calendar.id === id) || config.calendars[1];
    const output = [];
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    for (let index = 0; index < days; index++) {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const dateKey = iso(date);
      let entries = tasks
        .filter(task => config.visible[task.calendar] !== false && occurs(task, dateKey))
        .map(task => ({ ...task, occurrence: dateKey, recurring: task.repeat !== 'none', calendarInfo: byCalendar(task.calendar) }));

      if (state.routine && config.routineEnabled && date.getDay() > 0 && date.getDay() < 6) {
        entries = entries.concat([
          { id:'routine-am-' + dateKey, text:'Energisa Tocantins', notes:'Expediente da manhã', occurrence:dateKey, time:config.morningStart, duration:0, allDay:false, kind:'routine', calendarInfo:{name:'Rotina',color:'#64a8ff'} },
          { id:'routine-lunch-' + dateKey, text:'Almoço', notes:'Intervalo', occurrence:dateKey, time:config.morningEnd, duration:0, allDay:false, kind:'routine', calendarInfo:{name:'Rotina',color:'#64a8ff'} },
          { id:'routine-pm-' + dateKey, text:'Energisa Tocantins', notes:'Expediente da tarde', occurrence:dateKey, time:config.afternoonStart, duration:0, allDay:false, kind:'routine', calendarInfo:{name:'Rotina',color:'#64a8ff'} }
        ]);
      }

      entries = entries.filter(entry => {
        const text = `${entry.text} ${entry.notes || ''} ${entry.calendarInfo?.name || ''}`.toLowerCase();
        if (state.query && !text.includes(state.query.toLowerCase())) return false;
        if (state.filter === 'pending') return entry.kind === 'task' && !entry.done;
        if (state.filter === 'done') return entry.kind === 'task' && entry.done;
        return true;
      }).sort((a, b) => (a.allDay === b.allDay ? (mins(a.time) ?? 9999) - (mins(b.time) ?? 9999) : a.allDay ? -1 : 1));

      if (entries.length) output.push({ date: dateKey, entries });
    }
    return output;
  }

  function addSequentialButton() {
    const tools = $('.tools');
    if (!tools || $('#agendaSequentialBtn')) return;
    const button = document.createElement('button');
    button.id = 'agendaSequentialBtn';
    button.className = 'icon';
    button.title = 'Agenda sequencial';
    button.setAttribute('aria-label', 'Agenda sequencial');
    button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 6h11"></path><path d="M8 12h11"></path><path d="M8 18h11"></path><path d="M4.5 6h.01"></path><path d="M4.5 12h.01"></path><path d="M4.5 18h.01"></path></svg>';
    button.addEventListener('click', openSequential);
    tools.prepend(button);
  }

  const overlay = document.createElement('section');
  overlay.id = 'appleSchedule';
  overlay.innerHTML = `
    <div class="as-sheet" role="dialog" aria-modal="true" aria-label="Agenda sequencial">
      <div class="as-grab"></div>
      <header class="as-head"><div><h2>Agenda</h2><p>Próximos 90 dias em ordem cronológica</p></div><button class="as-close" aria-label="Fechar">×</button></header>
      <div class="as-search"><input id="asQuery" placeholder="Buscar na agenda"></div>
      <div class="as-filters">
        <button class="active" data-as-filter="all">Todos</button>
        <button data-as-filter="pending">Pendentes</button>
        <button data-as-filter="done">Concluídas</button>
        <button data-as-routine="false">Rotina</button>
      </div>
      <div class="as-list" id="asList"></div>
    </div>`;
  document.body.append(overlay);

  const sequenceState = { filter:'all', query:'', routine:false };

  function renderSequential() {
    const list = $('#asList');
    const groups = buildOccurrences(90, sequenceState);
    if (!groups.length) {
      list.innerHTML = '<div class="as-empty"><b>Nenhum evento encontrado</b>Ajuste a busca ou o filtro.</div>';
      return;
    }
    let counter = 0;
    list.innerHTML = groups.map(group => {
      const day = formatDay(group.date);
      return `<section class="as-day"><header class="as-dayhead"><b>${day.title}</b><span>${group.entries.length} item(ns)</span></header>${group.entries.map(entry => {
        const done = entry.kind === 'task' && entry.done;
        const time = entry.allDay || !entry.time ? 'Dia todo' : entry.time;
        const recurring = entry.recurring ? ' · Recorrente' : '';
        const calendar = entry.calendarInfo?.name || '';
        const eventColor = entry.calendarInfo?.color || '#0a84ff';
        const index = counter++;
        return `<article class="as-event ${done ? 'done' : ''}" style="--event:${eventColor};--apple-index:${index}">
          <div class="as-time">${time}</div>
          <div><div class="as-title">${esc(entry.text)}${entry.kind === 'task' && !done ? ' <span style="color:var(--orange)">⚑</span>' : ''}</div><div class="as-meta">${esc(calendar)}${recurring}${entry.notes ? ' · ' + esc(entry.notes) : ''}</div></div>
          ${entry.kind === 'routine' ? '<span></span>' : `<button class="as-edit" data-edit="${entry.id}">Editar</button>`}
        </article>`;
      }).join('')}</section>`;
    }).join('');
  }

  function openSequential() {
    sequenceState.filter = 'all';
    sequenceState.query = '';
    sequenceState.routine = false;
    $('#asQuery').value = '';
    overlay.querySelectorAll('[data-as-filter]').forEach(button => button.classList.toggle('active', button.dataset.asFilter === 'all'));
    const routine = overlay.querySelector('[data-as-routine]');
    routine.dataset.asRoutine = 'false';
    routine.classList.remove('active');
    renderSequential();
    overlay.classList.add('open');
  }

  function closeSequential() { overlay.classList.remove('open'); }

  overlay.querySelector('.as-close').addEventListener('click', closeSequential);
  overlay.addEventListener('click', event => {
    if (event.target === overlay) closeSequential();
    const filter = event.target.closest('[data-as-filter]');
    if (filter) {
      sequenceState.filter = filter.dataset.asFilter;
      overlay.querySelectorAll('[data-as-filter]').forEach(button => button.classList.toggle('active', button === filter));
      renderSequential();
    }
    const routine = event.target.closest('[data-as-routine]');
    if (routine) {
      sequenceState.routine = !sequenceState.routine;
      routine.dataset.asRoutine = String(sequenceState.routine);
      routine.classList.toggle('active', sequenceState.routine);
      renderSequential();
    }
    const edit = event.target.closest('.as-edit[data-edit]');
    if (edit) {
      closeSequential();
      setTimeout(() => edit.click(), 0);
    }
  });
  $('#asQuery').addEventListener('input', event => { sequenceState.query = event.target.value; renderSequential(); });

  function animate(direction = '') {
    const calendar = $('#calendarBody');
    const detail = $('#dayDetail');
    if (!calendar) return;
    [calendar, detail].filter(Boolean).forEach(element => {
      element.classList.remove('apple-motion', 'apple-from-left', 'apple-from-right');
      void element.offsetWidth;
      element.classList.add('apple-motion');
      if (direction) element.classList.add(direction === 'left' ? 'apple-from-left' : 'apple-from-right');
    });
    calendar.querySelectorAll('.daycell,.eventcard,.wevent,.group').forEach((element, index) => element.style.setProperty('--apple-index', index));
  }

  function setupMotion() {
    const body = $('#calendarBody');
    if (!body) return;
    let direction = '';
    $('#previous')?.addEventListener('click', () => { direction = 'left'; }, true);
    $('#next')?.addEventListener('click', () => { direction = 'right'; }, true);
    document.querySelectorAll('.tabs button').forEach(button => button.addEventListener('click', () => { direction = ''; }));
    new MutationObserver(() => {
      requestAnimationFrame(() => {
        animate(direction);
        direction = '';
      });
    }).observe(body, { childList:true });

    let startX = 0, startY = 0;
    body.addEventListener('touchstart', event => {
      if (event.target.closest('.weekscroll,.as-list')) return;
      startX = event.touches[0].clientX;
      startY = event.touches[0].clientY;
    }, { passive:true });
    body.addEventListener('touchend', event => {
      const dx = event.changedTouches[0].clientX - startX;
      const dy = event.changedTouches[0].clientY - startY;
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy)) return;
      if (dx < 0) $('#next')?.click(); else $('#previous')?.click();
    }, { passive:true });
    animate();
  }

  function init() {
    addSequentialButton();
    setupMotion();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once:true });
  else init();
})();