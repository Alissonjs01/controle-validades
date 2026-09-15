const CACHE_NAME = "controle-validades-glass-v3";
const APP_SHELL = [
  "/",
  "/manifest.webmanifest",
  "/icons/pwa-icon.svg",
  "/icons/pwa-icon-192.png",
  "/icons/pwa-icon-512.png",
  "/icons/maskable-icon-512.png",
  "/icons/apple-touch-icon.png",
  "/images/glass-calendar.webp",
  "/icons/validda-mark.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && ["/images/glass-calendar.webp", "/icons/validda-mark.svg"].includes(url.pathname)) {
    event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
    return;
  }
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request).catch(() => caches.match("/"))
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const client = clients.find((item) => "focus" in item);

        if (client) {
          return client.focus();
        }

        return self.clients.openWindow("/");
      })
  );
});

self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data?.json() ?? {}; } catch { /* Always show a notification. */ }
  event.waitUntil(self.registration.showNotification(payload.title || "ValiddA", {
    body: payload.body || "Confira os lotes que exigem atenção.",
    tag: payload.tag || "expiry-alert",
    icon: "/icons/pwa-icon-192.png",
    badge: "/icons/pwa-icon-192.png",
    data: { url: "/" }
  }));
});
