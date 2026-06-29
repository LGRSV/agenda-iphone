const CACHE = 'agenda-lagares-v13';
const APP_SHELL = ['./', './manifest.webmanifest', './apple-enhance.js', './apple-bridge.js'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

async function enhancedPage(request) {
  const response = await fetch(request);
  const contentType = response.headers.get('content-type') || '';
  if (!response.ok || !contentType.includes('text/html')) return response;
  const html = await response.text();
  if (html.includes('apple-enhance.js')) return response;
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  headers.delete('content-encoding');
  const injection = '<script src="./apple-enhance.js?v=13"></script><script src="./apple-bridge.js?v=13"></script>';
  return new Response(html.replace('</body>', `${injection}</body>`), {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  if (event.request.mode === 'navigate') {
    event.respondWith(enhancedPage(event.request).catch(() => caches.match(event.request).then(response => response || caches.match('./'))));
    return;
  }
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

self.addEventListener('push', event => {
  let data = { title: 'Agenda Lagares', body: 'Você tem um compromisso próximo.' };
  try { data = { ...data, ...(event.data ? event.data.json() : {}) }; } catch {}
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    tag: data.tag || 'agenda-reminder',
    renotify: true,
    data: data.data || {}
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
    const existing = list.find(client => client.url.includes('agenda-iphone'));
    return existing ? existing.focus() : clients.openWindow('./?app=1');
  }));
});