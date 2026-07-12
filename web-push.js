/*
  Web Push — Agenda Lagares
  Registra o aparelho no PushManager e salva a assinatura no Supabase.
  A chave VAPID pública pode permanecer no frontend; a chave privada fica somente no backend.
*/
(() => {
  'use strict';

  const MODULE_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
  const CONFIG_KEY = 'agenda_supabase_config_v1';
  const VAPID_PUBLIC_KEY = 'BHzqjO-Vj9a_HfGo7SNPJc6M-aOEzrc_xmSdglCg27WBehZDRDBiOWoMqSIR4VxjiT5GIhEzBGdxQblgYfH3TaE';
  const PANEL_ID = 'agendaWebPushPanel';
  const STATUS_ID = 'agendaWebPushStatus';
  const ACTIVATE_ID = 'agendaWebPushActivate';
  const TEST_ID = 'agendaWebPushTest';
  const DISABLE_ID = 'agendaWebPushDisable';
  const STYLE_ID = 'agendaWebPushStyles';

  let clientPromise = null;
  let busy = false;

  const readJson = (key, fallback = {}) => {
    try { return JSON.parse(localStorage.getItem(key) || '') || fallback; }
    catch (_) { return fallback; }
  };

  const getClient = async () => {
    if (!clientPromise) {
      clientPromise = (async () => {
        const cfg = readJson(CONFIG_KEY);
        if (!cfg.url || !cfg.publishableKey) throw new Error('Backend da Agenda não configurado.');
        const { createClient } = await import(MODULE_URL);
        return createClient(cfg.url, cfg.publishableKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
        });
      })();
    }
    return clientPromise;
  };

  const getAuthenticatedContext = async () => {
    const sb = await getClient();
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    if (!data.session?.user) throw new Error('Entre na Agenda pelo botão de acesso antes de ativar as notificações.');
    return { sb, session: data.session, user: data.session.user };
  };

  const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = () => navigator.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches;
  const supportsPush = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

  const urlBase64ToUint8Array = value => {
    const padding = '='.repeat((4 - value.length % 4) % 4);
    const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map(char => char.charCodeAt(0)));
  };

  const arrayBufferToBase64Url = buffer => {
    const bytes = new Uint8Array(buffer || new ArrayBuffer(0));
    let binary = '';
    bytes.forEach(byte => { binary += String.fromCharCode(byte); });
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  };

  const deviceLabel = () => {
    if (isIOS()) return /iPad/.test(navigator.userAgent) ? 'iPad' : 'iPhone';
    if (/Android/i.test(navigator.userAgent)) return 'Android';
    return 'Navegador';
  };

  const ensureRegistration = async () => {
    let registration = await navigator.serviceWorker.getRegistration('./');
    if (!registration) registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    await navigator.serviceWorker.ready;
    return registration;
  };

  const currentSubscription = async () => {
    if (!supportsPush()) return null;
    const registration = await ensureRegistration();
    return registration.pushManager.getSubscription();
  };

  const setStatus = (message, type = '') => {
    const element = document.getElementById(STATUS_ID);
    if (!element) return;
    element.textContent = message;
    element.dataset.type = type;
  };

  const setBusy = value => {
    busy = value;
    [ACTIVATE_ID, TEST_ID, DISABLE_ID].forEach(id => {
      const button = document.getElementById(id);
      if (button) button.disabled = value;
    });
  };

  const saveSubscription = async subscription => {
    const { sb, user } = await getAuthenticatedContext();
    const p256dh = subscription.getKey('p256dh');
    const auth = subscription.getKey('auth');
    if (!p256dh || !auth) throw new Error('O navegador não forneceu as chaves da assinatura.');

    const { error } = await sb.from('push_subscriptions').upsert({
      user_id: user.id,
      endpoint: subscription.endpoint,
      p256dh: arrayBufferToBase64Url(p256dh),
      auth_key: arrayBufferToBase64Url(auth),
      expiration_time: subscription.expirationTime == null ? null : Math.trunc(subscription.expirationTime),
      user_agent: navigator.userAgent,
      device_label: deviceLabel(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Araguaina',
      active: true,
      last_error: null,
      updated_at: new Date().toISOString()
    }, { onConflict: 'endpoint' });
    if (error) throw error;
  };

  const activate = async () => {
    if (busy) return;
    if (!supportsPush()) {
      setStatus('Este navegador não oferece Web Push neste modo.', 'error');
      return;
    }
    if (isIOS() && !isStandalone()) {
      setStatus('No iPhone, abra a Agenda pelo ícone adicionado à Tela de Início para ativar notificações.', 'error');
      return;
    }

    setBusy(true);
    setStatus('Solicitando autorização…');
    try {
      await getAuthenticatedContext();
      const permission = Notification.permission === 'default'
        ? await Notification.requestPermission()
        : Notification.permission;
      if (permission !== 'granted') throw new Error('A permissão de notificações não foi concedida no iPhone.');

      const registration = await ensureRegistration();
      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });
      }
      await saveSubscription(subscription);
      setStatus('Notificações em segundo plano estão ativas neste aparelho.', 'success');
      await refreshButtons();
    } catch (error) {
      setStatus(String(error?.message || error || 'Não foi possível ativar as notificações.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const test = async () => {
    if (busy) return;
    setBusy(true);
    setStatus('Enviando notificação de teste…');
    try {
      const subscription = await currentSubscription();
      if (!subscription) throw new Error('Ative as notificações neste aparelho primeiro.');
      await saveSubscription(subscription);
      const { sb } = await getAuthenticatedContext();
      const { data, error } = await sb.functions.invoke('agenda-web-push', { body: { mode: 'test' } });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error || 'O backend não confirmou o envio do teste.');
      setStatus('Teste enviado. A notificação deve aparecer em instantes.', 'success');
    } catch (error) {
      setStatus(String(error?.message || error || 'Falha no teste de notificação.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (busy) return;
    setBusy(true);
    setStatus('Desativando neste aparelho…');
    try {
      const subscription = await currentSubscription();
      if (subscription) {
        try {
          const { sb, user } = await getAuthenticatedContext();
          const { error } = await sb.from('push_subscriptions')
            .delete()
            .eq('user_id', user.id)
            .eq('endpoint', subscription.endpoint);
          if (error) throw error;
        } finally {
          await subscription.unsubscribe();
        }
      }
      setStatus('Notificações em segundo plano desativadas neste aparelho.');
      await refreshButtons();
    } catch (error) {
      setStatus(String(error?.message || error || 'Não foi possível desativar.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const refreshButtons = async () => {
    const activateButton = document.getElementById(ACTIVATE_ID);
    const testButton = document.getElementById(TEST_ID);
    const disableButton = document.getElementById(DISABLE_ID);
    if (!activateButton || !testButton || !disableButton) return;

    if (!supportsPush()) {
      activateButton.hidden = false;
      testButton.hidden = true;
      disableButton.hidden = true;
      setStatus('Web Push indisponível neste navegador.', 'error');
      return;
    }

    try {
      const subscription = await currentSubscription();
      const active = Notification.permission === 'granted' && Boolean(subscription);
      activateButton.hidden = active;
      testButton.hidden = !active;
      disableButton.hidden = !active;
      if (active) {
        setStatus('Notificações em segundo plano estão ativas neste aparelho.', 'success');
        saveSubscription(subscription).catch(() => {});
      } else if (Notification.permission === 'denied') {
        setStatus('As notificações estão bloqueadas nos Ajustes do iPhone.', 'error');
      } else if (isIOS() && !isStandalone()) {
        setStatus('Abra a Agenda pelo ícone da Tela de Início para ativar notificações.');
      } else {
        setStatus('Ative para receber lembretes mesmo com a Agenda fechada.');
      }
    } catch (error) {
      setStatus(String(error?.message || error), 'error');
    }
  };

  const ensureStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${PANEL_ID}{margin:14px 0;padding:14px;border:1px solid var(--line);border-radius:16px;background:var(--soft)}
      #${PANEL_ID} h4{margin:0 0 6px;font-size:15px;color:var(--text)}
      #${STATUS_ID}{margin:0 0 12px;color:var(--muted);font-size:13px;line-height:1.42}
      #${STATUS_ID}[data-type="success"]{color:#78d88b}
      #${STATUS_ID}[data-type="error"]{color:var(--danger)}
      #${PANEL_ID} .push-actions{display:grid;gap:8px}
      #${PANEL_ID} button{width:100%;min-height:46px}
      #${PANEL_ID} .push-note{display:block;margin-top:10px;color:var(--faint);font-size:11px;line-height:1.4}
    `;
    document.head.appendChild(style);
  };

  const install = () => {
    const dialog = document.getElementById('alertsDialog');
    if (!dialog || document.getElementById(PANEL_ID)) return;
    ensureStyles();

    const oldActivate = document.getElementById('activateAlerts');
    if (oldActivate) oldActivate.hidden = true;

    const panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <h4>Notificações com o aplicativo fechado</h4>
      <p id="${STATUS_ID}" aria-live="polite">Verificando este aparelho…</p>
      <div class="push-actions">
        <button class="primary" id="${ACTIVATE_ID}" type="button">Ativar notificações</button>
        <button class="primary" id="${TEST_ID}" type="button" hidden>Enviar notificação de teste</button>
        <button class="secondary" id="${DISABLE_ID}" type="button" hidden>Desativar neste aparelho</button>
      </div>
      <small class="push-note">São enviados lembretes das tarefas que possuem data, horário e opção de lembrete definida.</small>`;

    const status = document.getElementById('alertsStatus');
    if (status) status.insertAdjacentElement('afterend', panel);
    else dialog.querySelector('.modal')?.prepend(panel);

    panel.querySelector(`#${ACTIVATE_ID}`).addEventListener('click', activate);
    panel.querySelector(`#${TEST_ID}`).addEventListener('click', test);
    panel.querySelector(`#${DISABLE_ID}`).addEventListener('click', disable);
    refreshButtons();
  };

  new MutationObserver(install).observe(document.documentElement, { childList: true, subtree: true });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
