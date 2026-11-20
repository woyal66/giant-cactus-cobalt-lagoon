/* ReefPilot watch worker — notifications only. Does not cache the app. */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const open = clients[0];
      if (open) return open.focus();
      return self.clients.openWindow("/");
    }),
  );
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || typeof data !== "object") return;
  if (data.type === "show") {
    event.waitUntil(
      self.registration.showNotification(String(data.title || "ReefPilot"), {
        body: String(data.body || ""),
        tag: "reefpilot-watch",
        renotify: true,
        requireInteraction: true,
        silent: false,
        vibrate: [240, 80, 240, 80, 480],
      }),
    );
  }
  if (data.type === "clear") {
    event.waitUntil(
      self.registration.getNotifications({ tag: "reefpilot-watch" }).then((list) => {
        for (const n of list) n.close();
      }),
    );
  }
});
