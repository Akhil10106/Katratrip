/**
 * TripSplit Premium Service Worker v5.0
 * -----------------------------------------------------------
 * Optimized for: Katra 2026 Offline Operations
 * Features:
 * 1. Strategic Caching: Saves UI files (CSS, JS, HTML).
 * 2. Auth Bypass: Ensures Google Login is never blocked.
 * 3. Cache Cleanup: Automatically deletes old versions.
 */

const CACHE_NAME = 'tripsplit-premium-v5';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './script.js',
    './manifest.json',
    'https://unpkg.com/lucide@latest',
    'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js',
    'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js'
];

// 1. INSTALL: Save all files into the phone's memory
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('TripSplit: Hard-coding files for offline use...');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting(); // Force the new version to activate immediately
});

// 2. ACTIVATE: Cleanup old cache versions to save phone space
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('TripSplit: Clearing old cache...');
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

// 3. FETCH: The "Safety Net" logic
self.addEventListener('fetch', (event) => {
    // --- AUTHENTICATION BYPASS ---
    // If the request is for Google/Firebase Auth, let it pass through.
    // Do NOT try to cache login pages, as they require live servers.
    if (
        event.request.url.includes('googleapis.com') || 
        event.request.url.includes('identitytoolkit') || 
        event.request.url.includes('firebaseapp.com/__/auth')
    ) {
        return; 
    }

    event.respondWith(
        fetch(event.request).catch(() => {
            // If the network fails (Katra mountains), serve the cached file
            return caches.match(event.request);
        })
    );
});
