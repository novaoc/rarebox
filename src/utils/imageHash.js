/**
 * Perceptual image hashing for card identification.
 *
 * Computes a 64-bit dHash and a 64-bit pHash from an image — the same pair
 * the scan index is built with (scripts/build_scan_index.py — keep in sync!),
 * and the same combination used by the Lexmark card-sorter patent
 * (US 12,200,174) and every verified open-source card scanner. Matching is
 * Hamming distance over both hashes; the card's identity (name, set, number)
 * comes from the matched reference card, so no text is ever read.
 */

// grayscale at WxH via canvas (bilinear-ish browser resampling — hash tolerant)
function grayscale(source, w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)
  const g = new Float64Array(w * h)
  for (let i = 0; i < w * h; i++) {
    g[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]
  }
  return g
}

/** 64-bit dHash as BigInt: bit = px[x] > px[x+1] on a 9x8 grayscale. */
export function dhash64(source) {
  const g = grayscale(source, 9, 8)
  let bits = 0n
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      bits = (bits << 1n) | (g[y * 9 + x] > g[y * 9 + x + 1] ? 1n : 0n)
    }
  }
  return bits
}

const N = 32
const COS = (() => {
  const t = []
  for (let u = 0; u < N; u++) {
    t[u] = new Float64Array(N)
    for (let x = 0; x < N; x++) t[u][x] = Math.cos(((2 * x + 1) * u * Math.PI) / (2 * N))
  }
  return t
})()

/** 64-bit pHash as BigInt: 32x32 DCT-II, top-left 8x8, median threshold (DC skipped). */
export function phash64(source) {
  const g = grayscale(source, N, N)
  // rows
  const tmp = new Float64Array(N * N)
  for (let y = 0; y < N; y++) {
    for (let u = 0; u < N; u++) {
      let s = 0
      for (let x = 0; x < N; x++) s += g[y * N + x] * COS[u][x]
      tmp[y * N + u] = s
    }
  }
  // cols
  const dct = new Float64Array(N * N)
  for (let v = 0; v < N; v++) {
    for (let u = 0; u < N; u++) {
      let s = 0
      for (let y = 0; y < N; y++) s += tmp[y * N + u] * COS[v][y]
      dct[v * N + u] = s
    }
  }
  const block = []
  for (let v = 0; v < 8; v++) for (let u = 0; u < 8; u++) block.push(dct[v * N + u])
  const coeffs = block.slice(1).slice().sort((a, b) => a - b)
  const med = coeffs[Math.floor(coeffs.length / 2)]
  let bits = 0n
  for (const c of block) bits = (bits << 1n) | (c > med ? 1n : 0n)
  return bits
}

/** Hamming distance between two 64-bit BigInts. */
export function hamming64(a, b) {
  let x = a ^ b
  let n = 0
  while (x) {
    x &= x - 1n
    n++
  }
  return n
}

/** Compute both hashes from an image source (img/canvas/bitmap). */
export function hashCard(source) {
  return { d: dhash64(source), p: phash64(source) }
}

/**
 * Parse a scan-index .bin (format RBX1, see build_scan_index.py).
 * Returns { ids: string[], d: BigUint64Array, p: BigUint64Array }.
 */
export function parseIndex(buffer) {
  const view = new DataView(buffer)
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3))
  if (magic !== 'RBX1') throw new Error('bad scan index magic')
  const count = view.getUint32(4, true)
  const ids = new Array(count)
  const d = new BigUint64Array(count)
  const p = new BigUint64Array(count)
  const dec = new TextDecoder()
  let off = 8
  for (let i = 0; i < count; i++) {
    const len = view.getUint8(off)
    off += 1
    ids[i] = dec.decode(new Uint8Array(buffer, off, len))
    off += len
    d[i] = view.getBigUint64(off, true)
    p[i] = view.getBigUint64(off + 8, true)
    off += 16
  }
  return { ids, d, p }
}

/**
 * Match a hash pair against a parsed index.
 * Returns top-k [{ id, dist }] sorted by combined Hamming distance.
 */
export function matchIndex(index, hash, k = 5) {
  const best = [] // small k — insertion keeps it simple
  for (let i = 0; i < index.ids.length; i++) {
    const dist = hamming64(index.d[i], hash.d) + hamming64(index.p[i], hash.p)
    if (best.length < k || dist < best[best.length - 1].dist) {
      best.push({ id: index.ids[i], dist })
      best.sort((a, b) => a.dist - b.dist)
      if (best.length > k) best.pop()
    }
  }
  return best
}
