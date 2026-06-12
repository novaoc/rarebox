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
          <div v-if="(booth.binders || []).length" class="share-scope">
            <label>QR for</label>
            <select v-model="scope" class="select select-sm">
              <option value="all">Whole booth ({{ booth.items.length }})</option>
              <option v-for="b in booth.binders" :key="b.id" :value="b.id">{{ b.icon }} {{ b.name }} ({{ binderItems(booth, b).length }})</option>
            </select>
          </div>
          <div class="qr-container">
            <canvas ref="qrCanvas" class="qr-canvas"></canvas>
          </div>
          <div v-if="frameCount > 1" class="share-frame-info">
            <span class="badge badge-accent">{{ currentFrame + 1 }} / {{ frameCount }}</span>
            <span class="text-muted" style="font-size: 12px">offline mode: animated — scan from Rarebox (Booth → Scan). Reopen with a connection for a camera-friendly code.</span>
          </div>
          <p v-else-if="qrShortUrl" class="share-hint">Scannable with any phone camera — a short link to the whole booth (stored by da.gd).</p>
          <p v-else class="share-hint">Scannable with any phone camera — it's just a link.</p>

          <button class="btn btn-secondary btn-sm share-poster-btn" :disabled="posterBusy" @click="downloadPoster">
            {{ posterBusy ? 'Building poster…' : '🖼 Download as picture' }}
          </button>
          <p v-if="posterError" class="share-short-note share-short-error">{{ posterError }}</p>

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
import { ref, onMounted, onBeforeUnmount, nextTick, watch, computed } from 'vue'
import QRCode from 'qrcode'
import { encodeBoothBytes, boothToUrl, boothTotal, fmtBoothDate, dagdShorten, binderItems } from '../utils/booth'
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
const posterBusy = ref(false)
const posterError = ref('')
const frameCount = ref(0)
const currentFrame = ref(0)
const qrShortUrl = ref('')
// Per-binder QR: share one lens of the table as its own code — the
// buyer side just sees a smaller booth, no new share format needed
const scope = ref('all')
const sharedBooth = computed(() => {
  const b = props.booth
  if (scope.value === 'all') return b
  const binder = (b.binders || []).find(x => x.id === scope.value)
  if (!binder) return b
  return { ...b, name: `${b.name} — ${binder.name}`, items: binderItems(b, binder), binders: [] }
})
const total = computed(() => boothTotal(sharedBooth.value))

// A URL QR up to ~2.3KB stays comfortably scannable by native cameras;
// bigger booths switch to the animated RBX2 code (in-app scanner).
const SINGLE_QR_LIMIT = 2300
const FRAME_MS = 400
let frames = []
let frameTimer = null

function fmtMoney(n) {
  return '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

watch(scope, () => {
  if (frameTimer) { clearInterval(frameTimer); frameTimer = null }
  qrShortUrl.value = ''
  shortUrl.value = ''
  building.value = true
  prepare()
})

function onShareOnline() {
  if (frameCount.value > 1) {
    if (frameTimer) { clearInterval(frameTimer); frameTimer = null }
    building.value = true
    prepare()
  }
}
window.addEventListener('online', onShareOnline)

async function prepare() {
  shareUrl.value = await boothToUrl(sharedBooth.value)
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
    return
  }
  // Big booth: shorten via da.gd so it stays ONE camera-scannable QR —
  // anyone's phone opens it, no Rarebox needed. Animated frames are only
  // the offline fallback (shortener unreachable).
  try {
    if (navigator.onLine === false) throw new Error('offline')
    const code = await dagdShorten(shareUrl.value)
    qrShortUrl.value = 'https://da.gd/' + code
    frames = []
    frameCount.value = 1
    await QRCode.toCanvas(qrCanvas.value, qrShortUrl.value, {
      width: 300, margin: 2,
      color: { dark: '#141414', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
    return
  } catch { /* offline / da.gd down — animate below */ }
  const bytes = await encodeBoothBytes(sharedBooth.value)
  frames = buildFrames(bytes)
  frameCount.value = frames.length
  drawFrame(0)
  frameTimer = setInterval(() => {
    currentFrame.value = (currentFrame.value + 1) % frames.length
    drawFrame(currentFrame.value)
  }, FRAME_MS)
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

/**
 * Downloadable QR poster — Tactile-branded (cream paper, RB sticker,
 * booth-name chip, QR on a white mat with a hard shadow, games band).
 * 1080×1350 (4:5) so it posts clean on socials and prints fine.
 * Big booths can't fit a camera-scannable QR, so the poster falls back
 * to the TinyURL short link (shortened on demand).
 */
async function downloadPoster() {
  posterBusy.value = true
  posterError.value = ''
  try {
    let url = shareUrl.value
    if (url.length > SINGLE_QR_LIMIT) {
      if (!shortUrl.value) await shorten()
      if (!shortUrl.value) throw new Error('shorten-failed')
      url = shortUrl.value
    }

    const qr = document.createElement('canvas')
    await QRCode.toCanvas(qr, url, {
      width: 520, margin: 0,
      color: { dark: '#141414', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })

    const W = 1080, H = 1350
    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    const ctx = canvas.getContext('2d')
    const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    const INK = '#141414', CREAM = '#faf6ef', YELLOW = '#ffd23f'

    ctx.fillStyle = CREAM
    ctx.fillRect(0, 0, W, H)

    // header: RB sticker + wordmark
    ctx.save()
    ctx.translate(120, 120)
    ctx.rotate(-6 * Math.PI / 180)
    ctx.fillStyle = INK
    ctx.beginPath(); ctx.roundRect(-36, -36, 84, 84, 20); ctx.fill() // hard shadow
    ctx.fillStyle = YELLOW
    ctx.beginPath(); ctx.roundRect(-44, -44, 84, 84, 20); ctx.fill()
    ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke()
    ctx.fillStyle = INK
    ctx.font = `900 34px ${FONT}`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('RB', -2, 0)
    ctx.restore()
    ctx.fillStyle = INK
    ctx.font = `900 64px ${FONT}`
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText('rarebox', 188, 118)

    // booth name chip (rotated sticker) — painted in the booth's brand
    // color when one is set, Rarebox yellow otherwise
    const brandHex = /^#[0-9a-f]{6}$/i.test(sharedBooth.value.brand?.color || '') ? sharedBooth.value.brand.color : ''
    const chipBg = brandHex || YELLOW
    const [cr, cg, cb] = [1, 3, 5].map(i => parseInt(chipBg.slice(i, i + 2), 16))
    const chipInk = (0.299 * cr + 0.587 * cg + 0.114 * cb) > 140 ? INK : '#ffffff'
    const name = (sharedBooth.value.name || 'Card booth').slice(0, 34)
    ctx.font = `900 50px ${FONT}`
    const nameW = ctx.measureText(name).width + 72
    ctx.save()
    ctx.translate(W / 2, 268)
    ctx.rotate(-2 * Math.PI / 180)
    ctx.fillStyle = INK
    ctx.beginPath(); ctx.roundRect(-nameW / 2 + 7, -45 + 7, nameW, 90, 18); ctx.fill()
    ctx.fillStyle = chipBg
    ctx.beginPath(); ctx.roundRect(-nameW / 2, -45, nameW, 90, 18); ctx.fill()
    ctx.lineWidth = 5; ctx.strokeStyle = INK; ctx.stroke()
    ctx.fillStyle = chipInk
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(name, 0, 2)
    ctx.restore()

    // venue / table / date
    const meta = [sharedBooth.value.venue, sharedBooth.value.table && `Table ${sharedBooth.value.table}`, fmtBoothDate(sharedBooth.value.date)].filter(Boolean).join('  ·  ')
    if (meta) {
      ctx.fillStyle = '#5f5a51'
      ctx.font = `700 34px ${FONT}`
      ctx.textAlign = 'center'
      ctx.fillText(meta.slice(0, 52), W / 2, 358)
    }

    // QR on a white mat with hard shadow
    const matSize = 600, matX = (W - matSize) / 2, matY = 410
    ctx.fillStyle = INK
    ctx.beginPath(); ctx.roundRect(matX + 14, matY + 14, matSize, matSize, 28); ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath(); ctx.roundRect(matX, matY, matSize, matSize, 28); ctx.fill()
    ctx.lineWidth = 6; ctx.strokeStyle = INK; ctx.stroke()
    ctx.drawImage(qr, matX + 40, matY + 40, 520, 520)

    // scan hint + table line
    ctx.fillStyle = '#5f5a51'
    ctx.font = `700 32px ${FONT}`
    ctx.textAlign = 'center'
    ctx.fillText('Scan to browse this booth', W / 2, matY + matSize + 68)
    const count = sharedBooth.value.items?.length || 0
    ctx.fillStyle = INK
    ctx.font = `900 42px ${FONT}`
    ctx.fillText(`${count} listing${count !== 1 ? 's' : ''}  ·  ${fmtMoney(total.value)} full table`, W / 2, matY + matSize + 128)

    // marketing line + games band
    ctx.font = `900 40px ${FONT}`
    ctx.fillText('Collect. Track. Trade. Win.', W / 2, H - 138)
    ctx.fillStyle = YELLOW
    ctx.fillRect(0, H - 78, W, 78)
    ctx.fillStyle = INK
    ctx.fillRect(0, H - 84, W, 6)
    ctx.font = `900 26px ${FONT}`
    ctx.fillText('POKÉMON  ★  MAGIC  ★  YU-GI-OH!  ★  ONE PIECE  ★  LORCANA  ★  RIFTBOUND', W / 2, H - 38)

    const blob = await new Promise(res => canvas.toBlob(res, 'image/png'))
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `${(sharedBooth.value.name || 'booth').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-qr.png`
    a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 5000)
  } catch {
    posterError.value = navigator.onLine
      ? "Couldn't build the poster — big booths need a short link first."
      : 'Big booths need a connection once to build a poster (short link).'
  } finally {
    posterBusy.value = false
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
onBeforeUnmount(() => {
  window.removeEventListener('online', onShareOnline)
  if (frameTimer) clearInterval(frameTimer)
})
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
.share-poster-btn { display: block; margin: 0 auto 12px; }
.share-short-note { font-size: 11.5px; color: var(--text-muted); text-align: center; margin-bottom: 10px; line-height: 1.4; }
.share-short-error { color: var(--danger); font-weight: 600; }
.share-link-input { flex: 1; font-family: monospace; font-size: 11px; }
.share-info { text-align: center; }
.share-scope { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; font-size: 12.5px; font-weight: 800; }
.share-scope .select { flex: 1; }
</style>
