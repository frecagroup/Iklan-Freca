/* Freca Ads — service worker
 * - Aset statis (_next/static, ikon, logo): cache-first.
 * - Halaman (navigasi): network-first, fallback ke cache bila offline.
 * - Request ke Supabase / domain lain TIDAK pernah di-cache (data selalu segar).
 */
const VERSION = 'freca-ads-v1'
const STATIC_CACHE = `${VERSION}-static`
const PAGE_CACHE = `${VERSION}-pages`
const PRECACHE = ['/manifest.json', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png', '/logofreca.png']

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return // Supabase dll: langsung ke jaringan

  const isStatic =
    url.pathname.startsWith('/_next/static/') || /\.(png|ico|svg|woff2?)$/.test(url.pathname)

  if (isStatic) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(STATIC_CACHE).then((c) => c.put(req, copy))
            }
            return res
          }),
      ),
    )
    return
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // jangan cache redirect ke /login
          if (res.ok && !res.redirected) {
            const copy = res.clone()
            caches.open(PAGE_CACHE).then((c) => c.put(req, copy))
          }
          return res
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match('/'))),
    )
  }
})
