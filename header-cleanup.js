/*
  Limpeza do cabeçalho mobile — Agenda Lagares
  Mantém somente os controles essenciais no topo e remove overlays de preview.
*/
(() => {
  'use strict';

  const ALLOWED_IDS = new Set(['supabaseStorageBtn', 'painelBtn', 'financeiroBtn', 'lixBtn', 'alertsBtn', 'themeToggle', 'atualizarBtn', 'notaRapidaBtn']);
  const STYLE_ID = 'agendaHeaderCleanupStyles';

  const ensureStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      @media (max-width: 760px) {
        .topbar{position:relative!important;top:auto!important;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;align-items:start!important;overflow:visible!important}
        .topbar>div:first-child{min-width:0!important}
        .head-actions{display:flex!important;align-items:center!important;justify-content:flex-end!important;gap:6px!important;max-width:150px!important;overflow:visible!important;flex-wrap:wrap!important}
        .head-actions>.icon-btn{width:46px!important;height:46px!important;flex:0 0 46px!important}
        .agenda-hidden-header-control{display:none!important}
        [data-agenda-preview-control="desktop"]{display:none!important}
      }
    `;
    document.head.appendChild(style);
  };

  const cleanHeader = () => {
    ensureStyles();
    const actions = document.querySelector('.head-actions');
    if (actions) {
      [...actions.children].forEach(child => {
        const keep = child.id && ALLOWED_IDS.has(child.id);
        child.classList.toggle('agenda-hidden-header-control', !keep);
        if (!keep) child.setAttribute('aria-hidden', 'true');
      });
    }

    // Alguns wrappers de PWA/preview inserem um botão "Desktop" fora do app.
    for (const element of document.querySelectorAll('button,a,[role="button"]')) {
      if (element.closest('.app') || element.closest('#agendaLoginOverlay')) continue;
      const label = (element.textContent || '').trim().toLowerCase();
      const aria = (element.getAttribute('aria-label') || '').trim().toLowerCase();
      if (label === 'desktop' || aria === 'desktop') {
        element.dataset.agendaPreviewControl = 'desktop';
        element.setAttribute('aria-hidden', 'true');
      }
    }
  };

  cleanHeader();
  let frame = 0;
  new MutationObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(cleanHeader);
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
