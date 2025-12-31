// ==============================================
// CÓDIGO MINIMALISTA QUE SÍ INSTALA COMO APP
// ==============================================

// ARCHIVO: sw-minimal.js (sube a GitHub)
const CACHE_NAME = 'socialapp-pwa-v1';

self.addEventListener('install', (e) => {
  console.log('📦 Instalando PWA...');
  e.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (e) => {
  console.log('🚀 PWA Activada');
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Estrategia básica: Network First
  e.respondWith(
    fetch(e.request).catch(() => {
      return new Response(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>SocialApp</title>
          <style>
            body{font-family:sans-serif;text-align:center;padding:20px;}
            h1{color:#667eea;}
          </style>
        </head>
        <body>
          <h1>SocialApp</h1>
          <p>App instalada como PWA ✅</p>
          <p>Reconectando...</p>
          <script>setTimeout(()=>location.reload(),3000);</script>
        </body>
        </html>`, {
        headers: { 'Content-Type': 'text/html' }
      });
    })
  );
});
