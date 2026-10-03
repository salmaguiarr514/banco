const CACHE = "nodo-v1";

const STATIC = [
  "/dashboard.html",
  "/login.html",
  "/css/base.css",
  "/css/layout.css",
  "/css/balance.css",
  "/css/mercado.css",
  "/css/components.css",
  "/css/modals.css",
  "/css/transferencias.css",
  "/css/tarjeta.css",
  "/css/ui.css",
  "/css/prestamos.css",
  "/css/inversiones.css",
  "/css/recarga.css",
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

  // API calls → network-first (nunca cachear respuestas de autenticación)
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth")) {
    e.respondWith(fetch(request).catch(() => new Response(JSON.stringify({ offline: true }), { headers: { "Content-Type": "application/json" } })));
    return;
  }

  // Recursos externos (CDN fonts, FA, Chart.js) → stale-while-revalidate
  if (!url.origin.includes(self.location.origin)) {
    e.respondWith(
      caches.match(request).then((cached) => {
        const fresh = fetch(request).then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put(request, res.clone()));
          return res;
        }).catch(() => cached);
        return cached || fresh;
      })
    );
    return;
  }

  // Archivos estáticos propios → cache-first
  e.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(request, res.clone()));
        return res;
      });
    })
  );
});
