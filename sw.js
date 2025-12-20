// Archivo sw.js en GitHub
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  // Esto es lo que activa el botón de "Instalar"
  event.respondWith(fetch(event.request));
});
