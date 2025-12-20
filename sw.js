const CACHE_NAME = 'blog-v1';
// Agrega aquí las URLs que quieres que funcionen offline (como tu página de inicio)
const urlsToCache = [
  '/',
  'https://werwfw45234wef3243e23fwedfrtert343455.blogspot.com/'
];

// Instalación: Guarda los archivos en el teléfono
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Interceptor: Si no hay internet, busca en la caché
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Si está en caché, lo devuelve. Si no, intenta ir a internet.
        return response || fetch(event.request).catch(() => {
          // AQUÍ puedes decidir qué mostrar si no hay internet ni caché
          // Podrías devolver una página personalizada de "Offline"
          return caches.match('/');
        });
      })
  );
});
