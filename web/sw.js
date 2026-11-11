/* Jejak: service worker minimal supaya bisa dipasang ke layar utama. Tidak menyimpan cache data. */
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", function () {});
