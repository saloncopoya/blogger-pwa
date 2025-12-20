// --- CONFIGURACIÓN DE FIREBASE (PON ESTO ARRIBA DE TODO) ---
importScripts('https://www.gstatic.com/firebasejs/9.17.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.17.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyASox7mRak5V0py29htEVWCVeipGpA0yfs",
  projectId: "galloslivebadge",
  messagingSenderId: "979482928760", // AQUÍ VA EL ID SENDER
  appId: "1:979482928760:web:3ea879dc4ee1e020df6f8d"
});

const messaging = firebase.messaging();

// Escuchar notificaciones en segundo plano
messaging.onBackgroundMessage((payload) => {
  console.log('Notificación recibida en segundo plano:', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgfNk28jLkog7p3YJv2vrK0rFEehU18BtZxPobHh6zMTO3e80-e_j5xbkU8IinudcuhRjvxp9aGjNTEDA-oFIRk_4s3ogo3-xQqgm_7Ej1E0FOoLR0Z1YDmx4wrobs8nheRahQKrjgHchZg9X-kZNqaDyctv2LeYFc5kGifjnOWx_sx2_MUCc0vqdYWzQqh/s512/pcg.jpg'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// --- EL RESTO DE TU CÓDIGO (CACHE, FETCH, ETC.) EMPIEZA AQUÍ ---
const CACHE_NAME = 'gallos3';
// ... (todo lo demás que ya tienes)
const urlsToCache = [
  '/',
  '/favicon.ico',
  'https://galloslive.blogspot.com/',
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
