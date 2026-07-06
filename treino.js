/* =========================================================================
   Treino A/B/C — módulo de academia para a Agenda Lagares
   - Injeta um card de treino todo dia às 06:00 (rotação A -> B -> C)
   - Abre um painel com os exercícios, campo de peso/reps e evolução
   - Cada exercício traz uma animação (SVG) mostrando o movimento
   Segue o mesmo padrão de enhancement do edit-enhancement.js
   ========================================================================= */
(() => {
  'use strict';

  const TASK_KEY = 'agenda_lagares_v3';
  const LOG_KEY = 'agenda_treino_logs_v1';
  const META_KEY = 'agenda_treino_meta_v1';
  const DIALOG_ID = 'treinoDialog';
  const STYLE_ID = 'treinoStyles';
  const HORIZON = 90;   // gera treinos para os próximos 90 dias
  const REGEN = 60;     // regera quando a cobertura cair abaixo de 60 dias
  const META_VERSION = 2; // sobe quando a regra de geração muda (seg–sex)

  /* ---------- animações dos exercícios (SVG + SMIL, tudo offline) --------
     Bonequinho articulado: os membros dobram no cotovelo/joelho e o
     movimento tem easing (ease-in-out) para ficar fluido e natural.       */
  const STROKE = 'var(--accent)';
  const EASE = '0.42 0 0.58 1';
  const n1 = v => Math.round(v * 10) / 10;
  const svg = inner =>
    `<svg viewBox="0 0 64 64" width="100%" height="100%" fill="none" stroke="${STROKE}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  const dot = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${STROKE}" stroke="none"/>`;

  // <animate> com quadros suavizados (spline) e retorno ao início
  function tween(attr, frames, dur, loop = true) {
    const seq = loop ? frames.concat([frames[0]]) : frames;
    const n = seq.length - 1;
    const kt = seq.map((_, i) => n1(i / n)).join(';');
    const ks = Array(n).fill(EASE).join(';');
    return `<animate attributeName="${attr}" values="${seq.join(';')}" keyTimes="${kt}" calcMode="spline" keySplines="${ks}" dur="${dur}s" repeatCount="indefinite"/>`;
  }

  // corpo frontal (cabeça + tronco + pernas); os braços entram por cima
  const frontBase = () =>
    dot(32, 10, 5.4) +
    `<line x1="32" y1="15" x2="32" y2="40"/><line x1="32" y1="40" x2="26" y2="58"/><line x1="32" y1="40" x2="38" y2="58"/>`;

  // membro articulado (raiz→junta→ponta) a partir de ângulos (graus, 0 = para baixo)
  function poseStr(sx, sy, a1, a2, l1, l2) {
    const r1 = a1 * Math.PI / 180, r2 = a2 * Math.PI / 180;
    const ex = sx + l1 * Math.sin(r1), ey = sy + l1 * Math.cos(r1);
    const hx = ex + l2 * Math.sin(r2), hy = ey + l2 * Math.cos(r2);
    return `${n1(sx)},${n1(sy)} ${n1(ex)},${n1(ey)} ${n1(hx)},${n1(hy)}`;
  }
  function limb(sx, sy, poses, l1, l2, dur) {
    const frames = poses.map(p => poseStr(sx, sy, p[0], p[1], l1, l2));
    return `<polyline points="${frames[0]}">${tween('points', frames, dur)}</polyline>`;
  }
  // dois braços simétricos: direito usa (a1,a2); esquerdo espelha (-a1,-a2)
  function arms(poses, dur) {
    const L1 = 11, L2 = 10;
    return limb(25.5, 22, poses.map(p => [-p[0], -p[1]]), L1, L2, dur) +
      limb(38.5, 22, poses, L1, L2, dur);
  }
  const upper = (poses, dur) => svg(frontBase() + arms(poses, dur));
  const floor = (x1, x2, y) => `<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke-width="2" opacity=".4"/>`;

  const ANIM = {
    // membros superiores (frontal, articulados)
    press:    () => upper([[70, 148], [162, 172]], 1.8),
    fly:      () => upper([[94, 112], [40, 20]], 1.8),
    lateral:  () => upper([[8, 12], [90, 94]], 1.8),
    pulldown: () => upper([[158, 168], [118, 150]], 1.7),
    row:      () => upper([[34, 20], [56, 126]], 1.6),
    pushdown: () => upper([[16, 128], [16, 6]], 1.4),
    curl:     () => upper([[12, 18], [12, 150]], 1.5),
    // agachamento (lateral): corpo desce e os joelhos dobram, pés fixos
    squat: () => svg(
      `<circle cx="32" cy="12" r="5" fill="${STROKE}" stroke="none">${tween('cy', ['12', '20'], 1.8)}</circle>` +
      `<line x1="32" y1="17" x2="32" y2="40">${tween('y1', ['17', '25'], 1.8)}${tween('y2', ['40', '48'], 1.8)}</line>` +
      `<polyline points="32,40 28,49 27,58">${tween('points', ['32,40 28,49 27,58', '32,48 24,51 27,58'], 1.8)}</polyline>` +
      `<polyline points="32,40 36,49 37,58">${tween('points', ['32,40 36,49 37,58', '32,48 40,51 37,58'], 1.8)}</polyline>` +
      floor(24, 40, 58)),
    // leg press (lateral, reclinado): pernas estendem empurrando a plataforma
    legpress: () => svg(
      dot(15, 25, 5) +
      `<line x1="15" y1="29" x2="27" y2="41"/>` +
      `<line x1="10" y1="23" x2="24" y2="43" stroke-width="2" opacity=".4"/>` +
      `<polyline points="27,41 35,34 31,26">${tween('points', ['27,41 35,34 31,26', '27,41 45,33 53,28'], 1.6)}</polyline>` +
      `<line x1="33" y1="20" x2="33" y2="34" stroke-width="3">${tween('x1', ['33', '55'], 1.6)}${tween('x2', ['33', '55'], 1.6)}</line>`),
    // cadeira extensora (sentado): a canela sobe pivotando no joelho
    legext: () => svg(
      dot(25, 13, 5) +
      `<line x1="25" y1="18" x2="25" y2="38"/>` +
      `<line x1="25" y1="38" x2="40" y2="38"/>` +
      `<line x1="40" y1="38" x2="40" y2="52">${tween('x2', ['40', '53'], 1.6)}${tween('y2', ['52', '37'], 1.6)}</line>` +
      `<line x1="25" y1="23" x2="33" y2="30"/>` +
      floor(17, 31, 41)),
    // panturrilha (frontal): sobe na ponta dos pés
    calf: () => svg(
      `<g><animateTransform attributeName="transform" type="translate" values="0 4;0 -3;0 4" keyTimes="0;0.5;1" calcMode="spline" keySplines="${EASE};${EASE}" dur="1.1s" repeatCount="indefinite"/>` +
      frontBase() +
      `<line x1="25.5" y1="22" x2="22" y2="40"/><line x1="38.5" y1="22" x2="42" y2="40"/></g>` +
      floor(22, 42, 60)),
    // abdominal (lateral): o tronco enrola para cima
    abs: () => svg(
      `<polyline points="22,46 31,40 27,52"/>` +
      `<polyline points="22,46 34,46 44,46">${tween('points', ['22,46 34,46 44,46', '22,46 30,39 36,31'], 1.7)}</polyline>` +
      `<circle cx="48" cy="46" r="4.4" fill="${STROKE}" stroke="none">${tween('cx', ['48', '38'], 1.7)}${tween('cy', ['46', '28'], 1.7)}</circle>` +
      floor(18, 52, 52))
  };
  const animFor = mov => (ANIM[mov] || ANIM.press)();

  /* --- fotos reais (dominio publico: free-exercise-db) por exercicio ----
     2 quadros (inicio/fim) alternados como um GIF; o SVG fica por baixo
     como fallback quando estiver offline ou a imagem nao carregar.        */
  const DEMO_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';
  const DEMOS = {
    a1: 'Dumbbell_Bench_Press', a2: 'Barbell_Incline_Bench_Press_-_Medium_Grip', a3: 'Butterfly',
    a4: 'Dumbbell_Shoulder_Press', a5: 'Side_Lateral_Raise', a6: 'Triceps_Pushdown_-_Rope_Attachment', a7: 'Lying_Triceps_Press',
    b1: 'Wide-Grip_Lat_Pulldown', b2: 'Seated_Cable_Rows', b3: 'Bent_Over_Two-Dumbbell_Row', b4: 'Full_Range-Of-Motion_Lat_Pulldown',
    b5: 'Barbell_Curl', b6: 'Alternate_Incline_Dumbbell_Curl', b7: 'Hammer_Curls',
    c1: 'Barbell_Full_Squat', c2: 'Leg_Press', c3: 'Leg_Extensions', c4: 'Lying_Leg_Curls', c5: 'Standing_Calf_Raises', c6: 'Crunches'
  };
  function demoHtml(ex) {
    const svg = animFor(ex.mov);
    const dir = DEMOS[ex.k];
    if (!dir) return `<div class="tr-demo">${svg}</div>`;
    const base = DEMO_BASE + '/' + encodeURIComponent(dir);
    return `<div class="tr-demo">` +
      `<div class="tr-demo-svg">${svg}</div>` +
      `<img class="tr-demo-img" src="${base}/0.jpg" alt="" loading="lazy" onerror="this.style.display='none'">` +
      `<img class="tr-demo-img flip" src="${base}/1.jpg" alt="" loading="lazy" onerror="this.style.display='none'">` +
      `</div>`;
  }

  /* --------------------------- planos A / B / C -------------------------- */
  const WORKOUTS = {
    A: {
      muscles: 'Peito, Ombro e Tríceps',
      exercises: [
        { k: 'a1', name: 'Supino reto com halteres', muscle: 'Peito', sets: 3, reps: '12', mov: 'press' },
        { k: 'a2', name: 'Supino inclinado (máquina)', muscle: 'Peito superior', sets: 3, reps: '12', mov: 'press' },
        { k: 'a3', name: 'Crucifixo / voador (peck deck)', muscle: 'Peito', sets: 3, reps: '15', mov: 'fly' },
        { k: 'a4', name: 'Desenvolvimento com halteres', muscle: 'Ombros', sets: 3, reps: '12', mov: 'press' },
        { k: 'a5', name: 'Elevação lateral', muscle: 'Ombros', sets: 3, reps: '15', mov: 'lateral' },
        { k: 'a6', name: 'Tríceps na polia (corda)', muscle: 'Tríceps', sets: 3, reps: '15', mov: 'pushdown' },
        { k: 'a7', name: 'Tríceps testa / francês', muscle: 'Tríceps', sets: 3, reps: '12', mov: 'pushdown' }
      ]
    },
    B: {
      muscles: 'Costas e Bíceps',
      exercises: [
        { k: 'b1', name: 'Puxada frontal (pulldown)', muscle: 'Dorsais', sets: 3, reps: '12', mov: 'pulldown' },
        { k: 'b2', name: 'Remada baixa (máquina)', muscle: 'Costas', sets: 3, reps: '12', mov: 'row' },
        { k: 'b3', name: 'Remada curvada com halteres', muscle: 'Costas', sets: 3, reps: '12', mov: 'row' },
        { k: 'b4', name: 'Pulldown com barra reta', muscle: 'Dorsais', sets: 3, reps: '15', mov: 'pulldown' },
        { k: 'b5', name: 'Rosca direta (barra)', muscle: 'Bíceps', sets: 3, reps: '12', mov: 'curl' },
        { k: 'b6', name: 'Rosca alternada (halteres)', muscle: 'Bíceps', sets: 3, reps: '12', mov: 'curl' },
        { k: 'b7', name: 'Rosca martelo', muscle: 'Bíceps / Antebraço', sets: 3, reps: '15', mov: 'curl' }
      ]
    },
    C: {
      muscles: 'Pernas e Abdômen',
      exercises: [
        { k: 'c1', name: 'Agachamento (livre ou Smith)', muscle: 'Quadríceps / Glúteo', sets: 3, reps: '12', mov: 'squat' },
        { k: 'c2', name: 'Leg press 45°', muscle: 'Pernas', sets: 3, reps: '12', mov: 'legpress' },
        { k: 'c3', name: 'Cadeira extensora', muscle: 'Quadríceps', sets: 3, reps: '15', mov: 'legext' },
        { k: 'c4', name: 'Mesa flexora', muscle: 'Posterior de coxa', sets: 3, reps: '15', mov: 'legext' },
        { k: 'c5', name: 'Panturrilha em pé', muscle: 'Panturrilha', sets: 4, reps: '20', mov: 'calf' },
        { k: 'c6', name: 'Abdominal / prancha', muscle: 'Abdômen', sets: 3, reps: '20', mov: 'abs' }
      ]
    }
  };

  /* --------------------------- utilidades base --------------------------- */
  const readJSON = (key, fallback) => {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
    catch (_) { return fallback; }
  };
  const readTasks = () => { const v = readJSON(TASK_KEY, []); return Array.isArray(v) ? v : []; };
  const writeTasks = t => localStorage.setItem(TASK_KEY, JSON.stringify(t));
  const loadLogs = () => readJSON(LOG_KEY, {}) || {};
  const saveLogs = l => localStorage.setItem(LOG_KEY, JSON.stringify(l));

  function today() {
    const n = new Date(), off = n.getTimezoneOffset();
    return new Date(n.getTime() - off * 60000).toISOString().slice(0, 10);
  }
  function addDays(dstr, n) {
    const d = new Date(dstr + 'T12:00:00'); d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  function isWeekend(dstr) {
    const g = new Date(dstr + 'T12:00:00').getDay();
    return g === 0 || g === 6; // domingo ou sábado
  }
  // contador contínuo de dias úteis (epoch 1970-01-05 = segunda-feira),
  // para a rotação A -> B -> C não reiniciar toda semana
  const EPOCH = Math.floor(Date.parse('1970-01-05T12:00:00') / 86400000);
  function weekdayIndex(dstr) {
    const days = Math.floor(Date.parse(dstr + 'T12:00:00') / 86400000) - EPOCH;
    const weeks = Math.floor(days / 7);
    let rem = days % 7; if (rem < 0) rem += 7;
    return weeks * 5 + Math.min(rem, 4);
  }
  const workoutForDate = dstr => ['A', 'B', 'C'][(((weekdayIndex(dstr) % 3) + 3) % 3)];
  const esc = v => { const d = document.createElement('div'); d.textContent = v; return d.innerHTML; };
  function prettyDate(dstr) {
    try { return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(dstr + 'T12:00:00')); }
    catch (_) { return dstr; }
  }
  const shortDate = dstr => { const p = dstr.split('-'); return `${p[2]}/${p[1]}`; };

  /* -------------- gera os cards de treino diários na agenda -------------- */
  const workoutText = w => `🏋️ Treino ${w} · ${WORKOUTS[w].muscles}`;

  function ensureTasks() {
    const meta = readJSON(META_KEY, {}) || {};
    const t0 = today();
    const upgrade = meta.version !== META_VERSION;
    if (!upgrade && meta.generatedUntil && meta.generatedUntil >= addDays(t0, REGEN)) return false;

    const target = addDays(t0, HORIZON);
    const tasks = readTasks();
    let changed = false;

    // 1) reconcilia treinos já existentes: remove os de fim de semana (não
    //    concluídos) e corrige a letra/horário dos de dia útil que mudaram
    for (let i = tasks.length - 1; i >= 0; i--) {
      const tk = tasks[i];
      if (!String(tk.id).startsWith('treino-')) continue;
      if (isWeekend(tk.date)) {
        if (!tk.done) { tasks.splice(i, 1); changed = true; }
        continue;
      }
      if (!tk.done) {
        const text = workoutText(workoutForDate(tk.date));
        if (tk.text !== text) { tk.text = text; changed = true; }
        if (tk.time !== '06:00') { tk.time = '06:00'; changed = true; }
      }
    }

    // 2) cria os treinos de dia útil que faltam na janela
    const have = new Set(tasks.filter(x => String(x.id).startsWith('treino-')).map(x => x.date));
    for (let d = t0; d <= target; d = addDays(d, 1)) {
      if (isWeekend(d) || have.has(d)) continue;
      const w = workoutForDate(d);
      tasks.push({ id: 'treino-' + d, text: workoutText(w), date: d, time: '06:00', tag: 'saude', reminder: 0, done: false });
      changed = true;
    }

    meta.version = META_VERSION;
    meta.generatedUntil = target;
    localStorage.setItem(META_KEY, JSON.stringify(meta));
    if (changed) { writeTasks(tasks); return true; }
    return false;
  }

  /* ------------------------------ estilos -------------------------------- */
  function ensureStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .tr-open{margin-left:auto;display:inline-flex;align-items:center;gap:5px;padding:4px 11px;border:1px solid var(--accent);border-radius:999px;background:color-mix(in srgb,var(--accent) 14%,transparent);color:var(--accent);font-size:11px;font-weight:800;line-height:1;transition:transform .13s ease}
      .tr-open:active{transform:scale(.94)}
      #${DIALOG_ID}{width:min(calc(100% - 24px),520px);max-height:calc(100dvh - 24px);padding:0;border:1px solid var(--line);border-radius:24px;background:var(--bg);color:var(--text);box-shadow:0 30px 90px rgba(0,0,0,.56)}
      #${DIALOG_ID}::backdrop{background:rgba(0,0,0,.6);backdrop-filter:blur(4px)}
      .tr-wrap{display:flex;flex-direction:column;max-height:calc(100dvh - 24px)}
      .tr-head{position:sticky;top:0;z-index:2;padding:18px 18px 14px;border-bottom:1px solid var(--line);background:linear-gradient(135deg,var(--surface),var(--soft))}
      .tr-eyebrow{display:block;color:var(--accent);font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;margin-bottom:5px}
      .tr-head h3{margin:0;font-size:24px;letter-spacing:-.04em}
      .tr-sub{margin:5px 0 0;color:var(--muted);font-size:13px;text-transform:capitalize}
      .tr-close{position:absolute;top:14px;right:14px;width:34px;height:34px;border:1px solid var(--line);border-radius:11px;background:var(--surface);color:var(--text);font-size:19px;line-height:1;display:grid;place-items:center}
      .tr-timer{position:sticky;top:0;z-index:1;display:flex;align-items:center;gap:12px;padding:11px 14px;border-bottom:1px solid var(--line);background:var(--surface)}
      .tr-ring{position:relative;width:52px;height:52px;flex:0 0 auto}
      .tr-ring svg{transform:rotate(-90deg)}
      .tr-ring .bg{stroke:var(--soft2)}
      .tr-ring .fg{stroke:var(--accent);stroke-linecap:round;transition:stroke-dashoffset .3s linear}
      .tr-ring.done .fg{stroke:#78d88b}
      .tr-time{position:absolute;inset:0;display:grid;place-items:center;font-size:13px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.02em}
      .tr-timer-main{flex:1;min-width:0}
      .tr-timer-label{color:var(--faint);font-size:10px;font-weight:800;letter-spacing:.07em;text-transform:uppercase}
      .tr-presets{display:flex;gap:6px;margin-top:6px}
      .tr-preset{padding:5px 10px;border:1px solid var(--line);border-radius:999px;background:var(--soft);color:var(--text);font-size:11px;font-weight:800;line-height:1}
      .tr-preset.on{border-color:var(--accent);background:var(--accent);color:var(--accentInk)}
      .tr-timer-btns{display:flex;gap:7px;flex:0 0 auto}
      .tr-tbtn{width:42px;height:42px;border:1px solid var(--line);border-radius:13px;background:var(--soft);color:var(--text);font-size:17px;line-height:1;display:grid;place-items:center}
      .tr-tbtn.play{border-color:var(--accent);background:var(--accent);color:var(--accentInk)}
      .tr-cardio{margin:0 0 12px;padding:12px 13px;border:1px solid var(--line);border-radius:16px;background:linear-gradient(135deg,var(--surface),var(--soft))}
      .tr-cardio-top{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:9px}
      .tr-cardio-label{font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
      .tr-cardio-time{font-size:22px;font-weight:850;font-variant-numeric:tabular-nums;letter-spacing:-.03em}
      .tr-cardio-presets{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:9px}
      .tr-cpreset{padding:6px 11px;border:1px solid var(--line);border-radius:999px;background:var(--surface);color:var(--text);font-size:12px;font-weight:800;line-height:1}
      .tr-cpreset.on{border-color:var(--accent);background:var(--accent);color:var(--accentInk)}
      .tr-ccustom{display:inline-flex;align-items:center;gap:5px;cursor:text}
      .tr-ccustom input{width:40px;border:0;background:transparent;color:inherit;font:inherit;font-weight:800;text-align:center;outline:0;padding:0;-moz-appearance:textfield}
      .tr-ccustom input::-webkit-outer-spin-button,.tr-ccustom input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}
      .tr-ccustom input::placeholder{color:var(--muted)}
      .tr-cardio-ctrl{display:flex;gap:8px}
      .tr-cbtn{min-height:40px;border-radius:12px;font-size:13px;font-weight:800;border:1px solid var(--line);background:var(--soft);color:var(--text);padding:0 14px}
      .tr-cbtn.play{flex:1;border-color:var(--accent);background:var(--accent);color:var(--accentInk)}
      .tr-body{overflow-y:auto;padding:12px 14px 8px}
      .tr-tip{margin:0 0 12px;padding:11px 13px;border:1px solid var(--line);border-radius:14px;background:var(--soft);color:var(--muted);font-size:12px;line-height:1.45}
      .tr-tip strong{color:var(--text)}
      .tr-ex{display:grid;grid-template-columns:72px minmax(0,1fr);gap:12px;padding:13px 0;border-top:1px solid var(--line)}
      .tr-ex:first-of-type{border-top:0}
      .tr-demo{position:relative;width:72px;height:72px;border:1px solid var(--line);border-radius:16px;background:var(--soft);overflow:hidden}
      .tr-demo-svg{position:absolute;inset:0}
      .tr-demo-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:var(--soft)}
      .tr-demo-img.flip{animation:tr-flip 1.6s steps(1,end) infinite}
      @keyframes tr-flip{0%,49.9%{opacity:0}50%,100%{opacity:1}}
      .tr-ex-name{font-size:14px;font-weight:750;line-height:1.25}
      .tr-ex-meta{margin-top:3px;color:var(--muted);font-size:11px;font-weight:700}
      .tr-ex-meta b{color:var(--accent)}
      .tr-inputs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:9px}
      .tr-inputs label{display:block;margin:0 0 4px;color:var(--faint);font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase}
      .tr-inputs input{width:100%;min-height:42px;padding:9px 11px;border:1px solid var(--line);border-radius:12px;outline:0;background:var(--surface);color:var(--text);font-size:16px;font-weight:700}
      .tr-inputs input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(117,203,255,.2)}
      .tr-evo{display:flex;align-items:center;gap:8px;margin-top:8px;min-height:20px}
      .tr-last{color:var(--muted);font-size:11px;font-weight:700}
      .tr-delta{font-size:11px;font-weight:800;padding:2px 7px;border-radius:999px}
      .tr-delta.up{color:#78d88b;background:rgba(120,216,139,.14)}
      .tr-delta.down{color:var(--danger);background:rgba(255,156,156,.14)}
      .tr-delta.flat{color:var(--faint);background:var(--soft2)}
      .tr-spark{margin-left:auto}
      .tr-foot{position:sticky;bottom:0;display:flex;gap:9px;padding:12px 14px calc(14px + env(safe-area-inset-bottom));border-top:1px solid var(--line);background:var(--bg)}
      .tr-btn{flex:1;min-height:48px;border-radius:14px;font-size:14px;font-weight:800}
      .tr-btn.ghost{border:1px solid var(--line);background:var(--soft);color:var(--text)}
      .tr-btn.solid{border:1px solid var(--accent);background:var(--accent);color:var(--accentInk)}
    `;
    document.head.appendChild(style);
  }

  /* ------------------------------ dialog --------------------------------- */
  let dialogEl = null, currentDate = null, currentW = null;

  /* ----------------------- cronômetro de descanso ------------------------ */
  const RING_C = 2 * Math.PI * 23; // circunferência do anel (r=23)
  let restTotal = 60, restLeft = 60, restInt = null, audioCtx = null;
  let cardioTotal = 300, cardioLeft = 300, cardioInt = null; // cardio de aquecimento (5 min padrão)
  const fmtTime = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  function beep() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      [0, 0.22].forEach(t => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.type = 'sine'; o.frequency.value = 880;
        o.connect(g); g.connect(audioCtx.destination);
        const s = audioCtx.currentTime + t;
        g.gain.setValueAtTime(0.0001, s);
        g.gain.exponentialRampToValueAtTime(0.3, s + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, s + 0.18);
        o.start(s); o.stop(s + 0.2);
      });
    } catch (_) {}
  }

  function paintTimer() {
    if (!dialogEl) return;
    dialogEl.querySelector('#trTime').textContent = fmtTime(Math.max(0, restLeft));
    const off = RING_C * (1 - Math.max(0, restLeft) / restTotal);
    dialogEl.querySelector('#trRingFg').setAttribute('stroke-dashoffset', off.toFixed(1));
  }
  function stopTimer() { clearInterval(restInt); restInt = null; dialogEl.querySelector('#trToggle').textContent = '▶'; }
  function timerFinished() {
    stopTimer();
    restLeft = 0; paintTimer();
    dialogEl.querySelector('#trRing').classList.add('done');
    if (navigator.vibrate) navigator.vibrate([140, 70, 140]);
    beep();
    toast('Descanso concluído — bora pra próxima série! 💪');
  }
  function startTimer() {
    if (restInt) { stopTimer(); return; }
    if (restLeft <= 0) restLeft = restTotal;
    dialogEl.querySelector('#trRing').classList.remove('done');
    dialogEl.querySelector('#trToggle').textContent = '⏸';
    try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch (_) {}
    restInt = setInterval(() => {
      restLeft--;
      paintTimer();
      if (restLeft <= 0) timerFinished();
    }, 1000);
  }
  function resetTimer() { stopTimer(); restLeft = restTotal; dialogEl.querySelector('#trRing').classList.remove('done'); paintTimer(); }
  function setPreset(sec) {
    restTotal = sec; restLeft = sec; stopTimer();
    dialogEl.querySelector('#trRing').classList.remove('done');
    dialogEl.querySelectorAll('.tr-preset').forEach(b => b.classList.toggle('on', Number(b.dataset.sec) === sec));
    paintTimer();
  }

  /* ----------------------- cardio (aquecimento) ------------------------- */
  function cardioSection() {
    return `<div class="tr-cardio">` +
      `<div class="tr-cardio-top"><span class="tr-cardio-label">Cardio (aquecimento)</span><span class="tr-cardio-time" id="trCardioTime">${fmtTime(cardioLeft)}</span></div>` +
      `<div class="tr-cardio-presets" id="trCardioPresets">${[5, 10, 15, 20, 30, 45, 60].map(m => `<button class="tr-cpreset ${cardioTotal === m * 60 ? 'on' : ''}" type="button" data-cardio="${m}">${m} min</button>`).join('')}<label class="tr-cpreset tr-ccustom">custom<input type="number" id="trCardioCustom" min="1" max="180" inputmode="numeric" placeholder="—"></label></div>` +
      `<div class="tr-cardio-ctrl"><button class="tr-cbtn play" id="trCardioToggle" type="button">${cardioInt ? '⏸ Pausar' : '▶ Iniciar'}</button><button class="tr-cbtn" id="trCardioReset" type="button" aria-label="Zerar">↺</button></div>` +
      `</div>`;
  }
  function paintCardio() { const t = document.getElementById('trCardioTime'); if (t) t.textContent = fmtTime(Math.max(0, cardioLeft)); }
  function syncCardioUI() {
    paintCardio();
    const tog = document.getElementById('trCardioToggle'); if (tog) tog.textContent = cardioInt ? '⏸ Pausar' : '▶ Iniciar';
    document.querySelectorAll('.tr-cpreset').forEach(b => b.classList.toggle('on', Number(b.dataset.cardio) * 60 === cardioTotal));
  }
  function stopCardio() { clearInterval(cardioInt); cardioInt = null; const tog = document.getElementById('trCardioToggle'); if (tog) tog.textContent = '▶ Iniciar'; }
  function cardioFinished() { stopCardio(); cardioLeft = 0; paintCardio(); if (navigator.vibrate) navigator.vibrate([160, 80, 160]); beep(); toast('Cardio concluído — bora pro treino!'); }
  function startCardio() {
    if (cardioInt) { stopCardio(); return; }
    if (cardioLeft <= 0) cardioLeft = cardioTotal;
    const tog = document.getElementById('trCardioToggle'); if (tog) tog.textContent = '⏸ Pausar';
    try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch (_) {}
    cardioInt = setInterval(() => { cardioLeft--; paintCardio(); if (cardioLeft <= 0) cardioFinished(); }, 1000);
  }
  function resetCardio() { stopCardio(); cardioLeft = cardioTotal; paintCardio(); }
  function setCardio(min) { cardioTotal = min * 60; cardioLeft = cardioTotal; stopCardio(); syncCardioUI(); }

  function ensureDialog() {
    if (dialogEl) return dialogEl;
    dialogEl = document.createElement('dialog');
    dialogEl.id = DIALOG_ID;
    dialogEl.innerHTML = `
      <div class="tr-wrap">
        <div class="tr-head">
          <span class="tr-eyebrow" id="trEyebrow">Treino</span>
          <h3 id="trTitle">Treino</h3>
          <p class="tr-sub" id="trSub"></p>
          <button class="tr-close" id="trClose" type="button" aria-label="Fechar">×</button>
        </div>
        <div class="tr-timer">
          <div class="tr-ring" id="trRing">
            <svg width="52" height="52" viewBox="0 0 52 52" fill="none" stroke-width="4">
              <circle class="bg" cx="26" cy="26" r="23"/>
              <circle class="fg" id="trRingFg" cx="26" cy="26" r="23" stroke-dasharray="144.5" stroke-dashoffset="0"/>
            </svg>
            <span class="tr-time" id="trTime">1:00</span>
          </div>
          <div class="tr-timer-main">
            <span class="tr-timer-label">Descanso entre séries</span>
            <div class="tr-presets" id="trPresets">
              <button class="tr-preset" type="button" data-sec="30">30s</button>
              <button class="tr-preset on" type="button" data-sec="60">60s</button>
              <button class="tr-preset" type="button" data-sec="90">90s</button>
              <button class="tr-preset" type="button" data-sec="120">2min</button>
            </div>
          </div>
          <div class="tr-timer-btns">
            <button class="tr-tbtn play" id="trToggle" type="button" aria-label="Iniciar descanso">▶</button>
            <button class="tr-tbtn" id="trReset" type="button" aria-label="Zerar">↺</button>
          </div>
        </div>
        <div class="tr-body" id="trBody"></div>
        <div class="tr-foot">
          <button class="tr-btn ghost" id="trSave" type="button">Salvar cargas</button>
          <button class="tr-btn solid" id="trDone" type="button">Salvar e concluir ✓</button>
        </div>
      </div>`;
    document.body.appendChild(dialogEl);
    dialogEl.querySelector('#trClose').addEventListener('click', () => dialogEl.close());
    dialogEl.addEventListener('click', e => { if (e.target === dialogEl) dialogEl.close(); });
    dialogEl.addEventListener('close', () => { stopTimer(); stopCardio(); });
    dialogEl.addEventListener('click', e => {
      const cp = e.target.closest('[data-cardio]');
      if (cp) { setCardio(Number(cp.dataset.cardio)); return; }
      if (e.target.closest('#trCardioToggle')) { startCardio(); return; }
      if (e.target.closest('#trCardioReset')) { resetCardio(); }
    });
    dialogEl.addEventListener('change', e => {
      if (e.target && e.target.id === 'trCardioCustom') {
        const m = Math.max(1, Math.min(180, Math.round(Number(e.target.value) || 0)));
        if (m) setCardio(m);
      }
    });
    dialogEl.querySelector('#trSave').addEventListener('click', () => saveSession(false));
    dialogEl.querySelector('#trDone').addEventListener('click', () => saveSession(true));
    dialogEl.querySelector('#trToggle').addEventListener('click', startTimer);
    dialogEl.querySelector('#trReset').addEventListener('click', resetTimer);
    dialogEl.querySelector('#trPresets').addEventListener('click', e => {
      const b = e.target.closest('.tr-preset');
      if (b) setPreset(Number(b.dataset.sec));
    });
    const fgc = dialogEl.querySelector('#trRingFg');
    fgc.setAttribute('stroke-dasharray', RING_C.toFixed(1));
    return dialogEl;
  }

  function sparkline(values) {
    if (!values.length) return '';
    const w = 58, h = 20, max = Math.max(...values), min = Math.min(...values), span = max - min || 1;
    const step = values.length > 1 ? w / (values.length - 1) : 0;
    const pts = values.map((v, i) => `${(i * step).toFixed(1)},${(h - 2 - ((v - min) / span) * (h - 4)).toFixed(1)}`).join(' ');
    const last = values.length - 1;
    const lx = (last * step).toFixed(1), ly = (h - 2 - ((values[last] - min) / span) * (h - 4)).toFixed(1);
    return `<svg class="tr-spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none">
      <polyline points="${pts}" stroke="var(--accent)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="${lx}" cy="${ly}" r="2.2" fill="var(--accent)"/></svg>`;
  }

  function exerciseRow(ex, logs) {
    const arr = (logs[ex.k] || []).slice().sort((a, b) => a.date.localeCompare(b.date));
    const last = arr[arr.length - 1];
    const prev = arr[arr.length - 2];
    let evo = '<span class="tr-last">Sem registro ainda</span>';
    if (last) {
      let delta = '';
      if (prev) {
        const d = Number(last.weight) - Number(prev.weight);
        const cls = d > 0 ? 'up' : d < 0 ? 'down' : 'flat';
        const sign = d > 0 ? '+' : '';
        delta = `<span class="tr-delta ${cls}">${d === 0 ? '=' : sign + d + ' kg'}</span>`;
      }
      evo = `<span class="tr-last">Última: <b>${esc(String(last.weight))} kg</b> · ${shortDate(last.date)}</span>${delta}`;
    }
    const spark = sparkline(arr.map(x => Number(x.weight)).filter(n => Number.isFinite(n)));
    const wVal = last ? esc(String(last.weight)) : '';
    const rVal = last && last.reps ? esc(String(last.reps)) : ex.reps;
    return `
      <div class="tr-ex" data-k="${ex.k}">
        ${demoHtml(ex)}
        <div>
          <div class="tr-ex-name">${esc(ex.name)}</div>
          <div class="tr-ex-meta">${esc(ex.muscle)} · <b>${ex.sets} × ${esc(ex.reps)}</b></div>
          <div class="tr-inputs">
            <div><label>Carga (kg)</label><input type="number" inputmode="decimal" step="0.5" min="0" placeholder="0" data-f="weight" value="${wVal}"></div>
            <div><label>Reps feitas</label><input type="text" inputmode="numeric" maxlength="8" placeholder="${esc(ex.reps)}" data-f="reps" value="${rVal}"></div>
          </div>
          <div class="tr-evo">${evo}${spark}</div>
        </div>
      </div>`;
  }

  function openModal(taskId) {
    const task = readTasks().find(t => String(t.id) === String(taskId));
    if (!task) return;
    const m = /treino\s+([abc])/i.exec(task.text || '');
    currentDate = String(task.id).replace('treino-', '');
    currentW = (m && m[1] ? m[1] : workoutForDate(currentDate)).toUpperCase();
    const plan = WORKOUTS[currentW];
    if (!plan) return;

    ensureStyles();
    const dlg = ensureDialog();
    const logs = loadLogs();
    dlg.querySelector('#trEyebrow').textContent = `Treino ${currentW} · Nível iniciante`;
    dlg.querySelector('#trTitle').textContent = plan.muscles;
    dlg.querySelector('#trSub').textContent = prettyDate(currentDate);
    dlg.querySelector('#trDone').textContent = task.done ? 'Concluído ✓' : 'Salvar e concluir ✓';
    dlg.querySelector('#trBody').innerHTML =
      cardioSection() +
      `<p class="tr-tip"><strong>Faça o cardio acima</strong> para aquecer e depois os exercícios. Cronômetro de descanso no topo; anote a carga de cada exercício para acompanhar sua evolução.</p>` +
      plan.exercises.map(ex => exerciseRow(ex, logs)).join('');
    syncCardioUI();
    if (!restInt) paintTimer();
    if (!dlg.open) dlg.showModal();
  }

  function saveSession(markDone) {
    if (!currentW || !currentDate) return;
    const logs = loadLogs();
    let count = 0;
    dialogEl.querySelectorAll('.tr-ex').forEach(row => {
      const k = row.dataset.k;
      const weight = row.querySelector('[data-f="weight"]').value.trim().replace(',', '.');
      const reps = row.querySelector('[data-f="reps"]').value.trim();
      if (weight === '' || !Number.isFinite(Number(weight))) return;
      const entry = { date: currentDate, weight: Number(weight), reps };
      const arr = (logs[k] || []).filter(e => e.date !== currentDate);
      arr.push(entry);
      arr.sort((a, b) => a.date.localeCompare(b.date));
      logs[k] = arr;
      count++;
    });
    saveLogs(logs);

    if (markDone) {
      const tasks = readTasks();
      const task = tasks.find(t => String(t.id) === 'treino-' + currentDate);
      if (task) { task.done = true; writeTasks(tasks); }
      dialogEl.close();
      toast(`Treino ${currentW} concluído! ${count} carga${count === 1 ? '' : 's'} salva${count === 1 ? '' : 's'}.`);
      setTimeout(() => window.location.reload(), 350);
      return;
    }
    toast(count ? `${count} carga${count === 1 ? '' : 's'} salva${count === 1 ? '' : 's'}.` : 'Nada para salvar ainda.');
    if (count) openModal('treino-' + currentDate); // atualiza evolução/sparklines
  }

  function toast(message) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = message; t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ------------------ botões nos cards de treino da agenda --------------- */
  function installButtons() {
    document.querySelectorAll('.task-card').forEach(card => {
      const check = card.querySelector('.check[data-id]');
      if (!check) return;
      const id = check.dataset.id;
      if (!String(id).startsWith('treino-')) return;
      const footer = card.querySelector('.task-footer');
      if (!footer || footer.querySelector('.tr-open')) return;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'tr-open';
      b.dataset.treinoId = id;
      b.innerHTML = '🏋️ Abrir treino';
      footer.appendChild(b);
    });
  }

  /* -------------------------------- init --------------------------------- */
  function init() {
    if (ensureTasks()) { window.location.reload(); return; }
    ensureStyles();
    installButtons();

    let frame = 0;
    new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(installButtons);
    }).observe(document.body, { childList: true, subtree: true });

    document.addEventListener('click', e => {
      const b = e.target.closest('.tr-open');
      if (b) { e.preventDefault(); e.stopImmediatePropagation(); openModal(b.dataset.treinoId); return; }
      // clicar no título de um card de treino também abre o painel do treino
      const title = e.target.closest('.task-title');
      if (title) {
        const check = title.closest('.task-card') && title.closest('.task-card').querySelector('.check[data-id]');
        const id = check && check.dataset.id;
        if (id && String(id).startsWith('treino-')) { e.preventDefault(); e.stopImmediatePropagation(); openModal(id); }
      }
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
