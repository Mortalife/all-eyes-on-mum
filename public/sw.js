// Service worker: makes the app installable. Served from /sw.js so its scope covers the whole site.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

// Shows a notification when the server sends a push message
self.addEventListener("push", (event) => {
  const { title, body, url } = event.data.json();
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/dist/icon-192.png",
      data: { url },
    }),
  );
});

// Opens the notification's link when it is tapped
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data.url));
});
