/* =====================================================================
   KAGEBANA — sw.js (service worker)
   Makes the game work offline once it has been opened online.
   - Game files: try the network first (so updates arrive), fall back to
     the saved copy when offline or the network is slow.
   - Fonts (Google Fonts): use the saved copy first; they never change.
   On install it reads index.html and saves every script, style and icon
   it links, so there is no file list to keep up to date here.
   ===================================================================== */
const CACHE = 'kagebana-v1';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const EXTRA = ['manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const res = await fetch('./', { cache: 'no-store' });
    const html = await res.clone().text();
    await cache.put('./', res);
    const urls = new Set(EXTRA);
    for (const m of html.matchAll(/(?:src|href)="([^"#]+\.(?:js|css)(?:\?[^"]*)?)"/g)) if (!/^https?:/.test(m[1])) urls.add(m[1]);
    await Promise.all([...urls].map(u => cache.add(new Request(u, { cache: 'no-store' })).catch(() => {})));
    // The Google Fonts stylesheet: the page loaded it before this worker existed, so save it now.
    for (const m of html.matchAll(/<link[^>]+href="(https:\/\/fonts\.googleapis\.com\/[^"]+)"[^>]*rel="stylesheet"|<link[^>]+rel="stylesheet"[^>]+href="(https:\/\/fonts\.googleapis\.com\/[^"]+)"/g)) {
      const u = (m[1] || m[2]).replace(/&amp;/g, '&');
      await fetch(u).then(r => { if (r.ok) return cache.put(u, r); }).catch(() => {});
    }
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

/* Saves a fresh copy and drops older versions of the same file (style.css?v=9 once ?v=10 is saved). */
async function store(req, res) {
  if (!res || !(res.ok || res.type === 'opaque')) return;
  const cache = await caches.open(CACHE);
  await cache.put(req, res);
  const url = new URL(req.url);
  if (url.search) for (const k of await cache.keys()) { const u = new URL(k.url); if (u.origin === url.origin && u.pathname === url.pathname && u.search !== url.search) await cache.delete(k); }
}
const cached = async (req, loose) => (await caches.match(req)) || (loose ? caches.match(req, { ignoreSearch: true }) : undefined);

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (FONT_HOSTS.includes(url.hostname)) {
    e.respondWith((async () => (await cached(req)) || fetch(req).then(res => { e.waitUntil(store(req, res.clone())); return res; }))());
    return;
  }
  if (url.origin !== location.origin) return;
  e.respondWith((async () => {
    // A page load asks for the folder or index.html: both are the same saved page.
    const key = req.mode === 'navigate' ? new Request('./') : req;
    const net = fetch(req).then(res => { e.waitUntil(store(key, res.clone())); return res; });
    net.catch(() => {}); // handled below; this just stops an "unhandled" warning when the saved copy wins
    try {
      // Give the network 3 seconds, then use the saved copy if there is one.
      const first = await Promise.race([net, new Promise(r => setTimeout(r, 3000, null))]);
      if (first) return first;
      return (await cached(key, true)) || net;
    } catch (err) {
      const hit = await cached(key, true);
      if (hit) return hit;
      throw err;
    }
  })());
});
