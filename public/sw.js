const CACHE_NAME = 'radar-cache-v2';
const DATA_CACHE_NAME = 'radar-data-v1';

const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json'
];

// API routes that should be cached for offline access
const API_ROUTES = [
  '/api/contacts',
  '/api/call-logs',
  '/api/tally',
  '/health'
];

self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Service Worker: Caching App Shell');
      return cache.addAll(ASSETS);
    }).then(() => {
      self.skipWaiting();
    })
  );
});

self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME && cacheName !== DATA_CACHE_NAME) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      self.clients.claim();
    })
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      caches.open(DATA_CACHE_NAME).then(cache => {
        return fetch(request).then(response => {
          // If the request is successful, clone and cache the response
          if (response.status === 200) {
            cache.put(request.url, response.clone());
          }
          return response;
        }).catch(() => {
          // If fetch fails, try to serve from cache
          return cache.match(request);
        });
      })
    );
    return;
  }

  // Handle app shell requests
  event.respondWith(
    caches.match(request).then(response => {
      if (response) {
        return response;
      }
      
      // If not in cache, fetch from network
      return fetch(request).then(response => {
        // Don't cache non-successful responses
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });

        return response;
      });
    })
  );
});

// Handle background sync for offline data
self.addEventListener('sync', event => {
  if (event.tag === 'background-sync') {
    console.log('Service Worker: Background sync triggered');
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  // Implement background sync logic here
  // This could sync offline data when connection is restored
  console.log('Background sync: Processing offline data...');
}
