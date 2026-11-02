/* nativo.js — recursos do app nativo da Agenda (LGRSV/agenda-app, instalado pelo AltStore).

   Só faz alguma coisa dentro do app (window.Capacitor nativo). No Safari/PWA não roda nada.
   1) GPS em segundo plano: quando a localização da Agenda está ligada (AgendaLocal.ativo()),
      o plugin BackgroundGeolocation entrega as posições mesmo com o app fechado/tela apagada
      e elas entram no mesmo motor de chegadas e saídas do localizacao.js.
   2) Lembretes locais: agenda no próprio iPhone as notificações das tarefas com horário e
      lembrete (mesma regra do checkAlerts: data+hora menos `reminder` minutos). Tocam com o
      app fechado e sem internet. Limite do iOS: 64 pendentes; usamos até 50, os mais próximos.
   3) Service worker: no app a página vem direto da rede; a 1ª vez, depois que o sw.js fica
      pronto, recarrega uma vez para ele montar a página completa (scripts injetados). */
(() => {
  'use strict';
  const C = window.Capacitor;
  if (!C || typeof C.isNativePlatform !== 'function' || !C.isNativePlatform()) return;

  const BG = C.registerPlugin('BackgroundGeolocation');
  const LN = C.registerPlugin('LocalNotifications');
  const TK = 'agenda_lagares_v3';
  const NK = 'agenda_notas_v1';
  const SIG_KEY = 'agenda_nativo_lembretes_sig';
  const log = (...a) => { try { console.log('[nativo]', ...a); } catch (_) {} };
  document.documentElement.classList.add('app-nativo');

  // ---------- 3) service worker: recarregar uma vez quando ele assumir ----------
  try {
    if ('serviceWorker' in navigator && !navigator.serviceWorker.controller && !sessionStorage.getItem('nativo_sw_reload')) {
      navigator.serviceWorker.ready.then(() => {
        sessionStorage.setItem('nativo_sw_reload', '1');
        setTimeout(() => location.reload(), 300);
      }).catch(() => {});
    }
  } catch (_) {}

  // ---------- 1) GPS em segundo plano ----------
  let watcherId = null;
  async function ligarGps() {
    if (watcherId) return;
    try {
      watcherId = await BG.addWatcher({
        backgroundTitle: 'Agenda',
        backgroundMessage: 'Registrando chegadas e saídas dos seus lugares.',
        requestPermissions: true,
        stale: false,
        distanceFilter: 25
      }, (loc, err) => {
        if (err) {
          log('gps erro', err.code || err.message);
          if (err.code === 'NOT_AUTHORIZED') desligarGps();
          return;
        }
        if (!loc || !window.AgendaLocal || typeof window.AgendaLocal._processarFix !== 'function') return;
        window.AgendaLocal._processarFix({
          coords: { latitude: loc.latitude, longitude: loc.longitude, accuracy: loc.accuracy, speed: loc.speed },
          timestamp: Number(loc.time) || Date.now()
        });
      });
      log('gps ligado');
    } catch (e) { watcherId = null; log('gps falhou', e && e.message); }
  }
  async function desligarGps() {
    if (!watcherId) return;
    const id = watcherId; watcherId = null;
    try { await BG.removeWatcher({ id }); } catch (_) {}
    log('gps desligado');
  }
  function conferirGps() {
    const L = window.AgendaLocal;
    if (!L || typeof L.ativo !== 'function') return;
    if (L.ativo()) ligarGps(); else desligarGps();
  }

  // ---------- 2) lembretes locais ----------
  const ler = (k, padrao) => { try { const v = JSON.parse(localStorage.getItem(k) || ''); return v ?? padrao; } catch (_) { return padrao; } };
  function idNum(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h) || 1; }
  function saidaFinanceira(t, notas) {
    if (!t || t.tag !== 'financeiro') return false;
    const n = notas[String(t.id)]; return !!(n && n.movimento === 'saida');
  }
  function proximosLembretes() {
    const tarefas = ler(TK, []), notas = ler(NK, {}) || {};
    if (!Array.isArray(tarefas)) return [];
    const agora = Date.now(), limite = agora + 21 * 86400000;
    const lista = [];
    for (const t of tarefas) {
      if (!t || t.done || !t.time || !t.date || !(Number(t.reminder) >= 0) || saidaFinanceira(t, notas)) continue;
      const quando = new Date(`${t.date}T${t.time}:00`).getTime() - Number(t.reminder) * 60000;
      if (!Number.isFinite(quando) || quando <= agora + 5000 || quando > limite) continue;
      lista.push({
        id: idNum(`${t.id}-${quando}`),
        title: 'Lembrete da agenda',
        body: Number(t.reminder) > 0 ? `${t.text} · começa em ${t.reminder} min` : `${t.text} · é agora`,
        schedule: { at: new Date(quando), allowWhileIdle: true },
        extra: { taskId: String(t.id) }
      });
    }
    return lista.sort((a, b) => a.schedule.at - b.schedule.at).slice(0, 50);
  }
  let permissaoNotif = null;
  async function sincronizarLembretes() {
    try {
      if (permissaoNotif === null) {
        const p = await LN.checkPermissions();
        permissaoNotif = p.display === 'granted' ? 'granted' : (await LN.requestPermissions()).display;
      }
      if (permissaoNotif !== 'granted') return;
      const lista = proximosLembretes();
      const sig = lista.map(n => `${n.id}:${+n.schedule.at}:${n.body}`).join('|');
      if (sig === localStorage.getItem(SIG_KEY)) return;
      const pend = await LN.getPending();
      if (pend && pend.notifications && pend.notifications.length) {
        await LN.cancel({ notifications: pend.notifications.map(n => ({ id: n.id })) });
      }
      if (lista.length) await LN.schedule({ notifications: lista });
      localStorage.setItem(SIG_KEY, sig);
      log('lembretes agendados', lista.length);
    } catch (e) { log('lembretes falharam', e && e.message); }
  }

  // ---------- ciclo ----------
  function ciclo() { conferirGps(); sincronizarLembretes(); }
  window.addEventListener('load', () => setTimeout(ciclo, 2500));
  setInterval(ciclo, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) ciclo(); });
  window.addEventListener('storage', e => { if (e.key === TK) sincronizarLembretes(); });
  window.AgendaNativo = { ciclo, ligarGps, desligarGps, sincronizarLembretes, proximosLembretes };
})();
