'use strict';
const CACHE='navixu3-v410-r3pro-phone-link-fix1';
const SHELL=['./','./index.html','./manifest.webmanifest','./version.json','./navixu3-icon.svg','./navixu3-192.png','./navixu3-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('navixu3-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(url.pathname.endsWith('/version.json')){event.respondWith(fetch(request,{cache:'no-store'}));return;}
 if(request.mode==='navigate'){
  event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('./index.html',copy));}return response;}).catch(()=>caches.match('./index.html').then(hit=>hit||caches.match('./'))));
  return;
 }
 if(SHELL.some(path=>new URL(path,self.location.href).pathname===url.pathname)){
  event.respondWith(caches.match(request).then(hit=>hit||fetch(request).then(response=>{if(response.ok)caches.open(CACHE).then(cache=>cache.put(request,response.clone()));return response;})));
 }
});
