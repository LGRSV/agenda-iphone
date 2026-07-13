/* Sincronização compartilhada da Agenda Lagares — usuário + e-mail, sem senha. */
(() => {
  'use strict';

  const MODULE_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
  const CONFIG_KEY = 'agenda_supabase_config_v1';
  const DIRTY_KEY = 'agenda_shared_dirty_v1';
  const BUTTON_ID = 'supabaseStorageBtn';
  const DIALOG_ID = 'supabaseStorageDialog';
  const DOT_ID = 'supabaseStorageDot';
  const DOCUMENTS = {
    tasks: ['agenda_lagares_v3', []],
    notes: ['agenda_notas_v1', {}],
    rules: ['agenda_lagares_rules_v1', []],
    training_logs: ['agenda_treino_logs_v1', {}],
    training_meta: ['agenda_treino_meta_v1', {}],
    settings: ['agenda_lagares_config_v1', {}],
    trash: ['agenda_lixeira_v1', []],
    history: ['agenda_historico_v1', []],
    investments: ['agenda_investimentos_v1', {}],
    accounts: ['agenda_contas_v1', {}]
  };
  const LOCAL_TO_DOC = new Map(Object.entries(DOCUMENTS).map(([doc, [key]]) => [key, doc]));
  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;
  let client = null;
  let session = null;
  let syncing = false;
  let internalWrite = false;
  let timer = 0;
  let realtime = null;
  let lastError = '';

  const json = (value, fallback) => { try { const v = JSON.parse(value); return v == null ? fallback : v; } catch (_) { return fallback; } };
  const cfg = () => json(localStorage.getItem(CONFIG_KEY) || '{}', {});
  const saveCfg = patch => originalSetItem.call(localStorage, CONFIG_KEY, JSON.stringify({ ...cfg(), ...patch }));
  const ownerId = () => String(cfg().workspaceOwnerId || session?.user?.id || '');
  const deviceId = () => {
    const existing = String(cfg().deviceId || '').trim();
    if (existing) return existing;
    const generated = (globalThis.crypto?.randomUUID?.() || `agenda-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    saveCfg({ deviceId: generated });
    return generated;
  };
  const notifySync = documentKey => {
    try { window.dispatchEvent(new CustomEvent('agenda:remote-sync', { detail: { documentKey } })); } catch (_) {}
  };
  const read = doc => json(localStorage.getItem(DOCUMENTS[doc][0]), structuredClone(DOCUMENTS[doc][1]));
  const write = (doc, payload) => {
    internalWrite = true;
    try { originalSetItem.call(localStorage, DOCUMENTS[doc][0], JSON.stringify(payload ?? structuredClone(DOCUMENTS[doc][1]))); }
    finally { internalWrite = false; }
  };
  const dirty = () => json(localStorage.getItem(DIRTY_KEY) || '{}', {});
  const saveDirty = value => originalSetItem.call(localStorage, DIRTY_KEY, JSON.stringify(value));

  async function getClient() {
    if (client) return client;
    const c = cfg();
    if (!c.url || !c.publishableKey) throw new Error('Backend da Agenda não configurado.');
    const { createClient } = await import(MODULE_URL);
    client = createClient(c.url, c.publishableKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    const result = await client.auth.getSession();
    if (result.error) throw result.error;
    session = result.data.session;
    client.auth.onAuthStateChange((_event, next) => { session = next; render(); });
    return client;
  }

  async function requireAccess() {
    const sb = await getClient();
    if (!session?.user) throw new Error('Entre com usuário e e-mail antes de sincronizar.');
    if (!ownerId()) throw new Error('Este aparelho ainda não foi vinculado à sua agenda.');
    return sb;
  }

  async function pushDocs(keys = Object.keys(DOCUMENTS), silent = false) {
    const sb = await requireAccess();
    syncing = true; render('Enviando…');
    try {
      for (const key of keys) {
        const { error } = await sb.from('agenda_documents').upsert({
          user_id: ownerId(), document_key: key, payload: read(key), device_id: deviceId()
        }, { onConflict: 'user_id,document_key' });
        if (error) throw error;
      }
      const d = dirty(); keys.forEach(k => delete d[k]); saveDirty(d);
      saveCfg({ lastSyncAt: new Date().toISOString() });
      if (!silent) toast('Agenda enviada ao Supabase.');
      lastError = '';
    } finally { syncing = false; render(); }
  }

  async function pullAll({ reload = true } = {}) {
    const sb = await requireAccess();
    syncing = true; render('Baixando…');
    try {
      const { data, error } = await sb.from('agenda_documents').select('document_key,payload,version,updated_at').eq('user_id', ownerId());
      if (error) throw error;
      let changed = false;
      for (const row of data || []) {
        if (!DOCUMENTS[row.document_key]) continue;
        const before = JSON.stringify(read(row.document_key));
        const after = JSON.stringify(row.payload ?? DOCUMENTS[row.document_key][1]);
        if (before !== after) { write(row.document_key, row.payload); changed = true; }
      }
      saveDirty({}); saveCfg({ lastSyncAt: new Date().toISOString() }); lastError = '';
      if (changed) notifySync('all');
      if (!changed) toast('Agenda conferida no Supabase.');
      return data || [];
    } finally { syncing = false; render(); }
  }

  async function syncNow() {
    const keys = Object.keys(dirty()).filter(k => DOCUMENTS[k]);
    if (keys.length) await pushDocs(keys, true);
    await pullAll({ reload: true });
  }

  function markDirty(doc) {
    const d = dirty(); d[doc] = Date.now(); saveDirty(d);
    clearTimeout(timer);
    timer = setTimeout(() => pushDocs([doc], true).catch(handle), 1400);
  }

  function patchStorage() {
    if (Storage.prototype.setItem.__agendaSharedPatched) return;
    function setItem(key, value) {
      const result = originalSetItem.call(this, key, value);
      if (this === localStorage && !internalWrite && LOCAL_TO_DOC.has(String(key))) markDirty(LOCAL_TO_DOC.get(String(key)));
      return result;
    }
    function removeItem(key) {
      const result = originalRemoveItem.call(this, key);
      if (this === localStorage && !internalWrite && LOCAL_TO_DOC.has(String(key))) markDirty(LOCAL_TO_DOC.get(String(key)));
      return result;
    }
    setItem.__agendaSharedPatched = true;
    Storage.prototype.setItem = setItem;
    Storage.prototype.removeItem = removeItem;
  }

  async function subscribe() {
    const sb = await requireAccess();
    if (realtime) await sb.removeChannel(realtime);
    realtime = sb.channel(`agenda-shared-${ownerId()}`).on('postgres_changes', {
      event: '*', schema: 'public', table: 'agenda_documents', filter: `user_id=eq.${ownerId()}`
    }, payload => {
      const row = payload.new?.document_key ? payload.new : payload.old;
      if (!row || !DOCUMENTS[row.document_key] || dirty()[row.document_key]) return;
      if (String(row.device_id || '') === deviceId()) return;
      write(row.document_key, payload.eventType === 'DELETE' ? DOCUMENTS[row.document_key][1] : row.payload);
      notifySync(row.document_key);
    }).subscribe();
  }

  function toast(message) {
    let el = document.querySelector('.toast');
    if (!el) { el = document.createElement('div'); el.className = 'toast'; document.body.appendChild(el); }
    el.textContent = message; el.classList.add('show');
    clearTimeout(el.__t); el.__t = setTimeout(() => el.classList.remove('show'), 2800);
  }

  function handle(error) { lastError = String(error?.message || error || 'Erro de sincronização'); syncing = false; render(); toast(`Supabase: ${lastError}`); }

  function ensureUI() {
    const actions = document.querySelector('.head-actions');
    if (!actions || document.getElementById(BUTTON_ID)) return;
    const button = document.createElement('button');
    button.id = BUTTON_ID; button.className = 'icon-btn'; button.type = 'button'; button.title = 'Sincronização';
    button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13.5 2 5 13h7l-1.5 9L19 11h-7z"/></svg><span id="supabaseStorageDot"></span>';
    button.addEventListener('click', openDialog); actions.insertBefore(button, actions.firstChild); render();
  }

  function openDialog() {
    let dialog = document.getElementById(DIALOG_ID);
    if (!dialog) {
      dialog = document.createElement('dialog'); dialog.id = DIALOG_ID;
      dialog.innerHTML = `<section class="modal"><h3>Sincronização</h3><p id="sharedSyncStatus"></p><div class="supabase-grid"><button class="primary wide" id="sharedSyncNow" type="button">Sincronizar agora</button><button class="secondary wide" id="sharedAccess" type="button">Vincular usuário e e-mail</button></div><div class="actions"><button class="secondary" id="sharedClose" type="button">Fechar</button></div></section>`;
      document.body.appendChild(dialog);
      dialog.querySelector('#sharedClose').onclick = () => dialog.close();
      dialog.querySelector('#sharedSyncNow').onclick = () => syncNow().catch(handle);
      dialog.querySelector('#sharedAccess').onclick = () => { dialog.close(); document.getElementById('agendaLoginOverlay')?.classList.add('open'); };
    }
    const c = cfg();
    dialog.querySelector('#sharedSyncStatus').textContent = session?.user && c.workspaceOwnerId
      ? `Conectado à agenda de ${c.username || 'usuário'}. Última sincronização: ${c.lastSyncAt ? new Date(c.lastSyncAt).toLocaleString('pt-BR') : 'ainda não realizada'}.`
      : 'Este aparelho ainda precisa ser vinculado usando usuário e e-mail.';
    if (!dialog.open) dialog.showModal();
  }

  function render(message = '') {
    const dot = document.getElementById(DOT_ID);
    if (!dot) return;
    dot.className = syncing ? 'syncing' : lastError ? 'error' : session?.user && cfg().workspaceOwnerId ? 'online' : '';
    dot.title = message || lastError || (session?.user && cfg().workspaceOwnerId ? 'Agenda sincronizada' : 'Vincule este aparelho');
  }

  async function boot() {
    patchStorage(); ensureUI();
    new MutationObserver(ensureUI).observe(document.body, { childList: true, subtree: true });
    try {
      await getClient();
      if (session?.user && cfg().workspaceOwnerId) {
        await pullAll({ reload: false });
        await subscribe();
      }
    } catch (error) { handle(error); }
  }

  window.SupabaseAgenda = { getConfig: cfg, openDialog, pushAll: () => pushDocs(), pullAll, pushDirty: syncNow, syncNow, getUser: () => session?.user || null };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();