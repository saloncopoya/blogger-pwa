// CONFIGURACIÓN
const CACHE_NAME = 'socialapp-v2.0';
const OFFLINE_URL = '/offline.html';

// URLs a cachear inicialmente (incluye tu app Firebase)
const urlsToCache = [
  '/',
  'https://postinv2s.blogspot.com/?source=pwa',
  'https://postinv2s.blogspot.com/?m=1',
  
  // Firebase SDKs
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js',
  
  // Recursos estáticos
  'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgfNk28jLkog7p3YJv2vrK0rFEehU18BtZxPobHh6zMTO3e80-e_j5xbkU8IinudcuhRjvxp9aGjNTEDA-oFIRk_4s3ogo3-xQqgm_7Ej1E0FOoLR0Z1YDmx4wrobs8nheRahQKrjgHchZg9X-kZNqaDyctv2LeYFc5kGifjnOWx_sx2_MUCc0vqdYWzQqh/s512/pcg.jpg'
];

// ESTRATEGIA: Cache First with Network Fallback
const STRATEGIES = {
  STATIC: 'cache-first', // Para recursos estáticos
  API: 'network-first',   // Para datos de Firebase
  IMAGES: 'cache-first'   // Para imágenes
};

// INSTALACIÓN - Cachear recursos críticos
self.addEventListener('install', event => {
  console.log('📦 Service Worker: Instalando...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('📦 Cacheando recursos iniciales');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('✅ Todos los recursos cacheados');
        return self.skipWaiting();
      })
      .catch(error => {
        console.error('❌ Error en instalación:', error);
      })
  );
});

// ACTIVACIÓN - Limpiar cachés viejos
self.addEventListener('activate', event => {
  console.log('🚀 Service Worker: Activado');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log(`🗑️ Eliminando cache viejo: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('✅ Cache limpiado, reclamando clientes');
      return self.clients.claim();
    })
  );
});

// MANEJO DE PETICIONES - Estrategia inteligente
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // No cachear peticiones de Firebase que no sean GET
  if (event.request.method !== 'GET') return;
  
  // Estrategia para Firebase Database
  if (url.href.includes('firebaseio.com')) {
    handleFirebaseRequest(event);
    return;
  }
  
  // Estrategia para Firebase SDKs (cache primero)
  if (url.href.includes('gstatic.com/firebasejs')) {
    handleStaticRequest(event);
    return;
  }
  
  // Estrategia para imágenes
  if (event.request.destination === 'image') {
    handleImageRequest(event);
    return;
  }
  
  // Estrategia por defecto: Network First con fallback a cache
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Si la respuesta es válida, cachear
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Si falla la red, buscar en cache
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          // Si es navegación y no está en cache, mostrar offline
          if (event.request.mode === 'navigate') {
            return caches.match(OFFLINE_URL) || 
                   caches.match('https://postinv2s.blogspot.com/?m=1');
          }
          
          // Para otros recursos, devolver respuesta vacía
          return new Response('', {
            status: 408,
            statusText: 'Offline'
          });
        });
      })
  );
});

// ESTRATEGIA PARA FIREBASE DATABASE (Network First)
function handleFirebaseRequest(event) {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Para Firebase, NO cachear datos en tiempo real
        return response;
      })
      .catch(() => {
        // Si falla Firebase, intentar obtener datos del localStorage
        return handleOfflineFirebaseData(event);
      })
  );
}

// ESTRATEGIA PARA RECURSOS ESTÁTICOS (Cache First)
function handleStaticRequest(event) {
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse; // Usar cache si existe
        }
        return fetch(event.request).then(response => {
          // Guardar en cache para futuras peticiones
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseClone);
          });
          return response;
        });
      })
  );
}

// ESTRATEGIA PARA IMÁGENES (Cache First con actualización)
function handleImageRequest(event) {
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Devolver imagen de cache inmediatamente
        const fetchPromise = fetch(event.request)
          .then(response => {
            // Actualizar cache en segundo plano
            if (response.ok) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseClone);
              });
            }
            return response;
          })
          .catch(() => cachedResponse); // Si falla fetch, usar cache
        
        return cachedResponse || fetchPromise;
      })
  );
}

// MANEJAR DATOS DE FIREBASE OFFLINE
function handleOfflineFirebaseData(event) {
  const url = new URL(event.request.url);
  const path = url.pathname;
  
  // Intentar obtener datos del localStorage
  return new Promise((resolve) => {
    if (typeof self.localStorage !== 'undefined') {
      const offlineData = localStorage.getItem(`offline_${btoa(path)}`);
      if (offlineData) {
        resolve(new Response(offlineData, {
          headers: { 'Content-Type': 'application/json' }
        }));
        return;
      }
    }
    
    // Si no hay datos offline, devolver error
    resolve(new Response(JSON.stringify({
      error: 'offline',
      message: 'No hay conexión a internet'
    }), {
      status: 408,
      headers: { 'Content-Type': 'application/json' }
    }));
  });
}

// SINCRONIZACIÓN EN SEGUNDO PLANO
self.addEventListener('sync', event => {
  console.log('🔄 Sincronización en segundo plano:', event.tag);
  
  if (event.tag === 'sync-posts') {
    event.waitUntil(syncPendingPosts());
  }
});

// SINCRONIZAR POSTS PENDIENTES
async function syncPendingPosts() {
  try {
    const pendingPosts = JSON.parse(localStorage.getItem('pending_posts') || '[]');
    
    for (const post of pendingPosts) {
      // Intentar enviar el post
      const response = await fetch('https://your-firebase-api.com/posts', {
        method: 'POST',
        body: JSON.stringify(post)
      });
      
      if (response.ok) {
        // Eliminar del array de pendientes
        pendingPosts.splice(pendingPosts.indexOf(post), 1);
        localStorage.setItem('pending_posts', JSON.stringify(pendingPosts));
      }
    }
  } catch (error) {
    console.error('❌ Error sincronizando:', error);
  }
}

// MENSAJES DEL CLIENTE
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'CACHE_POSTS') {
    // Cachear posts recientes
    cachePosts(event.data.posts);
  }
});

// CACHEAR POSTS PARA OFFLINE
async function cachePosts(posts) {
  const cache = await caches.open(CACHE_NAME);
  
  for (const post of posts) {
    if (post.mediaURL) {
      // Cachear imágenes de posts
      try {
        await cache.add(post.mediaURL);
      } catch (error) {
        console.log('⚠️ No se pudo cachear imagen:', post.mediaURL);
      }
    }
  }
}

// NOTIFICACIONES PUSH
self.addEventListener('push', event => {
  const options = {
    body: event.data ? event.data.text() : 'Nueva notificación',
    icon: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgfNk28jLkog7p3YJv2vrK0rFEehU18BtZxPobHh6zMTO3e80-e_j5xbkU8IinudcuhRjvxp9aGjNTEDA-oFIRk_4s3ogo3-xQqgm_7Ej1E0FOoLR0Z1YDmx4wrobs8nheRahQKrjgHchZg9X-kZNqaDyctv2LeYFc5kGifjnOWx_sx2_MUCc0vqdYWzQqh/s512/pcg.jpg',
    badge: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgfNk28jLkog7p3YJv2vrK0rFEehU18BtZxPobHh6zMTO3e80-e_j5xbkU8IinudcuhRjvxp9aGjNTEDA-oFIRk_4s3ogo3-xQqgm_7Ej1E0FOoLR0Z1YDmx4wrobs8nheRahQKrjgHchZg9X-kZNqaDyctv2LeYFc5kGifjnOWx_sx2_MUCc0vqdYWzQqh/s192/pcg.jpg',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '1'
    }
  };
  
  event.waitUntil(
    self.registration.showNotification('SocialApp', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  event.waitUntil(
    clients.matchAll({type: 'window'}).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes('postinv2s.blogspot.com') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('https://postinv2s.blogspot.com/');
      }
    })
  );
});
