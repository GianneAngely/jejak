/* Jejak: service worker minimal supaya bisa dipasang ke layar utama.
   Tidak menyimpan cache apa pun; versi lama yang mungkin tersimpan dihapus saat aktif. */
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function () {});
