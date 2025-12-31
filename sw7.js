const CACHE_NAME = 'gallos-v3'; // Cambia el nombre cada vez que subas cambios

const urlsToCache = [
  'https://postinv2s.blogspot.com',
  'https://postinv2s.blogspot.com/?m=1', // Corregida la doble barra
 ];

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // Si está en caché, lo devuelve de inmediato (RÁPIDO)
      if (cachedResponse) return cachedResponse;

      // Si no está, lo busca en internet
      return fetch(event.request).then(response => {
        // Si la respuesta es buena, la guarda para la próxima vez
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => {
        // SI NO HAY INTERNET Y NO ESTÁ EN CACHÉ:
        // Si el usuario está navegando a la página principal, fuérzalo a ver el inicio
        if (event.request.mode === 'navigate') {
          return caches.match('https://postinv2s.blogspot.com/?m=1');
        }
      });
    })
  );
});
// 2. Activación (Limpieza de cachés viejos)
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// 3. Manejo de peticiones (Offline Real)
self.addEventListener('fetch', event => {
  // Solo manejamos peticiones GET (Firebase usa otras que no se cachean así)
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Si la respuesta es válida, guardamos una copia en caché
        if (response && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => {
        // Si falla la red, buscamos en el caché
        return caches.match(event.request).then(cachedResponse => {
          // Si es una navegación (página principal), devolvemos el inicio guardado
          if (event.request.mode === 'navigate') {
            return caches.match('https://postinv2s.blogspot.com/?m=1');
          }
          return cachedResponse;
        });
      })
  );
});
