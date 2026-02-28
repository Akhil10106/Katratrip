self.addEventListener('fetch', (event) => {
  // --- OFFLINE AUTH FIX ---
  // If the URL is for Google Login or Firebase Auth, let it pass through bypass the cache.
  if (
    event.request.url.includes('googleapis.com') || 
    event.request.url.includes('identitytoolkit') || 
    event.request.url.includes('firebaseapp.com/__/auth')
  ) {
    return; // Do nothing, let the browser handle it normally
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return cached file if offline, otherwise fetch from internet
      return cachedResponse || fetch(event.request);
    })
  );
});
