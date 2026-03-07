// =============================================
//  sw.js — Service Worker CCRLR v2
//  PWA + Firebase Cloud Messaging push
// =============================================

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const CACHE_NAME = 'ccrlr-v2';
const ASSETS = [
  '/ecuador/',
  '/ecuador/index.html',
  '/ecuador/styles.css',
  '/ecuador/script.js',
  '/ecuador/manifest.json',
  '/ecuador/ICONO.png',
  '/ecuador/LOGO_SIN_FONDO.png'
];

firebase.initializeApp({
  apiKey: "AIzaSyCHznVAG8HyaAwzTMcYXrEjS4ikcgf9Nx0",
  authDomain: "chat-ccrlr.firebaseapp.com",
  databaseURL: "https://chat-ccrlr-default-rtdb.firebaseio.com",
  projectId: "chat-ccrlr",
  storageBucket: "chat-ccrlr.firebasestorage.app",
  messagingSenderId: "832816032978",
  appId: "1:832816032978:web:08721a677cff57b0d9110b"
});

const messaging = firebase.messaging();

// Notificaciones push cuando la app está en background/cerrada
messaging.onBackgroundMessage((payload) => {
  const notif = payload.notification || {};
  const data  = payload.data || {};
  self.registration.showNotification(notif.title || '📅 CCRLR', {
    body: notif.body || 'Tienes un nuevo evento.',
    icon: '/ecuador/ICONO.png',
    badge: '/ecuador/ICONO.png',
    vibrate: [200, 100, 200, 100, 200],
    requireInteraction: true,
    tag: data.eventoKey || 'ccrlr-evento',
    data: data
  });
});

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = '/ecuador/#calendario';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const client of list) {
        if (client.url.includes('/ecuador') && 'focus' in client) {
          client.focus(); client.navigate(url); return;
        }
      }
      if (clients.openWindow) clients.openWindow(url);
    })
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  if (!e.request.url.startsWith(self.location.origin)) return;
  if (e.request.url.includes('firebasedatabase') ||
      e.request.url.includes('firebaseio') ||
      e.request.url.includes('cloudinary') ||
      e.request.url.includes('googleapis') ||
      e.request.url.includes('gstatic')) return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      return fetch(e.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          caches.open(CACHE_NAME).then(c => c.put(e.request, response.clone()));
        }
        return response;
      }).catch(() => cached);
    })
  );
});
