// Service worker for Proximity Chat PWA, enabling offline caching and installability
// Bypasses caching for Flask backend API requests to ensure real-time WebRTC signaling

const CACHE_NAME = 'proximity-chat-v1';
const BACKEND_URL = 'https://hello-there-backend-dao6.onrender.com';
const urlsToCache = [
  '/',
  '/index.html',
  '/manifest.json',
  '/static/js/main.chunk.js', // Main JS bundle (adjust based on build output)
  '/static/css/main.chunk.css', // Main CSS bundle (adjust based on build output)
  '/favicon.ico',
  '/logo192.png',
  '/logo512.png'
];

/**
 * Install event: Cache essential static assets for offline use
 */
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing service worker');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Caching static assets:', urlsToCache);
        return cache.addAll(urlsToCache).catch((error) => {
          console.error('[ServiceWorker] Failed to cache asset:', error);
        });
      })
      .catch((error) => {
        console.error('[ServiceWorker] Cache installation failed:', error);
      })
  );
  // Force immediate activation to avoid waiting for old clients
  self.skipWaiting();
});

/**
 * Activate event: Clean up old caches
 */
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating service worker');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[ServiceWorker] Deleting old cache:', name);
            return caches.delete(name);
          }
        })
      );
    }).then(() => {
      console.log('[ServiceWorker] Claiming clients');
      return self.clients.claim();
    })
  );
});

/**
 * Fetch event: Serve cached assets for offline, bypass for API requests
 */
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  console.log(`[ServiceWorker] Fetching: ${requestUrl.pathname}, method: ${event.request.method}`);

  // Skip chrome-extension requests
  if (requestUrl.protocol === 'chrome-extension:') {
    console.log(`[ServiceWorker] Skipping chrome-extension request: ${requestUrl.pathname}`);
    event.respondWith(fetch(event.request));
    return;
  }

  // Bypass caching for Flask backend API requests
  if (requestUrl.origin === BACKEND_URL) {
    console.log(`[ServiceWorker] Bypassing cache for API request: ${requestUrl.pathname}`);
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          console.log(`[ServiceWorker] Successful fetch for ${requestUrl.pathname}: ${response.status}`);
          return response;
        })
        .catch((error) => {
          console.error(`[ServiceWorker] Fetch failed for ${requestUrl.pathname}:`, error);
          return new Response(
            JSON.stringify({ error: 'Failed to fetch API', details: error.message }),
            {
              status: 502,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        })
    );
    return;
  }

  // Bypass non-GET requests (e.g., POST)
  if (event.request.method !== 'GET') {
    console.log(`[ServiceWorker] Bypassing cache for non-GET request: ${requestUrl.pathname}`);
    event.respondWith(fetch(event.request));
    return;
  }

  // Handle static asset requests with cache-first strategy
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          console.log(`[ServiceWorker] Serving from cache: ${requestUrl.pathname}`);
          // Fetch in background to update cache
          event.waitUntil(
            fetch(event.request)
              .then((networkResponse) => {
                if (networkResponse.ok) {
                  return caches.open(CACHE_NAME).then((cache) => {
                    console.log(`[ServiceWorker] Updating cache: ${requestUrl.pathname}`);
                    cache.put(event.request, networkResponse.clone());
                  });
                }
              })
              .catch((error) => {
                console.error(`[ServiceWorker] Background fetch failed for ${requestUrl.pathname}:`, error);
              })
          );
          return cachedResponse;
        }

        // Fetch from network if not cached
        console.log(`[ServiceWorker] Fetching from network: ${requestUrl.pathname}`);
        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.ok && urlsToCache.some((url) => requestUrl.pathname.startsWith(url))) {
              return caches.open(CACHE_NAME).then((cache) => {
                console.log(`[ServiceWorker] Caching new response: ${requestUrl.pathname}`);
                cache.put(event.request, networkResponse.clone());
                return networkResponse;
              });
            }
            return networkResponse;
          })
          .catch((error) => {
            console.error(`[ServiceWorker] Network fetch failed for ${requestUrl.pathname}:`, error);
            return new Response('Offline', { status: 503 });
          });
      })
      .catch((error) => {
        console.error(`[ServiceWorker] Cache match failed for ${requestUrl.pathname}:`, error);
        return new Response('Cache error', { status: 500 });
      })
  );
});