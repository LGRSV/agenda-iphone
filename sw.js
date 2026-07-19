const CACHE = 'agenda-lagares-v203-importar-extrato';
const EDIT_SCRIPT = '<script src="./edit-enhancement.js?v=4" defer><\/script>';
const TREINO_SCRIPT = '<script src="./treino.js?v=12" defer><\/script>';
const PAINEL_SCRIPT = '<script src="./painel.js?v=2" defer><\/script>';
const GAME_SCRIPT = '<script src="./gamificacao.js?v=4" defer><\/script>';
const FINANCEIRO_SCRIPT = '<script src="./financeiro.js?v=2" defer><\/script>';
const NOTAS_SCRIPT = '<script src="./notas.js?v=8" defer><\/script>';
const CONDICIONAL_SCRIPT = '<script src="./condicional.js?v=3" defer><\/script>';
const SUPABASE_CONFIG_SCRIPT = '<script src="./supabase-project-config.js?v=1" defer><\/script>';
const SUPABASE_SCRIPT = '<script src="./supabase-shared-storage.js?v=5" defer><\/script>';
const SUPABASE_LOGIN_SCRIPT = '<script src="./supabase-login-ui.js?v=4" defer><\/script>';
const SIMPLE_ACCESS_SCRIPT = '<script src="./supabase-simple-access.js?v=5" defer><\/script>';
const SHARING_SCRIPT = '<script src="./agenda-sharing.js?v=3" defer><\/script>';
const WEB_PUSH_SCRIPT = '<script src="./web-push.js?v=1" defer><\/script>';
const VIEWMODE_SCRIPT = '<script src="./viewmode.js?v=2" defer><\/script>';
const HEADER_CLEANUP_SCRIPT = '<script src="./header-cleanup.js?v=4" defer><\/script>';
const UNDO_SCRIPT = '<script src="./undo.js?v=1" defer><\/script>';
const LIXEIRA_SCRIPT = '<script src="./lixeira.js?v=1" defer><\/script>';
const INTEL_SCRIPT = '<script src="./agenda-intelligence.js?v=2" defer><\/script>';
const LIST_STATUS_SCRIPT = '<script src="./agenda-list-status.js?v=2" defer><\/script>';
const EXPORT_SCRIPT = '<script src="./export-localstorage.js?v=2" defer><\/script>';
const REALTIME_SCRIPT = '<script src="./realtime-refresh.js?v=1" defer><\/script>';
const POLISH_STYLE = '<link rel="stylesheet" href="./interface-polish.css?v=4">';
const POLISH_SCRIPT = '<script src="./interface-polish.js?v=1" defer><\/script>';
const REG_FIN_SCRIPT = '<script src="./registros-financeiros.js?v=1" defer><\/script>';
const AUTH_GATE_SCRIPT = '<script src="./auth-gate.js?v=1" defer><\/script>';
const SEQ_SCRIPT = '<script src="./sequencial.js?v=3" defer><\/script>';

const STATIC_ASSET_RE = /\.(?:js|css|png|jpg|jpeg|svg|webp|woff2?)$/;

self.addEventListener('install', () => { self.skipWaiting(); });
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name !== CACHE).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      const response = await fetch(request, { cache: 'no-store' });
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || !contentType.includes('text/html')) return response;
      let html = await response.text();
      const isFinance = html.includes('financeiro.html');
      const isGame = html.includes('gamificacao.html');
      const isTraining = html.includes('treino.html');
      const isInvest = html.includes('investimentos.html');
      const isCarteira = html.includes('carteira.html');
      const isTreinoAna = html.includes('treino-ana.html');
      const isImportar = html.includes('importar.html');
      const isAuxPage = isFinance || isGame || isTraining || isInvest || isCarteira || isTreinoAna || isImportar;
      if (!isAuxPage && !html.includes('interface-polish.css')) html = html.replace('</head>', `${POLISH_STYLE}</head>`);
      if (!isAuxPage && !html.includes('edit-enhancement.js')) html = html.replace('</body>', `${EDIT_SCRIPT}</body>`);
      if (!isAuxPage && !html.includes('treino.js')) html = html.replace('</body>', `${TREINO_SCRIPT}</body>`);
      if (!isAuxPage && !html.includes('painel.js')) html = html.replace('</body>', `${PAINEL_SCRIPT}</body>`);
      if (!isAuxPage && !html.includes('gamificacao.js')) html = html.replace('</body>', `${GAME_SCRIPT}</body>`);
      if (!isAuxPage && !html.includes('financeiro.js')) html = html.replace('</body>', `${FINANCEIRO_SCRIPT}</body>`);
      if (!isAuxPage && !html.includes('notas.js')) html = html.replace('</body>', `${NOTAS_SCRIPT}</body>`);
      if (!isAuxPage && !html.includes('condicional.js')) html = html.replace('</body>', `${CONDICIONAL_SCRIPT}</body>`);
      if (!html.includes('supabase-project-config.js')) html = html.replace('</body>', `${SUPABASE_CONFIG_SCRIPT}</body>`);
      if (!html.includes('supabase-shared-storage.js')) html = html.replace('</body>', `${SUPABASE_SCRIPT}</body>`);
      if (!isAuxPage && !html.includes('supabase-login-ui.js')) html = html.replace('</body>', `${SUPABASE_LOGIN_SCRIPT}</body>`);
      if (!isAuxPage && !html.includes('supabase-simple-access.js')) html = html.replace('</body>', `${SIMPLE_ACCESS_SCRIPT}</body>`);
      if (!isAuxPage && !html.includes('web-push.js')) html = html.replace('</body>', `${WEB_PUSH_SCRIPT}</body>`);
      if (!isAuxPage && !html.includes('viewmode.js')) html = html.replace('</body>', `${VIEWMODE_SCRIPT}</body>`);
      if (!isAuxPage && !html.includes('header-cleanup.js')) html = html.replace('</body>', `${HEADER_CLEANUP_SCRIPT}</body>`);
      if (!isAuxPage && !html.includes('undo.js')) html = html.replace('</body>', `${UNDO_SCRIPT}</body>`);
      if (!isAuxPage && !html.includes('lixeira.js')) html = html.replace('</body>', `${LIXEIRA_SCRIPT}</body>`);
      if (!isAuxPage && !html.includes('agenda-intelligence.js')) html = html.replace('</body>', `${INTEL_SCRIPT}</body>`);
      if (!isAuxPage && !html.includes('agenda-list-status.js')) html = html.replace('</body>', `${LIST_STATUS_SCRIPT}</body>`);
      if (!isAuxPage && !html.includes('export-localstorage.js')) html = html.replace('</body>', `${EXPORT_SCRIPT}</body>`);
      if (!isAuxPage && !html.includes('realtime-refresh.js')) html = html.replace('</body>', `${REALTIME_SCRIPT}</body>`);
      if (!isAuxPage && !html.includes('interface-polish.js')) html = html.replace('</body>', `${POLISH_SCRIPT}</body>`);
      if (!isAuxPage && !html.includes('registros-financeiros.js')) html = html.replace('</body>', `${REG_FIN_SCRIPT}</body>`);
      if (!isAuxPage && !html.includes('auth-gate.js')) html = html.replace('</body>', `${AUTH_GATE_SCRIPT}</body>`);
      if (!isAuxPage && !html.includes('agenda-sharing.js')) html = html.replace('</body>', `${SHARING_SCRIPT}</body>`);
      if (!isAuxPage && !html.includes('sequencial.js')) html = html.replace('</body>', `${SEQ_SCRIPT}</body>`);
      const headers = new Headers(response.headers);
      headers.delete('content-length');
      headers.delete('content-encoding');
      headers.set('cache-control', 'no-store');
      return new Response(html, { status: response.status, statusText: response.statusText, headers });
    })());
    return;
  }

  // Assets estáticos (js/css/imagens/fontes): cache-first com revalidação em segundo
  // plano. Isso é o que faltava para o "P" do PWA funcionar de verdade — antes,
  // toda navegação baixava de novo os ~25 scripts do zero, mesmo sem nenhuma
  // mudança neles, o que pesava bastante em rede lenta/instável.
  const url = new URL(request.url);
  if (url.origin === self.location.origin && STATIC_ASSET_RE.test(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(request);
      const network = fetch(request).then(response => {
        if (response && response.ok) cache.put(request, response.clone());
        return response;
      }).catch(() => null);
      if (cached) return cached;
      const fresh = await network;
      return fresh || new Response('', { status: 504, statusText: 'offline' });
    })());
  }
});

self.addEventListener('push', event => {
  let data = { title: 'Lembrete da Agenda', body: 'Você tem uma tarefa agendada.' };
  try { data = { ...data, ...(event.data ? event.data.json() : {}) }; }
  catch (_) { if (event.data) data.body = event.data.text(); }
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    tag: data.tag || 'agenda-alerta',
    renotify: true,
    icon: './icon-192.png',
    badge: './icon-192.png',
    timestamp: Date.now(),
    data: { url: data.url || './?alert=1', taskId: data.taskId || null, scheduledFor: data.scheduledFor || null }
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || './', self.location.origin).href;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const current = windows.find(client => client.url.startsWith(self.location.origin));
    if (current) {
      await current.focus();
      if ('navigate' in current) await current.navigate(target);
      return;
    }
    return self.clients.openWindow(target);
  })());
});

// redeploy trigger v184-cache-otimizado
