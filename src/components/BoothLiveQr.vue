<template>
  <div class="blq" :style="accent ? { borderTopColor: accent } : null">
    <div class="blq-head">
      <img v-if="brand.logo" :src="brand.logo" class="blq-logo" alt="" @error="$event.target.style.display='none'" />
      <span v-else class="blq-mark" :style="{ background: accent || 'var(--accent)', color: markInk }">{{ brand.mark || initial }}</span>
      <div class="blq-name">{{ booth?.name || 'Card booth' }}</div>
    </div>

    <canvas ref="canvas" class="blq-qr"></canvas>
    <div v-if="frameCount > 1 && !guideOpen" class="blq-frames">{{ frame + 1 }} / {{ frameCount }} — scan from Rarebox (Booth → Scan)</div>
    <div v-if="shortBusy" class="blq-shortening">refreshing link…</div>

    <!-- Animated fallback: camera-only buyers get a 2-step ramp. Step 1 is a
         tiny static QR to the Rarebox scanner (their phone's data plan works
         even when THIS screen is offline); step 2 runs the animated code. -->
    <template v-if="shortFailed">
      <div v-if="!guideOpen" class="blq-mode-hint">
        This screen is offline — the code above needs the Rarebox scanner.
      </div>
      <button v-if="!guideOpen" class="blq-guide-btn" @click="guideOpen = true">📷 Only have a phone camera? Start here</button>
      <div v-else class="blq-guide">
        <strong>Get the scanner (uses your phone's internet):</strong>
        <ol>
          <li>Scan the code above with your camera — the Rarebox scanner opens in your browser</li>
          <li>Allow camera access when it asks</li>
          <li>Tap the button below, then point your phone at the moving code until it completes</li>
        </ol>
        <button class="blq-guide-btn blq-guide-go" @click="guideOpen = false">▶ Ready — show the moving code</button>
      </div>
    </template>

    <div class="blq-sub">
      <span class="blq-live" :class="{ off: status !== 'live' }">● {{ statusLabel }}</span>
      <template v-if="booth"> {{ booth.items.length }} listing{{ booth.items.length !== 1 ? 's' : '' }} · {{ fmtMoney(total) }}</template>
    </div>
    <div class="blq-hint">{{ guideOpen ? 'Step 1: scan this with your phone camera' : shortFailed ? 'Scan from Rarebox: Booth → Scan' : 'Point any phone camera here — the booth opens in the browser' }}</div>

    <div class="blq-foot">
      <span class="blq-rb">RB</span> made with <strong>rarebox</strong>
    </div>
  </div>
</template>

<script setup>
/**
 * The branded live QR — what sits on a stand all day.
 *
 * One face for both the on-device kiosk and the remote display: booth
 * identity up top (logo or monogram in the booth's accent), the code in
 * the middle, Rarebox's mark at the foot.
 *
 * Single-QR booths render at error-correction H and carry a center badge
 * (logo when the booth has one, monogram otherwise) — H tolerates ~30%
 * module loss and the badge covers ~5% of the area, so phones keep
 * scanning happily. Animated RBX2 booths stay badge-free: those frames
 * are raw binary chunks where every module counts.
 */
import { ref, computed, watch, onBeforeUnmount, nextTick } from 'vue'
import QRCode from 'qrcode'
import { boothTotal, encodeBoothBytes, dagdShorten } from '../utils/booth'

const props = defineProps({
  booth: { type: Object, default: null },
  shareBytes: { type: Object, default: null }, // Uint8Array — display view passes received bytes verbatim
  status: { type: String, default: 'live' },   // live | connecting | reconnecting | waiting
  size: { type: Number, default: 480 },
})

const canvas = ref(null)
const frameCount = ref(0)
const frame = ref(0)
const shortBusy = ref(false)
const shortFailed = ref(false)
const guideOpen = ref(false)
let anim = null
let shortInFlight = false
// short-link cache + throttle: one da.gd call per distinct state, ≥8s apart
let shortForUrl = ''
let shortUrl = ''
let lastShortenAt = 0
let shortTimer = null

const SINGLE_QR_LIMIT = 2300
const FRAME_MS = 400

const brand = computed(() => props.booth?.brand || {})
const accent = computed(() => /^#[0-9a-f]{6}$/i.test(brand.value.color || '') ? brand.value.color : '')
const initial = computed(() => (props.booth?.name || 'R').trim().charAt(0).toUpperCase())
const markInk = computed(() => {
  const c = accent.value
  if (!c) return '#141414'
  const [r, g, b] = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))
  return (0.299 * r + 0.587 * g + 0.114 * b) > 140 ? '#141414' : '#ffffff'
})
const total = computed(() => boothTotal(props.booth || {}))
const statusLabel = computed(() => ({ live: 'LIVE', connecting: 'CONNECTING', reconnecting: 'RECONNECTING', waiting: 'WAITING' }[props.status] || props.status.toUpperCase()))

function fmtMoney(n) {
  return '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function b64Url(bytes) {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Center badge: logo if it loads, monogram otherwise. */
async function drawBadge(ctx, W) {
  const side = Math.round(W * 0.21)
  const x = (W - side) / 2, y = (W - side) / 2, r = Math.round(side * 0.22)
  // white mat with ink edge, matching the listing mats
  ctx.fillStyle = '#ffffff'
  ctx.beginPath(); ctx.roundRect(x, y, side, side, r); ctx.fill()
  ctx.lineWidth = Math.max(2, side * 0.05); ctx.strokeStyle = '#141414'; ctx.stroke()

  const inset = Math.round(side * 0.12)
  if (brand.value.logo) {
    const ok = await new Promise(res => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        ctx.save()
        ctx.beginPath(); ctx.roundRect(x + inset, y + inset, side - 2 * inset, side - 2 * inset, r / 2); ctx.clip()
        // contain-fit
        const s = Math.min((side - 2 * inset) / img.width, (side - 2 * inset) / img.height)
        const w = img.width * s, h = img.height * s
        ctx.drawImage(img, x + (side - w) / 2, y + (side - h) / 2, w, h)
        ctx.restore()
        res(true)
      }
      img.onerror = () => res(false)
      img.src = brand.value.logo
    })
    if (ok) return
  }
  // monogram fallback
  ctx.fillStyle = accent.value || '#ffd23f'
  ctx.beginPath(); ctx.roundRect(x + inset, y + inset, side - 2 * inset, side - 2 * inset, r / 2); ctx.fill()
  ctx.fillStyle = markInk.value
  ctx.font = `900 ${Math.round(side * 0.34)}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText((brand.value.mark || initial.value).slice(0, 2), W / 2, W / 2 + side * 0.02)
}

async function render() {
  if (!props.booth && !props.shareBytes) return
  await nextTick()
  if (!canvas.value) return
  if (anim) { clearInterval(anim); anim = null }
  const bytes = props.shareBytes || await encodeBoothBytes(props.booth)
  const url = `${window.location.origin}/booth#b=${b64Url(bytes)}`

  if (url.length <= SINGLE_QR_LIMIT) {
    shortFailed.value = false
    guideOpen.value = false
    await drawStatic(url)
    return
  }
  // Big booth: a da.gd short link keeps it ONE static QR that any phone
  // camera opens — no Rarebox needed. Re-shortened when inventory changes
  // (throttled). Animated RBX2 survives only as the offline fallback: a
  // hotspot-only display can't reach da.gd, and a dead screen helps nobody.
  // navigator.onLine short-circuits the attempt entirely when offline.
  const ok = navigator.onLine === false ? false : await ensureShortLink(url)
  if (ok) {
    shortFailed.value = false
    guideOpen.value = false
    await drawStatic(shortUrl)
    return
  }
  shortFailed.value = true
  if (guideOpen.value) {
    // step 1 of the camera ramp: a tiny always-scannable QR to the scanner
    await drawStatic(`${window.location.origin}/booth?scan=1`)
    frameCount.value = 1
    return
  }
  drawAnimated(bytes)
}

async function drawStatic(payload) {
  frameCount.value = 1
  // H-level redundancy buys room for the center badge
  await QRCode.toCanvas(canvas.value, payload, {
    width: props.size, margin: 2,
    color: { dark: '#141414', light: '#ffffff' }, errorCorrectionLevel: 'H',
  })
  await drawBadge(canvas.value.getContext('2d'), canvas.value.width)
}

async function drawAnimated(bytes) {
  const { buildFrames } = await import('../utils/qrTransfer')
  const frames = buildFrames(bytes)
  frameCount.value = frames.length
  frame.value = 0
  const opts = { width: props.size, margin: 2, color: { dark: '#141414', light: '#ffffff' }, errorCorrectionLevel: 'M' }
  const draw = i => canvas.value && QRCode.toCanvas(canvas.value, [{ data: frames[i], mode: 'byte' }], opts)
  draw(0)
  anim = setInterval(() => { frame.value = (frame.value + 1) % frames.length; draw(frame.value) }, FRAME_MS)
}

async function ensureShortLink(url) {
  if (shortForUrl === url && shortUrl) return true
  if (shortInFlight) return shortForUrl !== '' && !!shortUrl // one fetch at a time; stale link beats none
  // throttle: a burst of edits re-renders often; shorten at most every 8s,
  // with a trailing retry so the QR converges on the latest state
  const wait = Math.max(0, lastShortenAt + 8000 - Date.now())
  if (wait > 0) {
    clearTimeout(shortTimer)
    shortTimer = setTimeout(render, wait + 50)
    return !!shortUrl // keep showing the previous short link meanwhile
  }
  lastShortenAt = Date.now()
  shortBusy.value = true
  shortInFlight = true
  try {
    const code = await dagdShorten(url)
    shortUrl = 'https://da.gd/' + code
    shortForUrl = url
    return true
  } catch {
    return false
  } finally {
    shortBusy.value = false
    shortInFlight = false
  }
}

watch(() => [props.shareBytes, props.booth && JSON.stringify(props.booth.items), props.booth?.name], render, { immediate: true })
let retryTimer = setInterval(() => { if (shortFailed.value && !guideOpen.value) render() }, 30000)
function onOnline() { lastShortenAt = 0; guideOpen.value = false; render() }
function onOffline() { render() } // flip to the offline path right away
function onVisible() { if (document.visibilityState === 'visible' && shortFailed.value) { lastShortenAt = 0; render() } }
window.addEventListener('online', onOnline)
window.addEventListener('offline', onOffline)
document.addEventListener('visibilitychange', onVisible)
watch(guideOpen, render)
onBeforeUnmount(() => {
  if (anim) clearInterval(anim)
  clearTimeout(shortTimer)
  clearInterval(retryTimer)
  window.removeEventListener('online', onOnline)
  window.removeEventListener('offline', onOffline)
  document.removeEventListener('visibilitychange', onVisible)
})
</script>

<style scoped>
.blq {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  background: var(--bg-card, #fff);
  border: var(--bw, 3px) solid var(--ink, #141414);
  border-top-width: 8px;
  border-radius: var(--radius-lg, 18px);
  box-shadow: var(--shadow-sm, 5px 5px 0 #141414);
  padding: 18px clamp(16px, 4vw, 30px) 14px;
  max-width: min(92vw, 560px);
}
.blq-head { display: flex; align-items: center; gap: 12px; max-width: 100%; }
.blq-logo { height: 44px; max-width: 160px; object-fit: contain; border: 1.5px solid var(--ink, #141414); border-radius: 10px; background: #fff; padding: 3px; }
.blq-mark {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 44px; height: 44px; padding: 0 9px;
  border: 2px solid var(--ink, #141414); border-radius: 12px;
  font-size: 19px; font-weight: 900;
}
.blq-name { font-size: clamp(18px, 3.4vw, 26px); font-weight: 900; letter-spacing: -0.01em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.blq-qr {
  border: 2.5px solid var(--ink, #141414); border-radius: 12px; background: #fff;
  width: min(74vw, 50vh) !important; height: auto !important;
}
.blq-frames { font-size: 12px; font-weight: 700; color: var(--text-secondary, #5f5a51); }
.blq-sub { font-size: 14.5px; font-weight: 800; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: center; }
.blq-live { color: #c92f2f; font-weight: 900; letter-spacing: 0.04em; animation: blq-pulse 1.6s ease infinite; }
.blq-live.off { color: var(--text-muted, #8a8478); animation: none; }
@keyframes blq-pulse { 50% { opacity: 0.45; } }
.blq-hint { font-size: 12.5px; font-weight: 700; color: var(--text-secondary, #5f5a51); }
.blq-foot {
  display: flex; align-items: center; gap: 7px;
  font-size: 12px; font-weight: 700; color: var(--text-secondary, #5f5a51);
  border-top: 1.5px solid var(--border-subtle, #e7dfd0);
  width: 100%; justify-content: center; padding-top: 9px; margin-top: 2px;
}
.blq-rb {
  display: inline-flex; align-items: center; justify-content: center;
  width: 22px; height: 22px; border-radius: 6px;
  background: var(--accent, #ffd23f); color: var(--on-accent, #141414);
  border: 1.5px solid var(--ink, #141414);
  font-size: 10px; font-weight: 900; transform: rotate(-6deg);
}
.blq-mode-hint { font-size: 11.5px; font-weight: 700; color: var(--text-secondary, #5f5a51); max-width: 420px; text-align: center; }
.blq-shortening { font-size: 11px; font-weight: 700; color: var(--text-muted, #8a8478); }
.blq-guide-btn {
  font: inherit; font-size: 14px; font-weight: 900;
  padding: 10px 18px; cursor: pointer;
  color: var(--on-accent, #141414); background: var(--accent, #ffd23f);
  border: 2px solid var(--ink, #141414); border-radius: 12px;
  box-shadow: var(--shadow-sm, 3px 3px 0 #141414);
}
.blq-guide-btn:active { box-shadow: none; transform: translate(1px, 1px); }
.blq-guide { display: flex; flex-direction: column; gap: 8px; max-width: 440px; font-size: 13px; text-align: left; }
.blq-guide ol { padding-left: 20px; display: flex; flex-direction: column; gap: 5px; line-height: 1.45; }
.blq-guide-go { align-self: center; }
</style>
