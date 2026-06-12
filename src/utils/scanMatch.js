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

function rotate90(source, dir) {
  const w = source.width || source.naturalWidth
  const h = source.height || source.naturalHeight
  const c = document.createElement('canvas')
  c.width = h
  c.height = w
  const ctx = c.getContext('2d')
  ctx.translate(h / 2, w / 2)
  ctx.rotate((dir * Math.PI) / 2)
  ctx.drawImage(source, -w / 2, -h / 2)
  return c
}

// Candidate framings: uploads tend to be the bare card; camera captures have
// the card inside the viewfinder guide (~15% insets), and phones hold cards
// imperfectly — try several and keep whichever framing matches best.
// Landscape photos usually mean the card is lying sideways: hash both 90°
// rotations too (reference hashes are portrait and have zero rotation
// tolerance — the wrong rotation simply won't match).
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
  if (img.width > img.height) {
    for (const dir of [1, -1]) {
      const r = rotate90(img, dir)
      out.push(r)
      out.push(crop(r, 0.15, 0.15, 0.85, 0.85))
    }
  }
  return out
}

/**
 * Normalized cross-correlation between a rectified card and a reference
 * image, on 48x66 grayscale. Invariant to linear brightness/contrast — which
 * is exactly what dim, sleeve-veiled phone photos break in the hashes. The
 * hash recalls a coarse candidate set; NCC picks the right card out of it.
 * Returns -1..1 (same card from a decent photo ≳ 0.55; impostors ≲ 0.4).
 */
const NCC_W = 48
const NCC_H = 66
function grayVec(source) {
  const c = document.createElement('canvas')
  c.width = NCC_W
  c.height = NCC_H
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, NCC_W, NCC_H)
  const { data } = ctx.getImageData(0, 0, NCC_W, NCC_H)
  const g = new Float64Array(NCC_W * NCC_H)
  let mean = 0
  for (let i = 0; i < g.length; i++) {
    g[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]
    mean += g[i]
  }
  mean /= g.length
  let varSum = 0
  for (let i = 0; i < g.length; i++) {
    g[i] -= mean
    varSum += g[i] * g[i]
  }
  const std = Math.sqrt(varSum / g.length) || 1
  for (let i = 0; i < g.length; i++) g[i] /= std
  return g
}

/** Correlation of two grayVec outputs (compute each once, dot many). */
export function nccDot(a, b) {
  let s = 0
  for (let i = 0; i < a.length; i++) s += a[i] * b[i]
  return s / a.length
}

export { grayVec }

/**
 * Name-band correlation vector (x 8-75%, y 2-11%, at 96x18 — text scale).
 * The tiebreak for language twins: a card's EN and JP printings share the
 * artwork, so whole-card NCC can't split them — but "Lechonk" does not
 * correlate with "グルトン". Measured on the OCRFix photo set: right
 * language ≥ +0.15 over the twin.
 */
const NAME_W = 96
const NAME_H = 18
export function nameVec(source) {
  const sw = source.width || source.naturalWidth
  const sh = source.height || source.naturalHeight
  const c = document.createElement('canvas')
  c.width = NAME_W
  c.height = NAME_H
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, sw * 0.08, sh * 0.02, sw * 0.67, sh * 0.09, 0, 0, NAME_W, NAME_H)
  const { data } = ctx.getImageData(0, 0, NAME_W, NAME_H)
  const g = new Float64Array(NAME_W * NAME_H)
  let mean = 0
  for (let i = 0; i < g.length; i++) {
    g[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]
    mean += g[i]
  }
  mean /= g.length
  let varSum = 0
  for (let i = 0; i < g.length; i++) {
    g[i] -= mean
    varSum += g[i] * g[i]
  }
  const std = Math.sqrt(varSum / g.length) || 1
  for (let i = 0; i < g.length; i++) g[i] /= std
  return g
}

// NCC decision points — calibrated on the OCRFix photo set (dim, sleeved,
// sideways cards): blended truth scored .52-.68, language twins .44-.60,
// real impostors ≤ .40. Blend = 65% whole-card art + 35% name band.
export const NCC_ART_WEIGHT = 0.65
export const NCC_NAME_WEIGHT = 0.35
export const NCC_CONFIDENT = 0.5
export const NCC_MARGIN = 0.05
export const NCC_FLOOR = 0.3
// Looser hash recall when a rectified card exists — NCC does the precision.
export const RECALL_DIST = 32

/**
 * Identify a card photo. Returns matches across all available indexes:
 *   [{ id, game, lang, dist }] sorted by distance (best first), capped at `k`.
 * opts.flats: pre-rectified card canvases (skips the internal rectifier —
 * the scan pipeline rectifies once and reuses the warps for hashing, NCC
 * re-ranking, and OCR).
 */
export async function identifyCard(imageDataUrl, k = 6, opts = {}) {
  const img = await loadImage(imageDataUrl)
  const frames = framings(img)
  // Rectification first: find the card's corners and flatten it — hashes have
  // no tolerance for perspective tilt, so this is what makes phone photos
  // match clean reference scans. Falls back to plain crops when no quad found.
  try {
    const flats = opts.flats || findCard(img)
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
