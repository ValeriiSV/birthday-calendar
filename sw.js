const CACHE = "birthday-calendar-v5";
const ASSETS = ["./", "./index.html", "./styles.css", "./glass.css", "./auth-ai.css", "./wow.css", "./app.js", "./firebase-config.js", "./firebase-init.js", "./ai-features.js", "./wow-features.js", "./i18n.js", "./install.js", "./manifest.webmanifest", "./icon.svg"];

self.addEventListener("install", event => event.waitUntil(
  caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())
));

self.addEventListener("activate", event => event.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())
));

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy)));
    return response;
  }).catch(() => caches.match(event.request).then(hit => hit || caches.match("./index.html"))));
});
