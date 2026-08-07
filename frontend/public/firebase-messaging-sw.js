// Import Firebase Scripts for Service Worker (compat versions are required inside service workers)
importScripts("https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js");

// Parse Firebase config from registration URL query parameters
const params = new URLSearchParams(location.search);
const firebaseConfig = {
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  storageBucket: params.get("storageBucket"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
};

// Check if we received valid parameters before initializing
if (firebaseConfig.apiKey && firebaseConfig.messagingSenderId) {
  // Initialize Firebase app in Service Worker context
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  // Handle messages in the background (when tab is closed or minimized)
  messaging.onBackgroundMessage((payload) => {
    console.log("[firebase-messaging-sw.js] Background message received: ", payload);
    
    const notificationTitle = payload.notification?.title || "New Push Notification";
    const notificationOptions = {
      body: payload.notification?.body || "",
      icon: "/vite.svg", // standard icon placeholder
      data: payload.data,
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} else {
  console.warn("[firebase-messaging-sw.js] Service worker registered but missing configuration parameters.");
}
