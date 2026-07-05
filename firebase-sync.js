/* =========================================================================
   firebase-sync.js — sincroniza a agenda (tarefas + treinos + config) com o
   Firestore, na conta logada. Offline-first: o localStorage continua sendo
   a fonte local; a nuvem é espelho + backup entre aparelhos.

   Regras de convivência (para não sobrescrever dados por engano):
   - No login: se a nuvem já tem dados, baixa; senão, envia o que há local.
   - Edições locais são enviadas (debounce) para a nuvem.
   - Mudanças vindas de OUTRO aparelho aparecem como aviso "toque para baixar"
     (não recarrega sozinho, evitando laços).

   Carregar DEPOIS do firebase-client.js.
   ========================================================================= */
(() => {
  'use strict';

  const TASKS = 'agenda_lagares_v3';
  const LOGS = 'agenda_treino_logs_v1';
  const META = 'agenda_treino_meta_v1';
  const CONFIG = 'agenda_lagares_config_v1';
  const REMOTE_AT = 'agenda_fb_remote_at';
  const DEVICE = 'agenda_fb_device';
  const WATCH = [TASKS, LOGS, META, CONFIG];

  const setItemOriginal = Storage.prototype.setItem;
  let interno = false;      // true = gravação nossa (não deve disparar envio)
  let unsub = null, docRef = null, pushTimer = null, enviando = false;

  function readJSON(key, fallback) {
    try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; }
    catch (_) { return fallback; }
  }
  function writeSilent(key, value) {
    interno = true;
    try { setItemOriginal.call(localStorage, key, typeof value === 'string' ? value : JSON.stringify(value)); }
    finally { interno = false; }
  }
  function deviceId() {
    let d = localStorage.getItem(DEVICE);
    if (!d) { d = 'dev-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8); writeSilent(DEVICE, d); }
    return d;
  }
  function toast(msg, tap) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('show');
    t.style.cursor = tap ? 'pointer' : '';
    t.onclick = tap || null;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.classList.remove('show'); t.onclick = null; }, tap ? 8000 : 2600);
  }

  function localSnapshot() {
    return {
      tasks: readJSON(TASKS, []),
      treinoLogs: readJSON(LOGS, {}),
      treinoMeta: readJSON(META, {}),
      config: readJSON(CONFIG, {}),
      updatedAt: Date.now(),
      device: deviceId()
    };
  }

  function applyRemote(data) {
    if (Array.isArray(data.tasks)) writeSilent(TASKS, data.tasks);
    if (data.treinoLogs && typeof data.treinoLogs === 'object') writeSilent(LOGS, data.treinoLogs);
    if (data.treinoMeta && typeof data.treinoMeta === 'object') writeSilent(META, data.treinoMeta);
    if (data.config && typeof data.config === 'object') writeSilent(CONFIG, data.config);
    writeSilent(REMOTE_AT, String(data.updatedAt || Date.now()));
    location.reload();
  }

  async function push() {
    if (!docRef || enviando) return;
    enviando = true;
    try {
      const snap = localSnapshot();
      await docRef.set(snap, { merge: true });
      writeSilent(REMOTE_AT, String(snap.updatedAt));
    } catch (e) {
      console.warn('[Agenda] Falha ao sincronizar com a nuvem:', e && e.message);
    } finally { enviando = false; }
  }
  function schedulePush() {
    if (!docRef) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(push, 1600);
  }

  async function start(user) {
    const db = window.FB && window.FB.db;
    if (!db || !user) return;
    docRef = db.collection('users').doc(user.uid);

    // pull inicial
    try {
      const doc = await docRef.get();
      const remote = doc.exists ? doc.data() : null;
      const remoteHasData = remote && Array.isArray(remote.tasks) && remote.tasks.length;
      if (remoteHasData) {
        const localAt = Number(localStorage.getItem(REMOTE_AT) || 0);
        if (Number(remote.updatedAt || 0) > localAt) { applyRemote(remote); return; }
        else schedulePush(); // local está à frente ou igual — garante a nuvem atualizada
      } else {
        await push(); // primeira vez: sobe o que existe neste aparelho
      }
    } catch (e) {
      console.warn('[Agenda] Falha ao baixar da nuvem:', e && e.message);
    }

    // ouve mudanças de outros aparelhos
    if (unsub) unsub();
    unsub = docRef.onSnapshot(snap => {
      const data = snap.data();
      if (!data || snap.metadata.hasPendingWrites) return; // ignora eco da própria gravação
      const localAt = Number(localStorage.getItem(REMOTE_AT) || 0);
      if (data.device !== deviceId() && Number(data.updatedAt || 0) > localAt) {
        toast('Atualização de outro aparelho — toque para baixar', () => applyRemote(data));
      }
    }, err => console.warn('[Agenda] onSnapshot:', err && err.message));
  }

  function stop() {
    if (unsub) { unsub(); unsub = null; }
    docRef = null;
    clearTimeout(pushTimer);
  }

  // detecta edições locais (tarefas, treinos, config) e agenda o envio
  Storage.prototype.setItem = function (chave, valor) {
    const r = setItemOriginal.apply(this, arguments);
    if (!interno && this === localStorage && WATCH.indexOf(chave) >= 0) schedulePush();
    return r;
  };

  window.addEventListener('fb-auth', ev => {
    const user = ev.detail && ev.detail.user;
    if (user) start(user); else stop();
  });

  // caso o login já tenha ocorrido antes deste script carregar
  if (window.FB && window.FB.user) start(window.FB.user);
})();
