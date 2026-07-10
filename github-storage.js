/*
  GitHub Storage Provider — Agenda Lagares
  - GitHub vira armazenamento sincronizado quando configurado.
  - localStorage continua como cache offline e fallback.
  - Nenhum token fica no repositório; a chave é configurada no aparelho do usuário.
*/
(() => {
  'use strict';

  const CFG_KEY = 'agenda_github_storage_config_v1';
  const STATUS_ID = 'githubStorageStatus';
  const BTN_ID = 'githubStorageBtn';
  const DIALOG_ID = 'githubStorageDialog';
  const STYLE_ID = 'githubStorageStyles';
  const DATA = {
    tarefas: { localKey: 'agenda_lagares_v3', path: 'dados/tarefas.json', fallback: [] },
    notas: { localKey: 'agenda_notas_v1', path: 'dados/notas.json', fallback: {} },
    recorrencias: { localKey: 'agenda_regras_v1', path: 'dados/recorrencias.json', fallback: [] },
    configuracoes: { localKey: 'agenda_configuracoes_v1', path: 'dados/configuracoes.json', fallback: {} },
    historico: { localKey: 'agenda_historico_v1', path: 'dados/historico.json', fallback: [] },
    metadata: { localKey: 'agenda_metadata_v1', path: 'dados/metadata.json', fallback: {} }
  };

  let syncTimer = 0;
  let syncing = false;
  let lastError = '';

  const safeJson = (value, fallback) => {
    try {
      const parsed = JSON.parse(value);
      return parsed == null ? fallback : parsed;
    } catch (_) {
      return fallback;
    }
  };

  const readLocal = def => safeJson(localStorage.getItem(def.localKey), def.fallback);
  const writeLocal = (def, value) => localStorage.setItem(def.localKey, JSON.stringify(value));

  const getConfig = () => {
    const cfg = safeJson(localStorage.getItem(CFG_KEY) || '{}', {});
    return {
      owner: cfg.owner || 'LGRSV',
      repo: cfg.repo || 'agenda-iphone',
      branch: cfg.branch || 'feature/github-storage',
      token: cfg.token || '',
      enabled: cfg.enabled === true,
      autoPull: cfg.autoPull !== false,
      autoPush: cfg.autoPush !== false
    };
  };

  const setConfig = cfg => {
    const cur = getConfig();
    localStorage.setItem(CFG_KEY, JSON.stringify({ ...cur, ...cfg }));
    renderStatus();
  };

  const apiUrl = (cfg, path) => `https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${path}?ref=${encodeURIComponent(cfg.branch)}`;

  const headers = cfg => ({
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    Authorization: `Bearer ${cfg.token}`
  });

  const b64encodeUnicode = text => btoa(unescape(encodeURIComponent(text)));
  const b64decodeUnicode = b64 => decodeURIComponent(escape(atob(String(b64 || '').replace(/\s/g, ''))));

  const fetchRemoteFile = async (cfg, def) => {
    const res = await fetch(apiUrl(cfg, def.path), { headers: headers(cfg), cache: 'no-store' });
    if (res.status === 404) return { sha: null, value: def.fallback };
    if (!res.ok) throw new Error(`Falha ao ler ${def.path}: HTTP ${res.status}`);
    const json = await res.json();
    return { sha: json.sha, value: safeJson(b64decodeUnicode(json.content), def.fallback) };
  };

  const putRemoteFile = async (cfg, def, value, sha, message) => {
    const body = {
      message,
      content: b64encodeUnicode(JSON.stringify(value, null, 2) + '\n'),
      branch: cfg.branch
    };
    if (sha) body.sha = sha;
    const res = await fetch(`https://api.github.com/repos/${encodeURIComponent(cfg.owner)}/${encodeURIComponent(cfg.repo)}/contents/${def.path}`, {
      method: 'PUT',
      headers: { ...headers(cfg), 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`Falha ao gravar ${def.path}: HTTP ${res.status}`);
    return res.json();
  };

  const isMeaningful = value => {
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === 'object') return Object.keys(value).length > 0;
    return value != null && value !== '';
  };

  const pullFromGitHub = async ({ overwriteLocal = false } = {}) => {
    const cfg = getConfig();
    if (!cfg.enabled || !cfg.token) throw new Error('GitHub Storage não configurado.');
    syncing = true;
    renderStatus('Baixando dados…');
    try {
      for (const def of Object.values(DATA)) {
        const remote = await fetchRemoteFile(cfg, def);
        const local = readLocal(def);
        if (overwriteLocal || !isMeaningful(local)) writeLocal(def, remote.value);
      }
      lastError = '';
      renderStatus('Sincronizado');
      dispatchChange('pull');
    } finally {
      syncing = false;
    }
  };

  const pushToGitHub = async () => {
    const cfg = getConfig();
    if (!cfg.enabled || !cfg.token) throw new Error('GitHub Storage não configurado.');
    syncing = true;
    renderStatus('Enviando dados…');
    try {
      for (const [name, def] of Object.entries(DATA)) {
        const local = readLocal(def);
        const remote = await fetchRemoteFile(cfg, def);
        await putRemoteFile(cfg, def, local, remote.sha, `sync(data): atualiza ${name} pela Agenda`);
      }
      lastError = '';
      renderStatus('Sincronizado');
    } finally {
      syncing = false;
    }
  };

  const schedulePush = () => {
    const cfg = getConfig();
    if (!cfg.enabled || !cfg.autoPush || !cfg.token) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      pushToGitHub().catch(err => {
        lastError = err.message || String(err);
        renderStatus('Erro ao sincronizar');
      });
    }, 1500);
  };

  const dispatchChange = source => {
    document.dispatchEvent(new CustomEvent('agenda:datachange', { detail: { source: `github-storage:${source}` } }));
    window.dispatchEvent(new CustomEvent('agenda:datachange', { detail: { source: `github-storage:${source}` } }));
  };

  const ensureStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = `
      #${BTN_ID}{position:relative}
      #${STATUS_ID}{position:absolute;right:-2px;bottom:-2px;width:10px;height:10px;border:2px solid var(--surface);border-radius:50%;background:var(--faint)}
      #${STATUS_ID}.on{background:#78d88b} #${STATUS_ID}.sync{background:#ffb74d} #${STATUS_ID}.err{background:var(--danger)}
      #${DIALOG_ID} .gh-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      #${DIALOG_ID} .gh-actions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px}
      #${DIALOG_ID} .gh-small{margin-top:10px;color:var(--muted);font-size:12px;line-height:1.45}
      #${DIALOG_ID} .gh-warn{margin-top:10px;padding:10px;border:1px solid color-mix(in srgb,var(--danger) 40%,var(--line));border-radius:12px;background:color-mix(in srgb,var(--danger) 10%,transparent);color:var(--danger);font-size:12px;line-height:1.45}
    `;
    document.head.appendChild(s);
  };

  const ensureDialog = () => {
    let dlg = document.getElementById(DIALOG_ID);
    if (dlg) return dlg;
    dlg = document.createElement('dialog');
    dlg.id = DIALOG_ID;
    dlg.innerHTML = `<form class="modal" id="githubStorageForm" method="dialog">
      <h3>GitHub Storage</h3>
      <p>Sincronize tarefas, notas e recorrências com arquivos JSON no GitHub. O token fica salvo apenas neste aparelho.</p>
      <div class="gh-row">
        <div><label class="field-label" for="ghOwner">Owner</label><input id="ghOwner" type="text" autocomplete="off"></div>
        <div><label class="field-label" for="ghRepo">Repo</label><input id="ghRepo" type="text" autocomplete="off"></div>
      </div>
      <label class="field-label" for="ghBranch">Branch de dados</label><input id="ghBranch" type="text" autocomplete="off">
      <label class="field-label" for="ghToken">Token GitHub</label><input id="ghToken" type="password" autocomplete="off" placeholder="Fine-grained token com Contents read/write">
      <div class="notice"><strong>Status</strong><span id="ghStatusText">Não configurado.</span></div>
      <div class="gh-actions">
        <button class="secondary" type="button" id="ghPull">Baixar do GitHub</button>
        <button class="secondary" type="button" id="ghPush">Enviar para GitHub</button>
      </div>
      <div class="gh-warn">Use preferencialmente um repositório privado para os dados. Não coloque token no código nem em arquivos do repositório.</div>
      <p class="gh-small">Modo seguro: o app continua funcionando offline no localStorage e sincroniza quando estiver configurado.</p>
      <div class="actions"><button class="secondary" type="button" id="ghCancel">Fechar</button><button class="primary" type="submit">Salvar e ativar</button></div>
    </form>`;
    document.body.appendChild(dlg);

    dlg.querySelector('#ghCancel').addEventListener('click', () => dlg.close());
    dlg.addEventListener('click', e => { if (e.target === dlg) dlg.close(); });
    dlg.querySelector('#ghPull').addEventListener('click', () => pullFromGitHub({ overwriteLocal: true }).then(() => setStatusText('Dados baixados e aplicados.')).catch(err => setStatusText(err.message, true)));
    dlg.querySelector('#ghPush').addEventListener('click', () => pushToGitHub().then(() => setStatusText('Dados enviados ao GitHub.')).catch(err => setStatusText(err.message, true)));
    dlg.querySelector('#githubStorageForm').addEventListener('submit', e => {
      e.preventDefault();
      setConfig({
        owner: dlg.querySelector('#ghOwner').value.trim(),
        repo: dlg.querySelector('#ghRepo').value.trim(),
        branch: dlg.querySelector('#ghBranch').value.trim() || 'feature/github-storage',
        token: dlg.querySelector('#ghToken').value.trim(),
        enabled: true,
        autoPull: true,
        autoPush: true
      });
      setStatusText('Configuração salva. Sincronização ativada.');
      schedulePush();
    });
    return dlg;
  };

  const setStatusText = (text, isError = false) => {
    const el = document.getElementById('ghStatusText');
    if (el) el.textContent = text;
    if (isError) lastError = text;
    renderStatus();
  };

  const openDialog = () => {
    ensureStyles();
    const dlg = ensureDialog();
    const cfg = getConfig();
    dlg.querySelector('#ghOwner').value = cfg.owner;
    dlg.querySelector('#ghRepo').value = cfg.repo;
    dlg.querySelector('#ghBranch').value = cfg.branch;
    dlg.querySelector('#ghToken').value = cfg.token;
    setStatusText(lastError || (cfg.enabled ? 'Ativo.' : 'Não configurado.'));
    if (!dlg.open) dlg.showModal();
  };

  const ensureButton = () => {
    ensureStyles();
    const actions = document.querySelector('.head-actions');
    if (!actions || document.getElementById(BTN_ID)) return;
    const button = document.createElement('button');
    button.id = BTN_ID;
    button.className = 'icon-btn';
    button.type = 'button';
    button.title = 'GitHub Storage';
    button.setAttribute('aria-label', 'Configurar GitHub Storage');
    button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5 5 7v5c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V7z"/><path d="M9 12.5 11 14.5 15.5 10"/></svg><span id="${STATUS_ID}"></span>`;
    button.addEventListener('click', openDialog);
    actions.insertBefore(button, actions.firstChild);
    renderStatus();
  };

  const renderStatus = (text = '') => {
    const dot = document.getElementById(STATUS_ID);
    if (!dot) return;
    const cfg = getConfig();
    dot.className = syncing ? 'sync' : lastError ? 'err' : cfg.enabled && cfg.token ? 'on' : '';
    dot.title = text || lastError || (cfg.enabled && cfg.token ? 'GitHub Storage ativo' : 'GitHub Storage não configurado');
  };

  const watchLocalChanges = () => {
    document.addEventListener('agenda:datachange', schedulePush);
    window.addEventListener('storage', event => {
      const keys = Object.values(DATA).map(d => d.localKey);
      if (keys.includes(event.key)) schedulePush();
    });
  };

  const init = () => {
    ensureButton();
    watchLocalChanges();
    const cfg = getConfig();
    if (cfg.enabled && cfg.token && cfg.autoPull) {
      pullFromGitHub({ overwriteLocal: false }).catch(err => {
        lastError = err.message || String(err);
        renderStatus('Erro ao baixar dados');
      });
    }
    let frame = 0;
    new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(ensureButton);
    }).observe(document.body, { childList: true, subtree: true });
  };

  window.GitHubStorageProvider = {
    getConfig,
    setConfig,
    pullFromGitHub,
    pushToGitHub,
    schedulePush
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
