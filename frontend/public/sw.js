// Minimal service worker — enables PWA install + a basic offline fallback.
// Network-first: online users always get fresh content; cache is only a fallback.
const CACHE = 'movora-shell-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET' || req.mode !== 'navigate') return
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((c) => c.put('/__shell', copy)).catch(() => {})
        return res
      })
      .catch(() => caches.match('/__shell').then((r) => r || Response.error()))
  )
})
