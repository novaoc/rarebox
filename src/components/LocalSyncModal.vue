<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal slide-up-enter-active" style="max-width: 480px">
      <div class="modal-header">
        <h3>{{ mode === 'send' ? '📤 Send to Device' : '📥 Receive from Device' }}</h3>
        <button class="btn btn-ghost btn-icon" @click="$emit('close')">✕</button>
      </div>

      <div class="modal-body">
        <!-- Mode tabs -->
        <div class="sync-tabs">
          <button class="sync-tab" :class="{ active: mode === 'send' }" @click="mode = 'send'">Send</button>
          <button class="sync-tab" :class="{ active: mode === 'receive' }" @click="mode = 'receive'">Receive</button>
        </div>

        <!-- SEND mode -->
        <template v-if="mode === 'send'">
          <p class="sync-desc">The other device can scan this QR code or paste the text below.</p>

          <!-- QR Code -->
          <div v-if="!qrTooLarge" class="qr-container">
            <canvas ref="qrCanvas" class="qr-canvas"></canvas>
          </div>
          <div v-else class="qr-fallback">
            <p class="text-muted" style="font-size: 13px; text-align: center;">
              Collection too large for QR code — use the text below instead.
            </p>
          </div>

          <!-- Copyable text -->
          <div class="sync-text-area">
            <textarea
              ref="sendTextarea"
              :value="compressedBase64 || encodedData"
              readonly
              class="input sync-textarea"
              rows="4"
              @click="selectText"
            ></textarea>
            <button class="btn btn-secondary btn-sm sync-copy-btn" @click="copyData">
              {{ copied ? '✓ Copied' : 'Copy' }}
            </button>
          </div>

          <div class="sync-info">
            <span class="text-muted" style="font-size: 12px">
              {{ itemCount }} item{{ itemCount !== 1 ? 's' : '' }} · {{ dataSize }}
            </span>
          </div>
        </template>

        <!-- RECEIVE mode -->
        <template v-if="mode === 'receive'">
          <p class="sync-desc">Paste the data from the sending device below.</p>

          <textarea
            v-model="receiveInput"
            class="input sync-textarea"
            placeholder="Paste sync data here..."
            rows="6"
          ></textarea>

          <div v-if="parseError" class="sync-error">{{ parseError }}</div>

          <div v-if="parsedBackup" class="sync-preview">
            <div class="sync-preview-title">Ready to import:</div>
            <div class="sync-preview-detail">
              {{ parsedBackup.data?.portfolios?.portfolios?.length || 0 }} portfolio(s)
            </div>
            <div class="sync-preview-detail" v-if="parsedBackup.exportedAt">
              Exported: {{ formatDate(parsedBackup.exportedAt) }}
            </div>
          </div>
        </template>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" @click="$emit('close')">Cancel</button>
        <button
          v-if="mode === 'receive'"
          class="btn btn-primary"
          :disabled="!parsedBackup"
          @click="doImport"
        >
          Import
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import QRCode from 'qrcode'
import { importBackup, validateBackup } from '../utils/backup'

const emit = defineEmits(['close'])

const mode = ref('send')
const copied = ref(false)

// ── Send ──
const qrCanvas = ref(null)
const sendTextarea = ref(null)
const qrTooLarge = ref(false)
const compressedBase64 = ref('')

// Compress string with gzip → base64
async function compressToBase64(str) {
  const bytes = new TextEncoder().encode(str)
  const cs = new CompressionStream('gzip')
  const writer = cs.writable.getWriter()
  writer.write(bytes)
  writer.close()
  const compressed = await new Response(cs.readable).arrayBuffer()
  // Convert to base64
  const arr = new Uint8Array(compressed)
  let binary = ''
  for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i])
  return btoa(binary)
}

// Decompress base64 → original string
async function decompressFromBase64(b64) {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const ds = new DecompressionStream('gzip')
  const writer = ds.writable.getWriter()
  writer.write(bytes)
  writer.close()
  const decompressed = await new Response(ds.readable).arrayBuffer()
  return new TextDecoder().decode(decompressed)
}

// Build backup data WITHOUT triggering download (exportBackup creates a file download)
function buildBackupData() {
  const payload = { version: 1, exportedAt: new Date().toISOString(), app: 'rarebox', data: {} }
  const keys = { portfolios: 'rarebox_portfolios', settings: 'rarebox_settings', snapshots: 'rarebox_snapshots' }
  for (const [label, key] of Object.entries(keys)) {
    const raw = localStorage.getItem(key)
    if (raw) try { payload.data[label] = JSON.parse(raw) } catch { payload.data[label] = raw }
  }
  const cacheKeys = Object.keys(localStorage).filter(k => k.startsWith('ph_cache_'))
  if (cacheKeys.length > 0) {
    payload.data.priceCache = {}
    for (const k of cacheKeys) {
      const raw = localStorage.getItem(k)
      if (raw) try { payload.data.priceCache[k] = JSON.parse(raw) } catch { payload.data.priceCache[k] = raw }
    }
  }
  return payload
}

// Strip bulky fields from card data for compact QR transfer.
// Keeps: name, set, number, prices, type, quantity — everything needed to restore.
// Drops: images, price history arrays, tcgdex raw data, price cache.
function compactForTransfer(payload) {
  const compact = JSON.parse(JSON.stringify(payload))
  // Drop price cache entirely — re-fetches on load
  delete compact.data.priceCache
  // Drop snapshots — not critical for transfer
  delete compact.data.snapshots
  // Slim down items inside portfolios
  const portfolios = compact.data.portfolios?.portfolios
  if (Array.isArray(portfolios)) {
    for (const p of portfolios) {
      if (!Array.isArray(p.items)) continue
      for (const item of p.items) {
        // Strip bulky card data fields
        if (item.cardData) {
          const cd = item.cardData
          // Keep essentials only
          item.cardData = {
            id: cd.id,
            name: cd.name,
            number: cd.number,
            set: cd.set ? { id: cd.set.id, name: cd.set.name, series: cd.set.series } : undefined,
            tcgplayer: cd.tcgplayer ? { prices: cd.tcgplayer.prices } : undefined,
          }
          // Remove undefined keys
          Object.keys(item.cardData).forEach(k => item.cardData[k] === undefined && delete item.cardData[k])
        }
      }
    }
  }
  return compact
}

const backupData = computed(() => buildBackupData())
const compactData = computed(() => compactForTransfer(backupData.value))
const encodedData = computed(() => JSON.stringify(compactData.value))
const itemCount = computed(() => {
  const portfolios = backupData.value.data?.portfolios?.portfolios || []
  return portfolios.reduce((s, p) => s + (p.items?.length || 0), 0)
})
const dataSize = computed(() => {
  const bytes = new Blob([encodedData.value]).size
  if (bytes < 1024) return `${bytes} B`
  return `${(bytes / 1024).toFixed(1)} KB`
})

async function generateQR() {
  if (!qrCanvas.value) return
  try {
    // Compress the JSON before encoding into QR
    const jsonStr = encodedData.value
    const bytes = new TextEncoder().encode(jsonStr)
    const cs = new CompressionStream('gzip')
    const writer = cs.writable.getWriter()
    writer.write(bytes)
    writer.close()
    const compressed = await new Response(cs.readable).arrayBuffer()
    const compressedArr = new Uint8Array(compressed)

    // Also store base64 version for clipboard
    let binary = ''
    for (let i = 0; i < compressedArr.length; i++) binary += String.fromCharCode(compressedArr[i])
    compressedBase64.value = btoa(binary)

    // QR with binary (byte mode) — version 40 + L correction = ~2953 bytes capacity
    if (compressedArr.length > 2900) {
      qrTooLarge.value = true
      return
    }
    qrTooLarge.value = false
    await QRCode.toCanvas(qrCanvas.value, compressedArr, {
      width: 280,
      margin: 2,
      color: { dark: '#141414', light: '#ffffff' },
      errorCorrectionLevel: 'L',
    })
  } catch (e) {
    console.error('QR generation failed:', e)
    qrTooLarge.value = true
  }
}

function selectText() {
  sendTextarea.value?.select()
}

async function copyData() {
  try {
    const text = compressedBase64.value || encodedData.value
    await navigator.clipboard.writeText(text)
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

watch(receiveInput, async (val) => {
  parseError.value = ''
  parsedBackup.value = null
  if (!val.trim()) return

  const input = val.trim()

  // Try parsing as raw JSON first (backwards compat)
  try {
    const data = JSON.parse(input)
    const err = validateBackup(data)
    if (err) { parseError.value = err; return }
    parsedBackup.value = data
    return
  } catch {}

  // Try decompressing from base64 (gzip compressed)
  try {
    const jsonStr = await decompressFromBase64(input)
    const data = JSON.parse(jsonStr)
    const err = validateBackup(data)
    if (err) { parseError.value = err; return }
    parsedBackup.value = data
  } catch {
    parseError.value = 'Invalid data — make sure you copied the full text'
  }
})

function doImport() {
  if (!parsedBackup.value) return
  try {
    importBackup(parsedBackup.value)
  } catch (e) {
    parseError.value = `Import failed: ${e.message}`
  }
}

function formatDate(iso) {
  try { return new Date(iso).toLocaleString() } catch { return iso }
}

// Generate QR on mount and when switching to send mode
watch(mode, (m) => { if (m === 'send') nextTick(generateQR) })
onMounted(() => { nextTick(generateQR) })
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

.qr-container {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}
.qr-canvas {
  border: var(--bw) solid var(--ink);
  border-radius: var(--radius);
  box-shadow: var(--shadow-xs);
  background: #fff;
}

.qr-fallback {
  padding: 20px;
  text-align: center;
  background: var(--bg-hover);
  border: var(--bw) solid var(--border-subtle);
  border-radius: var(--radius);
  margin-bottom: 16px;
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
