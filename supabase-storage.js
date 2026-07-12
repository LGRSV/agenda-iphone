/*
  Supabase Storage Provider — Agenda Lagares

  O Supabase passa a ser a fonte persistente dos dados. O localStorage continua
  como cache offline para manter o PWA funcional sem internet.

  Segurança:
  - usa somente Project URL + chave pública anon/publishable no navegador;
  - login por e-mail e senha é tratado pelo Supabase Auth;
  - a service_role key nunca deve ser usada neste arquivo;
  - o isolamento de cada usuário é feito pelas políticas RLS do banco.
*/
(() => {
  'use strict';

  const MODULE_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
  const CONFIG_KEY = 'agenda_supabase_config_v1';
  const DIRTY_KEY = 'agenda_supabase_dirty_v1';
  const BUTTON_ID = 'supabaseStorageBtn';
  const DIALOG_ID = 'supabaseStorageDialog';
  const STYLE_ID = 'supabaseStorageStyles';
  const STATUS_DOT_ID = 'supabaseStorageDot';
  const RELOAD_GUARD_KEY = 'agenda_supabase_reload_guard_v1';

  const DOCUMENTS = {
    tasks: { localKey: 'agenda_lagares_v3', fallback: [] },
    notes: { localKey: 'agenda_notas_v1', fallback: {} },
    rules: { localKey: 'agenda_lagares_rules_v1', fallback: [] },
    training_logs: { localKey: 'agenda_treino_logs_v1', fallback: {} },
    training_meta: { localKey: 'agenda_treino_meta_v1', fallback: {} },
    settings: { localKey: 'agenda_lagares_config_v1', fallback: {} },
    trash: { localKey: 'agenda_lixeira_v1', fallback: [] },
    history: { localKey: 'agenda_historico_v1', fallback: [] }
  };

  const LOCAL_TO_DOCUMENT = new Map(
    Object.entries(DOCUMENTS).map(([documentKey, definition]) => [definition.localKey, documentKey])
  );

  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;

  let client = null;
  let currentUser = null;
  let realtimeChannel = null;
  let internalWrite = false;
  let syncing = false;
  let pushTimer = 0;
  let reloadTimer = 0;
  let lastError = '';
  let libraryPromise = null;
  let startedUserId = '';

  const safeJson = (value, fallback) => {
    try {
      const parsed = JSON.parse(value);
      return parsed == null ? fallback : parsed;
    } catch (_) {
      return fallback;
    }
  };

  const clone = value => {
    try { return structuredClone(value); }
    catch (_) { return JSON.parse(JSON.stringify(value)); }
  };

  const rawSet = (key, value) => {
    internalWrite = true;
    try { originalSetItem.call(localStorage, key, value); }
    finally { internalWrite = false; }
  };

  const rawRemove = key => {
    internalWrite = true;
    try { originalRemoveItem.call(localStorage, key); }
    finally { internalWrite = false; }
  };

  const createDeviceId = () => `agenda-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

  const getConfig = () => {
    const value = safeJson(localStorage.getItem(CONFIG_KEY) || '{}', {});
    return {
      url: String(value.url || '').trim(),
      publishableKey: String(value.publishableKey || value.anonKey || '').trim(),
      email: String(value.email || '').trim(),
      enabled: value.enabled === true,
      deviceId: String(value.deviceId || createDeviceId()),
      migratedUserId: String(value.migratedUserId || ''),
      lastSyncAt: String(value.lastSyncAt || '')
    };
  };

  const setConfig = patch => {
    const next = { ...getConfig(), ...(patch || {}) };
    rawSet(CONFIG_KEY, JSON.stringify(next));
    renderStatus();
    return next;
  };

  const getDirty = () => safeJson(localStorage.getItem(DIRTY_KEY) || '{}', {});
  const setDirty = value => rawSet(DIRTY_KEY, JSON.stringify(value || {}));

  const readLocal = documentKey => {
    const def = DOCUMENTS[documentKey];
    return safeJson(localStorage.getItem(def.localKey), clone(def.fallback));
  };

  const sameJson = (a, b) => {
    try { return JSON.stringify(a) === JSON.stringify(b); }
    catch (_) { return false; }
  };

  const writeLocal = (documentKey, payload) => {
    const def = DOCUMENTS[documentKey];
    const next = payload == null ? clone(def.fallback) : payload;
    const previous = readLocal(documentKey);
    if (sameJson(previous, next)) return false;
    rawSet(def.localKey, JSON.stringify(next));
    return true;
  };

  const meaningful = value => {
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === 'object') return Object.keys(value).length > 0;
    return value != null && value !== '';
  };

  const mergeArrayById = (local, remote) => {
    const map = new Map();
    for (const item of Array.isArray(local) ? local : []) {
      const key = item && item.id != null ? String(item.id) : JSON.stringify(item);
      map.set(key, item);
    }
    for (const item of Array.isArray(remote) ? remote : []) {
      const key = item && item.id != null ? String(item.id) : JSON.stringify(item);
      map.set(key, item);
    }
    return [...map.values()];
  };

  const mergePayload = (documentKey, local, remote) => {
    if (!meaningful(remote)) return local;
    if (!meaningful(local)) return remote;
    if (['tasks', 'rules', 'training_logs', 'trash', 'history'].includes(documentKey) && Array.isArray(local) && Array.isArray(remote)) {
      return mergeArrayById(local, remote);
    }
    if (local && remote && typeof local === 'object' && typeof remote === 'object' && !Array.isArray(local) && !Array.isArray(remote)) {
      return { ...local, ...remote };
    }
    return remote;
  };

  const loadLibrary = async () => {
    if (!libraryPromise) libraryPromise = import(MODULE_URL);
    return libraryPromise;
  };

  const validConfig = cfg => /^https:\/\/.+\.supabase\.co\/?$/i.test(cfg.url) && cfg.publishableKey.length > 20;

  const destroyRealtime = async () => {
    if (client && realtimeChannel) {
      try { await client.removeChannel(realtimeChannel); } catch (_) {}
    }
    realtimeChannel = null;
  };

  const createSupabaseClient = async () => {
    const cfg = getConfig();
    if (!validConfig(cfg)) throw new Error('Informe a URL do projeto e a chave pública do Supabase.');
    const { createClient } = await loadLibrary();
    await destroyRealtime();
    client = createClient(cfg.url.replace(/\/$/, ''), cfg.publishableKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      },
      realtime: { params: { eventsPerSecond: 10 } }
    });

    client.auth.onAuthStateChange((_event, session) => {
      const nextUser = session && session.user ? session.user : null;
      const changed = String(currentUser && currentUser.id || '') !== String(nextUser && nextUser.id || '');
      currentUser = nextUser;
      renderStatus();
      updateDialogStatus();
      if (currentUser && changed) setTimeout(() => startAuthenticatedMode().catch(handleError), 0);
      if (!currentUser) { startedUserId = ''; destroyRealtime(); }
    });

    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    currentUser = data.session && data.session.user ? data.session.user : null;
    renderStatus();
    return client;
  };

  const requireClient = async () => client || createSupabaseClient();

  const requireUser = async () => {
    const sb = await requireClient();
    if (!currentUser) {
      const { data, error } = await sb.auth.getUser();
      if (error) throw error;
      currentUser = data.user || null;
    }
    if (!currentUser) throw new Error('Entre na sua conta do Supabase.');
    return currentUser;
  };

  const upsertDocument = async (documentKey, payload) => {
    const sb = await requireClient();
    const user = await requireUser();
    const cfg = getConfig();
    const { data, error } = await sb
      .from('agenda_documents')
      .upsert({
        user_id: user.id,
        document_key: documentKey,
        payload,
        device_id: cfg.deviceId
      }, { onConflict: 'user_id,document_key' })
      .select('document_key,payload,version,updated_at,device_id')
      .single();
    if (error) throw error;
    return data;
  };

  const fetchDocuments = async () => {
    const sb = await requireClient();
    const user = await requireUser();
    const { data, error } = await sb
      .from('agenda_documents')
      .select('document_key,payload,version,updated_at,device_id')
      .eq('user_id', user.id);
    if (error) throw error;
    return Array.isArray(data) ? data : [];
  };

  const markDirty = documentKey => {
    if (!DOCUMENTS[documentKey] || internalWrite) return;
    const dirty = getDirty();
    dirty[documentKey] = Date.now();
    setDirty(dirty);
    schedulePush();
  };

  const clearDirty = documentKeys => {
    const dirty = getDirty();
    for (const key of documentKeys) delete dirty[key];
    setDirty(dirty);
  };

  const notifyDataChanged = source => {
    const detail = { source: `supabase:${source}` };
    document.dispatchEvent(new CustomEvent('agenda:datachange', { detail }));
    window.dispatchEvent(new CustomEvent('agenda:datachange', { detail }));
  };

  const scheduleReload = (message, fingerprint = '') => {
    const key = fingerprint || message || 'reload';
    try {
      if (sessionStorage.getItem(RELOAD_GUARD_KEY) === key) return;
      sessionStorage.setItem(RELOAD_GUARD_KEY, key);
    } catch (_) {}
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
      showToast(message || 'Dados atualizados pelo Supabase.');
      setTimeout(() => location.reload(), 420);
    }, 180);
  };

  const pushDocuments = async (documentKeys, options = {}) => {
    const keys = [...new Set(documentKeys)].filter(key => DOCUMENTS[key]);
    if (!keys.length) return;
    await requireUser();
    syncing = true;
    renderStatus('Enviando…');
    try {
      for (const key of keys) await upsertDocument(key, readLocal(key));
      clearDirty(keys);
      setConfig({ lastSyncAt: new Date().toISOString() });
      lastError = '';
      if (!options.silent) showToast('Agenda salva no Supabase.');
    } finally {
      syncing = false;
      renderStatus();
    }
  };

  const pushDirty = async () => {
    if (!currentUser || syncing) return;
    const keys = Object.keys(getDirty()).filter(key => DOCUMENTS[key]);
    if (!keys.length) return;
    await pushDocuments(keys, { silent: true });
  };

  const pushAll = async () => pushDocuments(Object.keys(DOCUMENTS));

  const applyRemoteRows = (rows, overwrite = true) => {
    let changed = false;
    for (const row of rows) {
      if (!row || !DOCUMENTS[row.document_key]) continue;
      const key = row.document_key;
      const next = overwrite ? row.payload : mergePayload(key, readLocal(key), row.payload);
      if (writeLocal(key, next)) changed = true;
    }
    if (changed) notifyDataChanged('pull');
    return changed;
  };

  const pullAll = async ({ overwrite = true, reload = true } = {}) => {
    syncing = true;
    renderStatus('Baixando…');
    try {
      const rows = await fetchDocuments();
      const changed = applyRemoteRows(rows, overwrite);
      clearDirty(rows.map(row => row.document_key));
      setConfig({ lastSyncAt: new Date().toISOString() });
      lastError = '';
      if (changed && reload) scheduleReload('Agenda atualizada pelo Supabase.', 'pull:' + rows.map(row => [row.document_key,row.version,row.updated_at].join(':')).sort().join('|'));
      else showToast('Dados conferidos no Supabase.');
      return rows;
    } finally {
      syncing = false;
      renderStatus();
    }
  };

  const initialSync = async () => {
    const user = await requireUser();
    syncing = true;
    renderStatus('Sincronizando…');
    try {
      const cfg = getConfig();
      const firstMigration = cfg.migratedUserId !== user.id;
      const dirty = getDirty();
      const rows = await fetchDocuments();
      const remoteMap = new Map(rows.map(row => [row.document_key, row]));
      const remoteFingerprint = rows.map(row => [row.document_key,row.version,row.updated_at].join(':')).sort().join('|');
      let localChanged = false;
      const pushed = [];

      for (const key of Object.keys(DOCUMENTS)) {
        const local = readLocal(key);
        const remote = remoteMap.get(key);

        if (!remote) {
          await upsertDocument(key, local);
          pushed.push(key);
          continue;
        }

        if (dirty[key]) {
          await upsertDocument(key, local);
          pushed.push(key);
          continue;
        }

        if (firstMigration) {
          const merged = mergePayload(key, local, remote.payload);
          if (writeLocal(key, merged)) localChanged = true;
          if (!sameJson(merged, remote.payload)) {
            await upsertDocument(key, merged);
            pushed.push(key);
          }
          continue;
        }

        if (writeLocal(key, remote.payload)) localChanged = true;
      }

      clearDirty(pushed.length ? pushed : Object.keys(DOCUMENTS));
      setConfig({ migratedUserId: user.id, lastSyncAt: new Date().toISOString() });
      lastError = '';
      if (localChanged) {
        notifyDataChanged('initial-pull');
        scheduleReload('Agenda sincronizada com o Supabase.', 'initial:' + remoteFingerprint);
      }
    } finally {
      syncing = false;
      renderStatus();
    }
  };

  const subscribeRealtime = async () => {
    const sb = await requireClient();
    const user = await requireUser();
    const cfg = getConfig();
    await destroyRealtime();

    realtimeChannel = sb
      .channel(`agenda-documents-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'agenda_documents',
        filter: `user_id=eq.${user.id}`
      }, payload => {
        const row = payload.new && payload.new.document_key ? payload.new : payload.old;
        if (!row || !DOCUMENTS[row.document_key]) return;
        if (payload.eventType !== 'DELETE' && row.device_id === cfg.deviceId) return;
        if (getDirty()[row.document_key]) return;

        const nextPayload = payload.eventType === 'DELETE'
          ? clone(DOCUMENTS[row.document_key].fallback)
          : row.payload;
        if (writeLocal(row.document_key, nextPayload)) {
          notifyDataChanged('realtime');
          scheduleReload('Alteração recebida em tempo real.', 'realtime:' + [row.document_key,row.version,row.updated_at].join(':'));
        }
      })
      .subscribe(status => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          lastError = 'Falha na conexão em tempo real.';
          renderStatus();
        }
      });
  };

  const startAuthenticatedMode = async () => {
    if (!currentUser || startedUserId === currentUser.id) return;
    startedUserId = currentUser.id;
    try {
      await initialSync();
      await subscribeRealtime();
      updateDialogStatus();
    } catch (error) {
      startedUserId = '';
      throw error;
    }
  };

  const schedulePush = () => {
    const cfg = getConfig();
    if (!cfg.enabled || !currentUser || syncing) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => pushDirty().catch(handleError), 1700);
  };

  const handleError = error => {
    lastError = String(error && (error.message || error.error_description) || error || 'Erro desconhecido');
    syncing = false;
    renderStatus();
    updateDialogStatus(lastError, true);
    showToast(`Supabase: ${lastError}`);
  };

  const patchStorage = () => {
    if (Storage.prototype.setItem.__agendaSupabasePatched) return;

    function patchedSetItem(key, value) {
      const result = originalSetItem.call(this, key, value);
      if (this === localStorage && !internalWrite) {
        const documentKey = LOCAL_TO_DOCUMENT.get(String(key));
        if (documentKey) markDirty(documentKey);
      }
      return result;
    }

    function patchedRemoveItem(key) {
      const result = originalRemoveItem.call(this, key);
      if (this === localStorage && !internalWrite) {
        const documentKey = LOCAL_TO_DOCUMENT.get(String(key));
        if (documentKey) markDirty(documentKey);
      }
      return result;
    }

    patchedSetItem.__agendaSupabasePatched = true;
    Storage.prototype.setItem = patchedSetItem;
    Storage.prototype.removeItem = patchedRemoveItem;
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
    clearTimeout(toast.__agendaTimer);
    toast.__agendaTimer = setTimeout(() => toast.classList.remove('show'), 3000);
  };

  const ensureStyles = () => {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      #${BUTTON_ID}{position:relative}
      #${BUTTON_ID} svg{width:22px;height:22px}
      #${STATUS_DOT_ID}{position:absolute;right:2px;bottom:2px;width:10px;height:10px;border:2px solid var(--surface);border-radius:50%;background:var(--faint)}
      #${STATUS_DOT_ID}.online{background:#78d88b}
      #${STATUS_DOT_ID}.syncing{background:#ffb74d}
      #${STATUS_DOT_ID}.error{background:var(--danger)}
      #${DIALOG_ID} input[type="email"],#${DIALOG_ID} input[type="password"],#${DIALOG_ID} input[type="url"]{width:100%;min-height:46px;padding:11px 12px;border:1px solid var(--line);border-radius:13px;outline:0;background:var(--soft);color:var(--text);font-size:16px}
      #${DIALOG_ID} .supabase-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}
      #${DIALOG_ID} .supabase-grid .wide{grid-column:1/-1;margin:0}
      #${DIALOG_ID} .supabase-status{margin-top:13px;padding:12px;border:1px solid var(--line);border-radius:14px;background:var(--soft);font-size:12px;line-height:1.45;color:var(--muted)}
      #${DIALOG_ID} .supabase-status.error{border-color:color-mix(in srgb,var(--danger) 50%,var(--line));color:var(--danger)}
      #${DIALOG_ID} .supabase-help{margin-top:10px;color:var(--muted);font-size:11px;line-height:1.45}
    `;
    document.head.appendChild(style);
  };

  const updateDialogStatus = (message = '', error = false) => {
    const status = document.getElementById('supabaseStatusText');
    if (!status) return;
    const cfg = getConfig();
    const text = message || (currentUser
      ? `Conectado como ${currentUser.email || currentUser.id}.`
      : validConfig(cfg)
        ? 'Projeto configurado. Entre na sua conta.'
        : 'Informe os dados do projeto Supabase.');
    status.textContent = text;
    status.classList.toggle('error', error || Boolean(lastError && !currentUser));
  };

  const ensureDialog = () => {
    let dialog = document.getElementById(DIALOG_ID);
    if (dialog) return dialog;

    dialog = document.createElement('dialog');
    dialog.id = DIALOG_ID;
    dialog.innerHTML = `<section class="modal">
      <h3>Supabase</h3>
      <p>Backend da Agenda Lagares com login, banco PostgreSQL e sincronização em tempo real.</p>

      <label class="field-label" for="supabaseUrl">Project URL</label>
      <input id="supabaseUrl" type="url" inputmode="url" autocomplete="off" placeholder="https://seu-projeto.supabase.co">

      <label class="field-label" for="supabaseKey">Chave pública (anon/publishable)</label>
      <input id="supabaseKey" type="password" autocomplete="off" placeholder="sb_publishable_... ou anon key">

      <label class="field-label" for="supabaseEmail">E-mail</label>
      <input id="supabaseEmail" type="email" autocomplete="username" placeholder="voce@exemplo.com">

      <label class="field-label" for="supabasePassword">Senha</label>
      <input id="supabasePassword" type="password" autocomplete="current-password" minlength="6" placeholder="Senha da conta Supabase">

      <div id="supabaseStatusText" class="supabase-status">Não configurado.</div>

      <div class="supabase-grid">
        <button class="secondary" id="supabaseSave" type="button">Salvar projeto</button>
        <button class="primary" id="supabaseSignIn" type="button">Entrar</button>
        <button class="secondary" id="supabaseSignUp" type="button">Criar conta</button>
        <button class="secondary" id="supabaseSignOut" type="button">Sair</button>
        <button class="secondary" id="supabasePull" type="button">Baixar nuvem</button>
        <button class="secondary" id="supabasePush" type="button">Enviar aparelho</button>
        <button class="primary wide" id="supabaseSync" type="button">Sincronizar agora</button>
      </div>

      <p class="supabase-help">A chave pública pode ser usada no navegador. Nunca informe ou salve a <strong>service_role</strong>. As tabelas precisam estar protegidas pelas políticas RLS do arquivo SQL incluído no projeto.</p>
      <div class="actions"><button class="secondary" id="supabaseClose" type="button">Fechar</button></div>
    </section>`;
    document.body.appendChild(dialog);

    dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
    dialog.querySelector('#supabaseClose').addEventListener('click', () => dialog.close());

    const readFormConfig = () => ({
      url: dialog.querySelector('#supabaseUrl').value.trim(),
      publishableKey: dialog.querySelector('#supabaseKey').value.trim(),
      email: dialog.querySelector('#supabaseEmail').value.trim(),
      enabled: true
    });

    const saveProject = async () => {
      setConfig(readFormConfig());
      client = null;
      currentUser = null;
      startedUserId = '';
      await createSupabaseClient();
      updateDialogStatus('Projeto salvo. Entre na sua conta.');
    };

    dialog.querySelector('#supabaseSave').addEventListener('click', () => saveProject().catch(handleError));
    dialog.querySelector('#supabaseSignIn').addEventListener('click', async () => {
      try {
        await saveProject();
        const email = dialog.querySelector('#supabaseEmail').value.trim();
        const password = dialog.querySelector('#supabasePassword').value;
        if (!email || !password) throw new Error('Informe e-mail e senha.');
        const { data, error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
        currentUser = data.user;
        setConfig({ email });
        updateDialogStatus();
        await startAuthenticatedMode();
      } catch (error) { handleError(error); }
    });

    dialog.querySelector('#supabaseSignUp').addEventListener('click', async () => {
      try {
        await saveProject();
        const email = dialog.querySelector('#supabaseEmail').value.trim();
        const password = dialog.querySelector('#supabasePassword').value;
        if (!email || !password) throw new Error('Informe e-mail e senha.');
        const { data, error } = await client.auth.signUp({ email, password });
        if (error) throw error;
        setConfig({ email });
        if (data.session) {
          currentUser = data.user;
          await startAuthenticatedMode();
          updateDialogStatus('Conta criada e conectada.');
        } else {
          updateDialogStatus('Conta criada. Confirme o e-mail para entrar.');
        }
      } catch (error) { handleError(error); }
    });

    dialog.querySelector('#supabaseSignOut').addEventListener('click', async () => {
      try {
        if (client) await client.auth.signOut();
        currentUser = null;
        startedUserId = '';
        await destroyRealtime();
        updateDialogStatus('Sessão encerrada.');
        renderStatus();
      } catch (error) { handleError(error); }
    });

    dialog.querySelector('#supabasePull').addEventListener('click', () => pullAll({ overwrite: true, reload: true }).catch(handleError));
    dialog.querySelector('#supabasePush').addEventListener('click', () => pushAll().catch(handleError));
    dialog.querySelector('#supabaseSync').addEventListener('click', async () => {
      try {
        await pushDirty();
        await pullAll({ overwrite: true, reload: true });
      } catch (error) { handleError(error); }
    });

    return dialog;
  };

  const openDialog = () => {
    ensureStyles();
    const dialog = ensureDialog();
    const cfg = getConfig();
    dialog.querySelector('#supabaseUrl').value = cfg.url;
    dialog.querySelector('#supabaseKey').value = cfg.publishableKey;
    dialog.querySelector('#supabaseEmail').value = currentUser && currentUser.email || cfg.email;
    dialog.querySelector('#supabasePassword').value = '';
    updateDialogStatus(lastError, Boolean(lastError));
    if (!dialog.open) dialog.showModal();
  };

  const ensureButton = () => {
    ensureStyles();
    const actions = document.querySelector('.head-actions');
    if (!actions || document.getElementById(BUTTON_ID)) return;
    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.className = 'icon-btn';
    button.type = 'button';
    button.title = 'Supabase';
    button.setAttribute('aria-label', 'Configurar backend Supabase');
    button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 2 5 13h7l-1.5 9L19 11h-7z"/></svg><span id="${STATUS_DOT_ID}"></span>`;
    button.addEventListener('click', openDialog);
    actions.insertBefore(button, actions.firstChild);
    renderStatus();
  };

  const renderStatus = (message = '') => {
    const dot = document.getElementById(STATUS_DOT_ID);
    if (!dot) return;
    const cfg = getConfig();
    dot.className = syncing ? 'syncing' : lastError ? 'error' : currentUser ? 'online' : '';
    dot.title = message || lastError || (currentUser
      ? `Supabase conectado: ${currentUser.email || currentUser.id}`
      : validConfig(cfg) ? 'Supabase configurado — entre na conta' : 'Supabase não configurado');
  };

  const boot = async () => {
    patchStorage();
    ensureButton();

    let animationFrame = 0;
    new MutationObserver(() => {
      cancelAnimationFrame(animationFrame);
      animationFrame = requestAnimationFrame(ensureButton);
    }).observe(document.body, { childList: true, subtree: true });

    const cfg = getConfig();
    if (!cfg.enabled || !validConfig(cfg)) return;

    try {
      await createSupabaseClient();
      if (currentUser) await startAuthenticatedMode();
    } catch (error) {
      handleError(error);
    }
  };

  window.SupabaseAgenda = {
    getConfig,
    openDialog,
    pushAll,
    pullAll,
    pushDirty,
    getUser: () => currentUser
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
