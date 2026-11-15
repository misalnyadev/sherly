// SherlyStudio service worker — hanya syarat install PWA; TANPA caching
// (semua request tetap lewat jaringan, jadi update deployment selalu terlihat).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
