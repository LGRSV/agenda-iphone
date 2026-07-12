/* Alias de login para a Agenda Lagares.
   O Supabase continua usando e-mail internamente; a interface aceita "jalms2". */
(() => {
  'use strict';

  const USERNAME = 'jalms2';
  const EMAIL = 'joaoantonio.negocios@gmail.com';
  const OVERLAY_ID = 'agendaLoginOverlay';

  const normalize = value => {
    const input = String(value || '').trim();
    return input.toLowerCase() === USERNAME ? EMAIL : input;
  };

  const install = () => {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay || overlay.dataset.usernameAlias === '1') return;
    overlay.dataset.usernameAlias = '1';

    const input = overlay.querySelector('#agendaLoginEmail');
    const label = overlay.querySelector('label[for="agendaLoginEmail"]');
    const form = overlay.querySelector('#agendaLoginForm');
    if (!input || !form) return;

    input.type = 'text';
    input.inputMode = 'text';
    input.autocomplete = 'username';
    input.placeholder = 'jalms2';
    if (label) label.textContent = 'Login';

    form.addEventListener('submit', () => {
      input.value = normalize(input.value);
    }, true);

    const create = overlay.querySelector('#agendaCreateAccount');
    if (create) {
      create.addEventListener('click', () => {
        input.value = normalize(input.value);
      }, true);
    }

    const resend = overlay.querySelector('#agendaResendConfirmation');
    if (resend) {
      resend.addEventListener('click', () => {
        input.value = normalize(input.value);
      }, true);
    }

    input.addEventListener('focus', () => {
      if (input.value.toLowerCase() === EMAIL.toLowerCase()) input.value = USERNAME;
    });

    input.addEventListener('blur', () => {
      if (input.value.toLowerCase() === EMAIL.toLowerCase()) input.value = USERNAME;
    });
  };

  new MutationObserver(install).observe(document.documentElement, { childList: true, subtree: true });
  install();
})();
