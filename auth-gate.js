/* =========================================================================
   auth-gate.js — sessão automática da Agenda Lagares.
   A agenda abre sempre, em qualquer aparelho, sem tela de login inicial.
   Os dados ficam no localStorage; o Supabase entra só como sincronização.

   Se já houver sessão do Supabase, nada a fazer. Se não houver, mas o
   aparelho já foi vinculado antes (usuário + e-mail salvos), refaz a sessão
   em silêncio, em segundo plano, para manter a sincronização. Se nunca foi
   vinculado, a agenda segue local e o botão "Sincronização" do cabeçalho
   permite vincular quando quiser.
   ========================================================================= */
(() => {
  'use strict';

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

  // Refaz a sessão com o perfil salvo, sem incomodar. Falhou (sem rede,
  // perfil inválido)? Segue local; nada aparece para o usuário.
  const silentRelogin = () => {
    let tries = 0;
    const timer = setInterval(async () => {
      tries++;
      const access = window.AgendaSimpleAccess;
      if (access && typeof access.loginWithSavedProfile === 'function') {
        clearInterval(timer);
        try {
          const ok = await access.loginWithSavedProfile();
          if (ok) location.reload();
        } catch (_) {}
      } else if (tries > 120) {
        clearInterval(timer); // ~14s: módulo de acesso não carregou.
      }
    }, 120);
  };

  if (!hasSession()) silentRelogin();

  // Reage a login/logout feito em outra aba do mesmo app.
  window.addEventListener('storage', event => {
    if (event.key && /^sb-.*-auth-token$/.test(event.key)) location.reload();
  });
})();
