/* Redefinição segura de senha da Agenda Lagares.
   A interface usa o login jalms2; o e-mail real permanece oculto. */
(() => {
  'use strict';

  const MODULE_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
  const CONFIG_KEY = 'agenda_supabase_config_v1';
  const OVERLAY_ID = 'agendaLoginOverlay';
  const ACCOUNT_EMAIL = 'joaoantonio.negocios@gmail.com';
  const RESET_URL = 'https://lgrsv.github.io/agenda-iphone/?app=1&reset=1';
  let clientPromise = null;

  const readConfig = () => {
    try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}') || {}; }
    catch (_) { return {}; }
  };

  const getClient = async () => {
    if (!clientPromise) {
      clientPromise = (async () => {
        const cfg = readConfig();
        if (!cfg.url || !cfg.publishableKey) throw new Error('Configuração do Supabase não encontrada.');
        const { createClient } = await import(MODULE_URL);
        return createClient(cfg.url, cfg.publishableKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
        });
      })();
    }
    return clientPromise;
  };

  const setStatus = (message, error = false) => {
    const el = document.getElementById('agendaLoginStatus');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('error', error);
  };

  const setBusy = busy => {
    document.querySelectorAll(`#${OVERLAY_ID} button`).forEach(button => {
      if (button.id !== 'agendaLoginClose') button.disabled = busy;
    });
  };

  const addResetButton = () => {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay || overlay.dataset.passwordResetInstalled === '1') return;
    overlay.dataset.passwordResetInstalled = '1';

    const actions = overlay.querySelector('.actions');
    if (!actions) return;

    const button = document.createElement('button');
    button.className = 'action';
    button.id = 'agendaPasswordReset';
    button.type = 'button';
    button.textContent = 'Definir ou redefinir senha';

    const sync = overlay.querySelector('#agendaSyncNow');
    actions.insertBefore(button, sync || null);

    button.addEventListener('click', async () => {
      setBusy(true);
      setStatus('Enviando link seguro…');
      try {
        const sb = await getClient();
        const { error } = await sb.auth.resetPasswordForEmail(ACCOUNT_EMAIL, { redirectTo: RESET_URL });
        if (error) throw error;
        setStatus('Link enviado. Abra o e-mail mais recente para definir a senha.');
      } catch (error) {
        setStatus(error?.message || 'Não foi possível enviar o link.', true);
      } finally {
        setBusy(false);
      }
    });
  };

  const showResetScreen = async () => {
    const params = new URLSearchParams(location.search);
    const hash = new URLSearchParams(location.hash.replace(/^#/, ''));
    const isRecovery = params.get('reset') === '1' || hash.get('type') === 'recovery';
    if (!isRecovery) return;

    const waitForLoginUi = () => new Promise(resolve => {
      if (window.AgendaSupabaseLogin?.open) return resolve();
      let count = 0;
      const timer = setInterval(() => {
        count += 1;
        if (window.AgendaSupabaseLogin?.open || count > 80) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });

    await waitForLoginUi();
    window.AgendaSupabaseLogin?.open?.();

    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;

    const title = overlay.querySelector('h2');
    const intro = overlay.querySelector('.intro');
    const loginField = overlay.querySelector('#agendaLoginEmail')?.closest('.field');
    const password = overlay.querySelector('#agendaLoginPassword');
    const form = overlay.querySelector('#agendaLoginForm');
    const actions = overlay.querySelector('.actions');

    if (title) title.textContent = 'Definir nova senha';
    if (intro) intro.textContent = 'Escolha uma nova senha para o usuário jalms2.';
    if (loginField) loginField.hidden = true;
    if (password) {
      password.value = '';
      password.placeholder = 'Nova senha';
      password.autocomplete = 'new-password';
      password.minLength = 8;
    }

    if (actions) {
      actions.innerHTML = '';
      const save = document.createElement('button');
      save.className = 'action primary';
      save.type = 'submit';
      save.textContent = 'Salvar nova senha';
      actions.appendChild(save);
    }

    setStatus('Digite a nova senha com pelo menos 8 caracteres.');

    form?.addEventListener('submit', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const nextPassword = password?.value || '';
      if (nextPassword.length < 8) return setStatus('A senha precisa ter pelo menos 8 caracteres.', true);

      setBusy(true);
      setStatus('Salvando nova senha…');
      try {
        const sb = await getClient();
        const { data: sessionData } = await sb.auth.getSession();
        if (!sessionData.session) throw new Error('O link expirou ou a sessão de recuperação não foi criada. Solicite outro link.');
        const { error } = await sb.auth.updateUser({ password: nextPassword });
        if (error) throw error;
        setStatus('Senha definida. Você já pode entrar como jalms2.');
        history.replaceState({}, '', './?app=1');
        setTimeout(() => location.reload(), 900);
      } catch (error) {
        setStatus(error?.message || 'Não foi possível salvar a nova senha.', true);
        setBusy(false);
      }
    }, true);
  };

  new MutationObserver(addResetButton).observe(document.documentElement, { childList: true, subtree: true });
  addResetButton();

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showResetScreen);
  else showResetScreen();
})();
