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

  // Nunca deixa um dispositivo que já sincronizou antes sobrescrever a agenda
  // compartilhada com um estado vazio. Isso acontece, por exemplo, quando o
  // iOS limpa o localStorage de um app pouco usado, ou quando a troca de
  // sessão dispara o reset local de workspace (prepareBlankWorkspace, em
  // index.html) — sem essa trava, o próximo push automático apagaria as
  // tarefas de todo mundo que compartilha a mesma agenda.
  function isEmptyPayload(payload) {
    if (Array.isArray(payload)) return payload.length === 0;
    if (payload && typeof payload === 'object') return Object.keys(payload).length === 0;
    return true;
  }
  function isSuspiciouslyEmpty(key, payload) {
    if (!cfg().lastSyncAt) return false; // dispositivo novo, nunca sincronizou: vazio é esperado
    return isEmptyPayload(payload);
  }

  // Documentos que devem ser MESCLADOS com o servidor antes de enviar, em vez
  // de sobrescritos. Sem isso, um aparelho com a cópia antiga apagava do
  // servidor as tarefas que outra pessoa (ou um lançamento no servidor) tinha
  // adicionado — porque o envio era um overwrite total do array local.
  // Só tasks e notes: rules não entra (senão uma regra recorrente apagada de
  // propósito ressuscitaria a cada envio).
  const MERGE_KEYS = new Set(['tasks', 'notes']);
  async function serverPayload(sb, key) {
    const { data, error } = await sb.from('agenda_documents')
      .select('payload').eq('user_id', ownerId()).eq('document_key', key).maybeSingle();
    if (error) throw error;
    return data ? data.payload : undefined;
  }
  function trashIdSet() {
    const t = read('trash');
    return new Set((Array.isArray(t) ? t : []).map(x => String(x && x.id)));
  }
  function mergeTasks(localArr, serverArr) {
    const drop = trashIdSet();
    const byId = new Map();
    (Array.isArray(serverArr) ? serverArr : []).forEach(it => { if (it && it.id != null && !drop.has(String(it.id))) byId.set(String(it.id), it); });
    (Array.isArray(localArr) ? localArr : []).forEach(it => { if (it && it.id != null) byId.set(String(it.id), it); }); // edições locais vencem
    return Array.from(byId.values());
  }
  async function reconcileForPush(sb, key, localPayload) {
    try {
      const server = await serverPayload(sb, key);
      if (server == null) return localPayload;
      if (key === 'tasks' && Array.isArray(localPayload)) return mergeTasks(localPayload, server);
      if (key === 'notes' && server && typeof server === 'object' && !Array.isArray(server) && localPayload && typeof localPayload === 'object' && !Array.isArray(localPayload)) return { ...server, ...localPayload };
    } catch (_) { /* em caso de falha, envia o local mesmo (comportamento antigo) */ }
    return localPayload;
  }

  async function pushDocs(keys = Object.keys(DOCUMENTS), silent = false) {
    const sb = await requireAccess();
    syncing = true; render('Enviando…');
    const pushed = [];
    let recovered = false;
    try {
      for (const key of keys) {
        let payload = read(key);
        if (isSuspiciouslyEmpty(key, payload)) { recovered = true; continue; }
        if (MERGE_KEYS.has(key)) {
          const merged = await reconcileForPush(sb, key, payload);
          if (JSON.stringify(merged) !== JSON.stringify(payload)) { write(key, merged); notifySync(key); }
          payload = merged;
        }
        const { error } = await sb.from('agenda_documents').upsert({
          user_id: ownerId(), document_key: key, payload, device_id: deviceId()
        }, { onConflict: 'user_id,document_key' });
        if (error) throw error;
        pushed.push(key);
      }
      const d = dirty(); pushed.forEach(k => delete d[k]); saveDirty(d);
      if (pushed.length) saveCfg({ lastSyncAt: new Date().toISOString() });
      if (!silent && pushed.length) toast('Agenda enviada ao Supabase.');
      if (recovered) { toast('Dados locais vazios detectados — restaurando da nuvem em vez de apagar.'); pullAll().catch(() => {}); }
      lastError = '';
    } finally { syncing = false; render(); }
  }

  async function pullAll() {
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
      return data || [];
    } finally { syncing = false; render(); }
  }

  async function syncNow() {
    const keys = Object.keys(dirty()).filter(k => DOCUMENTS[k]);
    if (keys.length) await pushDocs(keys, true);
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

  // Rede/realtime do iOS cai silenciosamente quando o app fica em segundo
  // plano. Sem isso, o dispositivo podia ficar horas com dados desatualizados
  // e, ao voltar, um push automático (markDirty) sobrescrevia o servidor com
  // esse estado velho. Isso reconecta e busca o que houver de novo sempre que
  // o app volta ao primeiro plano, além de um pull periódico de segurança.
  function resyncIfLinked() {
    if (syncing || !session?.user || !ownerId()) return;
    pullAll().catch(() => {});
    subscribe().catch(() => {});
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
    document.addEventListener('visibilitychange', () => { if (!document.hidden) resyncIfLinked(); });
    window.addEventListener('online', resyncIfLinked);
    setInterval(() => { if (!Object.keys(dirty()).length) resyncIfLinked(); }, 60000);
  }

  window.SupabaseAgenda = { getConfig: cfg, openDialog, pushAll: () => pushDocs(), pullAll, pushDirty: syncNow, syncNow, getUser: () => session?.user || null };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();