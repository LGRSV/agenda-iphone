/* lembrete-chegada.js — avisa no celular quando o João CHEGA a um lugar salvo
   ("tirar a roupa da máquina", "bater o ponto").

   As regras ficam no próprio lugar, em agenda_lugares_v1.itens[i].lembretes, e por isso
   sincronizam junto com os lugares:
     { id, texto, dias?: [0..6] (0 = domingo), ate?: 'AAAA-MM-DD', umaVez?: true,
       intervaloMin?: 180 (mínimo entre dois avisos da mesma regra), ativo?: false (desliga) }

   Quem decide que o usuário chegou é o motor do localizacao.js (evento 'chegada': dentro do
   raio por pelo menos 60 s e sem estar em movimento). Este módulo só reage a esse evento.
   O controle do que já foi avisado fica só neste aparelho (agenda_lembretes_estado_v1): o
   localizacao.js regrava a lista de lugares inteira e apagaria um carimbo guardado nela. */
(() => {
  'use strict';

  const ESTADO_KEY = 'agenda_lembretes_estado_v1';
  const LK = 'agenda_lugares_v1';
  const INTERVALO_PADRAO_MIN = 180;
  const CHEGADA_RECENTE_MS = 20 * 60 * 1000; // evento de chegada velho (reaberto depois) não avisa de novo

  const json = (v, fb) => { try { const x = JSON.parse(v); return x == null ? fb : x; } catch (_) { return fb; } };
  const hojeIso = d => { const x = d || new Date(); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
  const norm = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

  const lerEstado = () => { const e = json(localStorage.getItem(ESTADO_KEY), {}); return e && typeof e === 'object' && !Array.isArray(e) ? e : {}; };
  const gravarEstado = e => {
    const lim = Date.now() - 120 * 86400000; // esquece o que passou de 120 dias
    for (const k of Object.keys(e)) if ((e[k].ultimo || 0) < lim) delete e[k];
    try { localStorage.setItem(ESTADO_KEY, JSON.stringify(e)); } catch (_) {}
  };

  function lugares() {
    try { if (window.AgendaLocal && typeof window.AgendaLocal.lugares === 'function') return window.AgendaLocal.lugares(); } catch (_) {}
    const w = json(localStorage.getItem(LK), null);
    return w && Array.isArray(w.itens) ? w.itens : [];
  }

  // regras do lugar que valem agora (agora = Date; estado = o que já foi avisado)
  function regrasQueValem(lugar, estado, agora) {
    const out = [];
    for (const r of Array.isArray(lugar.lembretes) ? lugar.lembretes : []) {
      if (!r || !r.id || !String(r.texto || '').trim() || r.ativo === false) continue;
      if (Array.isArray(r.dias) && r.dias.length && !r.dias.includes(agora.getDay())) continue;
      if (r.ate && hojeIso(agora) > String(r.ate)) continue;
      const e = estado[`${lugar.id}:${r.id}`] || {};
      if (r.umaVez && e.feito) continue;
      const intervalo = (Number.isFinite(Number(r.intervaloMin)) ? Number(r.intervaloMin) : INTERVALO_PADRAO_MIN) * 60000;
      if (agora.getTime() - (e.ultimo || 0) < intervalo) continue;
      out.push(r);
    }
    return out;
  }

  async function avisar(titulo, corpo) {
    try {
      if (window.AgendaNativo && typeof window.AgendaNativo.avisoImediato === 'function') {
        if (await window.AgendaNativo.avisoImediato(titulo, corpo)) return true;
      }
    } catch (_) {}
    try {
      if ('Notification' in window && Notification.permission === 'granted') {
        const reg = navigator.serviceWorker && (await navigator.serviceWorker.ready);
        if (reg && reg.showNotification) { await reg.showNotification(titulo, { body: corpo, tag: 'agenda-chegada', icon: './icon-192.png', data: { url: './' } }); return true; }
        new Notification(titulo, { body: corpo }); return true;
      }
    } catch (_) {}
    return false;
  }

  async function tratarChegada(visita, agora) {
    agora = agora || new Date();
    if (!visita || (visita.chegada && agora.getTime() - visita.chegada > CHEGADA_RECENTE_MS)) return 0;
    const lugar = lugares().find(l => l.id === visita.lugarId) || lugares().find(l => norm(l.nome) === norm(visita.nome));
    if (!lugar) return 0;
    const estado = lerEstado();
    const regras = regrasQueValem(lugar, estado, agora);
    let avisados = 0;
    for (const r of regras) {
      const k = `${lugar.id}:${r.id}`;
      estado[k] = Object.assign({}, estado[k], { ultimo: agora.getTime() }); // grava antes: um segundo evento não repete
      gravarEstado(estado);
      const ok = await avisar(`Chegou em ${lugar.nome}`, String(r.texto).trim());
      if (ok) { avisados += 1; if (r.umaVez) { estado[k].feito = true; gravarEstado(estado); } }
      else { estado[k].ultimo = 0; gravarEstado(estado); } // sem permissão de notificação: tenta de novo na próxima chegada
    }
    return avisados;
  }

  window.addEventListener('agenda:local-change', e => {
    const d = (e && e.detail) || {};
    if (d.tipo === 'chegada' && d.visita) tratarChegada(d.visita).catch(() => {});
  });

  window.AgendaLembreteChegada = { tratarChegada, regrasQueValem, _estado: lerEstado };
})();
