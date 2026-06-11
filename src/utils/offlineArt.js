/**
 * Offline art sleeves — no card pictures while offline, ever.
 *
 * Two jobs:
 *  1. `sleeveDataUri(label)` renders a self-contained SVG "card sleeve" —
 *     a per-card pastel hue, a background pattern, a tilted monogram
 *     sticker, the card's name, and a bit of flavor copy — all derived
 *     deterministically from the label, so the same card always wears
 *     the same sleeve. The landing showcase uses these as its card art.
 *  2. `installOfflineArtFallback()` enforces the offline rule: while the
 *     app is offline, EVERY cross-origin <img> (card scans, set logos,
 *     set symbols — even ones the service worker has cached) swaps its
 *     src to a sleeve; everything swaps back the moment we're online.
 *     Swapping src instead of replacing the node keeps Vue's virtual
 *     DOM happy and makes restore trivial.
 *
 * Why pictures stay out of offline mode entirely: offline browsing
 * renders only Rarebox-original art + card text, so the cached scans
 * are nothing more than a transient browser cache, never a feature.
 */

const PATTERNS = ['dots', 'stripes', 'cross', 'checker']
const NOTES = [
  "art's at home",
  'face-down until online',
  'in another binder',
  'sleeved for travel',
  'gone to grade',
  'napping in the deck box',
  'mid-shuffle',
  'left in the trade folder',
]

// FNV-1a — tiny, stable, good spread for short strings
function hash(str) {
  let h = 0x811c9dc5
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function esc(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// Split a name into at most two visual lines near the middle
function splitName(name) {
  if (name.length <= 15) return [name]
  const mid = Math.floor(name.length / 2)
  let best = -1
  for (let i = 0; i < name.length; i++) {
    if (name[i] === ' ' && (best === -1 || Math.abs(i - mid) < Math.abs(best - mid))) best = i
  }
  if (best === -1) return [name.slice(0, 16) + '…']
  const a = name.slice(0, best), b = name.slice(best + 1)
  return [a.length > 17 ? a.slice(0, 16) + '…' : a, b.length > 17 ? b.slice(0, 16) + '…' : b]
}

function patternDef(kind, ink) {
  switch (kind) {
    case 'dots':
      return `<pattern id="p" width="11" height="11" patternUnits="userSpaceOnUse"><circle cx="5.5" cy="5.5" r="1.2" fill="${ink}"/></pattern>`
    case 'stripes':
      return `<pattern id="p" width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2" height="9" fill="${ink}"/></pattern>`
    case 'cross':
      return `<pattern id="p" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="1" height="8" fill="${ink}"/><rect width="8" height="1" fill="${ink}"/></pattern>`
    default: // checker
      return `<pattern id="p" width="14" height="14" patternUnits="userSpaceOnUse"><rect width="7" height="7" fill="${ink}"/><rect x="7" y="7" width="7" height="7" fill="${ink}"/></pattern>`
  }
}

export function sleeveDataUri(label) {
  const name = label || 'Card'
  const h = hash(name)
  const hue = h % 360
  const pattern = PATTERNS[(h >>> 9) % PATTERNS.length]
  const note = NOTES[(h >>> 13) % NOTES.length]
  const tilt = ((h >>> 17) % 9) - 4
  const initial = (name.match(/[\p{L}\p{N}]/u) || ['?'])[0].toUpperCase()
  const dark = typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark'

  const bg = dark ? `hsl(${hue} 25% 20%)` : `hsl(${hue} 50% 91%)`
  const pat = dark ? `hsl(${hue} 22% 30%)` : `hsl(${hue} 35% 72%)`
  const pop = dark ? `hsl(${hue} 35% 32%)` : `hsl(${hue} 65% 82%)`
  const text = dark ? `hsl(${hue} 45% 85%)` : `hsl(${hue} 45% 24%)`
  const border = dark ? '#f5efe2' : '#141414'

  const lines = splitName(name)
  const nameSvg = lines
    .map((l, i) => `<text x="63" y="${118 + i * 13}" text-anchor="middle" font-size="10.5" font-weight="800" fill="${text}" font-family="system-ui, sans-serif">${esc(l)}</text>`)
    .join('')

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 126 176">` +
    `<defs>${patternDef(pattern, pat)}</defs>` +
    `<rect x="1.5" y="1.5" width="123" height="173" rx="10" fill="${bg}" stroke="${border}" stroke-width="3"/>` +
    `<rect x="3" y="3" width="120" height="170" rx="9" fill="url(#p)"/>` +
    `<g transform="rotate(${tilt} 63 70)">` +
    `<circle cx="63" cy="70" r="23" fill="${pop}" stroke="${border}" stroke-width="2.5"/>` +
    `<text x="63" y="78" text-anchor="middle" font-size="24" font-weight="900" fill="${text}" font-family="system-ui, sans-serif">${esc(initial)}</text>` +
    `</g>` +
    nameSvg +
    `<text x="63" y="${lines.length > 1 ? 158 : 150}" text-anchor="middle" font-size="8" font-style="italic" fill="${text}" opacity="0.65" font-family="system-ui, sans-serif">${esc(note)}</text>` +
    `</svg>`
  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}

// ── Offline enforcement ────────────────────────────────────────────────

const _swapped = new Set()

function toSleeve(img) {
  const src = img.currentSrc || img.src
  if (!src || src.startsWith('data:')) return
  let origin
  try { origin = new URL(src, location.href).origin } catch { return }
  if (origin === location.origin) return // app assets keep working offline
  if (!img.dataset.oaSrc) img.dataset.oaSrc = img.src
  img.src = sleeveDataUri(img.alt || 'Card')
  _swapped.add(img)
}

function sweep() {
  for (const img of Array.from(document.images)) toSleeve(img)
}

function restore() {
  for (const img of _swapped) {
    if (img.dataset.oaSrc) {
      img.src = img.dataset.oaSrc
      delete img.dataset.oaSrc
    }
  }
  _swapped.clear()
}

export function installOfflineArtFallback() {
  // Capture phase: load/error don't bubble, but capture still visits
  // document first — one pair of listeners covers every img, present
  // and future, with no per-view wiring. Covers SW-cached images too:
  // they load fine offline, and the load event swaps them anyway.
  const onImgEvent = (e) => {
    if (!(e.target instanceof HTMLImageElement)) return
    if (navigator.onLine) return
    toSleeve(e.target)
  }
  document.addEventListener('load', onImgEvent, true)
  document.addEventListener('error', onImgEvent, true)
  window.addEventListener('offline', sweep)
  window.addEventListener('online', restore)
  if (!navigator.onLine) sweep()
}
