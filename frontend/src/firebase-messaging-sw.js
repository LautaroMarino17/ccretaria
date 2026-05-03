importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyCZxLOw3Q6neX-aq3CeX9201rwMzh7IL10',
  authDomain: 'ccretria.firebaseapp.com',
  projectId: 'ccretria',
  storageBucket: 'ccretria.firebasestorage.app',
  messagingSenderId: '810156508737',
  appId: '1:810156508737:web:8fdd8deb17ce731e4828c0'
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const title = payload.notification?.title ?? 'SecretarIA';
  const body  = payload.notification?.body  ?? '';
  self.registration.showNotification(title, {
    body,
    icon: '/icons/icon.svg',
    badge: '/icons/icon.svg',
    tag: 'secretaria-daily',
    renotify: true,
  });
});

// Mínimo fetch handler requerido para el install prompt de PWA
self.addEventListener('fetch', () => {});
