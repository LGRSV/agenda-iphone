/* sequencial.js — atalhos para o Modo Sequencial (aba "Sequência" da agenda).
   A visualização em si vive dentro de index.html (função renderSequencia,
   junto das outras views Dia/Mês/Lista) para herdar de graça o toggle real
   de tarefas, o XP do painel de gamificação e as animações já existentes.
   Este script só acrescenta dois atalhos até a aba: um ícone fixo ao lado do
   menu principal e uma faixa logo abaixo do seletor Dia/Mês/Lista. */
(() => {
  'use strict';

  const STYLE_ID = 'seqModeStyles';
  const CLOCK_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="13" r="8.5"/><path d="M12 9v4l3 2M9 2h6"/></svg>';

  const ensureStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #seqTimerBtn{position:relative}
      #seqTimerBtn svg{width:20px;height:20px}
      #seqTimerBtn.seq-active{color:var(--accent);border-color:var(--accent)}
      .seq-entry-btn{display:flex;align-items:center;gap:8px;width:100%;margin:0 0 14px;padding:11px 14px;border:1px dashed var(--accent);border-radius:14px;background:color-mix(in srgb,var(--accent) 8%,var(--surface));color:var(--accent);font-size:12.5px;font-weight:800;transition:transform .14s ease}
      .seq-entry-btn svg{width:16px;height:16px;flex:0 0 auto}
      .seq-entry-btn:active{transform:scale(.98)}
      .seq-entry-btn[hidden]{display:none}
    `;
    document.head.appendChild(style);
  };

  const goToSequencia = () => {
    document.querySelector('#viewTabs [data-view="sequencia"]')?.click();
  };

  const syncActiveState = () => {
    const active = document.querySelector('#viewTabs [data-view="sequencia"].active');
    const btn = document.getElementById('seqTimerBtn');
    if (btn) btn.classList.toggle('seq-active', !!active);
    const entry = document.getElementById('seqEntryBtn');
    if (entry) entry.hidden = !!active;
  };

  const ensureButton = () => {
    if (document.getElementById('seqTimerBtn')) return;
    const actions = document.querySelector('.head-actions');
    if (!actions) return;
    const btn = document.createElement('button');
    btn.id = 'seqTimerBtn';
    btn.type = 'button';
    btn.className = 'icon-btn';
    btn.title = 'Modo sequencial';
    btn.setAttribute('aria-label', 'Ativar modo sequencial');
    btn.innerHTML = CLOCK_SVG;
    const moreBtn = document.getElementById('moreMenuBtn');
    if (moreBtn) actions.insertBefore(btn, moreBtn); else actions.appendChild(btn);
    btn.addEventListener('click', goToSequencia);
  };

  const ensureEntry = () => {
    if (document.getElementById('seqEntryBtn')) return;
    const tabs = document.getElementById('viewTabs');
    if (!tabs || !tabs.parentNode) return;
    const btn = document.createElement('button');
    btn.id = 'seqEntryBtn';
    btn.type = 'button';
    btn.className = 'seq-entry-btn';
    btn.innerHTML = `${CLOCK_SVG}<span>Modo sequencial</span>`;
    tabs.parentNode.insertBefore(btn, tabs.nextSibling);
    btn.addEventListener('click', goToSequencia);
  };

  const install = () => {
    ensureStyles();
    ensureButton();
    ensureEntry();
    syncActiveState();
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install);
  else install();
  new MutationObserver(install).observe(document.documentElement, { childList: true, subtree: true });
})();
