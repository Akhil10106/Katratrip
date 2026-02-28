const CACHE_NAME = 'tripsplit-v1';
const assets = [
  './',
  './index.html',
  './style.css',
  './script.js',
  'https://unpkg.com/lucide@latest',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js'
];

// 1. Install - Happens once when you first load the site with internet
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(assets);
    })
  );
});

// 2. Fetch - This is the "Safety Net"
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return the saved file if offline, otherwise go to the internet
      return cachedResponse || fetch(event.request);
    })
  );
});
