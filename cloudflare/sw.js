/* Offline support: cache the app shell and the engine on first load. CACHE is replaced by the build script. */
const CACHE = "pvsketch-fc1e471102";
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil((async () => { for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k); await self.clients.claim(); })()); });
self.addEventListener("fetch", (e) => {
  const req = e.request; if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE), hit = await cache.match(req, { ignoreSearch: true });
    if (hit) { e.waitUntil(fetch(req).then((r) => { if (r.ok) cache.put(req, r.clone()); }).catch(() => {})); return hit; }   // cache first, refresh in background
    try { const r = await fetch(req); if (r.ok) cache.put(req, r.clone()); return r; } catch (err) { return (await cache.match("index.html")) || Response.error(); }
  })());
});
