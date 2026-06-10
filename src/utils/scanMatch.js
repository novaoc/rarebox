/**
 * Card identification by perceptual-hash matching — the primary scanner.
 *
 * Hashes the captured photo (several crops, since the card may fill the
 * frame or sit inside the viewfinder guide) and matches against per-game
 * hash indexes precomputed from reference card images
 * (public/scan-index/*.bin, built by scripts/build_scan_index.py).
 * The matched reference card gives the exact card id — name, set and
 * collector number follow from the database, no text is ever read.
 */

import { hashCard, parseIndex, matchIndex } from './imageHash'
import { findCard } from './cardRectify'

// index name → game + language hints for resolution
export const SCAN_INDEXES = [
  { name: 'pokemon', game: 'pokemon', lang: 'en' },
  { name: 'pokemon-jp', game: 'pokemon', lang: 'ja' },
  { name: 'riftbound', game: 'riftbound', lang: 'en' },
  { name: 'lorcana', game: 'lorcana', lang: 'en' },
  { name: 'one-piece', game: 'one-piece', lang: 'en' },
]

// Combined Hamming distance (0..128) over dHash+pHash. Calibrated on a
// synthetic photo harness (36 distorted shots): correct matches landed at
// 6-21, wrong matches at 28+ — 26 rejects every observed wrong match while
// keeping 93% of correct ones. Better an honest miss than a wrong card.
export const CONFIDENT_DIST = 18
export const CANDIDATE_DIST = 26

const _indexes = new Map() // name → Promise<parsed | null>

function loadIndex(name) {
  if (!_indexes.has(name)) {
    _indexes.set(name, (async () => {
      try {
        const res = await fetch(`/scan-index/${name}.bin`)
        if (!res.ok) return null
        return parseIndex(await res.arrayBuffer())
      } catch {
        return null
      }
    })())
  }
  return _indexes.get(name)
}

/** Warm the indexes in the background (call when the scanner opens). */
export function preloadScanIndexes() {
  for (const { name } of SCAN_INDEXES) loadIndex(name)
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = dataUrl
  })
}

function crop(img, x0, y0, x1, y1) {
  const sx = Math.round(img.width * x0)
  const sy = Math.round(img.height * y0)
  const sw = Math.round(img.width * (x1 - x0))
  const sh = Math.round(img.height * (y1 - y0))
  const c = document.createElement('canvas')
  c.width = sw
  c.height = sh
  c.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
  return c
}

// Candidate framings: uploads tend to be the bare card; camera captures have
// the card inside the viewfinder guide (~15% insets), and phones hold cards
// imperfectly — try several and keep whichever framing matches best.
function framings(img) {
  const out = [img] // full frame
  out.push(crop(img, 0.15, 0.15, 0.85, 0.85)) // guide box
  // card-aspect (63:88) box centered, ~76% of height
  const ar = 63 / 88
  const h = 0.76
  const wFrac = (h * img.height * ar) / img.width
  if (wFrac < 1) {
    out.push(crop(img, 0.5 - wFrac / 2, (1 - h) / 2, 0.5 + wFrac / 2, (1 + h) / 2))
  }
  out.push(crop(img, 0.07, 0.07, 0.93, 0.93)) // slightly loose
  return out
}

/**
 * Identify a card photo. Returns matches across all available indexes:
 *   [{ id, game, lang, dist }] sorted by distance (best first), capped at `k`.
 */
export async function identifyCard(imageDataUrl, k = 6) {
  const img = await loadImage(imageDataUrl)
  const frames = framings(img)
  // Rectification first: find the card's corners and flatten it — hashes have
  // no tolerance for perspective tilt, so this is what makes phone photos
  // match clean reference scans. Falls back to plain crops when no quad found.
  try {
    const flats = findCard(img)
    if (flats) frames.unshift(...flats)
  } catch { /* rectifier is best-effort */ }
  const hashes = frames.map(f => hashCard(f))

  const loaded = await Promise.all(SCAN_INDEXES.map(async meta => ({
    meta,
    index: await loadIndex(meta.name),
  })))

  const best = new Map() // card id → { id, game, lang, dist }
  for (const { meta, index } of loaded) {
    if (!index) continue
    for (const hash of hashes) {
      for (const m of matchIndex(index, hash, k)) {
        const key = `${meta.name}:${m.id}`
        const prev = best.get(key)
        if (!prev || m.dist < prev.dist) {
          best.set(key, { id: m.id, game: meta.game, lang: meta.lang, dist: m.dist })
        }
      }
    }
  }

  return [...best.values()].sort((a, b) => a.dist - b.dist).slice(0, k)
}
