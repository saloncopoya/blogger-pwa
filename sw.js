const CACHE_NAME = 'gallos-live-v2'; // Cambié el nombre para forzar actualización

const urlsToCache = [
  '/',
  'https://werwfw45234wef3243e23fwedfrtert343455.blogspot.com/',
  'https://w7.pngwing.com/pngs/462/874/png-transparent-instagram-logo-icon-instagram-icon-text-logo-sticker-thumbnail.png'
];

// Instalación: Guarda los archivos críticos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting(); // Obliga al nuevo SW a tomar el control de inmediato
});

// Limpieza: Borra el caché viejo (blog-v1) para que se vean tus cambios nuevos
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// Estrategia: "Network First" (Intenta internet, si falla usa caché)
// Es mejor para blogs porque el contenido cambia seguido
self.addEventListener('fetch', event => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request).then(response => {
        return response || caches.match('/');
      });
    })
  );
});
