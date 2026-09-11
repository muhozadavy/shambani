// Shambani service worker — minimal app-shell cache so the installed app
// opens instantly and doesn't show a browser error page when offline.
// It does NOT cache Supabase API calls: those always need the network,
// and letting them fall through to the network keeps data live.

const CACHE_VERSION = 'shambani-shell-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
  // scope is the exact app page this worker was registered for
  // (e.g. "/farmer-app.html" or "/buyer-app.html")
  const shellUrl = self.registration.scope;
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      cache.addAll([
        shellUrl,
        '/icons/icon-192.png',
        '/icons/icon-512.png',
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
          .filter((key) => key !== CACHE_VERSION)
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

  // Never intercept Supabase or other cross-origin API/data calls —
  // always go straight to the network for those.
  if (url.origin !== self.location.origin) return;

  // App shell (the HTML page itself): try the network first so updates
  // show up right away, fall back to the cached shell when offline.
  if (req.mode === 'navigate' || req.url === self.registration.scope) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((res) => res || caches.match(self.registration.scope)))
    );
    return;
  }

  // Everything else same-origin (icons, manifest): cache-first.
  event.respondWith(
    caches.match(req).then((cached) => cached || fetch(req))
  );
});
