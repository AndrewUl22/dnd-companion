const CACHE_NAME = 'dnd-companion-v44';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/app.js',
  './js/data.js',
  './js/sounds.js',
  './js/books.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-splash.png'
];
// CDN-библиотека для чтения PDF — кэшируем отдельно и без риска для остального:
// если в момент установки нет сети или CDN недоступен, всё остальное приложение
// всё равно должно нормально закэшироваться и работать офлайн
const CDN_ASSETS = [
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js',
  'https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&family=Cinzel+Decorative:wght@700&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(ASSETS).then(() =>
        Promise.allSettled(CDN_ASSETS.map((url) => cache.add(url)))
      )
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isOwnAsset = url.origin === self.location.origin;

  if (isOwnAsset) {
    // Свои файлы (html/js/css/manifest/иконки) — "сеть, а не найдётся, кэш".
    // Раньше здесь было наоборот ("кэш, а не найдётся — сеть"), из-за чего
    // при онлайне приложение всё равно продолжало показывать старую
    // закэшированную версию сколько угодно долго, пока кто-нибудь вручную не
    // почистит кэш. Теперь, если есть сеть — всегда показываем актуальную
    // версию и заодно обновляем кэш; офлайн по-прежнему работает через кэш.
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && event.request.method === 'GET') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // Чужие CDN-файлы (pdf.js, шрифты) — версии в URL фиксированы, поэтому
  // безопасно и быстрее отдавать сразу из кэша, если он есть.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && event.request.method === 'GET') {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
