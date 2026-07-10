/*
  Export LocalStorage
  Adiciona botão no topo para exportar os dados locais da Agenda Lagares.
  O arquivo gerado pode ser enviado para análise externa sem precisar acessar o iPhone remotamente.
*/
(() => {
  'use strict';

  const BUTTON_ID = 'exportLocalStorageBtn';
  const STYLE_ID = 'exportLocalStorageStyles';
  const KNOWN_KEYS = [
    'agenda_lagares_v3',
    'agenda_notas_v1',
    'agenda_regras_v1',
    'agenda_treino_time_v1',
    'agenda_seed_pessoal_v1',
    'agenda_seed_pessoal_v2',
    'agenda_seed_pessoal_v3',
    'agenda_seed_pessoal_v4',
    'agenda_seed_pessoal_v5',
    'agenda_seed_pessoal_v6',
    'agenda_seed_pessoal_v7',
    'agenda_seed_pessoal_v8',
    'agenda_seed_pessoal_v9',
    'agenda_seed_pessoal_v10',
    'agenda_seed_pessoal_v11',
    'agenda_seed_pessoal_v12',
    'agenda_seed_pessoal_v13',
    'agenda_seed_pessoal_v14',
    'agenda_seed_pessoal_v15',
    'agenda_seed_pessoal_v16',
    'agenda_seed_pessoal_v17',
    'agenda_seed_pessoal_v18',
    'agenda_seed_pessoal_v19',
    'agenda_seed_pessoal_v20'
  ];

  const pad = value => String(value).padStart(2, '0');
  const timestamp = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
  };

  const tryJson = value => {
    try { return JSON.parse(value); } catch (_) { return value; }
  };

  const collect = () => {
    const localStorageDump = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      localStorageDump[key] = tryJson(localStorage.getItem(key));
    }

    const agendaKeys = {};
    for (const key of KNOWN_KEYS) {
      const value = localStorage.getItem(key);
      if (value !== null) agendaKeys[key] = tryJson(value);
    }

    let intelligence = null;
    try {
      intelligence = window.AgendaAPI?.getAgendaIntelligence?.() || window.AgendaIntel?.summarize?.() || null;
    } catch (_) {}

    return {
      app: 'Agenda Lagares',
      exportVersion: 1,
      exportedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      locationHref: location.href,
      agendaKeys,
      intelligence,
      localStorage: localStorageDump
    };
  };

  const showToast = message => {
    let toast = document.querySelector('.toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2600);
  };

  const download = () => {
    const data = collect();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agenda-lagares-localstorage-${timestamp()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    showToast('Dados da agenda exportados em JSON.');
  };

  const ensureStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${BUTTON_ID} svg {
        width: 22px;
        height: 22px;
      }
    `;
    document.head.appendChild(style);
  };

  const ensureButton = () => {
    ensureStyles();
    const actions = document.querySelector('.head-actions');
    if (!actions || document.getElementById(BUTTON_ID)) return;

    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.className = 'icon-btn';
    button.type = 'button';
    button.title = 'Exportar dados locais';
    button.setAttribute('aria-label', 'Exportar dados locais da agenda');
    button.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M5 3.5h11.5L19 6v14.5H5z"/>
        <path d="M8 3.5v6h8v-6"/>
        <path d="M8 20.5v-6h8v6"/>
        <path d="M10 6.5h4"/>
      </svg>`;
    button.addEventListener('click', download);

    actions.insertBefore(button, actions.firstChild);
  };

  ensureButton();
  let frame = 0;
  new MutationObserver(() => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(ensureButton);
  }).observe(document.body, { childList: true, subtree: true });
})();
