/* =========================================================================
   anim-enhance.js — animações de ABRIR e FECHAR dos modais da Agenda.

   O núcleo chama dialog.close() direto em vários pontos, então os modais
   sumiam sem transição de saída. Aqui envolvemos close()/showModal() de cada
   <dialog> (por elemento, não no prototype global) para:
     • na saída, aplicar .is-closing → tocar a animação e só então fechar;
     • ao reabrir, cancelar qualquer fechamento pendente (à prova de corrida).

   Seguro: #rescheduleDialog já tem sua própria animação de saída e é
   ignorado. Respeita prefers-reduced-motion (fecha na hora, sem animar).
   ========================================================================= */
(() => {
  'use strict';

  const SKIP = new Set(['rescheduleDialog']); // já animam o fechamento sozinhos
  const CLOSE_MS = 180;
  const nativeClose = HTMLDialogElement.prototype.close;
  const nativeShow = HTMLDialogElement.prototype.showModal;
  const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function enhance(dialog) {
    if (!(dialog instanceof HTMLDialogElement) || dialog.dataset.animEnhanced === '1') return;
    if (SKIP.has(dialog.id)) { dialog.dataset.animEnhanced = '1'; return; }
    dialog.dataset.animEnhanced = '1';

    let closeTimer = 0;

    dialog.showModal = function (...args) {
      // Reabrir cancela um fechamento em andamento.
      if (closeTimer) { clearTimeout(closeTimer); closeTimer = 0; }
      dialog.classList.remove('is-closing');
      if (!dialog.open) return nativeShow.apply(dialog, args);
    };

    dialog.close = function (returnValue) {
      if (!dialog.open || reduceMotion()) {
        dialog.classList.remove('is-closing');
        return nativeClose.call(dialog, returnValue);
      }
      if (dialog.classList.contains('is-closing')) return; // já saindo
      dialog.classList.add('is-closing');
      closeTimer = setTimeout(() => {
        closeTimer = 0;
        dialog.classList.remove('is-closing');
        try { nativeClose.call(dialog, returnValue); } catch (_) {}
      }, CLOSE_MS);
    };

    // Esc dispara 'cancel' → deixamos o nosso close animar em vez do corte seco.
    dialog.addEventListener('cancel', event => {
      if (reduceMotion()) return;
      event.preventDefault();
      dialog.close();
    });
  }

  const scan = () => document.querySelectorAll('dialog').forEach(enhance);

  let frame = 0;
  new MutationObserver(() => { cancelAnimationFrame(frame); frame = requestAnimationFrame(scan); })
    .observe(document.documentElement, { childList: true, subtree: true });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
  else scan();
})();
