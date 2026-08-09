/* Cubicle Arcade service worker — runtime cache so the hosted copy works
   offline after the first visit. No hand-maintained file list to drift. */
const CACHE = 'cubicle-arcade-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then((hit) =>
        hit || fetch(req).then((res) => {
          try { if (res && res.status === 200 && res.type === 'basic') cache.put(req, res.clone()); } catch (_) { /* ignore */ }
          return res;
        }).catch(() => hit)
      )
    )
  );
});
