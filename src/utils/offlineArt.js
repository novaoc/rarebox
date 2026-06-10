/**
 * Offline art placeholder — global image-error fallback.
 *
 * Card images that fail to load WHILE OFFLINE swap to a Tactile
 * placeholder mat (card name + "art's at home") instead of vanishing,
 * so an uncached shelf or search result reads as deliberately
 * text-only rather than broken. Online failures keep each view's own
 * @error behavior (usually hide) — a genuinely missing image is not
 * an offline problem.
 *
 * Uses a capture-phase listener on document, so it covers every <img>
 * in every view, present and future, with no per-view wiring. The
 * placeholder inherits the image's classes AND data-v-* attributes so
 * scoped component CSS (sizing, radius, grid placement) still applies.
 */
export function installOfflineArtFallback() {
  document.addEventListener(
    'error',
    (e) => {
      const img = e.target
      if (!(img instanceof HTMLImageElement)) return
      if (navigator.onLine) return
      if (img.dataset.offlinePh) return
      img.dataset.offlinePh = '1'

      const ph = document.createElement('div')
      ph.className = img.className ? img.className + ' offline-art' : 'offline-art'
      for (const attr of img.attributes) {
        if (attr.name.startsWith('data-v-')) ph.setAttribute(attr.name, attr.value)
      }
      const icon = document.createElement('span')
      icon.className = 'offline-art-icon'
      icon.textContent = '📡'
      const name = document.createElement('span')
      name.className = 'offline-art-name'
      name.textContent = img.alt || 'Card'
      const note = document.createElement('span')
      note.className = 'offline-art-note'
      note.textContent = "art's at home"
      ph.append(icon, name, note)
      img.replaceWith(ph)
    },
    true
  )
}
