/* Acesso simples da Agenda Lagares — usuário + e-mail, sem senha. */
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
    if (!overlay || overlay.dataset.simpleAccess === '2') return;
    overlay.dataset.simpleAccess = '2';

    const saved = readJson(PROFILE_KEY, { username: 'jalms2', email: '' });
    overlay.innerHTML = `
      <button class="close" id="agendaLoginClose" type="button" aria-label="Fechar">×</button>
      <form class="login-shell" id="agendaSimpleForm" novalidate>
        <div class="login-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M8 13l2.6 2.6L16.5 10"/></svg></div>
        <h2>Acessar Agenda</h2>
        <p class="intro">Use o mesmo usuário e e-mail em cada aparelho para abrir a mesma agenda.</p>
        <div class="field"><label for="agendaSimpleUsername">Usuário</label><input id="agendaSimpleUsername" name="username" type="text" autocomplete="username" autocapitalize="none" spellcheck="false" value="${String(saved.username || 'jalms2').replace(/"/g, '&quot;')}" placeholder="jalms2" required></div>
        <div class="field"><label for="agendaSimpleEmail">E-mail</label><input id="agendaSimpleEmail" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" value="${String(saved.email || '').replace(/"/g, '&quot;')}" placeholder="seuemail@exemplo.com" required></div>
        <div id="agendaSimpleStatus" class="status">Sem senha e sem confirmação de e-mail.</div>
        <div class="actions"><button class="action primary" id="agendaSimpleEnter" type="submit">Entrar e sincronizar</button></div>
        <p class="security">Use exatamente o mesmo usuário e e-mail nos outros aparelhos.</p>
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
      setStatus('Vinculando este aparelho…');
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
          const { error } = await sb.auth.updateUser({ data: { app_username: username, app_email: email, app_name: 'Agenda Lagares' } });
          if (error) throw error;
        }
        if (!session) throw new Error('Não foi possível criar a sessão deste aparelho.');

        const { data: workspaceRows, error: workspaceError } = await sb.rpc('claim_agenda_workspace', {
          p_username: username,
          p_email: email
        });
        if (workspaceError) throw workspaceError;
        const workspace = Array.isArray(workspaceRows) ? workspaceRows[0] : workspaceRows;
        if (!workspace?.owner_user_id) throw new Error('Não foi possível localizar o espaço da Agenda.');

        localStorage.setItem(PROFILE_KEY, JSON.stringify({ username, email, userId: session.user.id, workspaceId: workspace.workspace_id }));
        const cfg = readJson(CONFIG_KEY);
        localStorage.setItem(CONFIG_KEY, JSON.stringify({
          ...cfg,
          username,
          email,
          enabled: true,
          workspaceId: workspace.workspace_id,
          workspaceOwnerId: workspace.owner_user_id,
          migratedUserId: workspace.owner_user_id
        }));

        setStatus('Vinculado. Baixando a agenda compartilhada…');
        await new Promise(resolve => setTimeout(resolve, 500));

        const { data: existing, error: existingError } = await sb.from('agenda_documents')
          .select('document_key')
          .eq('user_id', workspace.owner_user_id)
          .limit(1);
        if (existingError) throw existingError;

        if (Array.isArray(existing) && existing.length) {
          if (window.SupabaseAgenda?.pullAll) await window.SupabaseAgenda.pullAll({ reload: false });
        } else if (window.SupabaseAgenda?.pushAll) {
          await window.SupabaseAgenda.pushAll();
        }

        setStatus('Agenda sincronizada neste aparelho.');
        setTimeout(() => location.reload(), 650);
      } catch (error) {
        const message = String(error?.message || error || 'Falha ao entrar.');
        if (/anonymous.*disabled|anonymous sign-ins are disabled/i.test(message)) {
          setStatus('O acesso sem senha não está habilitado no Supabase.', true);
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