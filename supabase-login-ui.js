/* Tela de acesso Supabase — Agenda Lagares v3.
   Fullscreen no iPhone, sem campos técnicos e sem zoom por duplo toque. */
(() => {
  'use strict';

  const MODULE_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
  const CONFIG_KEY = 'agenda_supabase_config_v1';
  const BUTTON_ID = 'supabaseStorageBtn';
  const OVERLAY_ID = 'agendaLoginOverlay';
  const STYLE_ID = 'agendaLoginStylesV3';
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
      html.agenda-login-open,body.agenda-login-open{overflow:hidden!important;overscroll-behavior:none!important}
      #${OVERLAY_ID}{position:fixed;z-index:99999;inset:0;display:none;overflow-y:auto;overscroll-behavior:contain;background:radial-gradient(circle at 50% 9%,rgba(56,169,232,.13),transparent 28%),#0e1117;color:#f7f8fb;-webkit-overflow-scrolling:touch;touch-action:pan-y}
      #${OVERLAY_ID}.open{display:block}
      #${OVERLAY_ID} *{box-sizing:border-box}
      #${OVERLAY_ID} .login-shell{width:min(100%,520px);min-height:100%;margin:0 auto;padding:calc(34px + env(safe-area-inset-top)) 24px calc(34px + env(safe-area-inset-bottom));display:flex;flex-direction:column;justify-content:center}
      #${OVERLAY_ID} .login-mark{width:64px;height:64px;margin:0 auto 22px;display:grid;place-items:center;border-radius:20px;background:linear-gradient(145deg,#45b9f4,#238fd0);box-shadow:0 16px 35px rgba(40,164,230,.24)}
      #${OVERLAY_ID} .login-mark svg{width:38px;height:38px}
      #${OVERLAY_ID} h2{margin:0;text-align:center;font-size:clamp(34px,9vw,48px);line-height:1;letter-spacing:-.055em}
      #${OVERLAY_ID} .intro{margin:20px auto 34px;max-width:390px;text-align:center;color:#9da5b4;font-size:17px;line-height:1.5}
      #${OVERLAY_ID} .field{margin-bottom:20px}
      #${OVERLAY_ID} label{display:block;margin:0 0 9px;color:#aeb5c2;font-size:13px;font-weight:850;letter-spacing:.14em;text-transform:uppercase}
      #${OVERLAY_ID} .input-wrap{position:relative}
      #${OVERLAY_ID} input{display:block;width:100%;height:62px;padding:0 17px;border:1px solid #333a47;border-radius:18px;outline:none;background:#191e27;color:#fff;font-size:16px;line-height:1;-webkit-appearance:none;appearance:none;-webkit-user-select:text;user-select:text;touch-action:manipulation;pointer-events:auto}
      #${OVERLAY_ID} input:focus{border-color:#51bff8;box-shadow:0 0 0 4px rgba(81,191,248,.17)}
      #${OVERLAY_ID} input[type=password]{padding-right:58px}
      #${OVERLAY_ID} .eye{position:absolute;right:8px;top:8px;width:46px;height:46px;border:0;border-radius:13px;background:transparent;color:#9da5b4;display:grid;place-items:center;touch-action:manipulation}
      #${OVERLAY_ID} .status{margin:5px 0 20px;padding:14px 16px;border:1px solid #303744;border-radius:16px;background:#171c24;color:#aeb5c2;font-size:13px;line-height:1.45}
      #${OVERLAY_ID} .status.error{border-color:#a8525a;color:#ffb0b7}
      #${OVERLAY_ID} .actions{display:grid;gap:12px}
      #${OVERLAY_ID} button.action{min-height:58px;border-radius:18px;border:1px solid #333a47;background:#191e27;color:#f7f8fb;font-size:17px;font-weight:850;touch-action:manipulation}
      #${OVERLAY_ID} button.primary{border-color:#56c2fa;background:linear-gradient(135deg,#5ec7fb,#42aee9);color:#081018}
      #${OVERLAY_ID} button:disabled{opacity:.55}
      #${OVERLAY_ID} .divider{display:flex;align-items:center;gap:14px;margin:8px 0;color:#667080;font-size:12px;font-weight:800;text-transform:uppercase}
      #${OVERLAY_ID} .divider:before,#${OVERLAY_ID} .divider:after{content:"";height:1px;flex:1;background:#2c333e}
      #${OVERLAY_ID} .security{margin:18px 4px 0;text-align:center;color:#778191;font-size:11px;line-height:1.5}
      #${OVERLAY_ID} .close{position:fixed;z-index:2;right:14px;top:calc(12px + env(safe-area-inset-top));width:44px;height:44px;border:1px solid #303744;border-radius:15px;background:rgba(25,30,39,.88);color:#fff;font-size:25px;touch-action:manipulation}
      @media(max-height:760px){#${OVERLAY_ID} .login-shell{justify-content:flex-start}#${OVERLAY_ID} .login-mark{margin-top:4px}}
    `;
    document.head.appendChild(style);
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

  const close = () => {
    document.getElementById(OVERLAY_ID)?.classList.remove('open');
    document.documentElement.classList.remove('agenda-login-open');
    document.body.classList.remove('agenda-login-open');
  };

  const ensureOverlay = () => {
    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) return overlay;
    ensureStyles();
    overlay = document.createElement('section');
    overlay.id = OVERLAY_ID;
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('role', 'dialog');
    overlay.innerHTML = `
      <button class="close" id="agendaLoginClose" type="button" aria-label="Fechar">×</button>
      <form class="login-shell" id="agendaLoginForm" novalidate>
        <div class="login-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="15" rx="3"/><path d="M8 3v4M16 3v4M8 13l2.6 2.6L16.5 10"/></svg></div>
        <h2>Acessar Agenda</h2>
        <p class="intro">Entre para salvar e sincronizar suas tarefas entre os dispositivos.</p>
        <div class="field"><label for="agendaLoginEmail">E-mail</label><input id="agendaLoginEmail" name="email" type="email" inputmode="email" autocomplete="username" autocapitalize="none" spellcheck="false" placeholder="seuemail@exemplo.com" required></div>
        <div class="field"><label for="agendaLoginPassword">Senha</label><div class="input-wrap"><input id="agendaLoginPassword" name="password" type="password" autocomplete="current-password" minlength="6" placeholder="Sua senha" required><button class="eye" id="agendaTogglePassword" type="button" aria-label="Mostrar senha">◉</button></div></div>
        <div id="agendaLoginStatus" class="status">Informe seu e-mail e sua senha.</div>
        <div class="actions">
          <button class="action primary" type="submit">Entrar</button>
          <button class="action" id="agendaCreateAccount" type="button">Criar conta</button>
          <div class="divider">ou</div>
          <button class="action" id="agendaSyncNow" type="button">Sincronizar agora</button>
          <button class="action" id="agendaSignOut" type="button">Sair da conta</button>
        </div>
        <p class="security">A conexão do projeto fica configurada internamente. A senha não é salva pela Agenda.</p>
      </form>`;
    document.body.appendChild(overlay);

    const email = overlay.querySelector('#agendaLoginEmail');
    const password = overlay.querySelector('#agendaLoginPassword');
    const credentials = () => ({ email: email.value.trim(), password: password.value });

    overlay.addEventListener('dblclick', event => event.preventDefault(), { passive: false });
    overlay.querySelectorAll('button').forEach(button => button.addEventListener('touchend', event => event.stopPropagation(), { passive: true }));
    password.addEventListener('pointerdown', () => setTimeout(() => password.focus({ preventScroll: false }), 0));
    overlay.querySelector('#agendaLoginClose').addEventListener('click', close);
    overlay.querySelector('#agendaTogglePassword').addEventListener('click', () => {
      password.type = password.type === 'password' ? 'text' : 'password';
      password.focus();
    });

    overlay.querySelector('#agendaLoginForm').addEventListener('submit', async event => {
      event.preventDefault();
      const values = credentials();
      if (!values.email || !values.password) return setStatus('Preencha o e-mail e a senha.', true);
      setBusy(true); setStatus('Entrando…');
      try {
        const sb = await getClient();
        const { error } = await sb.auth.signInWithPassword(values);
        if (error) throw error;
        saveConfig({ email: values.email });
        setStatus('Acesso realizado. Abrindo sua agenda…');
        setTimeout(() => location.reload(), 500);
      } catch (error) { setStatus(error?.message || 'Não foi possível entrar.', true); setBusy(false); }
    });

    overlay.querySelector('#agendaCreateAccount').addEventListener('click', async () => {
      const values = credentials();
      if (!values.email || values.password.length < 6) return setStatus('Informe o e-mail e uma senha com pelo menos 6 caracteres.', true);
      setBusy(true); setStatus('Criando conta…');
      try {
        const sb = await getClient();
        const { data, error } = await sb.auth.signUp(values);
        if (error) throw error;
        saveConfig({ email: values.email });
        if (data.session) { setStatus('Conta criada. Abrindo sua agenda…'); setTimeout(() => location.reload(), 500); }
        else { setStatus('Conta criada. Confira seu e-mail para confirmar o acesso.'); setBusy(false); }
      } catch (error) { setStatus(error?.message || 'Não foi possível criar a conta.', true); setBusy(false); }
    });

    overlay.querySelector('#agendaSyncNow').addEventListener('click', async () => {
      setBusy(true); setStatus('Sincronizando…');
      try {
        if (!window.SupabaseAgenda) throw new Error('O sincronizador ainda não terminou de carregar.');
        await window.SupabaseAgenda.pushDirty();
        setStatus('Alterações pendentes enviadas. A agenda permanece nesta tela.');
      } catch (error) { setStatus(error?.message || 'Não foi possível sincronizar.', true); }
      finally { setBusy(false); }
    });

    overlay.querySelector('#agendaSignOut').addEventListener('click', async () => {
      setBusy(true); setStatus('Encerrando sessão…');
      try { const sb = await getClient(); await sb.auth.signOut(); setStatus('Sessão encerrada.'); setTimeout(() => location.reload(), 400); }
      catch (error) { setStatus(error?.message || 'Não foi possível sair.', true); setBusy(false); }
    });
    return overlay;
  };

  const open = async () => {
    document.querySelectorAll('dialog[open]').forEach(dialog => { try { dialog.close(); } catch (_) {} });
    const overlay = ensureOverlay();
    const cfg = readConfig();
    overlay.querySelector('#agendaLoginEmail').value = cfg.email || '';
    overlay.querySelector('#agendaLoginPassword').value = '';
    overlay.classList.add('open');
    document.documentElement.classList.add('agenda-login-open');
    document.body.classList.add('agenda-login-open');
    setStatus('Verificando sua sessão…');
    setTimeout(() => overlay.querySelector('#agendaLoginEmail').focus(), 120);
    try {
      const sb = await getClient();
      const { data } = await sb.auth.getSession();
      setStatus(data.session?.user ? `Conectado como ${data.session.user.email || 'usuário'}.` : 'Informe seu e-mail e sua senha.');
    } catch (error) { setStatus(error?.message || 'Não foi possível verificar a sessão.', true); }
  };

  const replaceButton = () => {
    const current = document.getElementById(BUTTON_ID);
    if (!current || current.dataset.loginUiV3 === '1') return;
    const replacement = current.cloneNode(true);
    replacement.dataset.loginUiV3 = '1';
    replacement.title = 'Acessar e sincronizar';
    replacement.setAttribute('aria-label', 'Acessar e sincronizar a Agenda');
    replacement.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); open(); });
    current.replaceWith(replacement);
  };

  const boot = () => {
    ensureStyles();
    replaceButton();
    let frame = 0;
    new MutationObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(replaceButton); }).observe(document.body, { childList: true, subtree: true });
  };

  window.AgendaSupabaseLogin = { open, close };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
