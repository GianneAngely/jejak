/* Jejak: service worker.
   Strategi "jaringan dulu": halaman app dan berkasnya SELALU diambil dari server bila
   tersambung (jadi versi terbaru tetap termuat). Salinan hanya dipakai ketika jaringan
   gagal, supaya catatan yang pernah dibuka tetap bisa dibaca saat luring.
   Permintaan API tidak pernah disimpan di sini. */
var CACHE = "jejak-luring-v1";
var SHELL = /^\/(app|app\.js|app\.css|brand\.js|manifest\.webmanifest|icon\.svg|icon-512\.png|apple-touch-icon\.png)$/;

self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== self.location.origin || !SHELL.test(url.pathname)) return;
  var isPage = url.pathname === "/app";
  e.respondWith(fetch(req).then(function (res) {
    if (res && res.ok) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(isPage ? "/app" : req, copy); });
    }
    return res;
  }).catch(function () {
    return caches.match(isPage ? "/app" : req).then(function (hit) { return hit || Response.error(); });
  }));
});
