const CACHE_NAME = "hobbyme-v1";

const FILES_TO_CACHE = [
  "index.html",
  "signUp.html",
  "login.html",
  "results.html",
  "settings.html",
  "saved.html",
  "accountSettings.html",
  "css/style.css",
  "js/core.js",
  "js/search.js",
  "img/default.jpg",
  "manifest.json"
];

// Install SW
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );
});

// Activate (clean old caches)
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );
});

// Fetch fallback
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      // Serve from cache OR fetch new
      return (
        response ||
        fetch(event.request).catch(() =>
          caches.match("index.html") // fallback when fully offline
        )
      );
    })
  );
});

