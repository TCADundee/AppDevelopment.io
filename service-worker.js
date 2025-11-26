const CACHE_NAME = "hobbyme-v3";

const FILES_TO_CACHE = [
  "./",
  "index.html",
  "signUp.html",
  "login.html",
  "results.html",
  "settings.html",
  "saved.html",
  "accountSettings.html",
  "profile.html",

  "manifest.json",

  "css/style.css",

  "js/core.js",
  "js/search.js",
  "js/register.js",
  "js/login.js",
  "img/default.jpg",
  "img/icon-192.png",
  "img/icon-512.png"
];

// Install SW
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(FILES_TO_CACHE)
    )
  );
  self.skipWaiting();
});

// Activate (clean old caches)
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Cache-first strategy
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(cached => {
      return (
        cached ||
        fetch(event.request).catch(() => {
          // If offline and requesting HTML → show homepage
          if (event.request.destination === "document") {
            return caches.match("index.html");
          }
        })
      );
    })
  );
});

