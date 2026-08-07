const CACHE='psyweave-v21';
const ASSETS=['./','./index.html','./manifest.json','./icon.png','./css/style.css','/js/core.js','/js/engine.js','/js/music.js','/js/looper.js','/js/viz.js','/js/app.js'];
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).catch(()=>{}));
  self.skipWaiting();
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET') return;
  const url=new URL(e.request.url);
  if(url.origin!==location.origin) return;
  // NETWORK-FIRST: always fetch fresh, cache for offline fallback
  e.respondWith(
    fetch(e.request).then(res=>{
      if(res&&res.ok){const cp=res.clone(); caches.open(CACHE).then(c=>c.put(e.request,cp)).catch(()=>{});}
      return res;
    }).catch(()=>caches.match(e.request).then(hit=>hit||caches.match('./index.html')))
  );
});
