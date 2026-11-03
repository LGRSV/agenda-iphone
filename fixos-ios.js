/* fixos-ios.js — no iOS, depois que o teclado fecha, o WebKit pode deixar os elementos position:fixed
   deslocados para cima pela altura do teclado (o layout viewport fica "encolhido") até algo forçar o
   recálculo. Os botões flutuantes param no meio da tela durante a rolagem. Aqui: força o recálculo ao
   fechar o teclado e, se o deslocamento continuar, compensa pela margem (margem não cria containing
   block, então os filhos fixed de .agenda-actions continuam certos). */
(() => {
  'use strict';
  if (!/iPhone|iPad|iPod/.test(navigator.userAgent)) return;
  const vv = window.visualViewport;
  if (!vv) return;
  const st = document.createElement('style');
  st.textContent = '.fab,.agenda-actions,.agenda-actions #jarvis-btn,#app-ver,.toast{margin-bottom:calc(var(--ios-fixo-ajuste,0px) * -1)!important}';
  document.head.appendChild(st);
  const sonda = document.createElement('div');
  sonda.style.cssText = 'position:fixed;left:0;bottom:0;width:1px;height:1px;visibility:hidden;pointer-events:none';
  const raiz = document.documentElement;
  const digitando = () => { const a = document.activeElement; return !!a && (/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName) || a.isContentEditable); };
  let quadro = 0;
  function medir() {
    quadro = 0;
    if (!sonda.isConnected) { if (!document.body) return; document.body.appendChild(sonda); }
    if (digitando()) { raiz.style.removeProperty('--ios-fixo-ajuste'); return; }
    const falta = Math.round(vv.height + vv.offsetTop - sonda.getBoundingClientRect().bottom);
    if (falta > 20) raiz.style.setProperty('--ios-fixo-ajuste', falta + 'px');
    else raiz.style.removeProperty('--ios-fixo-ajuste');
  }
  const pedir = () => { if (!quadro) quadro = requestAnimationFrame(medir); };
  vv.addEventListener('resize', pedir);
  vv.addEventListener('scroll', pedir);
  window.addEventListener('scroll', pedir, { passive: true });
  window.addEventListener('orientationchange', pedir);
  window.addEventListener('pageshow', pedir);
  document.addEventListener('visibilitychange', pedir);
  document.addEventListener('focusout', () => setTimeout(() => { window.scrollTo(window.scrollX, window.scrollY); pedir(); }, 350));
  pedir();
})();
