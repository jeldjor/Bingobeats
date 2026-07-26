const CACHE = 'bingo-beats-clean-v201';
const CORE = [
  './',
  './index.html',
  './style.css?v=2010',
  './app.js?v=2010',
  './manifest.json',
  './bb_logo.png',
  './bb_logo_lime.webp',
  './bb_logo_orange.png',
  './bb_mascot_dj.png',
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
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request,copy));
        return response;
      })
      .catch(() => caches.match(event.request).then(found => found || caches.match('./index.html')))
  );
});
