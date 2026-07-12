const CACHE = 'agenda-lagares-v151-coracao-contorno';
const EDIT_SCRIPT = '<script src="./edit-enhancement.js?v=3"><\/script>';
const TREINO_SCRIPT = '<script src="./treino.js?v=8"><\/script>';
const PAINEL_SCRIPT = '<script src="./painel.js?v=2"><\/script>';
const FINANCEIRO_SCRIPT = '<script src="./financeiro.js?v=2"><\/script>';
const NOTAS_SCRIPT = '<script src="./notas.js?v=5"><\/script>';
const CONDICIONAL_SCRIPT = '<script src="./condicional.js?v=3"><\/script>';
const SUPABASE_CONFIG_SCRIPT = '<script src="./supabase-project-config.js?v=1"><\/script>';
const SUPABASE_SCRIPT = '<script src="./supabase-storage.js?v=3"><\/script>';
const SUPABASE_LOGIN_SCRIPT = '<script src="./supabase-login-ui.js?v=3"><\/script>';
const SIMPLE_ACCESS_SCRIPT = '<script src="./supabase-simple-access.js?v=1"><\/script>';
const VIEWMODE_SCRIPT = '<script src="./viewmode.js?v=1"><\/script>';
const HEADER_CLEANUP_SCRIPT = '<script src="./header-cleanup.js?v=2"><\/script>';
const UNDO_SCRIPT = '<script src="./undo.js?v=1"><\/script>';
const LIXEIRA_SCRIPT = '<script src="./lixeira.js?v=1"><\/script>';
const INTEL_SCRIPT = '<script src="./agenda-intelligence.js?v=2"><\/script>';
const LIST_STATUS_SCRIPT = '<script src="./agenda-list-status.js?v=2"><\/script>';
const EXPORT_SCRIPT = '<script src="./export-localstorage.js?v=2"><\/script>';
const REALTIME_SCRIPT = '<script src="./realtime-refresh.js?v=1"><\/script>';
const POLISH_STYLE = '<link rel="stylesheet" href="./interface-polish.css?v=4">';
const POLISH_SCRIPT = '<script src="./interface-polish.js?v=1" defer><\/script>';

self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name !== CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate') return;
  event.respondWith((async () => {
    const response = await fetch(event.request, { cache: 'no-store' });
    const contentType = response.headers.get('content-type') || '';
    if (!response.ok || !contentType.includes('text/html')) return response;
    let html = await response.text();
    const isFinance = html.includes('financeiro.html');
    if (!isFinance && !html.includes('interface-polish.css')) html = html.replace('</head>', `${POLISH_STYLE}</head>`);
    if (!isFinance && !html.includes('edit-enhancement.js')) html = html.replace('</body>', `${EDIT_SCRIPT}</body>`);
    if (!isFinance && !html.includes('treino.js')) html = html.replace('</body>', `${TREINO_SCRIPT}</body>`);
    if (!isFinance && !html.includes('painel.js')) html = html.replace('</body>', `${PAINEL_SCRIPT}</body>`);
    if (!isFinance && !html.includes('financeiro.js')) html = html.replace('</body>', `${FINANCEIRO_SCRIPT}</body>`);
    if (!isFinance && !html.includes('notas.js')) html = html.replace('</body>', `${NOTAS_SCRIPT}</body>`);
    if (!isFinance && !html.includes('condicional.js')) html = html.replace('</body>', `${CONDICIONAL_SCRIPT}</body>`);
    if (!isFinance && !html.includes('supabase-project-config.js')) html = html.replace('</body>', `${SUPABASE_CONFIG_SCRIPT}</body>`);
    if (!isFinance && !html.includes('supabase-storage.js')) html = html.replace('</body>', `${SUPABASE_SCRIPT}</body>`);
    if (!isFinance && !html.includes('supabase-login-ui.js')) html = html.replace('</body>', `${SUPABASE_LOGIN_SCRIPT}</body>`);
    if (!isFinance && !html.includes('supabase-simple-access.js')) html = html.replace('</body>', `${SIMPLE_ACCESS_SCRIPT}</body>`);
    if (!isFinance && !html.includes('viewmode.js')) html = html.replace('</body>', `${VIEWMODE_SCRIPT}</body>`);
    if (!isFinance && !html.includes('header-cleanup.js')) html = html.replace('</body>', `${HEADER_CLEANUP_SCRIPT}</body>`);
    if (!isFinance && !html.includes('undo.js')) html = html.replace('</body>', `${UNDO_SCRIPT}</body>`);
    if (!isFinance && !html.includes('lixeira.js')) html = html.replace('</body>', `${LIXEIRA_SCRIPT}</body>`);
    if (!isFinance && !html.includes('agenda-intelligence.js')) html = html.replace('</body>', `${INTEL_SCRIPT}</body>`);
    if (!isFinance && !html.includes('agenda-list-status.js')) html = html.replace('</body>', `${LIST_STATUS_SCRIPT}</body>`);
    if (!isFinance && !html.includes('export-localstorage.js')) html = html.replace('</body>', `${EXPORT_SCRIPT}</body>`);
    if (!isFinance && !html.includes('realtime-refresh.js')) html = html.replace('</body>', `${REALTIME_SCRIPT}</body>`);
    if (!isFinance && !html.includes('interface-polish.js')) html = html.replace('</body>', `${POLISH_SCRIPT}</body>`);
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.delete('content-encoding');
    headers.set('cache-control', 'no-store');
    return new Response(html, { status: response.status, statusText: response.statusText, headers });
  })());
});

self.addEventListener('push', event => {
  let data = { title: 'Lembrete da agenda', body: 'Você tem uma tarefa agendada.' };
  try { data = { ...data, ...(event.data ? event.data.json() : {}) }; }
  catch (_) { if (event.data) data.body = event.data.text(); }
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body, tag: data.tag || 'agenda-alerta', renotify: true,
    data: { url: data.url || './?alert=1' }
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || './', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const current = windows.find(client => client.url.startsWith(self.location.origin));
    if (current) return current.focus();
    return self.clients.openWindow(target);
  })());
});

// redeploy trigger v151-coracao-cardio-sem-vermelho
