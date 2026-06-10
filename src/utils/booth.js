/**
 * Booth — IRL selling shelves you can share with a link or QR.
 *
 * A booth is a shelf with asking prices: pick items, price them, share.
 * Because Rarebox has no server, the booth itself travels INSIDE the
 * share artifact: the URL fragment (#b=...) carries the gzipped booth,
 * so opening the link rebuilds it entirely on the buyer's device —
 * nothing is uploaded, hosted, or tracked. Fragments are never sent to
 * the server by browsers, so even the static host never sees the data.
 *
 * Share size guidance: items encode to ~25-60 bytes each after gzip.
 * A single QR holds ~2.9KB (≈ 60-100 items); past that the share modal
 * switches to the animated RBX2 QR (see qrTransfer.js) and the link
 * keeps working for socials/chat up to a few hundred items.
 */
import { gzip, gunzip } from './qrTransfer'

const BOOTHS_KEY = 'rarebox_booths'
const SAVED_SHOPS_KEY = 'rarebox_saved_shops'
export const SHARE_VERSION = 1

// ── Local storage ──────────────────────────────────────────────────────

export function loadBooths() {
  try { return JSON.parse(localStorage.getItem(BOOTHS_KEY)) || [] } catch { return [] }
}

export function saveBooths(booths) {
  try { localStorage.setItem(BOOTHS_KEY, JSON.stringify(booths)) } catch { /* quota */ }
}

export function loadSavedShops() {
  try { return JSON.parse(localStorage.getItem(SAVED_SHOPS_KEY)) || [] } catch { return [] }
}

export function saveSavedShops(shops) {
  try { localStorage.setItem(SAVED_SHOPS_KEY, JSON.stringify(shops)) } catch { /* quota */ }
}

// ── Share encoding ─────────────────────────────────────────────────────
// Compact tuple format keeps URLs short: each item becomes
// [type, game, id, name, setName, number, qty, price, img]

function packBooth(booth) {
  return {
    v: SHARE_VERSION,
    n: booth.name || 'Card booth',
    venue: booth.venue || '',
    date: booth.date || '',
    note: booth.note || '',
    items: (booth.items || []).map(it => [
      it.type || 'card',
      it.game || '',
      it.cardId || '',
      it.name || '',
      it.setName || '',
      it.number || '',
      it.qty ?? 1,
      it.price ?? 0,
      it.img || '',
    ]),
  }
}

function unpackBooth(packed) {
  if (!packed || packed.v !== SHARE_VERSION || !Array.isArray(packed.items)) {
    throw new Error('Not a Rarebox booth')
  }
  return {
    name: packed.n,
    venue: packed.venue,
    date: packed.date,
    note: packed.note,
    items: packed.items.map(([type, game, cardId, name, setName, number, qty, price, img]) => ({
      type, game, cardId, name, setName, number, qty, price, img,
    })),
  }
}

function bytesToBase64Url(bytes) {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64UrlToBytes(b64u) {
  const b64 = b64u.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** booth → raw share bytes (for QR frames) */
export async function encodeBoothBytes(booth) {
  return gzip(JSON.stringify(packBooth(booth)))
}

/** booth → full share URL */
export async function boothToUrl(booth, origin = window.location.origin) {
  const bytes = await encodeBoothBytes(booth)
  return `${origin}/booth#b=${bytesToBase64Url(bytes)}`
}

/** share bytes → booth (QR scan path) */
export async function decodeBoothBytes(bytes) {
  return unpackBooth(JSON.parse(await gunzip(bytes)))
}

/** URL fragment (or full URL) → booth, or null if it isn't a booth share */
export async function boothFromLocation(hashOrUrl) {
  const m = String(hashOrUrl).match(/[#&]b=([A-Za-z0-9_-]+)/)
  if (!m) return null
  return decodeBoothBytes(base64UrlToBytes(m[1]))
}

export function boothTotal(booth) {
  return (booth.items || []).reduce((s, it) => s + (it.qty || 1) * (it.price || 0), 0)
}

export function generateBoothId() {
  return 'booth-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}
