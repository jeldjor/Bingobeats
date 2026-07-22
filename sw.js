const CACHE='bingo-beats-v177';
const CORE=[
  './',
  './index.html',
  './style.css?v=1770',
  './style-v176.css?v=1770',
  './style-v177.css?v=1770',
  './app.js?v=1770',
  './app-v176.js?v=1770',
  './app-v177.js?v=1770',
  './bb_logo_lime.webp',
  './bb_logo_aqua.webp',
  './bb_logo_gold.webp',
  './app-icon.png',
  './app-icon-192.png'
];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  event.respondWith(fetch(event.request).then(response=>{
    const copy=response.clone();
    caches.open(CACHE).then(cache=>cache.put(event.request,copy));
    return response;
  }).catch(()=>caches.match(event.request).then(found=>found||caches.match('./index.html'))));
});
