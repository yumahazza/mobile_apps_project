/* eslint-disable no-undef */
// Service Worker untuk Firebase Cloud Messaging (Web Push)
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyDYnqTKZApWwiU4iDPQAufUk_ko0YIxHEQ',
  authDomain: 'ppk-praktikum-2a6ab.firebaseapp.com',
  projectId: 'ppk-praktikum-2a6ab',
  storageBucket: 'ppk-praktikum-2a6ab.firebasestorage.app',
  messagingSenderId: '164607713769',
  appId: '1:164607713769:android:ad2820d2fa053d5c9eab78',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const notificationTitle = payload.notification?.title || payload.data?.title || 'Notifikasi Praktikum';
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || 'Pembaruan baru terkait sesi praktikum Anda.',
    icon: '/assets/images/icon.png',
    data: payload.data,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
