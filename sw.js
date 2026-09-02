/* Картотека упражнений ILCA 6 — service worker
   При каждом обновлении содержимого меняй CACHE_VERSION,
   иначе у тренеров останется старая версия. */
const CACHE_VERSION = "ilca6-drills-v1.8.0";
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

/* Оболочка — cache-first: на воде связи нет, скорость важнее свежести.
   Данные (drills.js) — network-first с быстрым откатом в кеш: так обновление
   картотеки доезжает без правки этого файла, а офлайн продолжает работать. */
const DATA_FILES = ["drills.js"];
const NET_TIMEOUT = 2500;

function isData(url) {
  return DATA_FILES.some(f => url.pathname === f || url.pathname.endsWith("/" + f));
}

function fromCache(req) {
  return caches.match(req).then(hit => hit || fetch(req).catch(() => Response.error()));
}

function networkFirst(req) {
  return new Promise(resolve => {
    let done = false;
    const timer = setTimeout(() => {
      if (done) return;
      done = true;
      fromCache(req).then(resolve);
    }, NET_TIMEOUT);
    /* cache: "reload" — идём на сервер мимо HTTP-кеша браузера,
       иначе GitHub Pages может десять минут отдавать старый файл. */
    fetch(new Request(req.url, { cache: "reload" })).then(res => {
      if (res && res.status === 200 && res.type === "basic") {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then(c => c.put(req, copy));
      }
      if (done) return;
      done = true;
      clearTimeout(timer);
      resolve(res);
    }).catch(() => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      fromCache(req).then(resolve);
    });
  });
}

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin === self.location.origin && isData(url)) {
    e.respondWith(networkFirst(e.request));
    return;
  }
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
