/* Impede que o Safari desloque o painel financeiro para uma área lateral vazia.
   A rolagem horizontal continua existindo apenas nos carrosséis de cards. */
(() => {
  'use strict';

  const style = document.createElement('style');
  style.id = 'finance-mobile-guard-styles';
  style.textContent = `
    @media (max-width: 600px) {
      html, body { width: 100%; max-width: 100%; overscroll-behavior-x: none; }
      body { overflow-x: hidden; }
      .app { min-width: 0; overflow-x: hidden; }
      @supports (overflow: clip) {
        body, .app { overflow-x: clip; }
      }
      #pager, .saldo-pager {
        max-width: 100%;
        overscroll-behavior-x: contain;
        scroll-snap-stop: always;
      }
      #pager .slide, .saldo-pager .saldo-slide { scroll-snap-stop: always; }
    }
  `;
  document.head.append(style);
})();
