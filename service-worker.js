// Caching essential files during service worker installation
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open("hobby-cache").then((cache) => {
            return cache.addAll([
                "/",
                "/docs/index.html",
                "/css/style.css",
                "/js/core.js",
                "/img/hobby-icon.png",
                "/docs/profile.html", // Optional: cache other pages
                "/js/register.js",  // Optional: cache JavaScript files
                "/js/login.js"       // Optional: cache JavaScript files
            ]);
        })
    );
});

// Fetch event to serve cached content when offline
self.addEventListener("fetch", (event) => {
    event.respondWith(
        caches.match(event.request).then((response) => {
            // If the requested file is in cache, serve it; otherwise, fetch from network
            return response || fetch(event.request);
        })
    );
});
