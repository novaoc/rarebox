<template>
  <div class="modal-overlay" @click.self="close">
    <div class="modal slide-up-enter-active" style="max-width: 480px">
      <div class="modal-header">
        <h3><RbIcon :name="mode === 'send' ? 'upload' : 'download'" :size="18" /> {{ mode === 'send' ? 'Send to Device' : 'Receive from Device' }}</h3>
        <button class="btn btn-ghost btn-icon" @click="close">✕</button>
      </div>

      <div class="modal-body">
        <!-- Mode tabs -->
        <div class="sync-tabs">
          <button class="sync-tab" :class="{ active: mode === 'send' }" @click="mode = 'send'">Send</button>
          <button class="sync-tab" :class="{ active: mode === 'receive' }" @click="mode = 'receive'">Receive</button>
        </div>

        <!-- SEND mode -->
        <template v-if="mode === 'send'">
          <p class="sync-desc">
            On the other device, open <strong>Settings → Device Transfer → Receive</strong> and point its camera here.
            {{ frameCount > 1 ? 'The code animates — hold steady until the other side completes.' : '' }}
          </p>

          <div v-if="building" class="sync-building">
            <div class="spinner"></div>
            <p class="text-muted" style="font-size: 13px">Packing your shelves…</p>
          </div>

          <template v-else>
            <div class="qr-container">
              <canvas ref="qrCanvas" class="qr-canvas"></canvas>
            </div>
            <div v-if="frameCount > 1" class="sync-frame-info">
              <span class="badge badge-accent">{{ currentFrame + 1 }} / {{ frameCount }}</span>
              <span class="text-muted" style="font-size: 12px">full cycle ≈ {{ cycleSeconds }}s</span>
            </div>

            <!-- Copyable text fallback -->
            <div class="sync-text-area">
              <textarea
                ref="sendTextarea"
                :value="compressedBase64"
                readonly
                class="input sync-textarea"
                rows="3"
                @click="selectText"
              ></textarea>
              <button class="btn btn-secondary btn-sm sync-copy-btn" @click="copyData">
                {{ copied ? '✓ Copied' : 'Copy' }}
              </button>
            </div>

            <div class="sync-info">
              <span class="text-muted" style="font-size: 12px">
                {{ itemCount }} item{{ itemCount !== 1 ? 's' : '' }}{{ deckCount ? ` · ${deckCount} deck${deckCount !== 1 ? 's' : ''}` : '' }} · {{ dataSize }}
              </span>
            </div>
          </template>
        </template>

        <!-- RECEIVE mode -->
        <template v-if="mode === 'receive'">
          <template v-if="!scanning">
            <button class="btn btn-primary sync-scan-btn" @click="startScan"><RbIcon name="camera" :size="15" /> Scan QR from other device</button>
            <p class="sync-desc" style="text-align:center; margin: 12px 0 8px">— or paste the copied text —</p>
          </template>

          <div v-show="scanning" class="sync-camera">
            <video ref="videoEl" class="sync-video" playsinline muted></video>
            <div class="sync-scan-progress">
              <template v-if="collectorTotal">
                <div class="sync-progress-bar">
                  <div class="sync-progress-fill" :style="{ width: (collectorGot / collectorTotal * 100) + '%' }"></div>
                </div>
                <span>{{ collectorGot }} / {{ collectorTotal }} parts — keep pointing at the code</span>
              </template>
              <span v-else>Looking for a Rarebox code…</span>
            </div>
            <button class="btn btn-secondary btn-sm" style="margin-top:8px" @click="stopScan">Cancel scan</button>
          </div>

          <textarea
            v-if="!scanning"
            v-model="receiveInput"
            class="input sync-textarea"
            placeholder="Paste sync data here..."
            rows="5"
          ></textarea>

          <div v-if="parseError" class="sync-error">{{ parseError }}</div>

          <div v-if="parsedBackup" class="sync-preview">
            <div class="sync-preview-title">Ready to import:</div>
            <div class="sync-preview-detail">
              {{ shelfCount === 1 ? '1 shelf' : `${shelfCount} shelves` }}<span v-if="parsedDeckCount"> · {{ parsedDeckCount }} deck{{ parsedDeckCount !== 1 ? 's' : '' }}</span><span v-if="parsedBackup.data?.trade"> · trade in progress</span>
            </div>
            <div class="sync-preview-detail" v-if="parsedBackup.exportedAt">
              Exported: {{ formatDate(parsedBackup.exportedAt) }}
            </div>
          </div>
        </template>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" @click="close">Cancel</button>
        <button
          v-if="mode === 'receive'"
          class="btn btn-primary"
          :disabled="!parsedBackup || importing"
          @click="doImport"
        >
          <span v-if="importing" class="spinner spinner-sm"></span>
          <span v-else>Import</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import RbIcon from './icons/RbIcon.vue'
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import QRCode from 'qrcode'
import jsQR from 'jsqr'
import { buildBackupPayload, importBackup, validateBackup } from '../utils/backup'
import { buildFrames, FrameCollector, isFrame, gzip, gunzip, bytesToBase64, base64ToBytes } from '../utils/qrTransfer'

const emit = defineEmits(['close'])

const mode = ref('send')
const copied = ref(false)

// ── Send ──
const qrCanvas = ref(null)
const sendTextarea = ref(null)
const building = ref(true)
const compressedBase64 = ref('')
const itemCount = ref(0)
const deckCount = ref(0)
const dataSize = ref('')
const frameCount = ref(0)
const currentFrame = ref(0)

const FRAME_MS = 400
const cycleSeconds = computed(() => Math.ceil((frameCount.value * FRAME_MS) / 1000))

let frames = []
let frameTimer = null

// Strip bulky fields from card data for compact transfer.
// Keeps: name, set, number, prices, quantity — everything needed to restore.
// Drops: images, price history arrays, raw API blobs, price cache.
function slimItems(items) {
  if (!Array.isArray(items)) return
  for (const item of items) {
    if (!item.cardData) continue
    const cd = item.cardData
    item.cardData = {
      id: cd.id,
      name: cd.name,
      number: cd.number,
      set: cd.set ? { id: cd.set.id, name: cd.set.name, series: cd.set.series } : undefined,
      tcgplayer: cd.tcgplayer ? { prices: cd.tcgplayer.prices } : undefined,
    }
    Object.keys(item.cardData).forEach(k => item.cardData[k] === undefined && delete item.cardData[k])
  }
}

function compactForTransfer(payload) {
  const compact = JSON.parse(JSON.stringify(payload))
  delete compact.data.priceCache // re-fetches on the other device
  delete compact.data.snapshots // history charts rebuild over time
  for (const p of compact.data.portfolios?.portfolios || []) slimItems(p.items)
  if (compact.data.trade) {
    slimItems(compact.data.trade.sideA)
    slimItems(compact.data.trade.sideB)
  }
  return compact
}

async function prepareSend() {
  building.value = true
  try {
    const payload = await buildBackupPayload({ includePriceCache: false })
    const portfolios = payload.data?.portfolios?.portfolios || []
    itemCount.value = portfolios.reduce((s, p) => s + (p.items?.length || 0), 0)
    deckCount.value = Array.isArray(payload.data?.decks) ? payload.data.decks.length : 0

    const json = JSON.stringify(compactForTransfer(payload))
    const bytes = await gzip(json)
    compressedBase64.value = bytesToBase64(bytes)
    const kb = bytes.length / 1024
    dataSize.value = kb < 1 ? `${bytes.length} B` : `${kb.toFixed(1)} KB compressed`

    frames = buildFrames(bytes)
    frameCount.value = frames.length
    currentFrame.value = 0
    building.value = false
    await nextTick()
    startFrameLoop()
  } catch (e) {
    console.error('Sync prepare failed:', e)
    building.value = false
  }
}

async function drawFrame(i) {
  if (!qrCanvas.value || !frames[i]) return
  try {
    await QRCode.toCanvas(qrCanvas.value, [{ data: frames[i], mode: 'byte' }], {
      width: 300,
      margin: 2,
      color: { dark: '#141414', light: '#ffffff' },
      errorCorrectionLevel: 'M',
    })
  } catch (e) {
    console.error('QR draw failed:', e)
  }
}

function startFrameLoop() {
  stopFrameLoop()
  drawFrame(0)
  if (frames.length <= 1) return
  frameTimer = setInterval(() => {
    currentFrame.value = (currentFrame.value + 1) % frames.length
    drawFrame(currentFrame.value)
  }, FRAME_MS)
}

function stopFrameLoop() {
  if (frameTimer) { clearInterval(frameTimer); frameTimer = null }
}

function selectText() {
  sendTextarea.value?.select()
}

async function copyData() {
  try {
    await navigator.clipboard.writeText(compressedBase64.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    selectText()
  }
}

// ── Receive ──
const receiveInput = ref('')
const parseError = ref('')
const parsedBackup = ref(null)
const scanning = ref(false)
const videoEl = ref(null)
const collectorGot = ref(0)
const collectorTotal = ref(0)

const shelfCount = computed(() => parsedBackup.value?.data?.portfolios?.portfolios?.length || 0)
const parsedDeckCount = computed(() => Array.isArray(parsedBackup.value?.data?.decks) ? parsedBackup.value.data.decks.length : 0)

let mediaStream = null
let scanTimer = null
let collector = null
let scanCanvas = null

async function acceptPayload(bytes) {
  const json = await gunzip(bytes)
  const data = JSON.parse(json)
  const err = validateBackup(data)
  if (err) { parseError.value = err; return }
  parseError.value = ''
  parsedBackup.value = data
}

async function startScan() {
  parseError.value = ''
  parsedBackup.value = null
  collector = new FrameCollector()
  collectorGot.value = 0
  collectorTotal.value = 0
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 } },
      audio: false,
    })
  } catch {
    parseError.value = 'Camera unavailable — paste the copied text instead.'
    return
  }
  scanning.value = true
  await nextTick()
  videoEl.value.srcObject = mediaStream
  await videoEl.value.play()
  scanCanvas = scanCanvas || document.createElement('canvas')
  scanTimer = setInterval(scanTick, 120)
}

async function scanTick() {
  const video = videoEl.value
  if (!video || video.readyState < 2) return
  const w = video.videoWidth, h = video.videoHeight
  if (!w) return
  scanCanvas.width = w
  scanCanvas.height = h
  const ctx = scanCanvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(video, 0, 0, w, h)
  const img = ctx.getImageData(0, 0, w, h)
  const code = jsQR(img.data, w, h, { inversionAttempts: 'dontInvert' })
  if (!code || !code.binaryData?.length) return
  const bytes = Uint8Array.from(code.binaryData)

  if (isFrame(bytes)) {
    if (collector.feed(bytes)) {
      collectorGot.value = collector.received
      collectorTotal.value = collector.total
    }
    if (collector.done) {
      stopScan()
      try { await acceptPayload(collector.assemble()) }
      catch { parseError.value = 'Transfer corrupted — try scanning again.' }
    }
  } else {
    // Legacy single-QR transfer: the whole gzip blob in one code
    stopScan()
    try { await acceptPayload(bytes) }
    catch { parseError.value = 'Not a Rarebox transfer code.' }
  }
}

function stopScan() {
  if (scanTimer) { clearInterval(scanTimer); scanTimer = null }
  if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null }
  scanning.value = false
}

watch(receiveInput, async (val) => {
  parseError.value = ''
  parsedBackup.value = null
  if (!val.trim()) return

  const input = val.trim()

  // Raw JSON (backwards compat)
  try {
    const data = JSON.parse(input)
    const err = validateBackup(data)
    if (err) { parseError.value = err; return }
    parsedBackup.value = data
    return
  } catch { /* not raw JSON */ }

  // gzip + base64
  try {
    await acceptPayload(base64ToBytes(input))
  } catch {
    parseError.value = 'Invalid data — make sure you copied the full text'
  }
})

// importBackup is async and ends in a page reload on success — awaiting it
// is what lets failures actually reach the catch instead of vanishing as an
// unhandled rejection while the modal sits there looking done.
const importing = ref(false)
async function doImport() {
  if (!parsedBackup.value || importing.value) return
  importing.value = true
  try {
    await importBackup(parsedBackup.value)
  } catch (e) {
    parseError.value = `Import failed: ${e.message}`
  } finally {
    importing.value = false
  }
}

function formatDate(iso) {
  try { return new Date(iso).toLocaleString() } catch { return iso }
}

function close() {
  stopScan()
  stopFrameLoop()
  emit('close')
}

watch(mode, (m) => {
  if (m === 'send') nextTick(() => { frames.length ? startFrameLoop() : prepareSend() })
  else stopFrameLoop()
  if (m !== 'receive') stopScan()
})
onMounted(() => { prepareSend() })
onBeforeUnmount(() => { stopScan(); stopFrameLoop() })
</script>

<style scoped>
.sync-tabs {
  display: flex;
  gap: 4px;
  margin-bottom: 16px;
  background: var(--bg-card);
  border: var(--bw) solid var(--ink);
  border-radius: var(--radius);
  padding: 3px;
}
.sync-tab {
  flex: 1;
  padding: 8px;
  border: 1.5px solid transparent;
  background: none;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}
.sync-tab.active {
  background: var(--accent);
  border-color: var(--on-accent);
  color: var(--on-accent);
}
.sync-tab:hover:not(.active) { color: var(--text-primary); }

.sync-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 16px;
}

.sync-building {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 40px 0;
}

.qr-container {
  display: flex;
  justify-content: center;
  margin-bottom: 10px;
}
.qr-canvas {
  border: var(--bw) solid var(--ink);
  border-radius: var(--radius);
  box-shadow: var(--shadow-xs);
  background: #fff;
}

.sync-frame-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin-bottom: 14px;
}

.sync-text-area {
  position: relative;
  margin-bottom: 12px;
}
.sync-textarea {
  width: 100%;
  font-family: monospace;
  font-size: 11px;
  resize: none;
}
.sync-copy-btn {
  position: absolute;
  top: 6px;
  right: 6px;
}

.sync-info { text-align: center; }

.sync-scan-btn { width: 100%; }

.sync-camera {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 12px;
}
.sync-video {
  width: 100%;
  max-height: 280px;
  object-fit: cover;
  border: var(--bw) solid var(--ink);
  border-radius: var(--radius);
  background: #000;
}
.sync-scan-progress {
  width: 100%;
  margin-top: 10px;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--text-secondary);
  text-align: center;
}
.sync-progress-bar {
  width: 100%;
  height: 10px;
  background: var(--bg-secondary);
  border: 1.5px solid var(--ink);
  border-radius: 999px;
  overflow: hidden;
  margin-bottom: 6px;
}
.sync-progress-fill {
  height: 100%;
  background: var(--success);
  transition: width 0.2s;
}

.sync-error {
  font-size: 13px;
  font-weight: 600;
  color: var(--danger);
  padding: 8px 12px;
  background: var(--danger-dim);
  border: 1.5px solid var(--ink);
  border-radius: var(--radius);
  margin-top: 12px;
}

.sync-preview {
  margin-top: 12px;
  padding: 12px;
  background: var(--success-dim);
  border: 1.5px solid var(--ink);
  border-radius: var(--radius);
}
.sync-preview-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--success-text);
  margin-bottom: 4px;
}
.sync-preview-detail {
  font-size: 12px;
  color: var(--text-secondary);
}
</style>
