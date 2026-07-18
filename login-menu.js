/* =========================================================================
   login-menu.js — item "Entrar / trocar de conta" no menu suspenso.

   O acesso continua sendo o mesmo (sessão persistida por aparelho: você
   loga UMA vez por máquina e ela lembra). Este módulo só adiciona um atalho
   no menu (☰) para abrir a tela de login sob demanda — útil quando você ou
   a namorada precisam entrar/trocar de conta num aparelho compartilhado,
   sem depender do portão automático aparecer.

   Autocontido, idempotente e resistente a re-render (MutationObserver).
   Reaproveita a tela de login existente via window.AgendaSupabaseLogin.
   ========================================================================= */
(() => {
  'use strict';

  const BTN_ID = 'agendaLoginMenuBtn';
  const NOTE_ID = 'agendaLoginMenuNote';
  const CONFIG_KEY = 'agenda_supabase_config_v1';
  const PROFILE_KEY = 'agenda_app_profile_v1';

  const LOGIN_SVG = '<svg viewBox="0 0 24 24"><path d="M15 3h4a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1h-4"/><path d="M10 17l5-5-5-5"/><path d="M15 12H3"/></svg>';

  const json = (raw, fallback) => { try { const v = JSON.parse(raw); return v == null ? fallback : v; } catch (_) { return fallback; } };

  // Sessão persistida do Supabase (mesma checagem do portão de auth).
  const hasSession = () => {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !/^sb-.*-auth-token$/.test(k)) continue;
        const r = json(localStorage.getItem(k), null);
        const s = r && (r.currentSession || r.session || r);
        if (s && (s.refresh_token || s.access_token)) return true;
      }
    } catch (_) {}
    return false;
  };

  const currentIdentity = () => {
    const profile = json(localStorage.getItem(PROFILE_KEY), {}) || {};
    const config = json(localStorage.getItem(CONFIG_KEY), {}) || {};
    return String(profile.username || config.username || profile.email || config.email || '').trim();
  };

  const openLogin = () => {
    const login = window.AgendaSupabaseLogin;
    if (login && typeof login.open === 'function') { try { login.open(); return; } catch (_) {} }
    // Retrocompatível: se o módulo de login ainda não carregou, revela o portão.
    const veilBtn = document.querySelector('#agendaAuthVeil button');
    if (veilBtn) veilBtn.click();
  };

  const label = () => {
    const who = currentIdentity();
    if (hasSession()) return { title: 'Trocar de conta', sub: who ? `Conectado: ${who}` : 'Sessão ativa neste aparelho' };
    return { title: 'Entrar na conta', sub: 'Login uma vez por aparelho' };
  };

  const refresh = () => {
    const btn = document.getElementById(BTN_ID);
    if (!btn) return;
    const info = label();
    const strong = btn.querySelector('.login-menu-title');
    const small = btn.querySelector('.login-menu-sub');
    if (strong) strong.textContent = info.title;
    if (small) small.textContent = info.sub;
  };

  const ensureStyles = () => {
    if (document.getElementById('agendaLoginMenuStyles')) return;
    const s = document.createElement('style');
    s.id = 'agendaLoginMenuStyles';
    s.textContent = `
      #${BTN_ID}{flex-direction:column;align-items:flex-start!important;gap:2px!important;padding-top:8px!important;padding-bottom:8px!important}
      #${BTN_ID} .login-menu-line{display:flex;align-items:center;gap:10px;width:100%}
      #${BTN_ID} .login-menu-sub{margin-left:34px;color:var(--muted);font-size:11px;font-weight:700;letter-spacing:0;text-transform:none}
    `;
    document.head.appendChild(s);
  };

  const install = () => {
    const menu = document.getElementById('quickMenu');
    if (!menu) return;
    ensureStyles();
    if (!document.getElementById(BTN_ID)) {
      const note = document.createElement('span');
      note.className = 'menu-note';
      note.id = NOTE_ID;
      note.textContent = 'Conta';

      const btn = document.createElement('button');
      btn.id = BTN_ID;
      btn.type = 'button';
      btn.setAttribute('aria-label', 'Entrar ou trocar de conta');
      btn.innerHTML = `<span class="login-menu-line"><span class="menu-option-icon">${LOGIN_SVG}</span><span class="login-menu-title">Entrar na conta</span></span><span class="login-menu-sub">Login uma vez por aparelho</span>`;
      btn.addEventListener('click', event => { event.preventDefault(); openLogin(); });

      menu.appendChild(note);
      menu.appendChild(btn);
    }
    refresh();
  };

  let frame = 0;
  new MutationObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(install); })
    .observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('storage', event => { if (event.key && /^sb-.*-auth-token$/.test(event.key)) refresh(); });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
})();
