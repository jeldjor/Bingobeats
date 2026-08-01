const CACHE = 'bingo-beats-clean-v215';
const CORE = [
  './',
  './index.html',
  './style.css?v=2150',
  './app.js?v=2150',
  './manifest.json',
  './bb_logo.png',
  './bb_logo_lime.webp',
  './bb_logo_orange.png',
  './bb_mascot_dj.png',
  './bb_draw_variant_1.mp4',
  './bb_draw_variant_2.mp4',
  './bb_draw_variant_3.mp4',
  './app-icon.png',
  './app-icon-192.png'
];

self.addEventListener('install',event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate',event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key!==CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch',event => {
  if(event.request.method!=='GET') return;
  event.respondWith(
    fetch(event.request,{cache:'no-store'})
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request,copy));
        return response;
      })
      .catch(() => caches.match(event.request).then(found => found || caches.match('./index.html')))
  );
});
