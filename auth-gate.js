/* =========================================================================
   auth-gate.js — portão de autenticação da Agenda Lagares.
   Nada da agenda/financeiro aparece sem uma sessão do Supabase. O véu
   (#agendaAuthVeil, embutido no index.html) cobre o app por padrão; aqui
   decidimos: com sessão → revela; sem sessão → mantém coberto e força a
   tela de login (sem opção de fechar).

   À prova de lock-out: a decisão de REVELAR lê o token direto do
   localStorage — não depende de rede, do SDK nem do CDN. Se este módulo
   nem carregar, o dono (que tem token) já foi revelado pelo script inline
   do index; quem não tem token continua coberto (seguro).

   Desktop (mouse/teclado, sem toque): nunca pede usuário/e-mail. Revela o
   app direto e, se houver perfil salvo de um acesso anterior, entra em
   silêncio em segundo plano para sincronizar.
   ========================================================================= */
(() => {
  'use strict';

  const VEIL_ID = 'agendaAuthVeil';

  const isDesktop = () =>
    !/iPhone|iPad|iPod|Android/i.test(navigator.userAgent) &&
    !(navigator.maxTouchPoints > 1) &&
    matchMedia('(hover: hover) and (pointer: fine)').matches;

  // Detecta a sessão persistida do Supabase (chave sb-<ref>-auth-token).
  const hasSession = () => {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !/^sb-.*-auth-token$/.test(key)) continue;
        const raw = JSON.parse(localStorage.getItem(key) || 'null');
        const s = raw && (raw.currentSession || raw.session || raw);
        if (s && (s.refresh_token || s.access_token)) return true;
      }
    } catch (_) {}
    return false;
  };

  const reveal = () => {
    document.documentElement.classList.remove('agenda-locked');
    const veil = document.getElementById(VEIL_ID);
    if (veil) veil.remove();
  };

  const forceLogin = () => {
    document.documentElement.classList.add('agenda-locked');
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      const login = window.AgendaSupabaseLogin;
      if (login && typeof login.open === 'function') {
        clearInterval(timer);
        try { login.open(); } catch (_) {}
        // É um portão, não um modal opcional: sem "fechar" e sem "sair".
        const close = document.getElementById('agendaLoginClose');
        if (close) close.style.display = 'none';
        const signOut = document.getElementById('agendaSignOut');
        if (signOut) signOut.style.display = 'none';
      } else if (tries > 120) {
        clearInterval(timer); // ~14s: desiste de abrir sozinho; o véu tem botão "Entrar".
      }
    }, 120);
  };

  // Desktop sem sessão: revela e tenta o login silencioso com o perfil salvo.
  const desktopSilentLogin = () => {
    reveal();
    let tries = 0;
    const timer = setInterval(async () => {
      tries++;
      const access = window.AgendaSimpleAccess;
      if (access && typeof access.loginWithSavedProfile === 'function') {
        clearInterval(timer);
        try {
          const ok = await access.loginWithSavedProfile();
          if (ok) location.reload();
        } catch (_) { /* sem rede ou perfil inválido: segue local, sem incomodar */ }
      } else if (tries > 120) {
        clearInterval(timer);
      }
    }, 120);
  };

  const decide = () => {
    if (hasSession()) reveal();
    else if (isDesktop()) desktopSilentLogin();
    else forceLogin();
  };

  decide();

  // Reage a login/logout (inclusive em outra aba do mesmo app).
  window.addEventListener('storage', event => {
    if (event.key && /^sb-.*-auth-token$/.test(event.key)) location.reload();
  });
})();
