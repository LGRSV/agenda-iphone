/* =========================================================================
   firebase-client.js — inicializa o Firebase (Auth + App Check + Functions),
   injeta o botão de conta na barra do app e expõe o backend do Jarvis.

   Fica "adormecido" enquanto o firebase-config.js não estiver preenchido:
   nesse caso o app continua no modo local antigo, sem quebrar nada.

   Carregar DEPOIS dos SDKs compat do Firebase e do firebase-config.js.
   Expõe:
     window.FB = { app, auth, db, functions, user }
     window.JarvisBackend = { ready(), aiGemini(body), ttsGemini(text), ttsEleven(text) }
   e dispara o evento window 'fb-auth' (detail: { user }) a cada mudança de login.
   ========================================================================= */
(() => {
  'use strict';

  // Interruptor geral: só ativa o Firebase quando explicitamente ligado.
  if (window.FIREBASE_ENABLED !== true) {
    console.info('[Agenda] Firebase desligado — modo local (GitHub).');
    return;
  }

  const cfg = window.FIREBASE_CONFIG;
  const configured = cfg && typeof cfg.apiKey === 'string' && !/^SUA_|^SEU_/.test(cfg.apiKey);
  if (!configured) {
    console.info('[Agenda] Firebase ainda não configurado — rodando em modo local.');
    return;
  }
  if (typeof firebase === 'undefined' || !firebase.initializeApp) {
    console.warn('[Agenda] SDKs do Firebase não carregaram.');
    return;
  }

  const region = window.FIREBASE_REGION || 'southamerica-east1';
  const app = firebase.initializeApp(cfg);

  // App Check protege as Cloud Functions contra chamadas de fora do app.
  const siteKey = window.FIREBASE_APPCHECK_SITE_KEY;
  if (siteKey && !/^SUA_/.test(siteKey) && firebase.appCheck) {
    try { firebase.appCheck().activate(siteKey, true); }
    catch (e) { console.warn('[Agenda] App Check não ativado:', e); }
  }

  const auth = firebase.auth();
  const db = firebase.firestore ? firebase.firestore() : null;
  const functions = firebase.app().functions(region);

  window.FB = { app, auth, db, functions, user: null };

  function call(name, payload) {
    return functions.httpsCallable(name)(payload || {});
  }
  window.JarvisBackend = {
    ready: () => !!(auth.currentUser),
    aiGemini: (body) => call('aiGemini', { body }).then(r => r.data && r.data.text),
    ttsGemini: (text) => call('ttsGemini', { text }).then(r => r.data),
    ttsEleven: (text) => call('ttsEleven', { text }).then(r => r.data && r.data.audioBase64)
  };

  /* ------------------------- UI de conta/login ------------------------- */
  function ensureButton() {
    const actions = document.querySelector('.head-actions');
    if (!actions || document.getElementById('accountBtn')) return;
    const b = document.createElement('button');
    b.id = 'accountBtn';
    b.className = 'icon-btn';
    b.type = 'button';
    b.title = 'Conta';
    b.setAttribute('aria-label', 'Conta e sincronização');
    b.textContent = '👤';
    actions.insertBefore(b, actions.firstChild);
    b.addEventListener('click', onAccountClick);
  }

  function toast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 2600);
  }

  async function signIn() {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
      await auth.signInWithPopup(provider);
    } catch (e) {
      // iPhone em modo standalone às vezes bloqueia popup — cai para redirect
      if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/cancelled-popup-request' || e.code === 'auth/operation-not-supported-in-this-environment')) {
        try { await auth.signInWithRedirect(provider); } catch (_) { toast('Não foi possível entrar.'); }
      } else if (e && e.code !== 'auth/popup-closed-by-user') {
        toast('Não foi possível entrar.');
      }
    }
  }

  function onAccountClick() {
    const u = auth.currentUser;
    if (!u) { signIn(); return; }
    if (confirm(`Conectado como ${u.email || u.displayName || 'usuário'}.\n\nDeseja sair desta conta neste aparelho?`)) {
      auth.signOut();
    }
  }

  auth.onAuthStateChanged(user => {
    window.FB.user = user;
    ensureButton();
    const b = document.getElementById('accountBtn');
    if (b) {
      b.textContent = user ? '✅' : '👤';
      b.title = user ? ('Conta: ' + (user.email || user.displayName || 'conectado')) : 'Entrar / sincronizar';
    }
    if (user) toast('Sincronização ativa: ' + (user.displayName || user.email || 'conta conectada'));
    window.dispatchEvent(new CustomEvent('fb-auth', { detail: { user } }));
  });

  // Conclui o fluxo de redirect (quando o popup não é permitido)
  auth.getRedirectResult().catch(() => {});

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureButton);
  else ensureButton();
})();
