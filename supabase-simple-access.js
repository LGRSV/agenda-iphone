/* Acesso simples da Agenda Lagares.
   Usa sessão anônima autenticada do Supabase: usuário + e-mail, sem senha ou confirmação. */
(() => {
  'use strict';

  const MODULE_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
  const CONFIG_KEY = 'agenda_supabase_config_v1';
  const OVERLAY_ID = 'agendaLoginOverlay';
  const PROFILE_KEY = 'agenda_app_profile_v1';
  let clientPromise = null;

  const readJson = (key, fallback = {}) => {
    try { return JSON.parse(localStorage.getItem(key) || '') || fallback; }
    catch (_) { return fallback; }
  };

  const getClient = async () => {
    if (!clientPromise) {
      clientPromise = (async () => {
        const cfg = readJson(CONFIG_KEY);
        if (!cfg.url || !cfg.publishableKey) throw new Error('Configuração do backend não encontrada.');
        const { createClient } = await import(MODULE_URL);
        return createClient(cfg.url, cfg.publishableKey, {
          auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
        });
      })();
    }
    return clientPromise;
  };

  const setStatus = (message, error = false) => {
    const el = document.getElementById('agendaSimpleStatus');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('error', error);
  };

  const setBusy = busy => {
    const button = document.getElementById('agendaSimpleEnter');
    if (button) button.disabled = busy;
  };

  const build = overlay => {
    if (!overlay || overlay.dataset.simpleAccess === '1') return;
    overlay.dataset.simpleAccess = '1';

    const saved = readJson(PROFILE_KEY, { username: 'jalms2', email: '' });
    overlay.innerHTML = `
      <button class="close" id="agendaLoginClose" type="button" aria-label="Fechar">×</button>
      <form class="login-shell" id="agendaSimpleForm" novalidate>
        <div class="login-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M8 13l2.6 2.6L16.5 10"/></svg></div>
        <h2>Acessar Agenda</h2>
        <p class="intro">Informe seu usuário e e-mail para salvar esta agenda no backend.</p>
        <div class="field"><label for="agendaSimpleUsername">Usuário</label><input id="agendaSimpleUsername" name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" value="${String(saved.username || 'jalms2').replace(/"/g, '&quot;')}" placeholder="jalms2" required></div>
        <div class="field"><label for="agendaSimpleEmail">E-mail</label><input id="agendaSimpleEmail" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" value="${String(saved.email || '').replace(/"/g, '&quot;')}" placeholder="seuemail@exemplo.com" required></div>
        <div id="agendaSimpleStatus" class="status">Sem senha e sem confirmação de e-mail.</div>
        <div class="actions"><button class="action primary" id="agendaSimpleEnter" type="submit">Entrar e salvar</button></div>
        <p class="security">A sessão fica vinculada a este aparelho. Não apague os dados do aplicativo para não perder o acesso a esta sessão.</p>
      </form>`;

    overlay.querySelector('#agendaLoginClose').addEventListener('click', () => {
      overlay.classList.remove('open');
      document.documentElement.classList.remove('agenda-login-open');
      document.body.classList.remove('agenda-login-open');
    });

    overlay.querySelector('#agendaSimpleForm').addEventListener('submit', async event => {
      event.preventDefault();
      const username = overlay.querySelector('#agendaSimpleUsername').value.trim();
      const email = overlay.querySelector('#agendaSimpleEmail').value.trim().toLowerCase();
      if (!username || !email || !email.includes('@')) {
        setStatus('Informe um usuário e um e-mail válido.', true);
        return;
      }

      setBusy(true);
      setStatus('Conectando e salvando…');
      try {
        const sb = await getClient();
        const { data: sessionData, error: sessionError } = await sb.auth.getSession();
        if (sessionError) throw sessionError;

        let session = sessionData.session;
        if (!session) {
          const { data, error } = await sb.auth.signInAnonymously({
            options: { data: { app_username: username, app_email: email, app_name: 'Agenda Lagares' } }
          });
          if (error) throw error;
          session = data.session;
        } else {
          await sb.auth.updateUser({ data: { app_username: username, app_email: email, app_name: 'Agenda Lagares' } });
        }

        if (!session) throw new Error('Não foi possível criar a sessão do aplicativo.');

        localStorage.setItem(PROFILE_KEY, JSON.stringify({ username, email, userId: session.user.id }));
        const cfg = readJson(CONFIG_KEY);
        localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...cfg, username, email, enabled: true }));

        setStatus('Conectado. Enviando sua agenda…');
        await new Promise(resolve => setTimeout(resolve, 350));
        if (window.SupabaseAgenda?.pushAll) await window.SupabaseAgenda.pushAll();
        setStatus('Agenda salva no backend.');
        setTimeout(() => location.reload(), 700);
      } catch (error) {
        const message = String(error?.message || error || 'Falha ao entrar.');
        if (/anonymous.*disabled|anonymous sign-ins are disabled/i.test(message)) {
          setStatus('O acesso sem senha ainda não está habilitado no Supabase.', true);
        } else {
          setStatus(message, true);
        }
        setBusy(false);
      }
    });
  };

  const install = () => {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) build(overlay);
  };

  new MutationObserver(install).observe(document.documentElement, { childList: true, subtree: true });
  install();
})();
