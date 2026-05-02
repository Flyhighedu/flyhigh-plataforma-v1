const CACHE_NAME = 'admin-cache-v1';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Pass-through fetch for Admin to guarantee fresh data
    // No caching, completely parallel to the Staff offline logic
    event.respondWith(fetch(event.request));
});
