/* Gamificação da Agenda Lagares — XP, níveis, sequência e conquistas.
   Todos os símbolos são SVGs lineares próprios; não usa emojis coloridos do sistema. */
(() => {
  'use strict';

  const TASK_KEY = 'agenda_lagares_v3';
  const STYLE_ID = 'agendaGameStyles';
  const GAME_CLASS = 'agenda-game-active';

  const ICONS = {
    star: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"/></svg>',
    flame: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.5 3.5c.7 3.3-1.4 4.5-2.1 6.5-.5 1.4.1 2.5 1.4 3.2-.1-2.1 1-3.6 2.6-5 1.5 2 3.1 4.5 3.1 7.2A6.5 6.5 0 0 1 5.5 15c0-3.7 2.2-6.4 5.1-8.8-.1 2 .6 3.4 1.7 4.1"/><path d="M9.2 17.2c.2 2 1.2 3.3 2.8 3.3 1.8 0 3-1.3 3-3.2 0-1-.5-2-1.3-2.9-.3 1.3-1 2-1.8 2.6-.5-.8-.7-1.7-.5-2.8-1.4.9-2.2 1.8-2.2 3Z"/></svg>',
    coin: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M14.8 9.2c-.6-.8-1.5-1.2-2.7-1.2-1.5 0-2.6.8-2.6 2 0 1.3 1 1.8 2.7 2.1 1.6.3 2.4.8 2.4 1.9 0 1.2-1.1 2-2.7 2-1.3 0-2.3-.5-3-1.4M12 6.5V8M12 16v1.5"/></svg>',
    trophy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4h8v4.5c0 3-1.6 5.2-4 5.2s-4-2.2-4-5.2V4Z"/><path d="M8 6H5.5v1.5c0 2.4 1.4 3.8 3.5 4M16 6h2.5v1.5c0 2.4-1.4 3.8-3.5 4M12 13.7V17M8.5 20h7M10 17h4"/></svg>',
    gear: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19 13.5v-3l-2-.5a7 7 0 0 0-.8-1.8l1.1-1.8-2.1-2.1-1.8 1.1a7 7 0 0 0-1.9-.8L11 2.5H8l-.5 2.1a7 7 0 0 0-1.8.8L3.9 4.3 1.8 6.4l1.1 1.8a7 7 0 0 0-.8 1.8l-2 .5v3l2 .5a7 7 0 0 0 .8 1.8l-1.1 1.8 2.1 2.1 1.8-1.1a7 7 0 0 0 1.8.8L8 21.5h3l.5-2.1a7 7 0 0 0 1.9-.8l1.8 1.1 2.1-2.1-1.1-1.8a7 7 0 0 0 .8-1.8l2-.5Z" transform="translate(1.5 0) scale(.875)"/></svg>',
    book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.5c2.8-.7 5.3-.1 8 1.5v12c-2.7-1.6-5.2-2.2-8-1.5v-12Z"/><path d="M20 5.5c-2.8-.7-5.3-.1-8 1.5v12c2.7-1.6 5.2-2.2 8-1.5v-12Z"/></svg>',
    wallet: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6.5h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a3 3 0 0 1-3-3v-10a3 3 0 0 1 3-3h11"/><path d="M15 11h6v4h-6a2 2 0 0 1 0-4Z"/></svg>',
    muscle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 13c1.1-1 1.7-2.2 1.7-3.8V6.5c0-1 .8-1.8 1.8-1.8s1.8.8 1.8 1.8V9l1.4-1.3c.8-.8 2.1-.7 2.8.1.6.7.6 1.8 0 2.5l-1 1.1h2.2c2.1 0 3.8 1.7 3.8 3.8 0 2.8-2.2 5-5 5H9.7c-2.4 0-4.4-1.4-5.2-3.5L3 13h4Z"/></svg>',
    rocket: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4c2.2-1.4 4.5-1.7 6.7-1.6.1 2.2-.2 4.5-1.6 6.7l-6.2 7.8-5.8-5.8L14 4Z"/><circle cx="16.5" cy="6.5" r="1.7"/><path d="m8.4 12.4-3.2.4-2.4 2.4 4.2.8M11.6 15.6l-.4 3.2-2.4 2.4-.8-4.2M5 19l-2 2M7 19l-2 2"/></svg>',
    crown: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 7 4 4 5-7 5 7 4-4-2 11H5L3 7Z"/><path d="M6 21h12"/></svg>'
  };

  const readTasks = () => {
    try { const value = JSON.parse(localStorage.getItem(TASK_KEY)); return Array.isArray(value) ? value : []; }
    catch (_) { return []; }
  };

  // Lançamentos manuais de SAÍDA (ex.: "Motel · R$ 206") são anotações de
  // gasto, não conquistas — ficam FORA do jogo para o XP e as porcentagens
  // não serem distorcidos por itens que nunca se "concluem". Entradas e
  // cobranças continuam valendo (marcar = recebi).
  const readNotes = () => {
    try { const v = JSON.parse(localStorage.getItem('agenda_notas_v1')); return v && typeof v === 'object' ? v : {}; }
    catch (_) { return {}; }
  };
  const isFinRecord = (task, notes) => {
    if (!task || task.tag !== 'financeiro') return false;
    const n = notes[String(task.id)] || notes[task.id];
    return !!(n && n.movimento === 'saida');
  };

  // Tabela de XP — é ela que aparece em "Como o jogo funciona" no painel.
  const XP_TAGS = { trabalho: 25, faculdade: 30, saude: 20, financeiro: 15, pessoal: 10, casa: 10, outros: 10 };
  const XP_TAG_LABELS = { faculdade: 'Faculdade', trabalho: 'Trabalho', saude: 'Saúde', financeiro: 'Financeiro (sem valor)', pessoal: 'Pessoal / Casa / Outros' };
  const XP_BONUS = [
    ['Tarefas do JARVIS', 50, t => t.includes('jarvis')],
    ['Tarefas do VERA', 40, t => t.includes('vera')],
    ['Equipamentos especiais', 35, t => t.includes('equipamento especial')]
  ];
  const xpFor = task => {
    const text = String(task.text || '').toLowerCase();
    for (const [, xp, test] of XP_BONUS) if (test(text)) return xp;
    return XP_TAGS[task.tag] || 10;
  };

  const levelInfo = totalXp => {
    let level = 1, floor = 0;
    while (true) {
      const need = Math.round(180 + level * 70 + Math.pow(level, 1.45) * 18);
      if (totalXp < floor + need) return { level, floor, need, progress: totalXp - floor };
      floor += need;
      level += 1;
    }
  };

  const streak = tasks => {
    const dates = new Set(tasks.filter(t => t.done && /^\d{4}-\d{2}-\d{2}$/.test(t.date || '')).map(t => t.date));
    let cursor = new Date();
    const iso = d => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    if (!dates.has(iso(cursor))) cursor.setDate(cursor.getDate() - 1);
    let count = 0;
    while (dates.has(iso(cursor))) { count++; cursor.setDate(cursor.getDate() - 1); }
    return count;
  };

  const categoryStats = tasks => {
    const defs = [
      ['trabalho', 'Técnico', 'gear'],
      ['faculdade', 'Estudos', 'book'],
      ['financeiro', 'Gestão', 'wallet'],
      ['saude', 'Disciplina', 'muscle'],
      ['pessoal', 'Projetos', 'rocket']
    ];
    return defs.map(([key, label, icon]) => {
      let set = tasks.filter(t => key === 'pessoal' ? ['pessoal', 'casa', 'outros'].includes(t.tag) : t.tag === key);
      if (label === 'Projetos') set = tasks.filter(t => ['pessoal', 'casa', 'outros'].includes(t.tag) || /vera|jarvis|projeto/i.test(t.text || ''));
      const done = set.filter(t => t.done).length;
      return { key, label, icon, total: set.length, done, pct: set.length ? Math.round(done / set.length * 100) : 0 };
    });
  };

  const achievements = (tasks, xp, streakDays, level) => {
    const done = tasks.filter(t => t.done).length;
    const perfectDays = new Map();
    tasks.filter(t => t.date).forEach(t => {
      const row = perfectDays.get(t.date) || { all: 0, done: 0 };
      row.all++; if (t.done) row.done++; perfectDays.set(t.date, row);
    });
    const perfect = [...perfectDays.values()].filter(v => v.all >= 2 && v.all === v.done).length;
    return [
      { name: 'Primeiros passos', desc: 'Concluir 10 tarefas', ok: done >= 10 },
      { name: 'Ritmo constante', desc: 'Manter 7 dias de sequência', ok: streakDays >= 7 },
      { name: 'Centurião', desc: 'Concluir 100 tarefas', ok: done >= 100 },
      { name: 'Semana perfeita', desc: 'Completar 7 dias inteiros', ok: perfect >= 7 },
      { name: 'Veterano', desc: 'Alcançar o nível 10', ok: level >= 10 },
      { name: 'Lenda da Agenda', desc: 'Acumular 10.000 XP', ok: xp >= 10000 }
    ];
  };

  const rankTitle = level => level >= 30 ? 'Lendário' : level >= 20 ? 'Mestre da Rotina' : level >= 12 ? 'Estrategista' : level >= 6 ? 'Organizador' : 'Iniciante';

  const ensureStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #painelDialog.${GAME_CLASS}{width:min(calc(100% - 20px),560px)}
      #painelDialog.${GAME_CLASS} .pg-eyebrow{color:var(--accent)}
      #painelDialog.${GAME_CLASS} .pg-body{padding:14px 14px 22px}
      .gm-svg{width:22px;height:22px;display:inline-grid;place-items:center;flex:0 0 auto}
      .gm-svg svg{width:100%;height:100%;fill:none;stroke:currentColor;stroke-width:1.75;stroke-linecap:round;stroke-linejoin:round}
      .gm-hero{padding:18px;border:1px solid var(--line);border-radius:22px;background:linear-gradient(145deg,var(--surface),var(--soft));margin-bottom:12px}
      .gm-hero-top{display:flex;align-items:center;justify-content:space-between;gap:12px}
      .gm-avatar{width:58px;height:58px;border:1px solid var(--line);border-radius:18px;display:grid;place-items:center;color:var(--accent);background:var(--bg)}
      .gm-avatar .gm-svg{width:31px;height:31px}
      .gm-id{flex:1;min-width:0}.gm-id small{display:block;color:var(--muted);font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}.gm-id b{display:block;margin-top:3px;font-size:22px;letter-spacing:-.04em}.gm-level{font-size:13px;font-weight:850;color:var(--accent)}
      .gm-xp-row{display:flex;justify-content:space-between;gap:12px;margin-top:16px;color:var(--muted);font-size:12px;font-weight:750}.gm-xp-row strong{color:var(--text)}
      .gm-bar{height:10px;border-radius:999px;background:var(--soft2);overflow:hidden;margin-top:8px}.gm-bar>i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--accent2),var(--accent))}
      .gm-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;margin-bottom:14px}.gm-card{padding:13px 10px;border:1px solid var(--line);border-radius:17px;background:var(--surface);text-align:center}.gm-card .gm-svg{margin:0 auto 8px;color:var(--accent)}.gm-card b{display:block;font-size:22px;letter-spacing:-.04em}.gm-card span{display:block;margin-top:3px;color:var(--muted);font-size:10px;font-weight:750}
      .gm-section{margin:18px 2px 9px;color:var(--faint);font-size:11px;font-weight:850;letter-spacing:.08em;text-transform:uppercase}
      .gm-attribute{display:grid;grid-template-columns:32px 86px 1fr 38px;align-items:center;gap:9px;padding:9px 2px}.gm-attribute>.gm-svg{color:var(--accent)}.gm-attribute b{font-size:12px}.gm-mini{height:8px;border-radius:99px;background:var(--soft2);overflow:hidden}.gm-mini>i{display:block;height:100%;border-radius:inherit;background:var(--accent)}.gm-attribute em{font-style:normal;text-align:right;color:var(--muted);font-size:11px;font-weight:800}
      .gm-achievements{display:grid;gap:8px}.gm-ach{display:grid;grid-template-columns:38px 1fr auto;align-items:center;gap:10px;padding:11px;border:1px solid var(--line);border-radius:15px;background:var(--surface);opacity:.55}.gm-ach.ok{opacity:1}.gm-ach .gm-svg{width:25px;height:25px;color:var(--accent)}.gm-ach b{display:block;font-size:12px}.gm-ach span{display:block;margin-top:2px;color:var(--muted);font-size:10px}.gm-ach mark{background:transparent;color:var(--muted);font-size:11px;font-weight:850}.gm-ach.ok mark{color:#78d88b}
      .gm-rules{padding:13px 14px;border:1px solid var(--line);border-radius:15px;background:var(--surface);font-size:12px;color:var(--muted);line-height:1.55}
      .gm-rules b{color:var(--text)}
      .gm-rules table{width:100%;margin:10px 0;border-collapse:collapse}
      .gm-rules td{padding:6px 2px;border-bottom:1px solid var(--line);font-weight:700;color:var(--text);font-size:12px}
      .gm-rules td:last-child{text-align:right;color:var(--accent);font-weight:850}
      .gm-rules tr.gm-bonus td{color:var(--muted)}.gm-rules tr.gm-bonus td:last-child{color:#ffb74d}
      .gm-rules .gm-note{margin:8px 0 0;font-size:11px}
      .gm-xp-toast{position:fixed;left:50%;bottom:calc(92px + env(safe-area-inset-bottom));transform:translateX(-50%) translateY(14px);background:var(--surface);border:1px solid var(--accent);color:var(--text);border-radius:999px;padding:9px 18px;font-size:14px;font-weight:850;z-index:99999;opacity:0;transition:all .25s ease;box-shadow:0 10px 26px rgba(0,0,0,.35);display:flex;align-items:center;gap:8px}
      .gm-xp-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
      .gm-xp-toast .gm-svg{width:18px;height:18px;color:var(--accent)}
      @media(max-width:390px){.gm-cards{grid-template-columns:1fr 1fr}.gm-cards .gm-card:last-child{grid-column:1/-1}.gm-attribute{grid-template-columns:28px 76px 1fr 34px}}
    `;
    document.head.appendChild(style);
  };

  const render = () => {
    const dialog = document.getElementById('painelDialog');
    const body = document.getElementById('pgBody');
    if (!dialog || !body) return;

    const notes = readNotes();
    const tasks = readTasks().filter(t => t && t.text && !isFinRecord(t, notes));
    const completed = tasks.filter(t => t.done);
    const xp = completed.reduce((sum, task) => sum + xpFor(task), 0);
    const info = levelInfo(xp);
    const streakDays = streak(tasks);
    const attrs = categoryStats(tasks);
    const ach = achievements(tasks, xp, streakDays, info.level);
    const pct = Math.min(100, Math.round(info.progress / info.need * 100));

    dialog.classList.add(GAME_CLASS);
    const eyebrow = dialog.querySelector('.pg-eyebrow');
    const title = dialog.querySelector('.pg-head h3');
    const sub = dialog.querySelector('#pgSub');
    if (eyebrow) eyebrow.textContent = 'Indicadores';
    if (title) title.textContent = 'Sua evolução';
    if (sub) sub.textContent = 'Rotina transformada em progresso';

    body.innerHTML = `
      <section class="gm-hero">
        <div class="gm-hero-top">
          <div class="gm-avatar"><span class="gm-svg">${info.level >= 20 ? ICONS.crown : ICONS.star}</span></div>
          <div class="gm-id"><small>João · ${rankTitle(info.level)}</small><b>Nível ${info.level}</b></div>
          <div class="gm-level">${pct}%</div>
        </div>
        <div class="gm-xp-row"><span>Progresso para o próximo nível</span><strong>${info.progress} / ${info.need} XP</strong></div>
        <div class="gm-bar"><i style="width:${pct}%"></i></div>
      </section>

      <div class="gm-cards">
        <div class="gm-card"><span class="gm-svg">${ICONS.star}</span><b>${xp}</b><span>XP total</span></div>
        <div class="gm-card"><span class="gm-svg">${ICONS.flame}</span><b>${streakDays}</b><span>dias de sequência</span></div>
        <div class="gm-card"><span class="gm-svg">${ICONS.trophy}</span><b>${completed.length}</b><span>tarefas concluídas</span></div>
      </div>

      <p class="gm-section">Atributos · % concluído por área</p>
      ${attrs.map(a => `<div class="gm-attribute"><span class="gm-svg">${ICONS[a.icon]}</span><b>${a.label}</b><div class="gm-mini"><i style="width:${a.pct}%"></i></div><em>${a.pct}%</em></div>`).join('')}

      <p class="gm-section">Conquistas · ${ach.filter(a => a.ok).length}/${ach.length}</p>
      <div class="gm-achievements">${ach.map(a => `<div class="gm-ach ${a.ok ? 'ok' : ''}"><span class="gm-svg">${ICONS.trophy}</span><div><b>${a.name}</b><span>${a.desc}</span></div><mark>${a.ok ? 'Obtida' : 'Bloqueada'}</mark></div>`).join('')}</div>

      <p class="gm-section">Como o jogo funciona</p>
      <div class="gm-rules">
        <p>Cada tarefa <b>concluída</b> vale XP conforme a área. XP acumulado sobe seu nível; a sequência conta dias seguidos com pelo menos uma tarefa concluída.</p>
        <table>
          <tr><td>Faculdade</td><td>+30 XP</td></tr>
          <tr><td>Trabalho</td><td>+25 XP</td></tr>
          <tr><td>Saúde / Academia</td><td>+20 XP</td></tr>
          <tr><td>Financeiro (contas e cobranças)</td><td>+15 XP</td></tr>
          <tr><td>Pessoal · Casa · Outros</td><td>+10 XP</td></tr>
          ${XP_BONUS.map(([nome, xpb]) => `<tr class="gm-bonus"><td>${nome}</td><td>+${xpb} XP</td></tr>`).join('')}
        </table>
        <p class="gm-note">Lançamentos de <b>saída</b> do painel financeiro são registro de gasto: não aparecem como tarefa e não valem XP. Entradas e cobranças valem — marcar significa "recebi".</p>
      </div>`;
  };

  // Feedback imediato: ao concluir uma tarefa, mostra "+N XP" na hora.
  let xpToastTimer = 0;
  const xpToast = amount => {
    let el = document.getElementById('gmXpToast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'gmXpToast';
      el.className = 'gm-xp-toast';
      document.body.appendChild(el);
    }
    el.innerHTML = `<span class="gm-svg">${ICONS.star}</span>+${amount} XP`;
    requestAnimationFrame(() => el.classList.add('show'));
    clearTimeout(xpToastTimer);
    xpToastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  };

  const bindXpFeedback = () => {
    if (document.body.dataset.gmXpFeedback) return;
    document.body.dataset.gmXpFeedback = '1';
    document.body.addEventListener('change', event => {
      const box = event.target;
      if (!box.matches || !box.matches('.task-card .check[data-id]') || !box.checked) return;
      const task = readTasks().find(t => String(t.id) === String(box.dataset.id));
      if (!task || isFinRecord(task, readNotes())) return;
      xpToast(xpFor(task));
    });
  };

  const install = () => {
    ensureStyles();
    bindXpFeedback();
    const button = document.getElementById('painelBtn');
    if (button && !button.dataset.gameBound) {
      button.dataset.gameBound = '1';
      button.title = 'Indicadores e evolução';
      button.setAttribute('aria-label', 'Abrir indicadores e evolução');
      button.addEventListener('click', () => setTimeout(render, 0));
    }
    const dialog = document.getElementById('painelDialog');
    if (dialog && !dialog.dataset.gameObserver) {
      dialog.dataset.gameObserver = '1';
      dialog.addEventListener('toggle', () => { if (dialog.open) setTimeout(render, 0); });
    }
  };

  new MutationObserver(install).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();