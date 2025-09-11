#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const terser = require('terser');

const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);

const sourceDir = path.join(__dirname, '..', 'public');
const distDir = path.join(__dirname, '..', 'dist');

async function buildServiceWorker() {
  try {
    console.log('🔧 Building service worker...');
    
    // Read the cache manifest to get file list
    const cacheManifestPath = path.join(distDir, 'cache-manifest.json');
    let cacheManifest = { files: ['/'], version: Date.now() };
    
    if (fs.existsSync(cacheManifestPath)) {
      cacheManifest = JSON.parse(await readFile(cacheManifestPath, 'utf8'));
    }
    
    // Generate enhanced service worker
    const swTemplate = `
const CACHE_NAME = 'radar-cache-v${cacheManifest.version}';
const CACHE_VERSION = ${cacheManifest.version};
const ASSETS = ${JSON.stringify(cacheManifest.files, null, 2)};

// Additional runtime caching patterns
const RUNTIME_CACHE_PATTERNS = [
  /^https:\\/\\/fonts\\.googleapis\\.com\\//,
  /^https:\\/\\/fonts\\.gstatic\\.com\\//,
  /^https:\\/\\/api\\./
];

// Cache strategies
const CACHE_STRATEGIES = {
  CACHE_FIRST: 'cache-first',
  NETWORK_FIRST: 'network-first',
  STALE_WHILE_REVALIDATE: 'stale-while-revalidate'
};

self.addEventListener('install', event => {
  console.log('[SW] Install event');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching app shell');
        return cache.addAll(ASSETS);
      })
      .then(() => {
        console.log('[SW] App shell cached');
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', event => {
  console.log('[SW] Activate event');
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('[SW] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log('[SW] Cache cleanup complete');
        return self.clients.claim();
      })
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Handle API requests with network-first strategy
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      networkFirst(request)
    );
    return;
  }
  
  // Handle app shell resources with cache-first strategy
  if (ASSETS.includes(url.pathname) || url.pathname === '/') {
    event.respondWith(
      cacheFirst(request)
    );
    return;
  }
  
  // Handle runtime caching patterns
  for (const pattern of RUNTIME_CACHE_PATTERNS) {
    if (pattern.test(request.url)) {
      event.respondWith(
        staleWhileRevalidate(request)
      );
      return;
    }
  }
  
  // Default: try cache first, fallback to network
  event.respondWith(
    cacheFirst(request)
  );
});

// Cache strategies implementation
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Cache first failed:', error);
    throw error;
  }
}

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok && request.url.indexOf('/api/') !== -1) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network first, trying cache:', error);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);
  
  const fetchPromise = fetch(request).then(networkResponse => {
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  });
  
  return cachedResponse || fetchPromise;
}

// Background sync for offline actions (future enhancement)
self.addEventListener('sync', event => {
  console.log('[SW] Background sync:', event.tag);
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Handle background sync tasks
      Promise.resolve()
    );
  }
});

// Push notifications (future enhancement)
self.addEventListener('push', event => {
  console.log('[SW] Push received');
  const options = {
    body: event.data ? event.data.text() : 'New update available',
    icon: '/manifest.json',
    badge: '/manifest.json',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };
  
  event.waitUntil(
    self.registration.showNotification('Radar Notes', options)
  );
});

console.log('[SW] Service Worker loaded - Cache version:', CACHE_VERSION);
`;
    
    // Minify the service worker if in production
    let finalSW = swTemplate;
    if (process.env.NODE_ENV === 'production') {
      const result = await terser.minify(swTemplate, {
        compress: {
          drop_console: false, // Keep console logs for debugging
          drop_debugger: true
        },
        mangle: false, // Don't mangle for easier debugging
        format: {
          comments: false
        }
      });
      
      if (result.error) {
        throw result.error;
      }
      finalSW = result.code;
    }
    
    // Write the service worker
    await writeFile(path.join(distDir, 'sw.js'), finalSW);
    console.log('✓ Service worker built successfully');
    
  } catch (error) {
    console.error('❌ Service worker build failed:', error);
    process.exit(1);
  }
}

// Run build if called directly
if (require.main === module) {
  buildServiceWorker();
}

module.exports = { buildServiceWorker };