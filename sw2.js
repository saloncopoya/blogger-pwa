CACHE_NAME = 'gallos'; // Nombre nuevo para limpiar caché viejo



const urlsToCache = [

  '/',

  '/favicon.ico',

  'https://galloslive.blogspot.com/?m=1',

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

  if (event.request.mode === 'navigate' || event.request.destination === 'image') {

    event.respondWith(

      fetch(event.request)

        .then(response => {

          const copy = response.clone();

          caches.open(CACHE_NAME).then(cache => {

            cache.put(event.request, copy);

          });

          return response;

        })

        .catch(() => {

          return caches.match(event.request).then(cachedResponse => {

            // Si no hay red y no está en caché, devuelve '/' (el inicio) 

            // Esto evita el aviso de "No tienes conexión" del navegador

            return cachedResponse || caches.match('/'); 

          });

        })

    );

  } else {

    event.respondWith(

      caches.match(event.request).then(response => {

        return response || fetch(event.request);

      })

    );

  }

});



// Escuchar mensajes para actualizar el Badge

self.addEventListener('message', event => {

  if (event.data && event.data.type === 'SET_BADGE') {

    if ('setAppBadge' in self.navigator) {

      self.navigator.setAppBadge(event.data.number);

    }

  }

});
