/**
 * Offline art sleeves — global image-error fallback.
 *
 * Card images that fail to load WHILE OFFLINE swap to a "sleeved card":
 * a Tactile mat with a per-card pastel hue, a background pattern, and a
 * big monogram sticker — all derived deterministically from the card's
 * name, so the same card always wears the same sleeve. An uncached
 * shelf reads as a wall of deliberate alternate art, not a broken grid.
 * Online failures keep each view's own @error behavior (usually hide) —
 * a genuinely missing image is not an offline problem.
 *
 * Uses a capture-phase listener on document, so it covers every <img>
 * in every view, present and future, with no per-view wiring. The
 * placeholder inherits the image's classes AND data-v-* attributes so
 * scoped component CSS (sizing, radius, grid placement) still applies.
 */

const PATTERNS = ['oa-dots', 'oa-stripes', 'oa-cross', 'oa-checker']
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

export function installOfflineArtFallback() {
  document.addEventListener(
    'error',
    (e) => {
      const img = e.target
      if (!(img instanceof HTMLImageElement)) return
      if (navigator.onLine) return
      if (img.dataset.offlinePh) return
      img.dataset.offlinePh = '1'

      const label = img.alt || 'Card'
      const h = hash(label)
      const hue = h % 360
      const pattern = PATTERNS[(h >>> 9) % PATTERNS.length]
      const note = NOTES[(h >>> 13) % NOTES.length]
      const tilt = ((h >>> 17) % 9) - 4 // -4..4deg sticker tilt
      // First letter or digit — "Mega Charizard X ex" → M, "025/198" → 0
      const initial = (label.match(/[\p{L}\p{N}]/u) || ['?'])[0].toUpperCase()

      const ph = document.createElement('div')
      ph.className = (img.className ? img.className + ' ' : '') + 'offline-art ' + pattern
      for (const attr of img.attributes) {
        if (attr.name.startsWith('data-v-')) ph.setAttribute(attr.name, attr.value)
      }
      ph.style.setProperty('--oa-h', hue)
      ph.style.setProperty('--oa-tilt', tilt + 'deg')

      const mono = document.createElement('span')
      mono.className = 'offline-art-mono'
      mono.textContent = initial
      const name = document.createElement('span')
      name.className = 'offline-art-name'
      name.textContent = label
      const noteEl = document.createElement('span')
      noteEl.className = 'offline-art-note'
      noteEl.textContent = note
      ph.append(mono, name, noteEl)
      img.replaceWith(ph)
    },
    true
  )
}
