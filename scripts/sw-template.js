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

const META = 'rarebox-meta'

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(SHELL)
    // Tolerant precache: addAll is atomic, so ONE 404 (deploy skew, an
    // ad-blocked file) would block the new SW from ever installing.
    // Fetch each file individually; only the app itself is critical.
    const results = await Promise.allSettled(PRECACHE.map((u) => c.add(u)))
    const failedCritical = PRECACHE.filter((u, i) =>
      results[i].status === 'rejected' && (u === '/' || u === '/index.html' || u.startsWith('/assets/'))
    )
    if (failedCritical.length) throw new Error('precache failed: ' + failedCritical.join(','))
    // Record this shell generation so activate can keep the previous one
    const meta = await caches.open(META)
    await meta.put('/shells/' + SHELL, new Response(String(Date.now())))
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // Keep the current shell AND the most recent previous one: skipWaiting
    // + claim means tabs running the previous build are still alive, and
    // their lazy-loaded route chunks only exist in the previous shell cache
    // (the server already replaced them). One spare generation keeps those
    // tabs working; vite:preloadError in the app reloads as a last resort.
    const meta = await caches.open(META)
    const shellEntries = []
    for (const req of await meta.keys()) {
      const url = new URL(req.url)
      if (!url.pathname.startsWith('/shells/')) continue
      const name = url.pathname.slice('/shells/'.length)
      const ts = Number(await (await meta.match(req)).text()) || 0
      shellEntries.push({ name, ts, req })
    }
    shellEntries.sort((a, b) => b.ts - a.ts)
    const keepShells = new Set([SHELL, ...shellEntries.slice(0, 2).map(s => s.name)])
    for (const s of shellEntries) {
      if (!keepShells.has(s.name)) await meta.delete(s.req)
    }
    const keys = await caches.keys()
    await Promise.all(
      keys
        .filter((k) => k.startsWith('rarebox-') && k !== RUNTIME && k !== IMAGES && k !== META && !keepShells.has(k))
        .map((k) => caches.delete(k))
    )
    await self.clients.claim()
  })())
})

async function cacheFirst(req, cacheName) {
  const hit = await caches.match(req)
  if (hit) return hit
  const resp = await fetch(req)
  // Only full 200s: Safari video Range requests yield 206, which
  // cache.put rejects (unhandled) — and would poison playback anyway
  if (resp.status === 200) {
    const cache = await caches.open(cacheName)
    cache.put(req, resp.clone()).catch(() => {})
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
      // Only conclude "host blocks CORS" while online — a radio drop or
      // DNS blip would otherwise stop caching that host for the SW's life
      if (self.navigator.onLine) noCorsHosts.add(host)
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
