<template>
  <div class="bd-page">
    <template v-if="!secret">
      <div class="bd-help">
        <div class="bd-help-title">📡 Booth display</div>
        <p>This screen shows a booth's live QR, driven from another device.</p>
        <p>On your phone: <strong>Booth → 🔥 Table → 📺 Live QR → 📡 Show on another device</strong>, then scan the pairing code with this device's camera.</p>
      </div>
    </template>

    <template v-else>
      <div class="bd-name">{{ booth?.name || 'Waiting for your table…' }}</div>
      <canvas v-show="booth" ref="qrCanvas" class="bd-qr"></canvas>
      <div v-if="frameCount > 1" class="bd-frames">{{ frame + 1 }} / {{ frameCount }} — scan from Rarebox (Booth → Scan)</div>
      <div class="bd-sub">
        <span class="bd-live" :class="{ off: status !== 'connected' }">● {{ status === 'connected' ? 'LIVE' : status.toUpperCase() }}</span>
        <template v-if="booth"> {{ booth.items.length }} listing{{ booth.items.length !== 1 ? 's' : '' }} · {{ fmtMoney(total) }} — updates as the table changes</template>
        <template v-else> paired — waiting for the first update from your phone</template>
      </div>
      <p class="bd-note">Updates arrive end-to-end encrypted via ntfy.sh — the relay only ever sees scrambled bytes; the key stayed inside the pairing code.</p>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import QRCode from 'qrcode'
import { secretFromLocation, deriveChannel, subscribeState } from '../utils/remoteQr'
import { decodeBoothBytes, boothTotal } from '../utils/booth'
import { buildFrames } from '../utils/qrTransfer'

const secret = ref(secretFromLocation(window.location.hash))
const booth = ref(null)
const total = ref(0)
const status = ref('connecting')
const qrCanvas = ref(null)
const frameCount = ref(0)
const frame = ref(0)

const SINGLE_QR_LIMIT = 2300
const FRAME_MS = 400
let stop = null
let anim = null
let wakeLock = null

function fmtMoney(n) {
  return '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function b64Url(bytes) {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function render(shareBytes) {
  await nextTick()
  if (!qrCanvas.value) return
  if (anim) { clearInterval(anim); anim = null }
  // Re-encoding would change nothing: the wire bytes ARE the share bytes
  const url = `${window.location.origin}/booth#b=${b64Url(shareBytes)}`
  const opts = { width: 460, margin: 2, color: { dark: '#141414', light: '#ffffff' }, errorCorrectionLevel: 'M' }
  if (url.length <= SINGLE_QR_LIMIT) {
    frameCount.value = 1
    await QRCode.toCanvas(qrCanvas.value, url, opts)
  } else {
    const frames = buildFrames(shareBytes)
    frameCount.value = frames.length
    frame.value = 0
    const draw = i => qrCanvas.value && QRCode.toCanvas(qrCanvas.value, [{ data: frames[i], mode: 'byte' }], opts)
    draw(0)
    anim = setInterval(() => { frame.value = (frame.value + 1) % frames.length; draw(frame.value) }, FRAME_MS)
  }
}

async function acquireWakeLock() {
  try { wakeLock = await navigator.wakeLock?.request('screen') } catch { /* unsupported */ }
}

onMounted(async () => {
  if (!secret.value) return
  // tidy the URL so the secret doesn't sit in the address bar / history
  history.replaceState(null, '', window.location.pathname)
  const channel = await deriveChannel(secret.value)
  stop = subscribeState(channel, async ({ shareBytes }) => {
    try {
      booth.value = await decodeBoothBytes(shareBytes)
      total.value = boothTotal(booth.value)
      render(shareBytes)
    } catch { /* malformed state — keep showing the last good one */ }
  }, s => { status.value = s })
  acquireWakeLock()
  // iOS releases wake locks when the tab loses visibility — re-grab
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') acquireWakeLock()
  })
})

onBeforeUnmount(() => {
  stop?.()
  if (anim) clearInterval(anim)
  try { wakeLock?.release() } catch { /* gone */ }
})
</script>

<style scoped>
.bd-page {
  min-height: 100vh;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 14px; text-align: center;
  padding: calc(24px + env(safe-area-inset-top, 0px)) 24px calc(24px + env(safe-area-inset-bottom, 0px));
  background: var(--bg-secondary, #faf6ef);
}
.bd-name { font-size: clamp(22px, 4vw, 32px); font-weight: 900; }
.bd-qr {
  border: var(--bw, 2px) solid var(--ink, #141414); border-radius: var(--radius, 14px);
  background: #fff; box-shadow: var(--shadow-sm, 4px 4px 0 #141414);
  max-width: min(80vw, 60vh);
  height: auto !important; width: min(80vw, 60vh) !important;
}
.bd-frames { font-size: 12.5px; font-weight: 700; color: var(--text-secondary, #5f5a51); }
.bd-sub { font-size: 14px; font-weight: 700; color: var(--text-secondary, #5f5a51); max-width: 460px; }
.bd-live { color: #c92f2f; font-weight: 900; letter-spacing: 0.04em; animation: bd-pulse 1.6s ease infinite; }
.bd-live.off { color: var(--text-muted, #8a8478); animation: none; }
@keyframes bd-pulse { 50% { opacity: 0.45; } }
.bd-note { font-size: 11.5px; color: var(--text-muted, #8a8478); font-weight: 600; max-width: 420px; }
.bd-help { max-width: 420px; display: flex; flex-direction: column; gap: 10px; font-size: 14.5px; line-height: 1.55; }
.bd-help-title { font-size: 24px; font-weight: 900; }
</style>
