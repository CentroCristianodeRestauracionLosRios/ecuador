// =============================================
//  sw.js — Service Worker CCRLR
//  Gestiona notificaciones push locales
// =============================================

const CACHE_NAME = 'ccrlr-v1';

// Instalación: cachear archivos principales
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(['/', '/index.html', '/styles.css', '/script.js', '/ICONO.png'])
    ).catch(() => {}) // no bloquear si falla el caché
  );
  self.skipWaiting();
});

// Activación: limpiar caches viejos
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Clic en notificación: abrir la página en la sección de calendario
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(client.url.split('#')[0] + '#calendario');
          return;
        }
      }
      if (clients.openWindow) {
        clients.openWindow(self.location.origin + '/#calendario');
      }
    })
  );
});

// Fetch: servir desde caché si está disponible (offline-first básico)
self.addEventListener('fetch', (e) => {
  // Solo para peticiones GET del mismo origen
  if (e.request.method !== 'GET' || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});
