/* Картотека упражнений ILCA 6 — service worker
   При каждом обновлении содержимого меняй CACHE_VERSION,
   иначе у тренеров останется старая версия. */
const CACHE_VERSION = "ilca6-drills-v1.3.0";
const BUILD_DATE = "2026-09-02";

const ASSETS = [
  "./",
  "./index.html",
  "./drills.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(c => c.addAll(ASSETS))
      .catch(() => {})
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

/* cache-first: на воде связи нет, скорость важнее свежести.
   Свежесть обеспечивает смена CACHE_VERSION + плашка обновления. */
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then(hit => {
      if (hit) return hit;
      return fetch(e.request).then(res => {
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match("./index.html"));
    })
  );
});

self.addEventListener("message", e => {
  if (!e.data) return;
  if (e.data.type === "SKIP_WAITING") self.skipWaiting();
  /* Подвал страницы спрашивает версию отсюда, чтобы цифры не расходились. */
  if (e.data.type === "GET_VERSION" && e.ports && e.ports[0]) {
    e.ports[0].postMessage({ version: CACHE_VERSION, build: BUILD_DATE });
  }
});
