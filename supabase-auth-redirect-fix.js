/* Correções de autenticação da Agenda Lagares.
   - Nunca usa localhost como retorno.
   - Reenvia confirmação para a URL pública.
   - Traduz erros de autenticação para mensagens claras. */
(() => {
  'use strict';

  const MODULE_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
  const CONFIG_KEY = 'agenda_supabase_config_v1';
  const OVERLAY_ID = 'agendaLoginOverlay';
  const PUBLIC_APP_URL = 'https://lgrsv.github.io/agenda-iphone/?app=1';
  let clientPromise = null;

  const readConfig = () => {
    try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}') || {}; }
    catch (_) { return {}; }
  };

  const redirectTo = () => PUBLIC_APP_URL;

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

  const values = overlay => ({
    email: overlay.querySelector('#agendaLoginEmail')?.value.trim() || '',
    password: overlay.querySelector('#agendaLoginPassword')?.value || ''
  });

  const translateStatus = status => {
    const text = String(status.textContent || '').trim();
    if (/invalid login credentials/i.test(text)) {
      status.textContent = 'Senha incorreta para esta conta. O e-mail já está confirmado.';
      status.classList.add('error');
    } else if (/email not confirmed/i.test(text)) {
      status.textContent = 'O e-mail ainda não foi confirmado. Use “Reenviar confirmação”.';
      status.classList.add('error');
    }
  };

  const install = () => {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay || overlay.dataset.redirectFix === '2') return;
    overlay.dataset.redirectFix = '2';

    const status = overlay.querySelector('#agendaLoginStatus');
    if (status) {
      new MutationObserver(() => translateStatus(status)).observe(status, {
        childList: true,
        characterData: true,
        subtree: true
      });
      translateStatus(status);
    }

    const oldCreate = overlay.querySelector('#agendaCreateAccount');
    if (!oldCreate) return;

    const create = oldCreate.cloneNode(true);
    oldCreate.replaceWith(create);

    let resend = overlay.querySelector('#agendaResendConfirmation');
    if (!resend) {
      resend = document.createElement('button');
      resend.className = 'action';
      resend.id = 'agendaResendConfirmation';
      resend.type = 'button';
      resend.textContent = 'Reenviar confirmação';
      create.insertAdjacentElement('afterend', resend);
    }

    create.addEventListener('click', async () => {
      const current = values(overlay);
      if (!current.email || current.password.length < 6) {
        setStatus('Informe o e-mail e uma senha com pelo menos 6 caracteres.', true);
        return;
      }

      setBusy(true);
      setStatus('Criando conta…');
      try {
        const sb = await getClient();
        const { data, error } = await sb.auth.signUp({
          email: current.email,
          password: current.password,
          options: { emailRedirectTo: redirectTo() }
        });
        if (error) throw error;

        const cfg = readConfig();
        localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...cfg, email: current.email, enabled: true }));

        if (data.session) {
          setStatus('Conta criada. Abrindo sua agenda…');
          setTimeout(() => location.reload(), 500);
        } else {
          setStatus('Conta criada. Abra o e-mail mais recente de confirmação.');
          setBusy(false);
        }
      } catch (error) {
        setStatus(error?.message || 'Não foi possível criar a conta.', true);
        setBusy(false);
      }
    });

    resend.addEventListener('click', async () => {
      const current = values(overlay);
      if (!current.email) {
        setStatus('Informe o e-mail para reenviar a confirmação.', true);
        return;
      }

      setBusy(true);
      setStatus('Enviando novo e-mail…');
      try {
        const sb = await getClient();
        const { error } = await sb.auth.resend({
          type: 'signup',
          email: current.email,
          options: { emailRedirectTo: redirectTo() }
        });
        if (error) throw error;
        setStatus('Novo e-mail enviado. O retorno será para a Agenda pública, não localhost.');
      } catch (error) {
        setStatus(error?.message || 'Não foi possível reenviar a confirmação.', true);
      } finally {
        setBusy(false);
      }
    });
  };

  const observer = new MutationObserver(install);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  install();
})();
