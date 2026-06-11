/**
 * Offline image packs — download every card image for selected games so
 * Browse/Search/Shelf are fully visual offline.
 *
 * Approach (researched against the alternatives):
 *  - Images come straight from each game's own CDN (the same URLs the app
 *    renders), so there's no rehosting of copyrighted scans, no extra
 *    infrastructure, and the cache key matches what <img> tags request.
 *    (GitHub-repo hosting was considered and rejected: multi-GB image
 *    repos violate GitHub's "not a CDN" policy, jsDelivr caps file/repo
 *    sizes, and base64 would inflate everything by 33%.)
 *  - Storage is the real enemy — pokemontcg.io "small" scans are ~160KB
 *    PNGs — so each image is RE-ENCODED on-device to WebP (JPEG where the
 *    browser can't encode WebP) before caching. That cuts a full Pokémon
 *    pack from ~3.2GB to roughly 450MB. Already-efficient JPGs under
 *    30KB are stored as-is.
 *  - Downloads run 5-at-a-time against CDNs (static files, not rate-
 *    limited APIs), are abortable, and resume for free: anything already
 *    in the cache is skipped on the next run.
 *  - Everything lands in the dedicated 'rarebox-img-bulk' cache. The
 *    service worker's image handler does a global caches.match(), so
 *    cached cards serve offline with zero extra wiring — and this cache
 *    is never trimmed, unlike the browse-as-you-go image cache.
 */
import { reactive } from 'vue'
import { getGameCards, getCardCounts, getTcgPrefs } from '../services/tcg/cardCache'

export const BULK_CACHE = 'rarebox-img-bulk'
const CONCURRENCY = 5
const TRANSCODE_MAX_BYTES = 30_000 // smaller than this → store as-is
const TRANSCODE_QUALITY = 0.72

/** Per-game average stored KB per image, measured (post-transcode). */
export const GAME_IMG_KB = {
  pokemon: 18, mtg: 16, yugioh: 22, lorcana: 22, 'one-piece': 35, riftbound: 60, // pokemon/mtg measured live (transcoded)
}
export const GAME_NAMES = {
  pokemon: 'Pokémon', mtg: 'Magic', yugioh: 'Yu-Gi-Oh!', lorcana: 'Lorcana',
  'one-piece': 'One Piece', riftbound: 'Riftbound',
}

/** Reactive download state — drives the Settings section and the mini pill. */
export const offlineImagesState = reactive({
  running: false,
  game: '',
  done: 0,
  total: 0,
  skipped: 0,
  failed: 0,
  bytes: 0,
  finishedAt: null,
})

let _abort = null

// Hosts that send no CORS header — the browser can't read (or re-encode)
// their bytes directly, so bulk downloads for these route through the
// allowlisted /api/img relay. Normal browsing still hits the CDN directly.
const NEEDS_PROXY = new Set([
  'images.ygoprodeck.com', 'cards.lorcast.io', 'optcgapi.com', 'cmsassets.rgpub.io',
])
function fetchUrlFor(url) {
  try {
    return NEEDS_PROXY.has(new URL(url).host) ? '/api/img?u=' + encodeURIComponent(url) : url
  } catch { return url }
}

export function fmtBytes(b) {
  if (b >= 1e9) return (b / 1e9).toFixed(1) + ' GB'
  if (b >= 1e6) return Math.round(b / 1e6) + ' MB'
  return Math.round(b / 1e3) + ' KB'
}

/** Size + count estimate for the warning copy, from the REAL local DB. */
export async function estimateGames() {
  const counts = await getCardCounts()
  const prefs = getTcgPrefs() || []
  return Object.entries(counts)
    .filter(([g, n]) => g !== 'total' && GAME_NAMES[g] && n > 0)
    .map(([g, n]) => ({
      game: g,
      name: GAME_NAMES[g] || g,
      count: n,
      bytes: n * (GAME_IMG_KB[g] || 25) * 1024,
      selected: prefs.includes(g),
    }))
}

async function transcode(blob) {
  // Re-encode to WebP (or JPEG on browsers that can't encode WebP —
  // canvas.toBlob silently falls back to PNG, so verify the result type).
  try {
    const bmp = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = bmp.width
    canvas.height = bmp.height
    const ctx = canvas.getContext('2d')
    ctx.drawImage(bmp, 0, 0)
    bmp.close()
    let out = await new Promise(r => canvas.toBlob(r, 'image/webp', TRANSCODE_QUALITY))
    if (!out || out.type !== 'image/webp') {
      out = await new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.8))
    }
    return out && out.size < blob.size ? out : blob
  } catch {
    return blob // CORS-tainted or undecodable — keep the original
  }
}

export async function downloadOfflineImages(games) {
  if (offlineImagesState.running) return
  const ac = new AbortController()
  _abort = ac
  const st = offlineImagesState
  st.running = true
  st.done = 0; st.skipped = 0; st.failed = 0; st.bytes = 0; st.finishedAt = null

  try {
    const cache = await caches.open(BULK_CACHE)

    // Collect work first so the pill can show a true total
    const work = []
    for (const game of games) {
      const cards = await getGameCards(game)
      for (const c of cards) {
        if (c.image) work.push({ game, url: c.image })
      }
    }
    st.total = work.length

    const queue = work.slice()
    async function worker() {
      while (queue.length && !ac.signal.aborted) {
        const { game, url } = queue.shift()
        st.game = game
        try {
          if (await cache.match(url)) { st.skipped++; st.done++; continue }
          const resp = await fetch(fetchUrlFor(url), { mode: 'cors', signal: ac.signal })
          if (!resp.ok) throw new Error('http ' + resp.status)
          let blob = await resp.blob()
          if (blob.size > TRANSCODE_MAX_BYTES) blob = await transcode(blob)
          await cache.put(url, new Response(blob, {
            headers: { 'Content-Type': blob.type || 'image/webp', 'Content-Length': String(blob.size) },
          }))
          st.bytes += blob.size
        } catch (e) {
          if (ac.signal.aborted) return
          st.failed++
        }
        st.done++
      }
    }
    await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  } finally {
    st.running = false
    st.game = ''
    st.finishedAt = Date.now()
    _abort = null
  }
}

export function stopOfflineImages() {
  _abort?.abort()
}

/** How much the bulk cache currently holds (entries; bytes via estimate()). */
export async function bulkCacheCount() {
  try {
    const cache = await caches.open(BULK_CACHE)
    return (await cache.keys()).length
  } catch { return 0 }
}

export async function clearBulkCache() {
  try { await caches.delete(BULK_CACHE) } catch { /* nothing to clear */ }
}
