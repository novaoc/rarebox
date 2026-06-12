#!/usr/bin/env node
// Booth remote-QR protocol tests — crypto envelope, channel separation,
// signaling clamps, plus ONE polite live ntfy.sh roundtrip (2 requests).
// WebRTC itself is covered by scripts/test_p2p_browser.mjs (real browser).
//
//   node scripts/test_remote_protocol.mjs            # offline tests only
//   node scripts/test_remote_protocol.mjs --live     # + ntfy roundtrip

import {
  generateSecret, deriveChannel, deriveSigChannel, seal, open,
} from '../src/utils/remoteQr.js'

let failures = 0
const ok = (cond, label) => { console.log(`${cond ? '✓' : '✗ FAIL'} ${label}`); if (!cond) failures++ }
const te = new TextEncoder()
const td = new TextDecoder()

const secret = generateSecret()
const state = await deriveChannel(secret)
const sig = await deriveSigChannel(secret)

// ── channel derivation ──────────────────────────────────────────────────
ok(/^rbx-[A-Za-z0-9_-]{32}$/.test(state.topic), `state topic shape (${state.topic})`)
ok(/^rbx-[A-Za-z0-9_-]{32}$/.test(sig.topic), 'sig topic shape')
ok(state.topic !== sig.topic, 'state and sig topics are separate')
const other = await deriveChannel(generateSecret())
ok(other.topic !== state.topic, 'different secrets → different topics')

// ── seal / open ─────────────────────────────────────────────────────────
const payload = te.encode(JSON.stringify({ hello: 'booth', n: 42 }))
const packet = await seal(state.key, payload)
const opened = await open(state.key, packet)
ok(td.decode(opened.shareBytes) === td.decode(payload), 'seal→open roundtrip')
ok(Math.abs(opened.ts - Date.now()) < 5000, 'freshness stamp is now-ish')

// tamper: flip one ciphertext bit → GCM must reject
const tampered = packet.slice()
tampered[tampered.length - 1] ^= 0x01
ok(await open(state.key, tampered).then(() => false, () => true), 'tampered packet rejected (GCM auth)')

// wrong key (stranger on the topic) → reject
ok(await open(other.key, packet).then(() => false, () => true), 'wrong-key packet rejected')

// same key, sig vs state — sig channel reuses the state key BY DESIGN
const sigPacket = await seal(sig.key, payload)
ok(await open(state.key, sigPacket).then(() => true, () => false), 'sig/state share one key (by design)')

// replay ordering: two packets, second has later ts
const p1 = await seal(state.key, payload)
await new Promise(r => setTimeout(r, 5))
const p2 = await seal(state.key, payload)
const [o1, o2] = [await open(state.key, p1), await open(state.key, p2)]
ok(o2.ts > o1.ts, 'monotonic timestamps for replay guard')

// size sanity: a realistic 250-item booth state stays well under caps
const bigState = te.encode(JSON.stringify({ items: Array.from({ length: 250 }, (_, i) => [`card-${i}`, 'Some Card Name', 'SV: Surging Sparks', `${i}`, 1, 9.99]) }))
const bigPacket = await seal(state.key, bigState)
ok(bigPacket.length < 80 * 1024, `250-item sealed state ${bigPacket.length}B < 80KB inbound cap`)

// ── live ntfy roundtrip (2 requests: 1 publish + 1 poll) ────────────────
if (process.argv.includes('--live')) {
  const topic = 'rbx-test-' + Math.random().toString(36).slice(2, 10)
  const body = Buffer.from(await seal(state.key, te.encode('live-test'))).toString('base64')
  const t0 = Date.now()
  const pub = await fetch(`https://ntfy.sh/${topic}`, { method: 'POST', body })
  ok(pub.ok, `live publish accepted (HTTP ${pub.status}, ${Date.now() - t0}ms)`)
  // the publish response echoes the stored message — assert the e2e crypto on it
  const echo = await pub.json()
  const got = await open(state.key, Uint8Array.from(Buffer.from(echo.message, 'base64')))
  ok(td.decode(got.shareBytes) === 'live-test', 'live roundtrip decrypts end-to-end')
  ok(echo.expires - echo.time === 43200, `cache window is 12h (expires-time=${echo.expires - echo.time}s)`)

  // cached retrieval (a fresh display's since=12h replay) — edge propagation
  // can lag a couple seconds, so retry up to 3 polls
  let msg = null
  for (let i = 0; i < 3 && !msg; i++) {
    await new Promise(r => setTimeout(r, 2000))
    const res = await fetch(`https://ntfy.sh/${topic}/json?poll=1&since=10m`)
    const lines = (await res.text()).trim().split('\n').filter(Boolean).map(l => JSON.parse(l))
    msg = lines.find(l => l.event === 'message') || null
  }
  ok(!!msg, 'cached message retrievable (late-pairing replay path)')
}

console.log(failures ? `\n✗ ${failures} failure(s)` : '\n✓ all protocol checks passed')
process.exit(failures ? 1 : 0)
