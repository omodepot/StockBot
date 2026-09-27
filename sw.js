const CACHE='stockbot-v36-stable-shell';
self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys()) await caches.delete(k);await self.clients.claim();})()));
self.addEventListener('fetch',e=>{
  if(e.request.mode==='navigate'){
    e.respondWith((async()=>{
      try{return await fetch(e.request,{cache:'no-store'});}
      catch(_){return new Response('StockBot requires a connection for this update',{status:503,headers:{'Content-Type':'text/plain'}});}
    })());
    return;
  }
  e.respondWith(fetch(e.request,{cache:'no-store'}));
});