/* NAVIXU3 GitHub Pages service worker — network-first app shell */
'use strict';
const CACHE_NAME = 'navixu3-shell-v1';
const APP_SHELL = './';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.add(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('navixu3-shell-') && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (url.pathname.endsWith('/version.json')) {
    event.respondWith(fetch(request, {cache:'no-store'}));
    return;
  }
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, {cache:'no-store'}).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(APP_SHELL, copy));
        }
        return response;
      }).catch(() => caches.match(APP_SHELL))
    );
  }
});
