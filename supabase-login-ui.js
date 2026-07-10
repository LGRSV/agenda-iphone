/*
  Tela simplificada de autenticação Supabase — Agenda Lagares.
  A URL e a chave pública permanecem na configuração interna e não são exibidas.
*/
(() => {
  'use strict';

  const MODULE_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
  const CONFIG_KEY = 'agenda_supabase_config_v1';
  const BUTTON_ID = 'supabaseStorageBtn';
  const DIALOG_ID = 'supabaseLoginDialogV2';
  const STYLE_ID = 'supabaseLoginStylesV2';
  let clientPromise = null;

  const readConfig = () => {
    try { return JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}') || {}; }
    catch (_) { return {}; }
  };

  const saveConfig = patch => {
    const current = readConfig();
    localStorage.setItem(CONFIG_KEY, JSON.stringify({ ...current, ...patch, enabled: true }));
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

  const ensureStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${DIALOG_ID}{width:min(calc(100% - 24px),430px);max-height:calc(100dvh - 24px);overflow:auto}
      #${DIALOG_ID} .modal{padding:22px}
      #${DIALOG_ID} .login-intro{margin:0 0 14px;color:var(--muted);font-size:13px;line-height:1.5}
      #${DIALOG_ID} input[type="email"],#${DIALOG_ID} input[type="password"]{
        display:block;width:100%;min-height:50px;padding:12px 13px;border:1px solid var(--line);
        border-radius:13px;outline:none;background:var(--soft);color:var(--text);font-size:16px;
        line-height:1.2;-webkit-user-select:text;user-select:text;pointer-events:auto;touch-action:manipulation;
        -webkit-appearance:none;appearance:none
      }
      #${DIALOG_ID} input:focus{border-color:var(--accent);box-shadow:0 0 0 3px rgba(117,203,255,.2)}
      #${DIALOG_ID} .login-actions{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:17px}
      #${DIALOG_ID} .login-actions .wide{grid-column:1/-1;width:100%;margin:0}
      #${DIALOG_ID} .login-status{margin-top:14px;padding:12px;border:1px solid var(--line);border-radius:14px;background:var(--soft);color:var(--muted);font-size:12px;line-height:1.45;overflow-wrap:anywhere}
      #${DIALOG_ID} .login-status.error{border-color:var(--danger);color:var(--danger)}
      #${DIALOG_ID} .login-security{margin-top:12px;color:var(--muted);font-size:11px;line-height:1.45}
      @media(max-width:390px){#${DIALOG_ID} .login-actions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  };

  const setStatus = (message, error = false) => {
    const el = document.getElementById('supabaseLoginStatusV2');
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('error', error);
  };

  const setBusy = busy => {
    const dialog = document.getElementById(DIALOG_ID);
    if (!dialog) return;
    dialog.querySelectorAll('button').forEach(button => {
      if (button.id !== 'supabaseLoginCloseV2') button.disabled = busy;
    });
  };

  const ensureDialog = () => {
    let dialog = document.getElementById(DIALOG_ID);
    if (dialog) return dialog;

    ensureStyles();
    dialog = document.createElement('dialog');
    dialog.id = DIALOG_ID;
    dialog.innerHTML = `<form class="modal" id="supabaseLoginFormV2" novalidate>
      <h3>Acessar Agenda</h3>
      <p class="login-intro">Entre para salvar e sincronizar suas tarefas entre os dispositivos.</p>

      <label class="field-label" for="supabaseEmailV2">E-mail</label>
      <input id="supabaseEmailV2" name="email" type="email" inputmode="email" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="seuemail@exemplo.com" required>

      <label class="field-label" for="supabasePasswordV2">Senha</label>
      <input id="supabasePasswordV2" name="password" type="password" autocomplete="current-password" minlength="6" placeholder="Sua senha" required>

      <div id="supabaseLoginStatusV2" class="login-status">Informe seu e-mail e sua senha.</div>

      <div class="login-actions">
        <button class="primary" id="supabaseLoginEnterV2" type="submit">Entrar</button>
        <button class="secondary" id="supabaseLoginCreateV2" type="button">Criar conta</button>
        <button class="secondary" id="supabaseLoginSyncV2" type="button">Sincronizar agora</button>
        <button class="secondary" id="supabaseLoginExitV2" type="button">Sair da conta</button>
        <button class="secondary wide" id="supabaseLoginCloseV2" type="button">Fechar</button>
      </div>

      <p class="login-security">A conexão do projeto fica configurada internamente. A senha não é salva pela Agenda.</p>
    </form>`;
    document.body.appendChild(dialog);

    const emailInput = dialog.querySelector('#supabaseEmailV2');
    const passwordInput = dialog.querySelector('#supabasePasswordV2');

    const credentials = () => ({
      email: emailInput.value.trim(),
      password: passwordInput.value
    });

    dialog.querySelector('#supabaseLoginCloseV2').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });

    dialog.querySelector('#supabaseLoginFormV2').addEventListener('submit', async event => {
      event.preventDefault();
      const { email, password } = credentials();
      if (!email || !password) return setStatus('Preencha o e-mail e a senha.', true);
      setBusy(true); setStatus('Entrando…');
      try {
        const sb = await getClient();
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        saveConfig({ email });
        setStatus('Acesso realizado. Abrindo sua agenda…');
        setTimeout(() => location.reload(), 550);
      } catch (error) {
        setStatus(error?.message || 'Não foi possível entrar.', true);
        setBusy(false);
      }
    });

    dialog.querySelector('#supabaseLoginCreateV2').addEventListener('click', async () => {
      const { email, password } = credentials();
      if (!email || !password) return setStatus('Preencha o e-mail e uma senha com pelo menos 6 caracteres.', true);
      setBusy(true); setStatus('Criando conta…');
      try {
        const sb = await getClient();
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) throw error;
        saveConfig({ email });
        if (data.session) {
          setStatus('Conta criada e conectada. Abrindo sua agenda…');
          setTimeout(() => location.reload(), 550);
        } else {
          setStatus('Conta criada. Confira seu e-mail para confirmar o acesso.');
          setBusy(false);
        }
      } catch (error) {
        setStatus(error?.message || 'Não foi possível criar a conta.', true);
        setBusy(false);
      }
    });

    dialog.querySelector('#supabaseLoginExitV2').addEventListener('click', async () => {
      setBusy(true); setStatus('Encerrando sessão…');
      try {
        const sb = await getClient();
        await sb.auth.signOut();
        setStatus('Sessão encerrada.');
        setTimeout(() => location.reload(), 450);
      } catch (error) {
        setStatus(error?.message || 'Não foi possível sair.', true);
        setBusy(false);
      }
    });

    dialog.querySelector('#supabaseLoginSyncV2').addEventListener('click', async () => {
      setBusy(true); setStatus('Sincronizando…');
      try {
        const api = window.SupabaseAgenda;
        if (!api) throw new Error('O sincronizador ainda não terminou de carregar.');
        await api.pushDirty();
        await api.pullAll({ overwrite: true, reload: false });
        setStatus('Agenda sincronizada com sucesso.');
      } catch (error) {
        setStatus(error?.message || 'Não foi possível sincronizar.', true);
      } finally {
        setBusy(false);
      }
    });

    return dialog;
  };

  const openDialog = async () => {
    const dialog = ensureDialog();
    const cfg = readConfig();
    const email = dialog.querySelector('#supabaseEmailV2');
    email.value = cfg.email || '';
    dialog.querySelector('#supabasePasswordV2').value = '';
    setStatus('Verificando sua sessão…');
    if (!dialog.open) dialog.showModal();
    setTimeout(() => email.focus(), 120);

    try {
      const sb = await getClient();
      const { data } = await sb.auth.getSession();
      setStatus(data.session?.user
        ? `Conectado como ${data.session.user.email || 'usuário'}.`
        : 'Informe seu e-mail e sua senha.');
    } catch (error) {
      setStatus(error?.message || 'Não foi possível verificar a sessão.', true);
    }
  };

  const replaceButton = () => {
    const current = document.getElementById(BUTTON_ID);
    if (!current || current.dataset.loginUiV2 === '1') return;
    const replacement = current.cloneNode(true);
    replacement.dataset.loginUiV2 = '1';
    replacement.title = 'Acessar e sincronizar';
    replacement.setAttribute('aria-label', 'Acessar e sincronizar a Agenda');
    replacement.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      openDialog();
    });
    current.replaceWith(replacement);
  };

  const boot = () => {
    ensureStyles();
    replaceButton();
    let frame = 0;
    new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(replaceButton);
    }).observe(document.body, { childList: true, subtree: true });
  };

  window.AgendaSupabaseLogin = { open: openDialog };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
