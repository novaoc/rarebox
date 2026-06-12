/**
 * Remote QR, peer-to-peer leg — a WebRTC DataChannel between the phone
 * (table view, publisher) and the tablet (display view, kiosk).
 *
 * Why: the ntfy relay charges one publish per inventory edit against a
 * 250/day-per-IP free tier — fine for one seller, tight for a whole hall
 * behind one convention NAT. With P2P, ntfy carries only the handshake
 * (~4 tiny messages per pairing session) and every live update flows
 * device-to-device. On the same LAN — or the seller's own hotspot — the
 * updates need no internet at all; ICE simply uses local candidates when
 * STUN can't be reached (the gathering cap below makes that fast).
 *
 * Choreography (all signaling rides the sealed sig topic, see remoteQr):
 *   display loads      → {t:'hello'}
 *   phone (on arm or hello or channel death) → {t:'offer', sdp}
 *   display            → {t:'answer', sdp}   → DataChannel opens
 *
 * Trust model: the pairing-QR secret authenticates everything. Signaling
 * messages are AES-GCM sealed (strangers can't inject an offer onto the
 * world-writable topic), and the SDP exchanged that way pins the DTLS
 * certificate fingerprints, so the channel can only ever connect to the
 * device that scanned your QR. Booth states crossing the channel keep the
 * SAME sealed envelope as the relay path — the display decodes both legs
 * with one code path, and a hijacked transport still carries only
 * ciphertext. Inbound frames are size-capped before any parsing.
 *
 * The relay is never torn down: it delivers the initial state (since=12h
 * replay), covers client-isolated venue Wi-Fi where P2P can't connect,
 * and takes over the moment the channel dies.
 */

import { seal, publishSig } from './remoteQr.js'

const ICE_CONFIG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
const GATHER_CAP_MS = 2000      // offline/hotspot: don't wait for STUN that never answers
const HEARTBEAT_MS = 10_000
const DEAD_AFTER_MS = 25_000
const REOFFER_MIN_MS = 5_000    // hello-flood / flap guard
const MAX_INBOUND_BYTES = 80 * 1024 // sealed 250-item booth is ~16KB; 5x headroom

function waitGathered(pc) {
  if (pc.iceGatheringState === 'complete') return Promise.resolve()
  return Promise.race([
    new Promise((res) => {
      pc.addEventListener('icegatheringstatechange', () => {
        if (pc.iceGatheringState === 'complete') res()
      })
    }),
    new Promise((res) => setTimeout(res, GATHER_CAP_MS)),
  ])
}

/**
 * Phone side (publisher). Owns the offer.
 *   const peer = phonePeer({ sigChannel, key, onUp, onDown })
 *   peer.offer()              — (re)start a connection attempt
 *   peer.onAnswer(sdp)        — feed answers from the sig subscription
 *   peer.send(shareBytes)     — true if delivered over the channel
 *   peer.stop()
 */
export function phonePeer({ sigChannel, key, onUp = () => {}, onDown = () => {} }) {
  let pc = null
  let dc = null
  let hb = null
  let lastPong = 0
  let lastOfferAt = 0
  let stopped = false

  function teardown(notify) {
    clearInterval(hb)
    hb = null
    try { dc?.close() } catch { /* gone */ }
    try { pc?.close() } catch { /* gone */ }
    dc = null
    pc = null
    if (notify) onDown()
  }

  async function offer() {
    if (stopped) return false
    const now = Date.now()
    if (now - lastOfferAt < REOFFER_MIN_MS) return false
    lastOfferAt = now
    teardown(false)
    pc = new RTCPeerConnection(ICE_CONFIG)
    dc = pc.createDataChannel('booth', { ordered: true })
    dc.binaryType = 'arraybuffer'
    dc.onopen = () => {
      lastPong = Date.now()
      hb = setInterval(() => {
        if (Date.now() - lastPong > DEAD_AFTER_MS) return teardown(true)
        try { dc.send('ping') } catch { teardown(true) }
      }, HEARTBEAT_MS)
      onUp()
    }
    dc.onmessage = (e) => { if (e.data === 'pong') lastPong = Date.now() }
    dc.onclose = () => { if (hb) teardown(true) }
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed'].includes(pc?.connectionState)) teardown(true)
    }
    await pc.setLocalDescription(await pc.createOffer())
    await waitGathered(pc)
    if (stopped || !pc) return false
    return publishSig(sigChannel, { t: 'offer', sdp: pc.localDescription.sdp })
  }

  async function onAnswer(sdp) {
    if (!pc || pc.signalingState !== 'have-local-offer') return
    try { await pc.setRemoteDescription({ type: 'answer', sdp }) } catch { /* stale answer */ }
  }

  /** Send one booth state over the channel, sealed. False = use the relay. */
  async function send(shareBytes) {
    if (!dc || dc.readyState !== 'open') return false
    try {
      const packet = await seal(key, shareBytes)
      dc.send(packet)
      return true
    } catch { teardown(true); return false }
  }

  return {
    offer,
    onAnswer,
    send,
    get connected() { return !!dc && dc.readyState === 'open' },
    stop() { stopped = true; teardown(false) },
  }
}

/**
 * Display side (kiosk). Answers offers; receives sealed states.
 *   const peer = displayPeer({ sigChannel, onPacket, onMode })
 *   peer.onOffer(sdp)   — feed offers from the sig subscription
 *   peer.stop()
 * onPacket(Uint8Array) gets the SEALED packet — caller open()s it with the
 * same code path the relay uses (one decoder, both transports).
 */
export function displayPeer({ sigChannel, onPacket = () => {}, onMode = () => {} }) {
  let pc = null
  let stopped = false

  async function onOffer(sdp) {
    if (stopped) return
    try { pc?.close() } catch { /* gone */ }
    pc = new RTCPeerConnection(ICE_CONFIG)
    pc.ondatachannel = ({ channel }) => {
      channel.binaryType = 'arraybuffer'
      channel.onopen = () => onMode('direct')
      channel.onclose = () => onMode('relay')
      channel.onmessage = (e) => {
        if (e.data === 'ping') { try { channel.send('pong') } catch { /* closing */ } return }
        if (typeof e.data === 'string') return // only ping/pong ride as text
        const bytes = new Uint8Array(e.data)
        if (bytes.length === 0 || bytes.length > MAX_INBOUND_BYTES) return
        onPacket(bytes)
      }
    }
    try {
      await pc.setRemoteDescription({ type: 'offer', sdp })
      await pc.setLocalDescription(await pc.createAnswer())
      await waitGathered(pc)
      if (stopped || !pc) return
      await publishSig(sigChannel, { t: 'answer', sdp: pc.localDescription.sdp })
    } catch { /* malformed offer — wait for the next one */ }
  }

  return {
    onOffer,
    stop() { stopped = true; try { pc?.close() } catch { /* gone */ } },
  }
}
