const CACHE = "gunma-hazard-v1";

const PRECACHE = [
  "/",
  "/index.html",
  "/icon.svg",
  "/manifest.json",
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  // Viteのホットリロード系はキャッシュしない
  if (e.request.url.includes("/@") || e.request.url.includes("/__vite")) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        // 成功したリクエストのみキャッシュ
        if (res.ok && e.request.method === "GET") {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => cached ?? new Response("", { status: 503 }));
    })
  );
});
