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

  /* ---------- animações dos exercícios (SVG + SMIL, tudo offline) -------- */
  const STROKE = 'var(--accent)';
  const svg = inner =>
    `<svg viewBox="0 0 64 64" width="100%" height="100%" fill="none" stroke="${STROKE}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
  const dot = (cx, cy, r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${STROKE}" stroke="none"/>`;
  const frontBase = () =>
    dot(32, 10, 5.5) +
    `<line x1="32" y1="15" x2="32" y2="40"/><line x1="32" y1="40" x2="25" y2="58"/><line x1="32" y1="40" x2="39" y2="58"/>`;

  // braço de segmento único (ombro -> mão) com mão animada
  function armPair(l, r, dur) {
    const seg = (sx, sy, ps) => {
      const xs = ps.map(p => p[0]).join(';'), ys = ps.map(p => p[1]).join(';');
      return `<line x1="${sx}" y1="${sy}" x2="${ps[0][0]}" y2="${ps[0][1]}">` +
        `<animate attributeName="x2" values="${xs}" dur="${dur}s" repeatCount="indefinite"/>` +
        `<animate attributeName="y2" values="${ys}" dur="${dur}s" repeatCount="indefinite"/></line>`;
    };
    return seg(26, 23, l) + seg(38, 23, r);
  }
  // braço de dois segmentos: superior fixo + antebraço animado (rosca, tríceps)
  function foreArm(elL, elR, hL, hR, dur) {
    const fa = (ex, ey, ps) => {
      const xs = ps.map(p => p[0]).join(';'), ys = ps.map(p => p[1]).join(';');
      return `<line x1="${ex}" y1="${ey}" x2="${ps[0][0]}" y2="${ps[0][1]}">` +
        `<animate attributeName="x2" values="${xs}" dur="${dur}s" repeatCount="indefinite"/>` +
        `<animate attributeName="y2" values="${ys}" dur="${dur}s" repeatCount="indefinite"/></line>`;
    };
    return `<line x1="26" y1="23" x2="${elL[0]}" y2="${elL[1]}"/><line x1="38" y1="23" x2="${elR[0]}" y2="${elR[1]}"/>` +
      fa(elL[0], elL[1], hL) + fa(elR[0], elR[1], hR);
  }

  const ANIM = {
    press: () => svg(frontBase() + armPair([[18, 30], [20, 6], [18, 30]], [[46, 30], [44, 6], [46, 30]], 1.5)),
    fly: () => svg(frontBase() + armPair([[10, 24], [28, 30], [10, 24]], [[54, 24], [36, 30], [54, 24]], 1.6)),
    lateral: () => svg(frontBase() + armPair([[22, 40], [10, 20], [22, 40]], [[42, 40], [54, 20], [42, 40]], 1.6)),
    pulldown: () => svg(frontBase() + armPair([[20, 4], [24, 22], [20, 4]], [[44, 4], [40, 22], [44, 4]], 1.5)),
    row: () => svg(frontBase() + armPair([[16, 36], [28, 28], [16, 36]], [[48, 36], [36, 28], [48, 36]], 1.4)),
    pushdown: () => svg(frontBase() + foreArm([24, 36], [40, 36], [[28, 30], [24, 48], [28, 30]], [[36, 30], [40, 48], [36, 30]], 1.2)),
    curl: () => svg(frontBase() + foreArm([24, 38], [40, 38], [[26, 52], [30, 28], [26, 52]], [[38, 52], [34, 28], [38, 52]], 1.4)),
    squat: () => svg(
      `<circle cx="30" cy="10" r="5" fill="${STROKE}" stroke="none"><animate attributeName="cy" values="10;18;10" dur="1.6s" repeatCount="indefinite"/></circle>` +
      `<line x1="30" y1="15" x2="30" y2="40"><animate attributeName="y1" values="15;23;15" dur="1.6s" repeatCount="indefinite"/><animate attributeName="y2" values="40;47;40" dur="1.6s" repeatCount="indefinite"/></line>` +
      `<line x1="30" y1="22" x2="42" y2="26"><animate attributeName="y1" values="22;30;22" dur="1.6s" repeatCount="indefinite"/><animate attributeName="y2" values="26;22;26" dur="1.6s" repeatCount="indefinite"/></line>` +
      `<polyline points="30,40 27,49 27,58"><animate attributeName="points" values="30,40 27,49 27,58; 30,47 22,50 27,58; 30,40 27,49 27,58" dur="1.6s" repeatCount="indefinite"/></polyline>` +
      `<polyline points="30,40 33,49 33,58"><animate attributeName="points" values="30,40 33,49 33,58; 30,47 38,50 33,58; 30,40 33,49 33,58" dur="1.6s" repeatCount="indefinite"/></polyline>`),
    legpress: () => svg(
      dot(16, 24, 5) +
      `<line x1="16" y1="28" x2="28" y2="40"/>` +
      `<line x1="12" y1="22" x2="24" y2="42" stroke-width="2" opacity=".45"/>` +
      `<polyline points="28,40 36,34 32,26"><animate attributeName="points" values="28,40 36,34 32,26; 28,40 46,33 54,28; 28,40 36,34 32,26" dur="1.5s" repeatCount="indefinite"/></polyline>` +
      `<polyline points="28,42 36,38 32,30"><animate attributeName="points" values="28,42 36,38 32,30; 28,42 46,37 54,32; 28,42 36,38 32,30" dur="1.5s" repeatCount="indefinite"/></polyline>` +
      `<line x1="34" y1="20" x2="34" y2="34" stroke-width="3"><animate attributeName="x1" values="34;56;34" dur="1.5s" repeatCount="indefinite"/><animate attributeName="x2" values="34;56;34" dur="1.5s" repeatCount="indefinite"/></line>`),
    legext: () => svg(
      dot(26, 12, 5) +
      `<line x1="26" y1="17" x2="26" y2="38"/>` +
      `<line x1="26" y1="38" x2="40" y2="38"/>` +
      `<line x1="40" y1="38" x2="40" y2="52"><animate attributeName="x2" values="40;54;40" dur="1.5s" repeatCount="indefinite"/><animate attributeName="y2" values="52;38;52" dur="1.5s" repeatCount="indefinite"/></line>` +
      `<line x1="18" y1="40" x2="30" y2="40" stroke-width="2" opacity=".45"/>` +
      `<line x1="26" y1="23" x2="34" y2="30"/>`),
    calf: () => svg(
      `<g><animateTransform attributeName="transform" type="translate" values="0 4; 0 -3; 0 4" dur="1s" repeatCount="indefinite"/>` +
      frontBase() +
      `<line x1="26" y1="23" x2="22" y2="40"/><line x1="38" y1="23" x2="42" y2="40"/></g>` +
      `<line x1="22" y1="60" x2="42" y2="60" stroke-width="2" opacity=".45"/>`),
    abs: () => svg(
      `<polyline points="22,46 30,40 26,52"/>` +
      `<polyline points="22,46 34,46 44,46"><animate attributeName="points" values="22,46 34,46 44,46; 22,46 30,40 36,32; 22,46 34,46 44,46" dur="1.5s" repeatCount="indefinite"/></polyline>` +
      `<circle cx="48" cy="46" r="4.5" fill="${STROKE}" stroke="none"><animate attributeName="cx" values="48;39;48" dur="1.5s" repeatCount="indefinite"/><animate attributeName="cy" values="46;29;46" dur="1.5s" repeatCount="indefinite"/></circle>` +
      `<line x1="18" y1="52" x2="52" y2="52" stroke-width="2" opacity=".45"/>`)
  };
  const animFor = mov => (ANIM[mov] || ANIM.press)();

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
  const dayIndex = dstr => Math.floor(Date.parse(dstr + 'T12:00:00') / 86400000);
  const workoutForDate = dstr => ['A', 'B', 'C'][(((dayIndex(dstr) % 3) + 3) % 3)];
  const esc = v => { const d = document.createElement('div'); d.textContent = v; return d.innerHTML; };
  function prettyDate(dstr) {
    try { return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(dstr + 'T12:00:00')); }
    catch (_) { return dstr; }
  }
  const shortDate = dstr => { const p = dstr.split('-'); return `${p[2]}/${p[1]}`; };

  /* -------------- gera os cards de treino diários na agenda -------------- */
  function ensureTasks() {
    const meta = readJSON(META_KEY, {}) || {};
    const t0 = today();
    if (meta.generatedUntil && meta.generatedUntil >= addDays(t0, REGEN)) return false;

    const target = addDays(t0, HORIZON);
    const tasks = readTasks();
    const have = new Set(tasks.filter(x => String(x.id).startsWith('treino-')).map(x => x.date));
    let added = 0;
    for (let d = t0; d <= target; d = addDays(d, 1)) {
      if (have.has(d)) continue;
      const w = workoutForDate(d);
      tasks.push({
        id: 'treino-' + d,
        text: `🏋️ Treino ${w} · ${WORKOUTS[w].muscles}`,
        date: d, time: '06:00', tag: 'saude', reminder: 0, done: false
      });
      added++;
    }
    meta.generatedUntil = target;
    localStorage.setItem(META_KEY, JSON.stringify(meta));
    if (added > 0) { writeTasks(tasks); return true; }
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
      .tr-body{overflow-y:auto;padding:12px 14px 8px}
      .tr-tip{margin:0 0 12px;padding:11px 13px;border:1px solid var(--line);border-radius:14px;background:var(--soft);color:var(--muted);font-size:12px;line-height:1.45}
      .tr-tip strong{color:var(--text)}
      .tr-ex{display:grid;grid-template-columns:72px minmax(0,1fr);gap:12px;padding:13px 0;border-top:1px solid var(--line)}
      .tr-ex:first-of-type{border-top:0}
      .tr-demo{width:72px;height:72px;border:1px solid var(--line);border-radius:16px;background:var(--soft);overflow:hidden}
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
        <div class="tr-body" id="trBody"></div>
        <div class="tr-foot">
          <button class="tr-btn ghost" id="trSave" type="button">Salvar cargas</button>
          <button class="tr-btn solid" id="trDone" type="button">Salvar e concluir ✓</button>
        </div>
      </div>`;
    document.body.appendChild(dialogEl);
    dialogEl.querySelector('#trClose').addEventListener('click', () => dialogEl.close());
    dialogEl.addEventListener('click', e => { if (e.target === dialogEl) dialogEl.close(); });
    dialogEl.querySelector('#trSave').addEventListener('click', () => saveSession(false));
    dialogEl.querySelector('#trDone').addEventListener('click', () => saveSession(true));
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
        <div class="tr-demo">${animFor(ex.mov)}</div>
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
      `<p class="tr-tip"><strong>Aquecimento:</strong> 5 min de esteira/bike. <strong>Descanso:</strong> 60–90 s entre as séries. Anote a carga de cada exercício para acompanhar sua evolução.</p>` +
      plan.exercises.map(ex => exerciseRow(ex, logs)).join('');
    dlg.showModal();
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
      if (!b) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      openModal(b.dataset.treinoId);
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
