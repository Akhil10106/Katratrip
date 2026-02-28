self.addEventListener('install', (e) => {
  console.log('Service Worker: Installed');
});

self.addEventListener('fetch', (e) => {
  // Required for PWA to be "installable"
  e.respondWith(fetch(e.request));
});
