// Service worker: makes the app installable. Served from /sw.js so its scope covers the whole site.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
