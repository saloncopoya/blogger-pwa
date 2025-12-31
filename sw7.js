// ==============================================
// SERVICE WORKER PROFESIONAL PARA BLOGGER PWA
// ==============================================

const CACHE_NAME = 'socialapp-blogger-v3';
const APP_SHELL = 'socialapp-app-shell';

// 1. ESTRATEGIA: Solo cachear lo ESENCIAL
const ESSENTIAL_URLS = [
  // Tu página principal - FORMATO CORRECTO para Blogger
  'https://postinv2s.blogspot.com/?m=1&source=pwa',
  
  // Tu logo/imagen (la que ya usas)
  'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgfNk28jLkog7p3YJv2vrK0rFEehU18BtZxPobHh6zMTO3e80-e_j5xbkU8IinudcuhRjvxp9aGjNTEDA-oFIRk_4s3ogo3-xQqgm_7Ej1E0FOoLR0Z1YDmx4wrobs8nheRahQKrjgHchZg9X-kZNqaDyctv2LeYFc5kGifjnOWx_sx2_MUCc0vqdYWzQqh/s512/pcg.jpg',
  
  // Página offline EMBEBIDA (no archivo externo)
  // Se creará dinámicamente
];

// ==============================================
// INSTALACIÓN - Cache App Shell
// ==============================================
self.addEventListener('install', (event) => {
  console.log('📦 SW: Instalando para Blogger...');
  
  event.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE_NAME);
        
        // 1. Cachear URLs esenciales
        await cache.addAll(ESSENTIAL_URLS);
        
        // 2. Crear página offline DINÁMICAMENTE
        const offlinePage = createOfflinePage();
        const offlineResponse = new Response(offlinePage, {
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
        
        await cache.put('/offline', offlineResponse);
        
        console.log('✅ SW instalado correctamente');
        return self.skipWaiting();
      } catch (error) {
        console.error('❌ Error instalación SW:', error);
        // Continuar aunque falle cache
        return self.skipWaiting();
      }
    })()
  );
});

// ==============================================
// ACTIVACIÓN - Limpiar caches viejos
// ==============================================
self.addEventListener('activate', (event) => {
  console.log('🚀 SW: Activado');
  
  event.waitUntil(
    (async () => {
      // Limpiar caches viejos
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log(`🗑️ Eliminando cache viejo: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
      
      // Tomar control inmediato
      await self.clients.claim();
      console.log('✅ SW activado y listo');
      
      // Enviar mensaje a clientes
      const clients = await self.clients.matchAll();
      clients.forEach(client => {
        client.postMessage({ type: 'SW_ACTIVATED', version: 'v3' });
      });
    })()
  );
});

// ==============================================
// ESTRATEGIA DE CACHE INTELIGENTE
// ==============================================
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  
  // 1. Ignorar solicitudes no-GET
  if (event.request.method !== 'GET') return;
  
  // 2. Estrategia diferente por tipo de recurso
  if (shouldUseNetworkOnly(event.request)) {
    handleNetworkOnly(event);
    return;
  }
  
  if (shouldUseCacheFirst(event.request)) {
    handleCacheFirst(event);
    return;
  }
  
  // 3. Estrategia por defecto: STALE-WHILE-REVALIDATE
  handleStaleWhileRevalidate(event);
});

// ==============================================
// ESTRATEGIAS ESPECÍFICAS
// ==============================================

// A. Solo red (Firebase, APIs)
function shouldUseNetworkOnly(request) {
  const url = request.url;
  return (
    url.includes('firebaseio.com') ||    // Firebase Realtime DB
    url.includes('firestore.googleapis.com') ||
    url.includes('analytics') ||
    url.includes('googleapis.com/auth') ||
    request.headers.get('Accept')?.includes('application/json')
  );
}

function handleNetworkOnly(event) {
  event.respondWith(
    fetch(event.request).catch(() => {
      // Para Firebase, devolver datos vacíos en offline
      if (event.request.url.includes('firebaseio.com')) {
        return new Response(JSON.stringify({ 
          offline: true,
          cachedAt: Date.now()
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Para navegación, mostrar offline page
      if (event.request.mode === 'navigate') {
        return caches.match('/offline');
      }
      
      return new Response('', { status: 408 });
    })
  );
}

// B. Cache primero (imágenes, CSS, JS estáticos)
function shouldUseCacheFirst(request) {
  const url = request.url;
  return (
    request.destination === 'image' ||
    url.includes('.jpg') ||
    url.includes('.png') ||
    url.includes('.gif') ||
    url.includes('blogger.googleusercontent.com') ||
    url.includes('blogspot.com') ||
    url.includes('static')
  );
}

function handleCacheFirst(event) {
  event.respondWith(
    (async () => {
      // 1. Buscar en cache
      const cachedResponse = await caches.match(event.request);
      
      // 2. Si existe en cache, devolver y actualizar en segundo plano
      if (cachedResponse) {
        // Actualizar cache en segundo plano (no bloquear)
        event.waitUntil(
          (async () => {
            try {
              const networkResponse = await fetch(event.request);
              if (networkResponse.ok) {
                const cache = await caches.open(CACHE_NAME);
                await cache.put(event.request, networkResponse.clone());
              }
            } catch (error) {
              // Silenciar error de actualización
            }
          })()
        );
        return cachedResponse;
      }
      
      // 3. Si no está en cache, buscar en red
      try {
        const networkResponse = await fetch(event.request);
        
        // Cachear para futuras peticiones
        if (networkResponse.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(event.request, networkResponse.clone());
        }
        
        return networkResponse;
      } catch (error) {
        // Si es imagen, devolver imagen placeholder
        if (event.request.destination === 'image') {
          return caches.match('https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgfNk28jLkog7p3YJv2vrK0rFEehU18BtZxPobHh6zMTO3e80-e_j5xbkU8IinudcuhRjvxp9aGjNTEDA-oFIRk_4s3ogo3-xQqgm_7Ej1E0FOoLR0Z1YDmx4wrobs8nheRahQKrjgHchZg9X-kZNqaDyctv2LeYFc5kGifjnOWx_sx2_MUCc0vqdYWzQqh/s512/pcg.jpg');
        }
        
        throw error;
      }
    })()
  );
}

// C. Stale-While-Revalidate (HTML, CSS, JS principal)
function handleStaleWhileRevalidate(event) {
  event.respondWith(
    (async () => {
      try {
        // 1. Intentar red primero (para contenido fresco)
        const networkResponse = await fetch(event.request);
        
        // 2. Si es exitoso, actualizar cache
        if (networkResponse.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put(event.request, networkResponse.clone());
        }
        
        return networkResponse;
      } catch (error) {
        // 3. Si falla la red, usar cache
        const cachedResponse = await caches.match(event.request);
        
        if (cachedResponse) {
          return cachedResponse;
        }
        
        // 4. Si es navegación y no hay cache, mostrar offline
        if (event.request.mode === 'navigate') {
          return caches.match('/offline');
        }
        
        // 5. Para otros recursos, fallback genérico
        return new Response('', { 
          status: 408,
          statusText: 'Sin conexión'
        });
      }
    })()
  );
}

// ==============================================
// PÁGINA OFFLINE DINÁMICA
// ==============================================
function createOfflinePage() {
  return `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SocialApp - Modo Offline</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      text-align: center;
    }
    .container {
      max-width: 400px;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(10px);
      border-radius: 20px;
      padding: 40px 30px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.2);
    }
    .icon {
      font-size: 80px;
      margin-bottom: 20px;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.1); }
    }
    h1 {
      font-size: 28px;
      margin-bottom: 15px;
      font-weight: 700;
    }
    p {
      font-size: 16px;
      margin-bottom: 25px;
      opacity: 0.9;
      line-height: 1.5;
    }
    .features {
      text-align: left;
      margin: 25px 0;
      padding-left: 20px;
    }
    .features li {
      margin-bottom: 10px;
      font-size: 14px;
    }
    button {
      background: white;
      color: #667eea;
      border: none;
      padding: 14px 28px;
      border-radius: 50px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.3s;
      margin-top: 10px;
      width: 100%;
      max-width: 200px;
    }
    button:hover {
      transform: translateY(-2px);
      box-shadow: 0 5px 15px rgba(255,255,255,0.2);
    }
    .version {
      font-size: 12px;
      opacity: 0.6;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">📶</div>
    <h1>Estás en modo offline</h1>
    <p>No tienes conexión a internet, pero puedes seguir usando SocialApp con funcionalidad limitada.</p>
    
    <div class="features">
      <p>📌 Funciones disponibles:</p>
      <ul>
        <li>✔️ Ver publicaciones cacheadas</li>
        <li>✔️ Leer comentarios guardados</li>
        <li>✔️ Escribir borradores</li>
        <li>✔️ Ver perfiles visitados</li>
      </ul>
    </div>
    
    <p>Las nuevas publicaciones y mensajes se enviarán cuando recuperes la conexión.</p>
    
    <button onclick="window.location.reload()">Reintentar conexión</button>
    
    <div class="version">SocialApp PWA v3.0 • Modo offline</div>
  </div>
  
  <script>
    // Intentar reconectar cada 10 segundos
    setInterval(() => {
      if (navigator.onLine) {
        window.location.reload();
      }
    }, 10000);
    
    // Verificar conexión al hacer clic en cualquier parte
    document.body.addEventListener('click', () => {
      if (navigator.onLine) {
        window.location.reload();
      }
    });
  </script>
</body>
</html>`;
}

// ==============================================
// MENSAJES DESDE EL CLIENTE
// ==============================================
self.addEventListener('message', (event) => {
  console.log('📨 SW recibió mensaje:', event.data);
  
  switch (event.data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;
      
    case 'CLEAR_CACHE':
      caches.delete(CACHE_NAME).then(() => {
        event.ports[0].postMessage({ success: true });
      });
      break;
      
    case 'GET_CACHE_INFO':
      caches.open(CACHE_NAME).then(cache => {
        cache.keys().then(keys => {
          event.ports[0].postMessage({
            count: keys.length,
            size: 'N/A' // No se puede obtener tamaño fácilmente
          });
        });
      });
      break;
      
    case 'CACHE_URLS':
      if (event.data.urls) {
        caches.open(CACHE_NAME).then(cache => {
          event.data.urls.forEach(url => {
            fetch(url).then(response => {
              if (response.ok) {
                cache.put(url, response);
              }
            });
          });
        });
      }
      break;
  }
});

// ==============================================
// NOTIFICACIONES PUSH (OPCIONAL)
// ==============================================
self.addEventListener('push', (event) => {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'Nueva notificación',
      icon: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgfNk28jLkog7p3YJv2vrK0rFEehU18BtZxPobHh6zMTO3e80-e_j5xbkU8IinudcuhRjvxp9aGjNTEDA-oFIRk_4s3ogo3-xQqgm_7Ej1E0FOoLR0Z1YDmx4wrobs8nheRahQKrjgHchZg9X-kZNqaDyctv2LeYFc5kGifjnOWx_sx2_MUCc0vqdYWzQqh/s192/pcg.jpg',
      badge: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgfNk28jLkog7p3YJv2vrK0rFEehU18BtZxPobHh6zMTO3e80-e_j5xbkU8IinudcuhRjvxp9aGjNTEDA-oFIRk_4s3ogo3-xQqgm_7Ej1E0FOoLR0Z1YDmx4wrobs8nheRahQKrjgHchZg9X-kZNqaDyctv2LeYFc5kGifjnOWx_sx2_MUCc0vqdYWzQqh/s96/pcg.jpg',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || 'https://postinv2s.blogspot.com/?m=1',
        timestamp: Date.now()
      },
      actions: [
        {
          action: 'open',
          title: 'Abrir'
        },
        {
          action: 'dismiss',
          title: 'Cerrar'
        }
      ]
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'SocialApp', options)
    );
  } catch (error) {
    // Notificación simple si el JSON falla
    const options = {
      body: 'Tienes una nueva notificación',
      icon: 'https://blogger.googleusercontent.com/img/b/R29vZ2xl/AVvXsEgfNk28jLkog7p3YJv2vrK0rFEehU18BtZxPobHh6zMTO3e80-e_j5xbkU8IinudcuhRjvxp9aGjNTEDA-oFIRk_4s3ogo3-xQqgm_7Ej1E0FOoLR0Z1YDmx4wrobs8nheRahQKrjgHchZg9X-kZNqaDyctv2LeYFc5kGifjnOWx_sx2_MUCc0vqdYWzQqh/s192/pcg.jpg'
    };
    
    event.waitUntil(
      self.registration.showNotification('SocialApp', options)
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes('postinv2s.blogspot.com') && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.url || 'https://postinv2s.blogspot.com/?m=1');
        }
      })
    );
  }
});

// ==============================================
// UTILIDADES
// ==============================================

// Verificar periodicamente actualizaciones
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'update-check') {
    console.log('🔄 Verificando actualizaciones...');
    // Aquí podrías verificar nuevas versiones
  }
});

// Manejar errores globales
self.addEventListener('error', (error) => {
  console.error('🔥 Error en SW:', error);
});

// ==============================================
// EXPORT para pruebas (si es módulo)
// ==============================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CACHE_NAME,
    ESSENTIAL_URLS,
    createOfflinePage
  };
}
