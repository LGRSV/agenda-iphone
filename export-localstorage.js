/*
  Export LocalStorage
  Adiciona botão no topo para exportar os dados locais da Agenda Lagares.
  Tokens, sessões e credenciais são sempre omitidos ou mascarados.
*/
(() => {
  'use strict';

  const BUTTON_ID = 'exportLocalStorageBtn';
  const STYLE_ID = 'exportLocalStorageStyles';
  const KNOWN_KEYS = [
    'agenda_lagares_v3',
    'agenda_notas_v1',
    'agenda_lagares_rules_v1',
    'agenda_treino_logs_v1',
    'agenda_treino_meta_v1',
    'agenda_lagares_config_v1',
    'agenda_lixeira_v1',
    'agenda_historico_v1'
  ];

  const SENSITIVE_KEY = /(token|secret|password|senha|service[_-]?role|auth[_-]?key|auth-token|publishablekey|anonkey)/i;
  const SENSITIVE_STORAGE_KEY = /(^sb-.+-auth-token$|agenda_lagares_gitsync|agenda_supabase_config)/i;

  const pad = value => String(value).padStart(2, '0');
  const timestamp = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}_${pad(d.getHours())}-${pad(d.getMinutes())}`;
  };

  const tryJson = value => {
    try { return JSON.parse(value); } catch (_) { return value; }
  };

  const redact = (value, key = '') => {
    if (SENSITIVE_KEY.test(String(key))) return '[REDACTED]';
    if (Array.isArray(value)) return value.map(item => redact(item));
    if (value && typeof value === 'object') {
      const result = {};
      for (const [childKey, childValue] of Object.entries(value)) {
        result[childKey] = redact(childValue, childKey);
      }
      return result;
    }
    return value;
  };

  const collect = () => {
    const localStorageDump = {};
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (SENSITIVE_STORAGE_KEY.test(key) || SENSITIVE_KEY.test(key)) {
        localStorageDump[key] = '[REDACTED]';
        continue;
      }
      localStorageDump[key] = redact(tryJson(localStorage.getItem(key)), key);
    }

    const agendaKeys = {};
    for (const key of KNOWN_KEYS) {
      const value = localStorage.getItem(key);
      if (value !== null) agendaKeys[key] = redact(tryJson(value), key);
    }

    let intelligence = null;
    try {
      intelligence = window.AgendaAPI?.getAgendaIntelligence?.() || window.AgendaIntel?.summarize?.() || null;
    } catch (_) {}

    return {
      app: 'Agenda Lagares',
      exportVersion: 2,
      exportedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      locationHref: location.href,
      securityNotice: 'Tokens, sessões e credenciais foram removidos deste arquivo.',
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
    showToast('Dados exportados sem tokens ou credenciais.');
  };

  const ensureStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `#${BUTTON_ID} svg{width:22px;height:22px}`;
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
