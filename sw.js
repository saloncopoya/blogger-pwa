self.addEventListener('install', (e) => {
  console.log('PWA Service Worker instalado');
});

self.addEventListener('fetch', (e) => {
  // Esto permite que la app funcione incluso con internet lento
  e.respondWith(fetch(e.request));
});
