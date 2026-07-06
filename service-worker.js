/* OMW LabRepair — Service Worker
   Strategi: network-first for egne filer (appen er altid frisk når nettet er der),
   cache som fallback (appen åbner også offline med sidste kendte version).
   Supabase- og CDN-kald røres IKKE (kun same-origin GET håndteres). */

const VERSION = "2.3.0";
const CACHE = "omw-" + VERSION;

const PRECACHE = [
  "./",
  "./index.html",
  "./style.css?v=" + VERSION,
  "./config.js?v=" + VERSION,
  "./data.js?v=" + VERSION,
  "./supabaseClient.js?v=" + VERSION,
  "./ui.js?v=" + VERSION,
  "./print.js?v=" + VERSION,
  "./dashboard.js?v=" + VERSION,
  "./app.js?v=" + VERSION,
  "./als-logo.svg?v=" + VERSION,
  "./als-logo.png",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache =>
      // addAll fejler alt hvis én fil fejler — tilføj enkeltvis og tolerér mangler
      Promise.allSettled(PRECACHE.map(url => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase/CDN/fonts: rør ikke

  // Navigation: netværk først, ellers cachet index (offline-start)
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(res => { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return res; })
        .catch(() => caches.match(req).then(hit => hit || caches.match("./index.html")))
    );
    return;
  }

  // Statiske filer: netværk først, cache-fallback
  event.respondWith(
    fetch(req)
      .then(res => {
        if (res && res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
        return res;
      })
      .catch(() => caches.match(req).then(hit => hit || caches.match(req, { ignoreSearch: true })))
  );
});
