// 1. IMPORTAR FIREBASE PRIMERO
importScripts('https://www.gstatic.com/firebasejs/9.17.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.17.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyASox7mRak5V0py29htEVWCVeipGpA0yfs",
  projectId: "galloslivebadge",
  messagingSenderId: "979482928760",
  appId: "1:979482928760:web:3ea879dc4ee1e020df6f8d"
});

const messaging = firebase.messaging();

// Notificaciones en segundo plano
messaging.onBackgroundMessage((payload) => {
  const notificationOptions = {
    body: payload.notification.body,
    icon: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgfNk28jLkog7p3YJv2vrK0rFEehU18BtZxPobHh6zMTO3e80-e_j5xbkU8IinudcuhRjvxp9aGjNTEDA-oFIRk_4s3ogo3-xQqgm_7Ej1E0FOoLR0Z1YDmx4wrobs8nheRahQKrjgHchZg9X-kZNqaDyctv2LeYFc5kGifjnOWx_sx2_MUCc0vqdYWzQqh/s512/pcg.jpg'
  };
  self.registration.showNotification(payload.notification.title, notificationOptions);
});

// 2. TU LÓGICA DE CACHÉ ORIGINAL
const CACHE_NAME = 'gallosv2_final'; 
const urlsToCache = [
  '/',
  '/favicon.ico',
  'https://galloslive.blogspot.com/',
  'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgfNk28jLkog7p3YJv2vrK0rFEehU18BtZxPobHh6zMTO3e80-e_j5xbkU8IinudcuhRjvxp9aGjNTEDA-oFIRk_4s3ogo3-xQqgm_7Ej1E0FOoLR0Z1YDmx4wrobs8nheRahQKrjgHchZg9X-kZNqaDyctv2LeYFc5kGifjnOWx_sx2_MUCc0vqdYWzQqh/s512/pcg.jpg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.map(key => { if (key !== CACHE_NAME) return caches.delete(key); })
    ))
  );
  self.clients.claim();
});

// Tu estrategia de Fetch (Cache First + Dynamic)
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate' || event.request.destination === 'image') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request) || caches.match('/'))
    );
  } else {
    event.respondWith(
      caches.match(event.request).then(response => response || fetch(event.request))
    );
  }
});

// Tu listener de Mensajes para el Badge
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SET_BADGE') {
    if ('setAppBadge' in self.navigator) {
      self.navigator.setAppBadge(event.data.number);
    }
  }
});
