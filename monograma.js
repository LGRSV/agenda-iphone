/* monograma.js — monograma da conta logada ao lado do número da versão (tela de início).
   "JL" por padrão e "AC" na conta da Ana (usuário acms): o mesmo mapa do ícone do app
   (ICONE_POR_USUARIO em nativo.js). Só aparece com sessão do Supabase e o app
   destravado (auth-gate.js): antes do login não mostra nada. CSS em index.html (.monograma). */
(() => {
  'use strict';
  const POR_USUARIO = { acms: 'AC' };
  const PADRAO = 'JL';
  const raiz = document.documentElement;
  const usuario = () => {
    try { return String((JSON.parse(localStorage.getItem('agenda_app_profile_v1') || '{}') || {}).username || '').trim().toLowerCase(); } catch (_) { return ''; }
  };
  const temSessao = () => {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !/^sb-.*-auth-token$/.test(k)) continue;
        const raw = JSON.parse(localStorage.getItem(k) || 'null');
        const s = raw && (raw.currentSession || raw.session || raw);
        if (s && (s.refresh_token || s.access_token)) return true;
      }
    } catch (_) {}
    return false;
  };
  function pintar() {
    const ver = document.getElementById('app-ver-num');
    if (!ver) return;
    let el = document.getElementById('app-monograma');
    const ok = temSessao() && !raiz.classList.contains('agenda-locked') && !document.getElementById('agendaAuthVeil');
    if (!ok) { if (el) el.remove(); return; }
    const txt = POR_USUARIO[usuario()] || PADRAO;
    if (!el) {
      el = document.createElement('span');
      el.id = 'app-monograma'; el.className = 'monograma'; el.setAttribute('role', 'img');
      ver.insertAdjacentElement('afterend', el);
    }
    if (el.textContent !== txt) { el.textContent = txt; el.setAttribute('aria-label', 'Conta ' + txt); }
  }
  new MutationObserver(pintar).observe(raiz, { attributes: true, attributeFilter: ['class'] });
  window.addEventListener('storage', pintar);
  window.addEventListener('pageshow', pintar);
  let n = 0; const t = setInterval(() => { pintar(); if (++n >= 20) clearInterval(t); }, 1500);
  pintar();
})();
