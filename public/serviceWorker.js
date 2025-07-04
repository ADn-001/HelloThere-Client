const CACHE_NAME = 'proximity-chat-v1';
const urlsToCache = ['/', '/index.html', '/manifest.json'];

/**
 * Install event: Cache static assets
 */
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing service worker');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[ServiceWorker] Caching static assets:', urlsToCache);
        return cache.addAll(urlsToCache);
      })
      .catch((error) => console.error('[ServiceWorker] Cache installation failed:', error))
  );
});

/**
 * Fetch event: Serve cached assets or bypass for API requests
 */
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  console.log(`[ServiceWorker] Fetching: ${requestUrl}, method: ${event.request.method}`);

  // Skip chrome-extension requests to avoid caching errors
  if (requestUrl.protocol === 'chrome-extension:') {
    console.log(`[ServiceWorker] Skipping chrome-extension request: ${requestUrl.pathname}`);
    event.respondWith(fetch(event.request));
    return;
  }

  // Bypass caching for API requests to Flask server
  if (requestUrl.origin === 'https://localhost:5000') {
    console.log(`[ServiceWorker] Bypassing cache for API request: ${requestUrl.pathname}`);
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          console.log(`[ServiceWorker] Successful fetch for ${requestUrl.pathname}: ${response.status}`);
          return response;
        })
        .catch((error) => {
          console.error(`[ServiceWorker] Fetch failed for ${requestUrl.pathname}:`, error);
          // Return a more specific error response
          return new Response(
            JSON.stringify({ error: 'Failed to fetch API', details: error.message }),
            {
              status: 502, // Use 502 to indicate network/gateway issue
              headers: { 'Content-Type': 'application/json' },
            }
          );
        })
    );
    return;
  }

  // Fallback: Bypass non-GET requests
  if (event.request.method !== 'GET') {
    console.log(`[ServiceWorker] Bypassing cache for non-GET request: ${requestUrl.pathname}`);
    event.respondWith(fetch(event.request));
    return;
  }

  // Handle static asset requests
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          console.log(`[ServiceWorker] Serving from cache: ${requestUrl.pathname}`);
          return cachedResponse;
        }
        console.log(`[ServiceWorker] Fetching from network: ${requestUrl.pathname}`);
        return fetch(event.request)
          .then((networkResponse) => {
            // Only cache supported URLs
            if (
              event.request.method === 'GET' &&
              urlsToCache.some((url) => requestUrl.pathname.startsWith(url))
            ) {
              return caches.open(CACHE_NAME).then((cache) => {
                console.log(`[ServiceWorker] Caching new response: ${requestUrl.pathname}`);
                cache.put(event.request, networkResponse.clone()).catch((error) => {
                  console.error(`[ServiceWorker] Failed to cache ${requestUrl.pathname}:`, error);
                });
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