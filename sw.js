// Shambani service worker — app-shell + asset cache so the installed app
// opens instantly from disk on every start instead of waiting on the
// network, then quietly refreshes itself in the background.
// It does NOT cache Supabase API calls: those always need the network,
// and letting them fall through to the network keeps data live.

const CACHE_VERSION = 'shambani-shell-v3';
const RUNTIME_CACHE = 'shambani-runtime-v3';
const CURRENT_CACHES = [CACHE_VERSION, RUNTIME_CACHE];

// Cross-origin hosts that are safe (and worth) caching for instant, offline
// starts — the app's fonts and the Supabase client library. Everything else
// cross-origin (Supabase's API itself) is left alone, untouched.
const CACHEABLE_CROSS_ORIGIN_HOSTS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.jsdelivr.net',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  // scope is the exact app page this worker was registered for
  // (e.g. "/farmer-app.html" or "/buyer-app.html") — each app has its own
  // icon set, so precache the matching one rather than a shared fallback.
  const shellUrl = self.registration.scope;
  const iconFolder = shellUrl.includes('buyer-app') ? 'buyer' : 'farmer';
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      cache.addAll([
        shellUrl,
        `/icons/${iconFolder}/icon-192.png`,
        `/icons/${iconFolder}/icon-512.png`,
      ]).catch(() => {
        // Best-effort: if a resource fails to precache (e.g. offline
        // install), don't block install of the rest.
      })
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !CURRENT_CACHES.includes(key))
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const crossOrigin = url.origin !== self.location.origin;

  // Never intercept Supabase or other cross-origin API/data calls —
  // always go straight to the network for those. Only a small allow-list
  // of static, cacheable hosts (fonts, the Supabase JS CDN script) is
  // handled below; everything else cross-origin passes through untouched.
  if (crossOrigin && !CACHEABLE_CROSS_ORIGIN_HOSTS.includes(url.hostname)) return;

  // App shell (the HTML page itself): serve straight from cache when we
  // have it so the app opens instantly on every launch — no waiting on
  // the network. A fresh copy is fetched in the background and saved for
  // next time (stale-while-revalidate), so the app still stays current.
  if (req.mode === 'navigate' || req.url === self.registration.scope) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const refresh = fetch(req)
          .then((res) => {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
            return res;
          })
          .catch(() => cached || caches.match(self.registration.scope));
        return cached || refresh;
      })
    );
    return;
  }

  // Everything else — icons, manifest, fonts, the Supabase CDN script:
  // cache-first with a background refresh (stale-while-revalidate), so
  // repeat visits never wait on the network but still pick up updates.
  event.respondWith(
    caches.match(req).then((cached) => {
      const refresh = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || refresh;
    })
  );
});

/* ===================== PUSH NOTIFICATIONS ===================== */
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: 'Shambani', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Shambani';
  const iconFolder = self.registration.scope.includes('buyer-app') ? 'buyer' : 'farmer';
  const options = {
    body: data.body || '',
    icon: `/icons/${iconFolder}/icon-192.png`,
    badge: `/icons/${iconFolder}/icon-192.png`,
    data: { url: data.url || self.registration.scope },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || self.registration.scope;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(targetUrl);
    })
  );
});
