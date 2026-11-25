// Service worker: jogo offline + cache das imagens das cartas
const APP = 'wlcg-app-v15';
const IMG = 'wlcg-img-v1';
const SHELL = ['./', './index.html', './manifest.json', './icons/icon-32.png?v=3', './icons/icon-180.png?v=3', './icons/icon-192.png?v=3', './icons/icon-512.png?v=3'];
const IMG_HOSTS = ['thronesdb.com', 'theironthrone.net', 'lcg-cdn.fantasyflightgames.com'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(APP).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('wlcg-app-') && k !== APP).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

async function fetchImage(req) {
  const cache = await caches.open(IMG);
  const hit = await cache.match(req.url, { ignoreVary: true });
  if (hit) return hit;
  let res;
  try { res = await fetch(req.url, { mode: 'cors', credentials: 'omit' }); if (!res.ok) throw new Error(res.status); }
  catch (e) { res = await fetch(req.url, { mode: 'no-cors', credentials: 'omit' }); }
  if (res.ok || res.type === 'opaque') cache.put(req.url, res.clone()).catch(() => { });
  return res;
}
async function networkFirst(req) {
  const cache = await caches.open(APP);
  try {
    const res = await fetch(req);
    if (res.ok && req.method === 'GET') cache.put(req, res.clone()).catch(() => { });
    return res;
  } catch (e) {
    const hit = await cache.match(req, { ignoreSearch: req.mode === 'navigate' }) || (req.mode === 'navigate' ? await cache.match('./index.html') : null);
    if (hit) return hit;
    throw e;
  }
}
async function staleWhileRevalidate(req) {
  const cache = await caches.open(APP);
  const hit = await cache.match(req);
  const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') cache.put(req, res.clone()).catch(() => { }); return res; }).catch(() => hit);
  return hit || net;
}
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (IMG_HOSTS.includes(url.hostname) && /\.(png|jpe?g|webp)$/i.test(url.pathname)) { e.respondWith(fetchImage(req)); return; }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') { e.respondWith(staleWhileRevalidate(req)); return; }
  if (url.origin === self.location.origin) { e.respondWith(networkFirst(req)); return; }
});
