/* =========================================================================
   viewmode.js — compatibilidade de tela + alternador Desktop / iPhone.
   - Corrige o "zoom" do iOS: trava o text-size-adjust, mata overflow
     horizontal e garante inputs >= 16px (o Safari da zoom em campos menores).
   - Botao flutuante para alternar entre:
       • iPhone : ajusta perfeitamente a tela (width=device-width, sem zoom).
       • Desktop: renderiza a pagina em largura de desktop (1180px).
   A escolha fica salva por aparelho. Funciona em qualquer pagina do app.
   ========================================================================= */
(function () {
  'use strict';
  var KEY = 'agenda_viewmode_v1';
  var VP_PHONE = 'width=device-width, initial-scale=1, maximum-scale=1, viewport-fit=cover';
  var VP_DESKTOP = 'width=1180, viewport-fit=cover';

  var vp = document.querySelector('meta[name="viewport"]');
  if (!vp) { vp = document.createElement('meta'); vp.setAttribute('name', 'viewport'); document.head.appendChild(vp); }

  // ---- CSS: correcoes de compatibilidade + estilo do botao ----
  var css = document.createElement('style');
  css.id = 'viewmodeStyles';
  css.textContent =
    'html{-webkit-text-size-adjust:100%;text-size-adjust:100%}' +
    // overflow-x:clip (e não hidden) evita rolagem horizontal SEM transformar o
    // body em container de scroll — no PWA do iOS o "hidden" fazia os botões
    // position:fixed rolarem junto com a página em vez de ficarem parados.
    'html,body{overflow-x:clip;max-width:100%}' +
    'img,svg,video,canvas{max-width:100%}' +
    // impede o zoom do iOS ao focar campos (precisa ser >=16px no celular)
    '@media(max-width:600px){input:not([type=checkbox]):not([type=radio]):not([type=range]),select,textarea{font-size:16px !important}}' +
    // botao alternador
    '#viewmode-btn{position:fixed;z-index:3000;top:calc(env(safe-area-inset-top) + 9px);right:calc(env(safe-area-inset-right) + 9px);' +
    'display:inline-flex;align-items:center;gap:6px;padding:7px 11px;border:1px solid rgba(150,160,180,.42);border-radius:999px;' +
    'background:rgba(28,31,38,.82);color:#e6eaf1;font:700 12px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;' +
    'letter-spacing:.01em;-webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);box-shadow:0 6px 18px rgba(0,0,0,.32);' +
    'cursor:pointer;-webkit-text-size-adjust:100%;transition:transform .13s ease}' +
    '#viewmode-btn:active{transform:scale(.94)}' +
    '#viewmode-btn svg{width:15px;height:15px;flex:0 0 auto}' +
    // no modo desktop tudo encolhe (viewport 1180): aumenta o botao p/ continuar tocavel
    'html[data-viewmode="desktop"] #viewmode-btn{padding:16px 22px;font-size:30px;gap:12px;border-radius:999px}' +
    'html[data-viewmode="desktop"] #viewmode-btn svg{width:34px;height:34px}';
  document.head.appendChild(css);

  var ICON_MONITOR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>';
  var ICON_PHONE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="7" y="2" width="10" height="20" rx="2.5"/><path d="M11 18h2"/></svg>';

  var btn = null;

  function paint(mode) {
    if (!btn) return;
    // botao mostra para onde vai alternar
    if (mode === 'desktop') { btn.innerHTML = ICON_PHONE + '<span>iPhone</span>'; btn.setAttribute('aria-label', 'Mudar para visualização iPhone'); }
    else { btn.innerHTML = ICON_MONITOR + '<span>Desktop</span>'; btn.setAttribute('aria-label', 'Mudar para visualização Desktop'); }
  }

  function apply(mode, save) {
    mode = mode === 'desktop' ? 'desktop' : 'phone';
    vp.setAttribute('content', mode === 'desktop' ? VP_DESKTOP : VP_PHONE);
    document.documentElement.setAttribute('data-viewmode', mode);
    if (save) { try { localStorage.setItem(KEY, mode); } catch (_) {} }
    paint(mode);
  }

  function init() {
    btn = document.createElement('button');
    btn.id = 'viewmode-btn';
    btn.type = 'button';
    document.body.appendChild(btn);
    btn.addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-viewmode') || 'phone';
      apply(cur === 'desktop' ? 'phone' : 'desktop', true);
    });
    var saved = 'phone';
    try { saved = localStorage.getItem(KEY) || 'phone'; } catch (_) {}
    apply(saved, false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
