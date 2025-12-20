const CACHE_NAME = 'gallos-live-v5-offline'; // Nombre nuevo para limpiar caché viejo

const urlsToCache = [
  '/',
  '/favicon.ico',
  'https://werwfw45234wef3243e23fwedfrtert343455.blogspot.com/',
  'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgfNk28jLkog7p3YJv2vrK0rFEehU18BtZxPobHh6zMTO3e80-e_j5xbkU8IinudcuhRjvxp9aGjNTEDA-oFIRk_4s3ogo3-xQqgm_7Ej1E0FOoLR0Z1YDmx4wrobs8nheRahQKrjgHchZg9X-kZNqaDyctv2LeYFc5kGifjnOWx_sx2_MUCc0vqdYWzQqh/s512/pcg.jpg'
];

// 1. Instalación: Guardar archivos críticos
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Caché instalado correctamente');
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

// 2. Activación: Limpieza total de versiones viejas
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(keys.map(key => {
        if (key !== CACHE_NAME) return caches.delete(key);
      }));
    })
  );
  self.clients.claim();
});

// 3. Estrategia OFFLINE REAL: Cache First + Dynamic Caching
self.addEventListener('fetch', event => {
  // Solo procesamos peticiones de navegación o de imágenes/estilos
  if (event.request.mode === 'navigate' || event.request.destination === 'image') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Si la red funciona, clonamos la respuesta y la guardamos en el caché
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, copy);
          });
          return response;
        })
        .catch(() => {
          // Si NO hay red, buscamos en el caché lo que sea que el usuario haya visto antes
          return caches.match(event.request).then(cachedResponse => {
            return cachedResponse || caches.match('/'); // Si no hay nada, al menos mostramos el inicio
          });
        })
    );
  } else {
    // Para el resto (scripts externos, anuncios), intentamos red primero
    event.respondWith(
      caches.match(event.request).then(response => {
        return response || fetch(event.request);
      })
    );
  }
});
