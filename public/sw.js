/* Athar PWA service worker. Strategy:
 *  - Static assets (icons, /_next/static): cache-first.
 *  - Navigations: network-first with an offline fallback to the cached shell.
 * Kept deliberately small; app data is always fetched fresh (network-first). */
const CACHE = "athar-v1";
const SHELL = ["/icons/icon-192.png", "/icons/icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never touch API/cross-origin

  // App-like navigations: try network, fall back to cache when offline.
  if (req.mode === "navigate") {
    e.respondWith(fetch(req).catch(() => caches.match(req).then((r) => r || caches.match("/"))));
    return;
  }

  // Immutable static assets: cache-first, then populate the cache.
  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icons/")) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })),
    );
  }
});
