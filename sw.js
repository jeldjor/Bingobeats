const CACHE='bingo-beats-v181';
const CORE=[
  './',
  './index.html',
  './style.css?v=1810',
  './style-v176.css?v=1810',
  './style-v177.css?v=1810',
  './style-v178.css?v=1810',
  './style-v179.css?v=1810',
  './style-v180.css?v=1810',
  './style-v181.css?v=1810',
  './app.js?v=1810',
  './app-v176.js?v=1810',
  './app-v177.js?v=1810',
  './app-v178.js?v=1810',
  './app-v179.js?v=1810',
  './app-v180.js?v=1810',
  './app-v181.js?v=1810',
  './bb_logo_lime.webp',
  './bb_logo_aqua.webp',
  './bb_logo_gold.webp',
  './bb_logo.png',
  './bb_mascot_dj.png',
  './app-icon.png',
  './app-icon-192.png'
];
self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())
));
self.addEventListener('activate',event=>event.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())
));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  event.respondWith(fetch(event.request).then(response=>{
    const copy=response.clone();
    caches.open(CACHE).then(cache=>cache.put(event.request,copy));
    return response;
  }).catch(()=>caches.match(event.request).then(found=>found||caches.match('./index.html'))));
});
