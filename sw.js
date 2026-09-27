const CACHE='stockbot-v39-scanner-product';
self.addEventListener('install',e=>self.skipWaiting());
self.addEventListener('activate',e=>e.waitUntil((async()=>{for(const k of await caches.keys()) await caches.delete(k);await self.clients.claim();})()));
self.addEventListener('fetch',e=>{
  if(e.request.mode==='navigate'){
    e.respondWith((async()=>{
      try{
        const r=await fetch(e.request,{cache:'no-store'});
        let html=await r.text();
        html=html.replace('</body>','<script src="./scanner-v12.js?v=38-exact-v12"></script><script src="./enhancements-v13.js?v=39-product"></script></body>');
        return new Response(html,{status:r.status,statusText:r.statusText,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store, max-age=0'}});
      }catch(_){return new Response('StockBot requires a connection for this update',{status:503,headers:{'Content-Type':'text/plain'}});}
    })());
    return;
  }
  e.respondWith(fetch(e.request,{cache:'no-store'}));
});