<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal slide-up-enter-active" style="max-width: 480px">
      <div class="modal-header">
        <h3>📣 Share your booth</h3>
        <button class="btn btn-ghost btn-icon" @click="$emit('close')">✕</button>
      </div>

      <div class="modal-body">
        <p class="share-desc">
          Buyers open the link or scan the code — your booth rebuilds on their
          device. Nothing is uploaded anywhere: the whole booth travels inside
          the link itself.
        </p>

        <div v-if="building" class="share-building"><div class="spinner"></div></div>

        <template v-else>
          <div class="qr-container">
            <canvas ref="qrCanvas" class="qr-canvas"></canvas>
          </div>
          <div v-if="frameCount > 1" class="share-frame-info">
            <span class="badge badge-accent">{{ currentFrame + 1 }} / {{ frameCount }}</span>
            <span class="text-muted" style="font-size: 12px">animated — scan from Rarebox (Booth → Scan)</span>
          </div>
          <p v-else class="share-hint">Scannable with any phone camera — it's just a link.</p>

          <div class="share-link-row">
            <input class="input share-link-input" :value="shareUrl" readonly @click="$event.target.select()" />
            <button class="btn btn-primary btn-sm" @click="copyLink">{{ copied ? '✓' : 'Copy link' }}</button>
          </div>

          <div v-if="shortUrl" class="share-link-row">
            <input class="input share-link-input share-link-short" :value="shortUrl" readonly @click="$event.target.select()" />
            <button class="btn btn-primary btn-sm" @click="copyShort">{{ copiedShort ? '✓' : 'Copy short' }}</button>
          </div>
          <button v-else class="btn btn-secondary btn-sm share-shorten-btn" :disabled="shortening" @click="shorten">
            {{ shortening ? 'Shortening…' : '✂️ Shorten for socials' }}
          </button>
          <p v-if="shortUrl" class="share-short-note">Short link is stored by TinyURL and needs internet to open — the QR and full link stay self-contained.</p>
          <p v-if="shortenError" class="share-short-note share-short-error">{{ shortenError }}</p>

          <div class="share-info">
            <span class="text-muted" style="font-size: 12px">
              {{ booth.items?.length || 0 }} listing{{ (booth.items?.length || 0) !== 1 ? 's' : '' }} ·
              {{ fmtMoney(total) }} · link {{ urlSize }}
            </span>
          </div>
        </template>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" @click="$emit('close')">Done</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import QRCode from 'qrcode'
import { encodeBoothBytes, boothToUrl, boothTotal } from '../utils/booth'
import { buildFrames } from '../utils/qrTransfer'

const props = defineProps({ booth: { type: Object, required: true } })
defineEmits(['close'])

const qrCanvas = ref(null)
const building = ref(true)
const shareUrl = ref('')
const urlSize = ref('')
const copied = ref(false)
const shortUrl = ref('')
const shortening = ref(false)
const shortenError = ref('')
const copiedShort = ref(false)
const frameCount = ref(0)
const currentFrame = ref(0)
const total = boothTotal(props.booth)

// A URL QR up to ~2.3KB stays comfortably scannable by native cameras;
// bigger booths switch to the animated RBX2 code (in-app scanner).
const SINGLE_QR_LIMIT = 2300
const FRAME_MS = 400
let frames = []
let frameTimer = null

function fmtMoney(n) {
  return '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function prepare() {
  shareUrl.value = await boothToUrl(props.booth)
  urlSize.value = shareUrl.value.length < 1024 ? `${shareUrl.value.length} chars` : `${(shareUrl.value.length / 1024).toFixed(1)}k chars`
  building.value = false
  await nextTick()
  if (shareUrl.value.length <= SINGLE_QR_LIMIT) {
    frames = []
    frameCount.value = 1
    await QRCode.toCanvas(qrCanvas.value, shareUrl.value, {
      width: 300, margin: 2,
      color: { dark: '#141414', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
  } else {
    const bytes = await encodeBoothBytes(props.booth)
    frames = buildFrames(bytes)
    frameCount.value = frames.length
    drawFrame(0)
    frameTimer = setInterval(() => {
      currentFrame.value = (currentFrame.value + 1) % frames.length
      drawFrame(currentFrame.value)
    }, FRAME_MS)
  }
}

async function drawFrame(i) {
  if (!qrCanvas.value || !frames[i]) return
  await QRCode.toCanvas(qrCanvas.value, [{ data: frames[i], mode: 'byte' }], {
    width: 300, margin: 2,
    color: { dark: '#141414', light: '#ffffff' },
    errorCorrectionLevel: 'M',
  })
}

// TinyURL allows browser calls from rarebox.io (CORS) — the request goes
// straight from the seller's device to TinyURL, never through us. The
// trade-off is explicit in the UI: the short link lives in their database
// and needs internet to resolve; the QR/full link stay self-contained.
async function shorten() {
  shortening.value = true
  shortenError.value = ''
  try {
    const resp = await fetch('https://tinyurl.com/api-create.php?url=' + encodeURIComponent(shareUrl.value))
    const text = (await resp.text()).trim()
    if (!resp.ok || !text.startsWith('https://tinyurl.com/')) throw new Error('bad response')
    shortUrl.value = text
  } catch {
    shortenError.value = navigator.onLine
      ? "Couldn't shorten right now — the full link works everywhere."
      : 'Shortening needs a connection — the full link works everywhere.'
  } finally {
    shortening.value = false
  }
}

async function copyShort() {
  try {
    await navigator.clipboard.writeText(shortUrl.value)
    copiedShort.value = true
    setTimeout(() => { copiedShort.value = false }, 2000)
  } catch { /* manual select */ }
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch { /* user can select manually */ }
}

onMounted(prepare)
onBeforeUnmount(() => { if (frameTimer) clearInterval(frameTimer) })
</script>

<style scoped>
.share-desc { font-size: 13px; color: var(--text-secondary); margin-bottom: 16px; }
.share-building { display: flex; justify-content: center; padding: 50px 0; }
.qr-container { display: flex; justify-content: center; margin-bottom: 10px; }
.qr-canvas {
  border: var(--bw) solid var(--ink);
  border-radius: var(--radius);
  box-shadow: var(--shadow-xs);
  background: #fff;
}
.share-frame-info { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 12px; }
.share-hint { text-align: center; font-size: 12px; color: var(--text-muted); margin-bottom: 12px; }
.share-link-row { display: flex; gap: 8px; margin-bottom: 10px; }
.share-link-short { font-size: 13px; font-weight: 700; }
.share-shorten-btn { width: 100%; margin-bottom: 10px; }
.share-short-note { font-size: 11.5px; color: var(--text-muted); text-align: center; margin-bottom: 10px; line-height: 1.4; }
.share-short-error { color: var(--danger); font-weight: 600; }
.share-link-input { flex: 1; font-family: monospace; font-size: 11px; }
.share-info { text-align: center; }
</style>
