const CACHE = "nodo-v6";

const STATIC = [
  "/favicon.svg",
  "/manifest.json",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  const url = new URL(request.url);

  // API calls → network-first
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth")) {
    e.respondWith(fetch(request).catch(() => new Response(JSON.stringify({ offline: true }), { headers: { "Content-Type": "application/json" } })));
    return;
  }

  // CSS y JS propios → network-first (para que los deploys apliquen de inmediato)
  if (url.origin === self.location.origin &&
      (url.pathname.endsWith(".css") || url.pathname.endsWith(".js") ||
       url.pathname.endsWith(".html"))) {
    e.respondWith(
      fetch(request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
        }
        return res;
      }).catch(() => caches.match(request))
    );
    return;
  }

  // Recursos externos (CDN fonts, FA, Chart.js) → stale-while-revalidate
  if (url.origin !== self.location.origin) {
    e.respondWith(
      caches.match(request).then((cached) => {
        const fresh = fetch(request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(request, clone));
          }
          return res;
        }).catch(() => cached);
        return cached || fresh;
      })
    );
    return;
  }

  // Resto (imágenes, svg, manifest) → cache-first
  e.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(request, clone));
        }
        return res;
      });
    })
  );
});
