const CACHE_PREFIX = "darkvell-";
const SW_BUILD = "20260705-noop-online";

async function clearDarkvellCaches() {
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key.startsWith(CACHE_PREFIX)).map((key) => caches.delete(key)));
}

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(clearDarkvellCaches());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    clearDarkvellCaches()
      .then(() => self.clients.claim())
  );
});
