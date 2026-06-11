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
 * Share size guidance (measured with realistic unique cards): items
 * encode to ~25-60 bytes each after gzip. A single QR holds ~2.3KB
 * (≈ 40 items); past that the share modal switches to the animated
 * RBX2 QR (see qrTransfer.js) and the link keeps working for
 * socials/chat. MAX_BOOTH_ITEMS keeps every share path comfortable:
 * 250 items ≈ 9 RBX2 frames (3.6s/cycle) and a ~7k-char URL, well
 * inside TinyURL's and da.gd's limits.
 *
 * Directories (#d=...) are the event-scale answer: instead of packing
 * every booth into one code, a directory carries one ~30-byte entry per
 * booth — name, venue, count, total, and a da.gd short code (da.gd is
 * CORS-open both to create and to RESOLVE links, so the importing
 * device expands each entry itself). A 40-booth hall fits a single
 * camera-scannable QR.
 */
import { gzip, gunzip } from './qrTransfer'

const BOOTHS_KEY = 'rarebox_booths'
const SAVED_SHOPS_KEY = 'rarebox_saved_shops'
export const SHARE_VERSION = 1
export const DIR_VERSION = 1

/** Hard cap on listings per booth — keeps QRs scannable, posters
 *  shortenable, and links pasteable everywhere. */
export const MAX_BOOTH_ITEMS = 250

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
//
// Booth meta fields are additive on v1: older clients simply don't read
// `table`/`loc`/`locName`, and older payloads leave them undefined —
// both directions keep working, so no version bump.

function packBooth(booth) {
  const packed = {
    v: SHARE_VERSION,
    // Snapshot stamp (epoch seconds, additive on v1): shares are frozen the
    // moment they're encoded, so the buyer side can say HOW frozen — a QR
    // printed Friday reads as days old by Sunday, while the table-mode
    // kiosk QR re-encodes on every change and always reads fresh.
    ts: Math.floor(Date.now() / 1000),
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
  if (booth.table) packed.table = booth.table
  if (booth.loc?.length === 2) {
    // 5 decimals ≈ 1m precision — plenty for "find the venue"
    packed.loc = [+booth.loc[0].toFixed(5), +booth.loc[1].toFixed(5)]
    if (booth.locName) packed.locName = booth.locName
  }
  return packed
}

// Shared payloads are attacker-controllable (anyone can craft a #b= link),
// so decode clamps everything: counts, string lengths, numeric ranges.
// gzip amplifies — a few-KB fragment can inflate to millions of items —
// hence the hard caps BEFORE the data reaches Vue's reactivity.
function str(v, max = 200) {
  return typeof v === 'string' ? v.slice(0, max) : ''
}
function num(v, max = 1e9) {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0
}
function imgUrl(v) {
  const s = str(v, 500)
  return /^https:\/\//.test(s) ? s : ''
}

function unpackBooth(packed) {
  if (!packed || packed.v !== SHARE_VERSION || !Array.isArray(packed.items)) {
    throw new Error('Not a Rarebox booth')
  }
  return {
    ts: num(packed.ts, 4102444800) || 0, // epoch seconds, 0 = pre-ts share
    name: str(packed.n, 80),
    venue: str(packed.venue, 120),
    date: str(packed.date, 40),
    note: str(packed.note, 500),
    table: str(packed.table, 40),
    loc: Array.isArray(packed.loc) && packed.loc.length === 2 ? [num(packed.loc[0] + 90, 180) - 90, num(packed.loc[1] + 180, 360) - 180] : null,
    locName: str(packed.locName, 120),
    items: packed.items.slice(0, MAX_BOOTH_ITEMS).map((it) => {
      const [type, game, cardId, name, setName, number, qty, price, img] = Array.isArray(it) ? it : []
      return {
        type: str(type, 20),
        game: str(game, 20),
        cardId: str(cardId, 80),
        name: str(name, 120),
        setName: str(setName, 120),
        number: str(number, 20),
        qty: num(qty, 9999),
        price: num(price),
        img: imgUrl(img),
      }
    }),
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

// Decompression amplification guard: a legit 250-item booth gzips to
// ~15KB; anything past 64KB compressed is not a booth someone made.
const MAX_SHARE_BYTES = 64 * 1024

/** share bytes → booth (QR scan path) */
export async function decodeBoothBytes(bytes) {
  if (bytes.length > MAX_SHARE_BYTES) throw new Error('Share payload too large')
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

/** Booth dates are ISO (yyyy-mm-dd) from the date picker; older booths
 *  carried free text ("Sat June 14") — render those untouched. */
export function fmtBoothDate(d) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d || '')) return d || ''
  const [y, m, day] = d.split('-').map(Number)
  return new Date(y, m - 1, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

// ── Location ───────────────────────────────────────────────────────────

/** Best "open in maps" URL for a booth location. Apple/Android map apps
 *  register the geo: scheme; desktop browsers get Google Maps (works
 *  everywhere, needs no key). */
export function directionsUrl(loc, label = '') {
  const [lat, lon] = loc
  const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent)
  if (isMobile) return `geo:${lat},${lon}?q=${lat},${lon}${label ? `(${encodeURIComponent(label)})` : ''}`
  return `https://www.google.com/maps?q=${lat},${lon}`
}

// ── Directory shares (#d=...) ──────────────────────────────────────────
// A directory is a list of pointers to booths, not the booths themselves:
// entries [[name, venue, itemCount, total, ref], ...] where ref is either
// a da.gd short code ("dgd:XyZ12") or a full self-contained booth URL
// (offline fallback — bigger, but needs no resolver).

function packDirectory(title, entries) {
  return {
    dv: DIR_VERSION,
    t: title || 'Booth directory',
    e: entries.map(en => [en.name || '', en.venue || '', en.count || 0, +(en.total || 0).toFixed(2), en.ref]),
  }
}

const MAX_DIR_ENTRIES = 200
function unpackDirectory(packed) {
  if (!packed || packed.dv !== DIR_VERSION || !Array.isArray(packed.e)) {
    throw new Error('Not a Rarebox booth directory')
  }
  return {
    title: str(packed.t, 120),
    entries: packed.e.slice(0, MAX_DIR_ENTRIES).map((en) => {
      const [name, venue, count, total, ref] = Array.isArray(en) ? en : []
      return { name: str(name, 80), venue: str(venue, 120), count: num(count, 9999), total: num(total), ref: str(ref, 200) }
    }),
  }
}

export async function encodeDirectoryBytes(title, entries) {
  return gzip(JSON.stringify(packDirectory(title, entries)))
}

export async function directoryToUrl(title, entries, origin = window.location.origin) {
  const bytes = await encodeDirectoryBytes(title, entries)
  return `${origin}/booth#d=${bytesToBase64Url(bytes)}`
}

export async function decodeDirectoryBytes(bytes) {
  if (bytes.length > MAX_SHARE_BYTES) throw new Error('Share payload too large')
  return unpackDirectory(JSON.parse(await gunzip(bytes)))
}

/** URL fragment (or full URL) → directory, or null */
export async function directoryFromLocation(hashOrUrl) {
  const m = String(hashOrUrl).match(/[#&]d=([A-Za-z0-9_-]+)/)
  if (!m) return null
  return decodeDirectoryBytes(base64UrlToBytes(m[1]))
}

/** Shorten a URL with da.gd. Unlike TinyURL, da.gd also lets the browser
 *  RESOLVE codes (CORS * on /coshorten), which is what makes compact
 *  directories possible. Returns the short code (not the full URL). */
export async function dagdShorten(url) {
  const resp = await fetch('https://da.gd/shorten?url=' + encodeURIComponent(url))
  const text = (await resp.text()).trim()
  if (!resp.ok || !text.startsWith('https://da.gd/')) throw new Error('shorten failed')
  return text.slice('https://da.gd/'.length)
}

/** da.gd short code → destination URL (CORS-open, fragment preserved). */
export async function dagdResolve(code) {
  const resp = await fetch('https://da.gd/coshorten/' + encodeURIComponent(code))
  const text = (await resp.text()).trim()
  if (!resp.ok || !/^https?:\/\//.test(text)) throw new Error('resolve failed')
  return text
}

/** Directory entry ref → booth. Handles both da.gd codes and inline URLs. */
export async function boothFromDirectoryRef(ref) {
  const url = ref.startsWith('dgd:') ? await dagdResolve(ref.slice(4)) : ref
  const booth = await boothFromLocation(url)
  if (!booth) throw new Error('not a booth link')
  return booth
}
