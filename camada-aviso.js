/* camada-aviso.js — o aviso (#toast) aparece por cima de janela aberta.

   Um <dialog> aberto com showModal() fica na camada de cima (top layer), acima de
   qualquer z-index: o erro de permissão em Acessos do iPhone ou de IP inválido na
   Renovação era mostrado ATRÁS da janela e só aparecia depois de fechá-la.
   Aqui o #toast vira popover manual: cada vez que algum módulo põe a classe "show",
   ele entra na camada de cima (acima do diálogo aberto); quando a classe sai, a
   animação de sumir roda e só então ele deixa a camada. Sem popover (iOS < 17),
   nada muda. */
(() => {
  'use strict';
  const t = document.getElementById('toast');
  if (!t || typeof t.showPopover !== 'function') return;
  t.setAttribute('popover', 'manual');
  const aberto = () => { try { return t.matches(':popover-open'); } catch (_) { return false; } };
  let tm = 0;
  function sincronizar() {
    clearTimeout(tm);
    if (t.classList.contains('show')) {
      // reabrir põe o aviso acima do diálogo aberto depois dele
      try { if (aberto()) t.hidePopover(); t.showPopover(); } catch (_) {}
    } else {
      tm = setTimeout(() => { try { if (!t.classList.contains('show') && aberto()) t.hidePopover(); } catch (_) {} }, 260);
    }
  }
  new MutationObserver(sincronizar).observe(t, { attributes: true, attributeFilter: ['class'] });
  sincronizar();
})();
