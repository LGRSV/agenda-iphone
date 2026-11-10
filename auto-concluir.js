/* auto-concluir.js — conclui sozinha a tarefa quando o usuário CHEGA ao local dela.

   Liga por tarefa: no campo Local, "Concluir sozinho quando eu chegar lá" grava
   agenda_notas_v1[id].local.autoConcluir = true (local-tarefa.js).

   Quem decide que o usuário chegou é o MOTOR do localizacao.js (lugares salvos,
   ≥ 60 s parado dentro do raio, precisão boa, etc.). Aqui não há detecção própria
   com fix avulso: só se lê as VISITAS que o motor registrou neste aparelho.

   Regra: tarefa pendente, com autoConcluir, de HOJE, cujo local corresponde a um
   lugar salvo (mesmo lugarId, ou centro do local a ≤ raio do lugar), e há visita
   a esse lugar que CHEGOU na janela [2 h antes do horário … fim do dia] (sem
   horário: o dia todo) ou que já estava lá e continua no horário da tarefa.
   (Antes bastava a visita "tocar" a janela: quem saía do turno da manhã às 11:37
   tinha a tarefa da tarde, 13:30, concluída às 11:30 sem ter voltado.)
   Visitas: deste aparelho, ou de outro aparelho da MESMA conta (campo uid, gravado
   pelo localizacao.js); visita sem uid de outro aparelho não conta (pode ser de
   outra pessoa na agenda compartilhada).
   Tarefa repetida: cada ocorrência é uma tarefa com a sua data, então só a de hoje entra.

   Conclui por AgendaAPI.completeAuto (mesmo caminho do check: syncRev, aviso ao
   parceiro em tarefa compartilhada, render), chama o lembrete-persistente na hora
   (satélites) e grava na nota, para auditoria e para não concluir de novo se o
   usuário reabrir: notas[id].autoConcluida = {em, data, lugar, lugarId, chegada, visitaId, dev}. */
(() => {
  'use strict';

  const TK = 'agenda_lagares_v3';
  const NK = 'agenda_notas_v1';
  const ANTES_MS = 2 * 3600 * 1000;
  // espera o primeiro download da nuvem (supabase-shared-storage sobrescreve o
  // armazenamento local ao abrir): concluir antes disso seria desfeito.
  const INICIO = Date.now() + 6000;

  const json = (v, fb) => { try { const x = JSON.parse(v); return x == null ? fb : x; } catch (_) { return fb; } };
  const pad = n => String(n).padStart(2, '0');
  const isoDia = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  function haversine(aLat, aLng, bLat, bLng) {
    const R = 6371000, r = Math.PI / 180;
    const dLat = (bLat - aLat) * r, dLng = (bLng - aLng) * r;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  // janela em que a presença conta; null se a tarefa não é de hoje
  function janela(t, agora) {
    const hoje = new Date(agora);
    if (!t || t.date !== isoDia(hoje)) return null;
    const d0 = new Date(hoje); d0.setHours(0, 0, 0, 0);
    const d1 = new Date(d0); d1.setDate(d1.getDate() + 1);
    let ini = d0.getTime(), hora = d0.getTime();
    const m = /^(\d{2}):(\d{2})$/.exec(String(t.time || ''));
    if (m) { const h = new Date(d0); h.setHours(Number(m[1]), Number(m[2]), 0, 0); hora = h.getTime(); ini = Math.max(ini, hora - ANTES_MS); }
    return { ini, hora, fim: d1.getTime() };
  }
  // lugar salvo que corresponde ao local da tarefa
  function lugarDaTarefa(local, lugares) {
    if (!local || !Array.isArray(lugares)) return null;
    if (local.lugarId) { const l = lugares.find(x => String(x.id) === String(local.lugarId)); if (l) return l; }
    let melhor = null, dm = Infinity;
    for (const l of lugares) {
      const d = haversine(Number(local.lat), Number(local.lng), l.lat, l.lng);
      if (d <= (l.raio || 100) && d < dm) { melhor = l; dm = d; }
    }
    return melhor;
  }
  // visita ao lugar que chegou na janela, ou que já estava lá no horário da tarefa;
  // prefere a que está aberta. Aparelho: este, ou outro da mesma conta (uid).
  function presenca(lugar, jan, agora, visitas, dev, uid) {
    const hora = jan.hora == null ? jan.ini : jan.hora;
    const ok = (visitas || []).filter(v => v && !v.descartada && v.lugarId === lugar.id &&
      (!dev || !v.dev || v.dev === dev || (!!uid && v.uid === uid)) &&
      v.chegada <= Math.min(jan.fim, agora) &&
      (v.chegada >= jan.ini || (agora >= hora && (v.saida == null ? agora : v.saida) >= hora)));
    return ok.find(v => v.saida == null) || ok.sort((a, b) => b.chegada - a.chegada)[0] || null;
  }
  // função pura (testável): tarefas a concluir agora
  function candidatas(tarefas, notas, lugares, visitas, dev, agora, uid) {
    const out = [];
    for (const t of tarefas || []) {
      if (!t || t.id == null || t.done || t.hidden) continue;
      const n = notas[String(t.id)];
      const local = n && n.local;
      if (!local || local.autoConcluir !== true) continue;
      if (n.autoConcluida && n.autoConcluida.data === t.date) continue; // já concluiu uma vez; se reabriu, respeita
      const jan = janela(t, agora); if (!jan || agora < jan.ini) continue;
      const lugar = lugarDaTarefa(local, lugares); if (!lugar) continue;
      const v = presenca(lugar, jan, agora, visitas, dev, uid); if (!v) continue;
      out.push({ tarefa: t, lugar, visita: v });
    }
    return out;
  }

  function avisar(msg) {
    const el = document.getElementById('toast'); if (!el) return;
    el.style.zIndex = '200';
    el.textContent = msg; el.classList.add('show');
    clearTimeout(avisar._t); avisar._t = setTimeout(() => el.classList.remove('show'), 5000);
  }

  let rodando = false;
  function avaliar() {
    const api = window.AgendaAPI, loc = window.AgendaLocal;
    if (rodando || !api || !loc || typeof loc.visitas !== 'function') return [];
    rodando = true;
    try {
      const tarefas = json(localStorage.getItem(TK), []);
      const notas = json(localStorage.getItem(NK), {});
      if (!Array.isArray(tarefas) || !notas || typeof notas !== 'object') return [];
      const dev = typeof loc.dispositivo === 'function' ? loc.dispositivo() : '';
      const agora = Date.now();
      let uid = '';
      try { const u = window.SupabaseAgenda && window.SupabaseAgenda.getUser && window.SupabaseAgenda.getUser(); uid = u && u.id ? String(u.id) : ''; } catch (_) {}
      const lista = candidatas(tarefas, notas, loc.lugares(), loc.visitas(2), dev, agora, uid);
      const feitas = [];
      for (const c of lista) {
        const id = String(c.tarefa.id);
        const ok = typeof api.completeAuto === 'function' ? api.completeAuto(id) : api.completeById(id);
        if (!ok) continue;
        const ns = json(localStorage.getItem(NK), {});
        const prev = ns[id] && typeof ns[id] === 'object' ? ns[id] : {};
        ns[id] = { ...prev, autoConcluida: { em: Date.now(), data: c.tarefa.date, lugar: c.lugar.nome, lugarId: c.lugar.id, chegada: c.visita.chegada, visitaId: c.visita.id, dev: dev || '' }, syncRev: Date.now() };
        localStorage.setItem(NK, JSON.stringify(ns));
        feitas.push(c);
      }
      if (feitas.length) {
        try { window.AgendaLembretePersistente && window.AgendaLembretePersistente.ciclo(); } catch (_) {}
        const msg = feitas.length === 1
          ? `✓ Concluída automaticamente: ${feitas[0].tarefa.text} (chegou em ${feitas[0].lugar.nome})`
          : `✓ ${feitas.length} tarefas concluídas automaticamente (chegou em ${[...new Set(feitas.map(f => f.lugar.nome))].join(', ')})`;
        avisar(msg);
        if (document.hidden && window.AgendaNativo && window.AgendaNativo.avisoImediato) {
          feitas.forEach(f => window.AgendaNativo.avisoImediato('Concluída automaticamente', `${f.tarefa.text} — chegou em ${f.lugar.nome}`));
        }
        try { window.dispatchEvent(new CustomEvent('agenda:auto-concluida', { detail: { ids: feitas.map(f => String(f.tarefa.id)) } })); } catch (_) {}
      }
      return feitas;
    } catch (e) {
      try { console.warn('[auto-concluir]', e); } catch (_) {}
      return [];
    } finally { rodando = false; }
  }

  let tm = 0;
  function agendar(ms) {
    clearTimeout(tm);
    tm = setTimeout(avaliar, Math.max(ms == null ? 800 : ms, INICIO - Date.now()));
  }
  window.addEventListener('agenda:local-change', e => {
    const tipo = e && e.detail && e.detail.tipo;
    // chegada: na hora (no app nativo pode estar em segundo plano, com o GPS acordando o JS)
    if (tipo === 'chegada') { if (Date.now() >= INICIO) avaliar(); else agendar(); }
    else if (tipo === 'sync' || tipo === 'lugares' || tipo === 'boot') agendar();
  });
  window.addEventListener('agenda:remote-sync', () => agendar(1500));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) agendar(1500); });
  setInterval(avaliar, 60000); // a janela pode abrir com o usuário já lá dentro
  agendar();

  window.AgendaAutoConcluir = { avaliar, agendar, candidatas, janela, lugarDaTarefa, ANTES_MS };
})();
