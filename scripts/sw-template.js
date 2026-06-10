/**
 * Rarebox service worker — generated at build time (see vite.config.js).
 *
 * Strategy:
 *  - App shell (index.html + hashed /assets/*) is precached at install, so
 *    the app opens and navigates fully offline. Your collection lives in
 *    IndexedDB and never needed the network in the first place.
 *  - Navigations are network-first (fresh deploys win) with the cached
 *    shell as the offline fallback.
 *  - Tour videos and scan indexes cache on first use (cache-first after).
 *  - Cross-origin card images cache as you view them. We re-request with
 *    CORS where the CDN allows it — opaque responses are skipped because
 *    browsers charge them ~7 MB of quota padding each.
 *  - Price / search API calls are never intercepted: live data stays live,
 *    and the app handles being offline at the UI layer.
 */

const VERSION = '__VERSION__'
const SHELL = 'rarebox-shell-' + VERSION
const RUNTIME = 'rarebox-runtime-v1'
const IMAGES = 'rarebox-img-v1'
const PRECACHE = __PRECACHE__

const IMG_MAX_ENTRIES = 1500
const noCorsHosts = new Set() // hosts that rejected a CORS fetch this session

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('rarebox-') && ![SHELL, RUNTIME, IMAGES].includes(k))
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

async function cacheFirst(req, cacheName) {
  const hit = await caches.match(req)
  if (hit) return hit
  const resp = await fetch(req)
  if (resp.ok) {
    const cache = await caches.open(cacheName)
    cache.put(req, resp.clone())
  }
  return resp
}

async function navigationHandler(req) {
  try {
    const resp = await fetch(req)
    if (resp.ok) {
      const cache = await caches.open(SHELL)
      cache.put('/index.html', resp.clone())
    }
    return resp
  } catch {
    const shell = await caches.match('/index.html')
    if (shell) return shell
    throw new Error('offline, no cached shell')
  }
}

async function trimCache(cacheName, max) {
  const cache = await caches.open(cacheName)
  const keys = await cache.keys()
  for (let i = 0; i < keys.length - max; i++) cache.delete(keys[i])
}

async function imageHandler(req) {
  const hit = await caches.match(req.url, { ignoreVary: true })
  if (hit) return hit
  const host = new URL(req.url).host
  if (!noCorsHosts.has(host)) {
    try {
      const resp = await fetch(req.url, { mode: 'cors' })
      if (resp.ok) {
        const cache = await caches.open(IMAGES)
        await cache.put(req.url, resp.clone())
        trimCache(IMAGES, IMG_MAX_ENTRIES)
        return resp
      }
    } catch {
      noCorsHosts.add(host)
    }
  }
  return fetch(req) // no-CORS fallback, served but not cached
}

self.addEventListener('fetch', (e) => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  if (url.origin === self.location.origin) {
    if (req.mode === 'navigate') {
      e.respondWith(navigationHandler(req))
    } else if (url.pathname.startsWith('/assets/')) {
      e.respondWith(cacheFirst(req, SHELL)) // hashed → immutable
    } else if (url.pathname.startsWith('/videos/') || url.pathname.startsWith('/scan-index/')) {
      e.respondWith(cacheFirst(req, RUNTIME))
    } else if (PRECACHE.includes(url.pathname)) {
      e.respondWith(cacheFirst(req, SHELL))
    }
    // anything else same-origin (e.g. /api/og) → network, untouched
  } else if (req.destination === 'image') {
    e.respondWith(imageHandler(req))
  }
  // cross-origin non-image (price APIs, card DBs) → network, untouched
})
