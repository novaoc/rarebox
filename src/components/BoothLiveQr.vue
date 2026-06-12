<template>
  <div class="blq" :style="accent ? { borderTopColor: accent } : null">
    <div class="blq-head">
      <img v-if="brand.logo" :src="brand.logo" class="blq-logo" alt="" @error="$event.target.style.display='none'" />
      <span v-else class="blq-mark" :style="{ background: accent || 'var(--accent)', color: markInk }">{{ brand.mark || initial }}</span>
      <div class="blq-name">{{ booth?.name || 'Card booth' }}</div>
    </div>

    <canvas ref="canvas" class="blq-qr"></canvas>
    <div v-if="frameCount > 1" class="blq-frames">{{ frame + 1 }} / {{ frameCount }} — scan from Rarebox (Booth → Scan)</div>

    <div class="blq-sub">
      <span class="blq-live" :class="{ off: status !== 'live' }">● {{ statusLabel }}</span>
      <template v-if="booth"> {{ booth.items.length }} listing{{ booth.items.length !== 1 ? 's' : '' }} · {{ fmtMoney(total) }}</template>
    </div>
    <div class="blq-hint">Scan to browse this booth — updates as the table changes</div>

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
import { boothTotal, encodeBoothBytes } from '../utils/booth'

const props = defineProps({
  booth: { type: Object, default: null },
  shareBytes: { type: Object, default: null }, // Uint8Array — display view passes received bytes verbatim
  status: { type: String, default: 'live' },   // live | connecting | reconnecting | waiting
  size: { type: Number, default: 480 },
})

const canvas = ref(null)
const frameCount = ref(0)
const frame = ref(0)
let anim = null

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
    frameCount.value = 1
    // H-level redundancy buys room for the center badge
    await QRCode.toCanvas(canvas.value, url, {
      width: props.size, margin: 2,
      color: { dark: '#141414', light: '#ffffff' }, errorCorrectionLevel: 'H',
    })
    await drawBadge(canvas.value.getContext('2d'), canvas.value.width)
  } else {
    const { buildFrames } = await import('../utils/qrTransfer')
    const frames = buildFrames(bytes)
    frameCount.value = frames.length
    frame.value = 0
    const opts = { width: props.size, margin: 2, color: { dark: '#141414', light: '#ffffff' }, errorCorrectionLevel: 'M' }
    const draw = i => canvas.value && QRCode.toCanvas(canvas.value, [{ data: frames[i], mode: 'byte' }], opts)
    draw(0)
    anim = setInterval(() => { frame.value = (frame.value + 1) % frames.length; draw(frame.value) }, FRAME_MS)
  }
}

watch(() => [props.shareBytes, props.booth && JSON.stringify(props.booth.items), props.booth?.name], render, { immediate: true })
onBeforeUnmount(() => { if (anim) clearInterval(anim) })
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
</style>
