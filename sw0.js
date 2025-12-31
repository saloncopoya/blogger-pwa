// sw.js - Service Worker Profesional para Blogger
const CACHE_NAME = 'socialapp-v1';
const OFFLINE_URL = '/offline.html'; // Página offline personalizada

// Archivos críticos para cachear
const PRECACHE_ASSETS = [
  'https://postinv2s.blogspot.com',
  'https://postinv2s.blogspot.com/?m=1',
  // Agrega aquí URLs específicas de tu blog
];

self.addEventListener('install', (event) => {
  console.log('📦 Service Worker: Instalando...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Cacheando archivos críticos');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        console.log('✅ Service Worker instalado');
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('⚡ Service Worker: Activado');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Eliminando cache viejo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Solo manejar solicitudes GET
  if (event.request.method !== 'GET') return;
  
  // Evitar extensiones de Chrome
  if (event.request.url.includes('chrome-extension://')) return;
  
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        // 1. Devuelve cache si existe
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // 2. Intenta red, cachea para futuro
        return fetch(event.request)
          .then((networkResponse) => {
            // Solo cachear si es exitoso y es de nuestro dominio
            if (networkResponse.ok && 
                event.request.url.startsWith(self.location.origin)) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(event.request, responseToCache));
            }
            return networkResponse;
          })
          .catch(() => {
            // 3. Si offline y es navegación, mostrar página offline
            if (event.request.mode === 'navigate') {
              return caches.match(OFFLINE_URL);
            }
            return new Response('Sin conexión', { 
              status: 503,
              headers: { 'Content-Type': 'text/plain' }
            });
          });
      })
  );
});

// Manejar mensajes desde la app
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }
});
