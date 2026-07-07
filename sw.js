const CACHE = 'agenda-lagares-v74';
const EDIT_SCRIPT = '<script src="./edit-enhancement.js?v=2"><\/script>';
const TREINO_SCRIPT = '<script src="./treino.js?v=3"><\/script>';
const PAINEL_SCRIPT = '<script src="./painel.js?v=2"><\/script>';
const NOTAS_SCRIPT = '<script src="./notas.js?v=2"><\/script>';
const SYNC_SCRIPT = '<script src="./sync.js?v=9"><\/script>';
const UNDO_SCRIPT = '<script src="./undo.js?v=1"><\/script>';
const LIXEIRA_SCRIPT = '<script src="./lixeira.js?v=1"><\/script>';

self.addEventListener('install', () => {
  self.skipWaiting();
});

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
    if (!html.includes('edit-enhancement.js')) html = html.replace('</body>', `${EDIT_SCRIPT}</body>`);
    if (!html.includes('treino.js')) html = html.replace('</body>', `${TREINO_SCRIPT}</body>`);
    if (!html.includes('painel.js')) html = html.replace('</body>', `${PAINEL_SCRIPT}</body>`);
    if (!html.includes('notas.js')) html = html.replace('</body>', `${NOTAS_SCRIPT}</body>`);
    if (!html.includes('sync.js')) html = html.replace('</body>', `${SYNC_SCRIPT}</body>`);
    if (!html.includes('undo.js')) html = html.replace('</body>', `${UNDO_SCRIPT}</body>`);
    if (!html.includes('lixeira.js')) html = html.replace('</body>', `${LIXEIRA_SCRIPT}</body>`);

    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.delete('content-encoding');
    headers.set('cache-control', 'no-store');
    return new Response(html, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  })());
});

self.addEventListener('push', event => {
  let data = { title: 'Lembrete da agenda', body: 'Você tem uma tarefa agendada.' };
  try {
    data = { ...data, ...(event.data ? event.data.json() : {}) };
  } catch (_) {
    if (event.data) data.body = event.data.text();
  }

  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    tag: data.tag || 'agenda-alerta',
    renotify: true,
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

// redeploy trigger v61-sat
