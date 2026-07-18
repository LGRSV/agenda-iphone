/* =========================================================================
   sequencial.js — Modo Sequência (foco gamificado) da Agenda Lagares.

   O que entrega:
   • Um cronômetro/relógio ao lado do menu (hambúrguer) que ativa o modo.
   • Uma aba "Sequência" logo após "Lista" que abre a mesma tela de foco.
   • Uma tela cheia que mostra a SEQUÊNCIA de atividades do dia em tempo real:
       - relógio ao vivo + cronômetro da sessão + cronômetro da tarefa atual;
       - a tarefa atual em destaque, as próximas em ordem e as concluídas;
       - ao concluir uma tarefa você GANHA XP (mesma tabela da Gamificação),
         com nível, barra de progresso e feedback de "+XP";
       - estado de conclusão quando não sobra mais nada ("terminou").

   Autocontido: não altera o núcleo da agenda. Lê/escreve o mesmo
   localStorage (agenda_lagares_v3 / agenda_notas_v1) e avisa o app com o
   evento 'agenda:remote-sync' para ele re-renderizar e sincronizar sozinho.
   Todos os ícones são SVGs lineares próprios (sem emojis do sistema).
   ========================================================================= */
(() => {
  'use strict';

  const TASK_KEY = 'agenda_lagares_v3';
  const NOTES_KEY = 'agenda_notas_v1';
  const STYLE_ID = 'agendaSeqStyles';
  const OVERLAY_ID = 'seqOverlay';
  const TIMER_BTN_ID = 'seqTimerBtn';
  const TAB_ID = 'seqViewTab';
  const SESSION_XP_KEY = 'agenda_seq_session_v1';

  /* ---- Ícones lineares próprios ---- */
  const ICONS = {
    stopwatch: '<svg viewBox="0 0 24 24"><path d="M9.5 2.5h5"/><circle cx="12" cy="13.5" r="8"/><path d="M12 9.5v4l2.6 1.6"/><path d="M18.8 7.2l1.4-1.4"/></svg>',
    bolt: '<svg viewBox="0 0 24 24"><path d="M13.5 2 5 13h7l-1.5 9L19 11h-7z"/></svg>',
    check: '<svg viewBox="0 0 24 24"><path d="M4 12.5 9 17.5 20 6.5"/></svg>',
    clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></svg>',
    flame: '<svg viewBox="0 0 24 24"><path d="M13.5 3.5c.7 3.3-1.4 4.5-2.1 6.5-.5 1.4.1 2.5 1.4 3.2-.1-2.1 1-3.6 2.6-5 1.5 2 3.1 4.5 3.1 7.2A6.5 6.5 0 0 1 5.5 15c0-3.7 2.2-6.4 5.1-8.8-.1 2 .6 3.4 1.7 4.1"/></svg>',
    arrow: '<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    trophy: '<svg viewBox="0 0 24 24"><path d="M8 4h8v4.5c0 3-1.6 5.2-4 5.2s-4-2.2-4-5.2V4Z"/><path d="M8 6H5.5v1.5c0 2.4 1.4 3.8 3.5 4M16 6h2.5v1.5c0 2.4-1.4 3.8-3.5 4M12 13.7V17M8.5 20h7M10 17h4"/></svg>',
    play: '<svg viewBox="0 0 24 24"><path d="M8 5.5v13l11-6.5z"/></svg>',
    skip: '<svg viewBox="0 0 24 24"><path d="M6 5.5v13l9-6.5zM17 5.5v13"/></svg>'
  };

  const TAGS = {
    trabalho: { label: 'Trabalho', color: '#4db6f4' }, pessoal: { label: 'Pessoal', color: '#bb86fc' },
    casa: { label: 'Casa', color: '#71d6be' }, faculdade: { label: 'Faculdade', color: '#ffb74d' },
    saude: { label: 'Academia', color: '#78d88b' }, financeiro: { label: 'Financeiro', color: '#ff7f91' },
    outros: { label: 'Outros', color: '#aab3c2' }
  };
  const tagMeta = tag => TAGS[tag] || TAGS.outros;

  /* ---- XP: mesma regra da Gamificação (mantém o placar coerente) ---- */
  const XP_TAGS = { trabalho: 25, faculdade: 30, saude: 20, financeiro: 15, pessoal: 10, casa: 10, outros: 10 };
  const XP_BONUS = [[50, t => t.includes('jarvis')], [40, t => t.includes('vera')], [35, t => t.includes('equipamento especial')]];
  const xpFor = task => {
    const text = String(task.text || '').toLowerCase();
    for (const [xp, test] of XP_BONUS) if (test(text)) return xp;
    return XP_TAGS[task.tag] || 10;
  };
  const levelInfo = totalXp => {
    let level = 1, floor = 0;
    while (true) {
      const need = Math.round(180 + level * 70 + Math.pow(level, 1.45) * 18);
      if (totalXp < floor + need) return { level, floor, need, progress: totalXp - floor };
      floor += need; level += 1;
    }
  };

  /* ---- utilidades ---- */
  const json = (raw, fallback) => { try { const v = JSON.parse(raw); return v == null ? fallback : v; } catch (_) { return fallback; } };
  const readTasks = () => { const v = json(localStorage.getItem(TASK_KEY), []); return Array.isArray(v) ? v : []; };
  const readNotes = () => { const v = json(localStorage.getItem(NOTES_KEY), {}); return v && typeof v === 'object' ? v : {}; };
  const esc = value => { const d = document.createElement('div'); d.textContent = String(value ?? ''); return d.innerHTML; };
  const todayStr = () => { const n = new Date(); return new Date(n.getTime() - n.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
  const pad = n => String(n).padStart(2, '0');
  const clockNow = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const fmtElapsed = ms => {
    const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
  };

  // Um lançamento manual de "saída" do financeiro é registro de gasto, não tarefa.
  const isFinOut = (task, notes) => {
    if (!task || task.tag !== 'financeiro') return false;
    const n = notes[String(task.id)] || notes[task.id];
    return !!(n && n.movimento === 'saida');
  };

  const noteOf = (task, notes) => notes[String(task.id)] || notes[task.id] || null;

  // Ordena a fila: por horário (sem horário vai para o fim), depois por texto.
  const bySchedule = (a, b) => (a.time || '99:99').localeCompare(b.time || '99:99') || String(a.text).localeCompare(String(b.text));

  /* Monta a sequência do dia:
     - pendentes de hoje + atrasadas (datas anteriores) = a "fila";
     - concluídas de hoje = histórico do dia. */
  function buildDay() {
    const notes = readNotes();
    const today = todayStr();
    const all = readTasks().filter(t => t && t.text && !isFinOut(t, notes));
    const pending = all.filter(t => !t.done && t.date && t.date <= today)
      .sort((a, b) => (a.date < today ? -1 : a.date > today ? 1 : 0) - (b.date < today ? -1 : b.date > today ? 1 : 0) || bySchedule(a, b));
    const doneToday = all.filter(t => t.done && t.date === today).sort(bySchedule);
    return { notes, today, pending, doneToday, totalXpAll: all.filter(t => t.done).reduce((s, t) => s + xpFor(t), 0) };
  }

  function taskStatus(task, today) {
    if (!task.time) return { cls: '', label: 'Sem horário' };
    if (task.date < today) return { cls: 'late', label: 'Atrasada' };
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    const [h, m] = task.time.split(':').map(Number);
    const target = h * 60 + m, diff = target - cur;
    if (diff <= -15) return { cls: 'late', label: `Atrasada ${Math.abs(diff)} min` };
    if (diff <= 5) return { cls: 'now', label: 'Agora' };
    if (diff < 60) return { cls: 'soon', label: `Em ${diff} min` };
    return { cls: '', label: `às ${task.time}` };
  }

  /* ---- sessão (cronômetros + XP ganho na sessão) ---- */
  let session = { open: false, startedAt: 0, taskStartedAt: 0, currentId: null, earned: 0, tick: 0 };

  function markTaskDone(taskId) {
    const tasks = readTasks();
    const idx = tasks.findIndex(t => String(t.id) === String(taskId));
    if (idx < 0 || tasks[idx].done) return 0;
    tasks[idx].done = true;
    const gained = xpFor(tasks[idx]);
    try { localStorage.setItem(TASK_KEY, JSON.stringify(tasks)); } catch (_) { return 0; }
    session.earned += gained;
    try { window.dispatchEvent(new CustomEvent('agenda:remote-sync', { detail: { documentKey: 'tasks', from: 'sequencial' } })); } catch (_) {}
    return gained;
  }

  /* ============================ UI ============================ */
  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #${TIMER_BTN_ID}{color:var(--accent)}
      #${TIMER_BTN_ID} .seq-svg{width:22px;height:22px}
      #${TIMER_BTN_ID}.running{border-color:var(--accent);animation:seqBtnPulse 2.2s ease-in-out infinite}
      @keyframes seqBtnPulse{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,var(--accent) 42%,transparent)}50%{box-shadow:0 0 0 6px transparent}}
      .seq-svg{display:inline-grid;place-items:center}
      .seq-svg svg{width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
      #${TAB_ID}{position:relative}
      #${TAB_ID}[data-active]{background:var(--surface);color:var(--text);box-shadow:0 1px 7px rgba(0,0,0,.16)}

      #${OVERLAY_ID}{position:fixed;inset:0;z-index:9500;display:flex;flex-direction:column;background:var(--bg);color:var(--text);
        padding:calc(env(safe-area-inset-top) + 12px) 0 calc(env(safe-area-inset-bottom) + 14px);opacity:0;visibility:hidden;transition:opacity .26s ease,visibility 0s linear .26s}
      #${OVERLAY_ID}.open{opacity:1;visibility:visible;transition:opacity .26s ease}
      #${OVERLAY_ID} .seq-inner{width:min(100%,760px);margin:0 auto;padding:0 16px;display:flex;flex-direction:column;gap:14px;flex:1;min-height:0;overflow-y:auto;-webkit-overflow-scrolling:touch}
      #${OVERLAY_ID} .seq-inner>*{flex:0 0 auto} /* não deixa o flex comprimir/clipar os cards */
      #${OVERLAY_ID}.open .seq-anim{animation:seqRise .42s cubic-bezier(.2,.8,.2,1) both}
      @keyframes seqRise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}

      .seq-top{display:flex;align-items:center;gap:12px;width:min(100%,760px);margin:0 auto;padding:0 16px 2px}
      .seq-top .seq-eyebrow{color:var(--accent);font-size:11px;font-weight:850;letter-spacing:.13em;text-transform:uppercase}
      .seq-top h2{margin:1px 0 0;font-size:24px;letter-spacing:-.04em}
      .seq-live{margin-left:auto;display:flex;align-items:center;gap:7px;padding:8px 12px;border:1px solid var(--line);border-radius:14px;background:var(--surface);font-variant-numeric:tabular-nums}
      .seq-live .seq-svg{width:17px;height:17px;color:var(--accent)}
      .seq-live b{font-size:17px;font-weight:850;letter-spacing:-.02em}
      .seq-close{width:44px;height:44px;flex:0 0 auto;display:grid;place-items:center;border:1px solid var(--line);border-radius:14px;background:var(--surface);color:var(--text)}
      .seq-close .seq-svg{width:20px;height:20px}
      .seq-close:active{transform:scale(.94)}

      .seq-hero{padding:18px;border:1px solid var(--line);border-radius:24px;background:linear-gradient(150deg,var(--surface),var(--soft));box-shadow:var(--shadow);position:relative}
      .seq-hero .seq-status{display:inline-flex;align-items:center;gap:6px;padding:5px 11px;border-radius:999px;font-size:11px;font-weight:850;letter-spacing:.02em}
      .seq-hero .seq-status.now{background:color-mix(in srgb,var(--accent) 18%,transparent);color:var(--accent)}
      .seq-hero .seq-status.late{background:color-mix(in srgb,#ff8a8a 18%,transparent);color:#ff8a8a}
      .seq-hero .seq-status.soon{background:color-mix(in srgb,#ffb74d 20%,transparent);color:#ffb74d}
      .seq-hero .seq-status:not(.now):not(.late):not(.soon){background:var(--soft2);color:var(--muted)}
      .seq-hero h3{margin:13px 0 0;font-size:26px;line-height:1.15;letter-spacing:-.035em;overflow-wrap:anywhere}
      .seq-hero .seq-note{margin:9px 0 0;color:var(--muted);font-size:13px;line-height:1.5;white-space:pre-wrap;max-height:5.2em;overflow:hidden}
      .seq-tagrow{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-top:13px}
      .seq-pill{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border:1px solid color-mix(in srgb,var(--tag) 44%,var(--line));border-radius:999px;background:color-mix(in srgb,var(--tag) 14%,transparent);font-size:11px;font-weight:850}
      .seq-pill:before{content:"";width:7px;height:7px;border-radius:50%;background:var(--tag)}
      .seq-xp-tag{display:inline-flex;align-items:center;gap:4px;color:var(--accent);font-size:12px;font-weight:850}
      .seq-xp-tag .seq-svg{width:14px;height:14px}
      .seq-taskclock{margin-top:15px;display:flex;align-items:center;gap:9px;color:var(--muted);font-size:12px;font-weight:750}
      .seq-taskclock b{color:var(--text);font-size:18px;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
      .seq-cta{display:flex;gap:9px;margin-top:16px}
      .seq-done-btn{flex:1;min-height:54px;display:inline-flex;align-items:center;justify-content:center;gap:9px;border:0;border-radius:16px;background:var(--accent);color:var(--accentInk);font-size:16px;font-weight:850;transition:transform .14s ease}
      .seq-done-btn:active{transform:scale(.97)}
      .seq-done-btn .seq-svg{width:21px;height:21px}
      .seq-skip-btn{min-height:54px;padding:0 16px;display:inline-flex;align-items:center;gap:7px;border:1px solid var(--line);border-radius:16px;background:var(--surface);color:var(--muted);font-size:13px;font-weight:800}
      .seq-skip-btn:active{transform:scale(.97)}
      .seq-skip-btn .seq-svg{width:17px;height:17px}

      .seq-hud{display:grid;grid-template-columns:repeat(3,1fr);gap:9px}
      .seq-hud .seq-cell{padding:13px 10px;border:1px solid var(--line);border-radius:17px;background:var(--surface);text-align:center}
      .seq-hud .seq-cell .seq-svg{width:19px;height:19px;margin:0 auto 6px;color:var(--accent)}
      .seq-hud .seq-cell b{display:block;font-size:20px;letter-spacing:-.03em;font-variant-numeric:tabular-nums}
      .seq-hud .seq-cell span{display:block;margin-top:2px;color:var(--muted);font-size:10px;font-weight:750}

      .seq-level{padding:14px 15px;border:1px solid var(--line);border-radius:18px;background:var(--surface)}
      .seq-level-top{display:flex;justify-content:space-between;align-items:baseline;gap:10px;font-size:12px;font-weight:800;color:var(--muted)}
      .seq-level-top b{color:var(--text);font-size:15px}
      .seq-bar{height:9px;margin-top:9px;border-radius:999px;background:var(--soft2);overflow:hidden}
      .seq-bar>i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--accent2),var(--accent));transition:width .4s cubic-bezier(.2,.8,.2,1)}

      .seq-section{margin:4px 2px -2px;color:var(--faint);font-size:11px;font-weight:850;letter-spacing:.08em;text-transform:uppercase}
      .seq-queue{display:flex;flex-direction:column;gap:8px}
      .seq-row{display:grid;grid-template-columns:34px 1fr auto;align-items:center;gap:11px;padding:12px;border:1px solid var(--line);border-radius:15px;background:var(--surface)}
      .seq-row .seq-idx{width:30px;height:30px;display:grid;place-items:center;border-radius:10px;background:var(--soft2);color:var(--muted);font-size:13px;font-weight:850;font-variant-numeric:tabular-nums}
      .seq-row .seq-rtext{min-width:0}
      .seq-row .seq-rtext b{display:block;font-size:14px;font-weight:650;line-height:1.3;overflow-wrap:anywhere}
      .seq-row .seq-rmeta{display:flex;flex-wrap:wrap;gap:7px;margin-top:4px;color:var(--muted);font-size:11px;font-weight:750}
      .seq-row .seq-rmeta i{font-style:normal;color:var(--tag,--muted)}
      .seq-row.done{opacity:.6}
      .seq-row.done .seq-rtext b{text-decoration:line-through;color:var(--faint)}
      .seq-row .seq-idx.ok{background:color-mix(in srgb,var(--accent) 20%,transparent);color:var(--accent)}
      .seq-row .seq-idx.ok .seq-svg{width:16px;height:16px}

      .seq-empty{padding:38px 20px;text-align:center}
      .seq-empty .seq-trophy{width:74px;height:74px;margin:0 auto 14px;display:grid;place-items:center;border-radius:24px;background:linear-gradient(150deg,var(--surface),var(--soft));border:1px solid var(--line);color:var(--accent)}
      .seq-empty .seq-trophy .seq-svg{width:38px;height:38px}
      .seq-empty h3{margin:0 0 7px;font-size:23px;letter-spacing:-.03em}
      .seq-empty p{margin:0;color:var(--muted);font-size:14px;line-height:1.5}

      .seq-burst{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);z-index:9600;display:inline-flex;align-items:center;gap:8px;padding:14px 22px;border:1px solid var(--accent);border-radius:999px;background:var(--surface);color:var(--accent);box-shadow:0 20px 50px rgba(0,0,0,.4);font-size:22px;font-weight:900;opacity:0;pointer-events:none}
      .seq-burst .seq-svg{width:26px;height:26px}
      .seq-burst.show{animation:seqBurst 1s cubic-bezier(.18,.85,.24,1) both}
      @keyframes seqBurst{0%{opacity:0;transform:translate(-50%,-40%) scale(.6)}22%{opacity:1;transform:translate(-50%,-52%) scale(1.12)}70%{opacity:1;transform:translate(-50%,-58%) scale(1)}100%{opacity:0;transform:translate(-50%,-72%) scale(.92)}}

      html[data-theme="light"] #${OVERLAY_ID}{background:var(--bg)}
      @media(max-width:390px){.seq-hud{grid-template-columns:1fr 1fr}.seq-hud .seq-cell:last-child{grid-column:1/-1}.seq-hero h3{font-size:23px}}
      @media(prefers-reduced-motion:reduce){#${OVERLAY_ID},#${OVERLAY_ID} *{animation:none!important;transition:opacity .12s linear!important}}
    `;
    document.head.appendChild(s);
  }

  function overlay() {
    let ov = document.getElementById(OVERLAY_ID);
    if (ov) return ov;
    ov = document.createElement('div');
    ov.id = OVERLAY_ID;
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-label', 'Modo Sequência');
    ov.innerHTML = `
      <div class="seq-top seq-anim">
        <div><span class="seq-eyebrow">Modo foco</span><h2>Sequência</h2></div>
        <div class="seq-live"><span class="seq-svg">${ICONS.clock}</span><b id="seqLiveClock">--:--</b></div>
        <button class="seq-close" id="seqCloseBtn" type="button" aria-label="Fechar modo sequência"><span class="seq-svg">${ICONS.close}</span></button>
      </div>
      <div class="seq-inner" id="seqBody"></div>`;
    document.body.appendChild(ov);
    ov.querySelector('#seqCloseBtn').addEventListener('click', close);
    // Delegação: concluir / pular / abrir tarefa da fila.
    ov.querySelector('#seqBody').addEventListener('click', event => {
      const done = event.target.closest('[data-seq-done]');
      if (done) { completeCurrent(done.dataset.seqDone); return; }
      const skip = event.target.closest('[data-seq-skip]');
      if (skip) { skipCurrent(); return; }
    });
    return ov;
  }

  let skipOffset = 0; // permite "pular" a tarefa atual sem concluí-la

  function completeCurrent(taskId) {
    const gained = markTaskDone(taskId);
    if (gained > 0) {
      burst(gained);
      session.taskStartedAt = Date.now();
      skipOffset = 0;
    }
    render();
  }

  function skipCurrent() {
    skipOffset += 1;
    session.taskStartedAt = Date.now();
    render();
  }

  function burst(amount) {
    const ov = document.getElementById(OVERLAY_ID);
    if (!ov) return;
    ov.querySelector('.seq-burst')?.remove();
    const b = document.createElement('div');
    b.className = 'seq-burst';
    b.innerHTML = `<span class="seq-svg">${ICONS.star}</span>+${amount} XP`;
    ov.appendChild(b);
    requestAnimationFrame(() => b.classList.add('show'));
    setTimeout(() => b.remove(), 1050);
  }

  function render() {
    const body = document.getElementById('seqBody');
    if (!body) return;
    const day = buildDay();
    const queue = day.pending;
    const current = queue.length ? queue[Math.min(skipOffset, queue.length - 1)] : null;
    const info = levelInfo(day.totalXpAll);
    const pct = Math.min(100, Math.round(info.progress / info.need * 100));
    const doneCount = day.doneToday.length;
    const totalToday = doneCount + queue.filter(t => t.date === day.today).length;
    const dayPct = totalToday ? Math.round(doneCount / totalToday * 100) : 0;

    if (!current) {
      body.innerHTML = `
        <div class="seq-empty seq-anim">
          <div class="seq-trophy"><span class="seq-svg">${ICONS.trophy}</span></div>
          <h3>${doneCount ? 'Sequência concluída!' : 'Nada na fila'}</h3>
          <p>${doneCount ? `Você fechou ${doneCount} tarefa${doneCount > 1 ? 's' : ''} hoje e ganhou <b>${session.earned} XP</b> nesta sessão. Descanse — está tudo em dia.` : 'Não há tarefas pendentes para hoje. Que tal adiantar algo de amanhã?'}</p>
        </div>
        ${hudHtml(day, info, pct, dayPct, doneCount, totalToday)}
        ${day.doneToday.length ? `<p class="seq-section seq-anim">Concluídas hoje</p><div class="seq-queue seq-anim">${day.doneToday.map((t, i) => rowHtml(t, i + 1, day.notes, true)).join('')}</div>` : ''}`;
      return;
    }

    const st = taskStatus(current, day.today);
    const meta = tagMeta(current.tag);
    const note = noteOf(current, day.notes);
    const detail = note && note.detail ? String(note.detail) : '';
    const upcoming = queue.filter(t => t !== current);

    body.innerHTML = `
      <section class="seq-hero seq-anim">
        <span class="seq-status ${st.cls}">${st.cls === 'late' || st.cls === 'now' ? `<span class="seq-svg" style="width:13px;height:13px">${ICONS.clock}</span>` : ''}${esc(st.label)}</span>
        <h3>${esc(current.text)}</h3>
        ${detail ? `<p class="seq-note">${esc(detail)}</p>` : ''}
        <div class="seq-tagrow">
          <span class="seq-pill" style="--tag:${meta.color}">${meta.label}</span>
          ${current.time ? `<span class="seq-pill" style="--tag:var(--muted)">${esc(current.time)}</span>` : ''}
          <span class="seq-xp-tag"><span class="seq-svg">${ICONS.star}</span>+${xpFor(current)} XP</span>
        </div>
        <div class="seq-taskclock"><span class="seq-svg" style="width:16px;height:16px">${ICONS.play}</span>Tempo nesta tarefa <b id="seqTaskClock">00:00</b></div>
        <div class="seq-cta">
          <button class="seq-done-btn" type="button" data-seq-done="${esc(current.id)}"><span class="seq-svg">${ICONS.check}</span>Concluir e avançar</button>
          ${upcoming.length ? `<button class="seq-skip-btn" type="button" data-seq-skip="1" aria-label="Pular por agora"><span class="seq-svg">${ICONS.skip}</span>Pular</button>` : ''}
        </div>
      </section>

      ${hudHtml(day, info, pct, dayPct, doneCount, totalToday)}

      ${upcoming.length ? `<p class="seq-section seq-anim">A seguir · ${upcoming.length}</p><div class="seq-queue seq-anim">${upcoming.slice(0, 30).map((t, i) => rowHtml(t, i + 1, day.notes, false)).join('')}</div>` : ''}
      ${day.doneToday.length ? `<p class="seq-section seq-anim">Concluídas hoje · ${day.doneToday.length}</p><div class="seq-queue seq-anim">${day.doneToday.slice(0, 20).map((t, i) => rowHtml(t, i + 1, day.notes, true)).join('')}</div>` : ''}`;

    tickTaskClock();
  }

  function hudHtml(day, info, pct, dayPct, doneCount, totalToday) {
    return `
      <div class="seq-hud seq-anim">
        <div class="seq-cell"><span class="seq-svg">${ICONS.check}</span><b>${doneCount}/${totalToday || doneCount}</b><span>hoje concluídas</span></div>
        <div class="seq-cell"><span class="seq-svg">${ICONS.clock}</span><b id="seqSessionClock">00:00</b><span>tempo de foco</span></div>
        <div class="seq-cell"><span class="seq-svg">${ICONS.star}</span><b>+${session.earned}</b><span>XP na sessão</span></div>
      </div>
      <div class="seq-level seq-anim">
        <div class="seq-level-top"><span>Nível <b>${info.level}</b></span><span>${info.progress} / ${info.need} XP · ${pct}%</span></div>
        <div class="seq-bar"><i style="width:${pct}%"></i></div>
      </div>`;
  }

  function rowHtml(task, idx, notes, done) {
    const meta = tagMeta(task.tag);
    const note = noteOf(task, notes);
    const dur = note && note.durationMin ? `${note.durationMin} min` : '';
    return `
      <div class="seq-row ${done ? 'done' : ''}">
        <span class="seq-idx ${done ? 'ok' : ''}">${done ? `<span class="seq-svg">${ICONS.check}</span>` : idx}</span>
        <div class="seq-rtext"><b>${esc(task.text)}</b><div class="seq-rmeta"><i style="color:${meta.color}">${meta.label}</i>${task.time ? `<span>${esc(task.time)}</span>` : ''}${dur ? `<span>${dur}</span>` : ''}${!done ? `<span>+${xpFor(task)} XP</span>` : ''}</div></div>
      </div>`;
  }

  /* ---- cronômetros (só rodam com o overlay aberto) ---- */
  function tickTaskClock() {
    const t = document.getElementById('seqTaskClock');
    if (t) t.textContent = fmtElapsed(Date.now() - session.taskStartedAt);
    const sc = document.getElementById('seqSessionClock');
    if (sc) sc.textContent = fmtElapsed(Date.now() - session.startedAt);
    const lc = document.getElementById('seqLiveClock');
    if (lc) lc.textContent = clockNow();
  }

  function startTicker() {
    stopTicker();
    session.tick = setInterval(() => { if (session.open) tickTaskClock(); }, 1000);
  }
  function stopTicker() { if (session.tick) { clearInterval(session.tick); session.tick = 0; } }

  /* ---- abrir / fechar ---- */
  function open() {
    ensureStyles();
    const ov = overlay();
    const now = Date.now();
    session.open = true;
    session.startedAt = session.startedAt || now;
    session.taskStartedAt = now;
    session.earned = 0;
    skipOffset = 0;
    render();
    requestAnimationFrame(() => ov.classList.add('open'));
    document.documentElement.style.overflow = 'hidden';
    startTicker();
    syncButton();
    markTab(true);
  }

  function close() {
    const ov = document.getElementById(OVERLAY_ID);
    session.open = false;
    stopTicker();
    if (ov) ov.classList.remove('open');
    document.documentElement.style.overflow = '';
    syncButton();
    markTab(false);
  }

  function toggle() { session.open ? close() : open(); }

  /* ---- botão de cronômetro ao lado do menu ---- */
  function syncButton() {
    const btn = document.getElementById(TIMER_BTN_ID);
    if (!btn) return;
    btn.classList.toggle('running', session.open);
  }

  function ensureButton() {
    const actions = document.querySelector('.head-actions');
    const menuBtn = document.getElementById('moreMenuBtn');
    if (!actions || !menuBtn || document.getElementById(TIMER_BTN_ID)) return;
    const btn = document.createElement('button');
    btn.id = TIMER_BTN_ID;
    btn.className = 'icon-btn';
    btn.type = 'button';
    btn.title = 'Modo Sequência (foco)';
    btn.setAttribute('aria-label', 'Abrir modo sequência de foco');
    btn.innerHTML = `<span class="seq-svg">${ICONS.stopwatch}</span>`;
    btn.addEventListener('click', toggle);
    actions.insertBefore(btn, menuBtn); // ao lado (à esquerda) do hambúrguer
    syncButton();
  }

  /* ---- aba "Sequência" após "Lista" ---- */
  function markTab(active) {
    const tab = document.getElementById(TAB_ID);
    if (tab) tab.toggleAttribute('data-active', !!active);
  }
  function ensureTab() {
    const tabs = document.getElementById('viewTabs');
    if (!tabs || document.getElementById(TAB_ID)) return;
    // A grade de abas é fixa em 3 colunas; passa para 4 ao entrar a Sequência.
    tabs.style.gridTemplateColumns = 'repeat(4,1fr)';
    const tab = document.createElement('button');
    tab.id = TAB_ID;
    tab.className = 'view-tab';
    tab.type = 'button';
    tab.textContent = 'Sequência';
    tab.setAttribute('aria-label', 'Abrir modo sequência');
    tab.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); open(); });
    tabs.appendChild(tab);
  }

  function install() {
    ensureStyles();
    ensureButton();
    ensureTab();
  }

  // Reage às re-renderizações do app (o header/abas são reconstruídos).
  let frame = 0;
  new MutationObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(install); })
    .observe(document.documentElement, { childList: true, subtree: true });

  // Se a agenda mudar por sync/realtime enquanto o modo está aberto, atualiza.
  window.addEventListener('agenda:remote-sync', () => { if (session.open) render(); });
  window.addEventListener('keydown', e => { if (e.key === 'Escape' && session.open) close(); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
