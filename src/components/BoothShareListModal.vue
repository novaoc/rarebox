<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal slide-up-enter-active" style="max-width: 500px">
      <div class="modal-header">
        <h3>📣 Share your saved shops</h3>
        <button class="btn btn-ghost btn-icon" @click="$emit('close')">✕</button>
      </div>

      <div class="modal-body">
        <!-- Step 1: pick shops -->
        <template v-if="stage === 'pick'">
          <p class="share-desc">
            Bundle saved booths into one <strong>directory</strong> — one QR or
            link that hands someone the whole list. Great for organizers:
            collect every seller's booth, share the hall in one code.
          </p>
          <div class="dirfield">
            <label>Directory title</label>
            <input v-model="title" class="input" placeholder="e.g. Anaheim Regionals — vendor hall" />
          </div>
          <div class="dir-pick-list">
            <label v-for="s in shops" :key="s.id" class="dir-pick-row">
              <input type="checkbox" v-model="selected" :value="s.id" />
              <span class="dir-pick-name">{{ s.booth.name }}</span>
              <span class="dir-pick-sub">{{ s.booth.items.length }} · {{ fmtMoney(boothTotal(s.booth)) }}</span>
            </label>
          </div>
          <p v-if="buildError" class="share-short-note share-short-error">{{ buildError }}</p>
        </template>

        <!-- Step 2: building -->
        <template v-else-if="stage === 'building'">
          <p class="share-desc">Packing booths — each gets a tiny short link so the whole hall fits one code…</p>
          <div class="dir-progress"><div class="bar"><i :style="{ width: (built / selected.length * 100) + '%' }"></i></div></div>
          <p class="dir-progress-label">{{ built }} / {{ selected.length }}</p>
        </template>

        <!-- Step 3: share artifacts -->
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

          <p v-if="usedShortener" class="share-short-note">
            Booth links inside the directory are stored by da.gd and need internet
            to download — once added, every shop works offline.
          </p>
          <p v-else class="share-short-note">
            Built fully self-contained (no shortener) — bigger code, but the
            import needs no connection at all.
          </p>

          <div class="share-info">
            <span class="text-muted" style="font-size: 12px">
              {{ selected.length }} booth{{ selected.length !== 1 ? 's' : '' }} · link {{ urlSize }}
            </span>
          </div>
        </template>
      </div>

      <div class="modal-footer">
        <template v-if="stage === 'pick'">
          <button class="btn btn-secondary" @click="$emit('close')">Cancel</button>
          <button class="btn btn-primary" :disabled="!selected.length" @click="build">
            Build directory ({{ selected.length }})
          </button>
        </template>
        <button v-else-if="stage === 'done'" class="btn btn-secondary" @click="$emit('close')">Done</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onBeforeUnmount } from 'vue'
import QRCode from 'qrcode'
import { boothToUrl, boothTotal, dagdShorten, directoryToUrl, encodeDirectoryBytes } from '../utils/booth'
import { buildFrames } from '../utils/qrTransfer'

const props = defineProps({ shops: { type: Array, required: true } })
defineEmits(['close'])

const stage = ref('pick')
const title = ref('')
const selected = ref(props.shops.map(s => s.id))
const built = ref(0)
const buildError = ref('')
const usedShortener = ref(true)

const qrCanvas = ref(null)
const shareUrl = ref('')
const urlSize = ref('')
const copied = ref(false)
const frameCount = ref(0)
const currentFrame = ref(0)

const SINGLE_QR_LIMIT = 2300
const FRAME_MS = 400
let frames = []
let frameTimer = null

function fmtMoney(n) {
  return '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

async function build() {
  stage.value = 'building'
  built.value = 0
  buildError.value = ''
  const chosen = props.shops.filter(s => selected.value.includes(s.id))
  const entries = []
  let shortenerOk = navigator.onLine

  for (const s of chosen) {
    const fullUrl = await boothToUrl(s.booth)
    let ref = fullUrl
    if (shortenerOk) {
      try {
        ref = 'dgd:' + await dagdShorten(fullUrl)
      } catch {
        // da.gd down → fall back to self-contained entries for the rest too,
        // so the directory doesn't mix half-working refs
        shortenerOk = false
        ref = fullUrl
      }
    }
    entries.push({
      name: s.booth.name,
      venue: s.booth.venue,
      count: s.booth.items.length,
      total: boothTotal(s.booth),
      ref,
    })
    built.value++
  }
  if (!shortenerOk) {
    // rebuild any earlier short refs as full URLs for consistency
    for (let i = 0; i < entries.length; i++) {
      if (entries[i].ref.startsWith('dgd:')) entries[i].ref = await boothToUrl(chosen[i].booth)
    }
  }
  usedShortener.value = shortenerOk

  shareUrl.value = await directoryToUrl(title.value, entries)
  urlSize.value = shareUrl.value.length < 1024 ? `${shareUrl.value.length} chars` : `${(shareUrl.value.length / 1024).toFixed(1)}k chars`
  stage.value = 'done'
  await nextTick()

  if (shareUrl.value.length <= SINGLE_QR_LIMIT) {
    frameCount.value = 1
    await QRCode.toCanvas(qrCanvas.value, shareUrl.value, {
      width: 300, margin: 2,
      color: { dark: '#141414', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
  } else {
    const bytes = await encodeDirectoryBytes(title.value, entries)
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

async function copyLink() {
  try {
    await navigator.clipboard.writeText(shareUrl.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch { /* manual select */ }
}

onBeforeUnmount(() => { if (frameTimer) clearInterval(frameTimer) })
</script>

<style scoped>
.share-desc { font-size: 13px; color: var(--text-secondary); margin-bottom: 14px; }
.dirfield { margin-bottom: 12px; }
.dirfield label { display: block; font-size: 12px; font-weight: 800; margin-bottom: 5px; }
.dir-pick-list { max-height: 38vh; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.dir-pick-row {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 10px; border: 1.5px solid var(--border-subtle); border-radius: 10px;
  cursor: pointer; font-size: 13.5px;
}
.dir-pick-row:hover { background: var(--bg-hover); }
.dir-pick-row input { width: 18px; height: 18px; accent-color: var(--accent); }
.dir-pick-name { font-weight: 700; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dir-pick-sub { font-size: 11.5px; color: var(--text-muted); white-space: nowrap; }

.dir-progress { margin: 14px 0 8px; }
.bar { height: 14px; border: 2px solid var(--ink); border-radius: 8px; background: var(--bg-secondary); overflow: hidden; }
.bar i { display: block; height: 100%; background: var(--success); transition: width .3s ease; }
.dir-progress-label { text-align: center; font-size: 12.5px; font-weight: 700; color: var(--text-secondary); }

.qr-container { display: flex; justify-content: center; margin-bottom: 10px; }
.qr-canvas { border: var(--bw) solid var(--ink); border-radius: var(--radius); box-shadow: var(--shadow-xs); background: #fff; }
.share-frame-info { display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 12px; }
.share-hint { text-align: center; font-size: 12px; color: var(--text-muted); margin-bottom: 12px; }
.share-link-row { display: flex; gap: 8px; margin-bottom: 10px; }
.share-link-input { flex: 1; font-family: monospace; font-size: 11px; }
.share-short-note { font-size: 11.5px; color: var(--text-muted); text-align: center; margin-bottom: 10px; line-height: 1.4; }
.share-short-error { color: var(--danger); font-weight: 600; }
.share-info { text-align: center; }
</style>
