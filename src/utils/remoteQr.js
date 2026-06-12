/**
 * Remote QR — drive the kiosk display on a second device.
 *
 * Leave a tablet at the table showing the booth QR; run every sale and
 * trade from your phone; the tablet's code re-encodes itself seconds
 * later. The two devices pair through one QR containing a random secret;
 * everything derived from it stays client-side:
 *
 *   topic = SHA-256(secret ‖ "topic")  → the ntfy.sh channel name
 *   key   = SHA-256(secret ‖ "key")    → AES-256-GCM payload key
 *
 * Updates travel through ntfy.sh (a free, no-account pub/sub relay,
 * CORS-open for both POST publish and EventSource subscribe) as
 * AES-GCM ciphertext of the SAME gzipped bytes a booth share QR
 * carries. The relay sees scrambled bytes and a random topic — never
 * inventory, never the key (it lives in the pairing QR's URL fragment,
 * which browsers don't send to servers). Same trade-off pattern as
 * "Shorten for socials", and disclosed in the UI the same way.
 *
 * Payload framing: ntfy messages are text, so ciphertext goes base64.
 * Bodies past ~4KB are auto-converted by ntfy into short-lived
 * attachments (2MiB cap, 3h expiry) — the subscriber transparently
 * fetches those. A timestamp inside the ciphertext drops stale replays;
 * GCM's auth tag drops garbage published by strangers (topics are
 * world-writable — undecryptable messages are silently ignored).
 *
 * Free-tier budget: 250 publishes/day per IP — a busy table's worth of
 * edits at the 1.5s debounce the table view uses.
 */

const NTFY = 'https://ntfy.sh'

const te = new TextEncoder()

function bytesToB64(bytes) {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s)
}
function b64ToBytes(b64) {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
function bytesToB64Url(bytes) {
  return bytesToB64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function b64UrlToBytes(s) {
  return b64ToBytes(s.replace(/-/g, '+').replace(/_/g, '/'))
}

export function generateSecret() {
  return bytesToB64Url(crypto.getRandomValues(new Uint8Array(16)))
}

/** Pairing link the display device opens (secret rides in the fragment). */
export function displayUrl(secret, origin = window.location.origin) {
  return `${origin}/booth/display#r=${secret}`
}

export function secretFromLocation(hashOrUrl) {
  const m = String(hashOrUrl).match(/[#&]r=([A-Za-z0-9_-]+)/)
  return m ? m[1] : null
}

/** secret → { topic, key } — all derivation stays on-device. */
export async function deriveChannel(secret) {
  const raw = b64UrlToBytes(secret)
  const topicHash = new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array([...raw, ...te.encode(':topic')])))
  const keyHash = await crypto.subtle.digest('SHA-256', new Uint8Array([...raw, ...te.encode(':key')]))
  const topic = 'rbx-' + bytesToB64Url(topicHash).slice(0, 32)
  const key = await crypto.subtle.importKey('raw', keyHash, 'AES-GCM', false, ['encrypt', 'decrypt'])
  return { topic, key }
}

/** Encrypt share bytes (already gzipped) with a freshness stamp. */
async function seal(key, shareBytes) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const stamped = new Uint8Array(8 + shareBytes.length)
  new DataView(stamped.buffer).setFloat64(0, Date.now())
  stamped.set(shareBytes, 8)
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, stamped))
  const out = new Uint8Array(12 + ct.length)
  out.set(iv); out.set(ct, 12)
  return out
}

async function open(key, packet) {
  const iv = packet.slice(0, 12)
  const plain = new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, packet.slice(12)))
  return {
    ts: new DataView(plain.buffer, plain.byteOffset, 8).getFloat64(0),
    shareBytes: plain.slice(8),
  }
}

/** Publish one booth state. Returns true on success. */
export async function publishState({ topic, key }, shareBytes) {
  try {
    const body = bytesToB64(await seal(key, shareBytes))
    const resp = await fetch(`${NTFY}/${topic}`, { method: 'POST', body })
    return resp.ok
  } catch { return false }
}

/**
 * Subscribe to booth states. onState({ ts, shareBytes }) fires for each
 * fresh, authentic update (stale and undecryptable messages are dropped).
 * Returns a stop() function. EventSource auto-reconnects; `since=12h`
 * replays the last known state so a fresh display syncs immediately.
 */
export function subscribeState({ topic, key }, onState, onStatus = () => {}) {
  let lastTs = 0
  let stopped = false
  const es = new EventSource(`${NTFY}/${topic}/sse?since=12h`)
  es.onopen = () => onStatus('connected')
  es.onerror = () => onStatus('reconnecting')
  es.onmessage = async (ev) => {
    if (stopped) return
    try {
      const msg = JSON.parse(ev.data)
      let packet
      if (msg.attachment?.url) {
        const r = await fetch(msg.attachment.url)
        packet = b64ToBytes(await r.text())
      } else if (msg.message) {
        packet = b64ToBytes(msg.message)
      } else return
      const state = await open(key, packet)
      if (state.ts <= lastTs) return // replay or out-of-order
      lastTs = state.ts
      onState(state)
    } catch { /* not ours / garbage on a public topic — ignore */ }
  }
  return () => { stopped = true; es.close() }
}
