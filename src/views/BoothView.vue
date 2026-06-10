<template>
  <div class="booth-page container">
    <!-- ── Incoming / opened shop (read-only) ───────────────────────── -->
    <template v-if="viewing">
      <div v-if="showInvite" class="booth-invite">
        <span class="booth-invite-mark" aria-hidden="true">RB</span>
        <span class="booth-invite-text">This booth was made with <strong>Rarebox</strong> — track your own collection free. No account, works offline.</span>
        <router-link to="/" class="btn btn-primary btn-sm" @click="dismissInvite">Try it</router-link>
        <button class="btn btn-ghost btn-icon" aria-label="Dismiss" @click="dismissInvite">✕</button>
      </div>

      <div class="shop-head card">
        <div class="shop-head-main">
          <span class="sticker">{{ viewing.booth.name }}</span>
          <div class="shop-meta">
            <span v-if="viewing.booth.venue">📍 {{ viewing.booth.venue }}</span>
            <span v-if="viewing.booth.date">🗓 {{ viewing.booth.date }}</span>
          </div>
          <p v-if="viewing.booth.note" class="shop-note">{{ viewing.booth.note }}</p>
        </div>
        <div class="shop-total">
          <div class="shop-total-label">Full table</div>
          <div class="shop-total-val">{{ fmtMoney(boothTotal(viewing.booth)) }}</div>
        </div>
      </div>

      <div class="shop-actions">
        <button v-if="!viewing.saved" class="btn btn-primary" @click="saveShop">⭐ Save this shop</button>
        <span v-else class="badge badge-success">✓ Saved</span>
        <button class="btn btn-secondary" @click="closeViewer">Back to Booth</button>
      </div>

      <div class="shop-grid">
        <div v-for="(it, i) in viewing.booth.items" :key="i" class="shop-item card-sm card">
          <div class="shop-item-img">
            <img v-if="it.img" :src="it.img" :alt="it.name" loading="lazy" @error="$event.target.style.display='none'" />
            <span v-else class="shop-item-noimg" aria-hidden="true">🃏</span>
          </div>
          <div class="shop-item-body">
            <div class="shop-item-name">{{ it.name }}</div>
            <div class="shop-item-sub">{{ [it.setName, it.number ? '#' + it.number : ''].filter(Boolean).join(' · ') }}</div>
            <div class="shop-item-row">
              <span class="badge badge-accent">{{ fmtMoney(it.price) }}</span>
              <span v-if="(it.qty || 1) > 1" class="text-muted shop-qty">×{{ it.qty }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- ── Hub: my booths + saved shops ─────────────────────────────── -->
    <template v-else>
      <section class="booth-hero">
        <h1 class="booth-title">Your table, <span class="marker">in their pocket</span>.</h1>
        <p class="booth-sub">
          Set up a booth for a card show, list what you're selling with your prices,
          and share it as a link or QR. Buyers see your table before they reach it —
          and everything stays on your devices, no servers involved.
        </p>
      </section>

      <section class="booth-section">
        <div class="booth-section-head">
          <h2>My booths</h2>
          <button class="btn btn-primary btn-sm" @click="createBooth">+ New booth</button>
        </div>

        <div v-if="!booths.length" class="empty-state">
          <p>No booths yet. Selling at a show, a store table, or out of a binder? Set one up in a minute.</p>
        </div>

        <div class="booth-grid">
          <div v-for="b in booths" :key="b.id" class="booth-card card">
            <div class="booth-card-name">{{ b.name }}</div>
            <div class="booth-card-meta">
              <span v-if="b.venue">📍 {{ b.venue }}</span>
              <span>{{ b.items.length }} listing{{ b.items.length !== 1 ? 's' : '' }}</span>
              <span class="text-accent" style="font-weight:800">{{ fmtMoney(boothTotal(b)) }}</span>
            </div>
            <div class="booth-card-actions">
              <router-link :to="`/booth/${b.id}`" class="btn btn-secondary btn-sm">Edit</router-link>
              <button class="btn btn-primary btn-sm" :disabled="!b.items.length" @click="shareBooth = b">Share</button>
              <button class="btn btn-ghost btn-sm" @click="deleteBooth(b.id)">Delete</button>
            </div>
          </div>
        </div>
      </section>

      <section class="booth-section">
        <div class="booth-section-head">
          <h2>Saved shops</h2>
          <button class="btn btn-secondary btn-sm" @click="startScan">📷 Scan a booth</button>
        </div>
        <p class="booth-section-sub">Booths other collectors shared with you — open them any time, even offline.</p>

        <div v-show="scanning" class="booth-camera">
          <video ref="videoEl" class="booth-video" playsinline muted></video>
          <div class="booth-scan-status">
            <template v-if="scanTotal">{{ scanGot }} / {{ scanTotal }} parts — keep pointing at the code</template>
            <template v-else>Looking for a booth code…</template>
          </div>
          <button class="btn btn-secondary btn-sm" style="margin-top:8px" @click="stopScan">Cancel</button>
        </div>
        <div v-if="scanError" class="booth-scan-error">{{ scanError }}</div>

        <div v-if="!savedShops.length && !scanning" class="empty-state">
          <p>Nothing saved yet. Scan a seller's QR or open their link, then hit <strong>Save this shop</strong>.</p>
        </div>

        <div class="booth-grid">
          <div v-for="s in savedShops" :key="s.id" class="booth-card card">
            <div class="booth-card-name">{{ s.booth.name }}</div>
            <div class="booth-card-meta">
              <span v-if="s.booth.venue">📍 {{ s.booth.venue }}</span>
              <span>{{ s.booth.items.length }} listing{{ s.booth.items.length !== 1 ? 's' : '' }}</span>
              <span class="text-accent" style="font-weight:800">{{ fmtMoney(boothTotal(s.booth)) }}</span>
            </div>
            <div class="booth-card-sub">Saved {{ fmtDate(s.savedAt) }}</div>
            <div class="booth-card-actions">
              <button class="btn btn-primary btn-sm" @click="openSaved(s)">Open</button>
              <button class="btn btn-ghost btn-sm" @click="removeSaved(s.id)">Remove</button>
            </div>
          </div>
        </div>
      </section>
    </template>

    <BoothShareModal v-if="shareBooth" :booth="shareBooth" @close="shareBooth = null" />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import jsQR from 'jsqr'
import BoothShareModal from '../components/BoothShareModal.vue'
import {
  loadBooths, saveBooths, loadSavedShops, saveSavedShops,
  boothFromLocation, decodeBoothBytes, boothTotal, generateBoothId,
} from '../utils/booth'
import { FrameCollector, isFrame } from '../utils/qrTransfer'

const router = useRouter()
const booths = ref(loadBooths())
const savedShops = ref(loadSavedShops())
const shareBooth = ref(null)
const viewing = ref(null) // { booth, saved }

// Invite newcomers (no TCG prefs = never onboarded), dismissibly
const INVITE_KEY = 'rarebox_booth_invite_dismissed'
const showInvite = ref(false)
try {
  showInvite.value = !localStorage.getItem('rarebox_tcg_prefs') && !localStorage.getItem(INVITE_KEY)
} catch { /* private mode */ }
function dismissInvite() {
  showInvite.value = false
  try { localStorage.setItem(INVITE_KEY, '1') } catch { /* private mode */ }
}

function fmtMoney(n) {
  return '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtDate(iso) {
  try { return new Date(iso).toLocaleDateString() } catch { return '' }
}

// ── My booths ──
function createBooth() {
  const booth = { id: generateBoothId(), name: 'My booth', venue: '', date: '', note: '', items: [], createdAt: new Date().toISOString() }
  booths.value.unshift(booth)
  saveBooths(booths.value)
  router.push(`/booth/${booth.id}`)
}

function deleteBooth(id) {
  if (!confirm('Delete this booth? Your shelf items are not affected.')) return
  booths.value = booths.value.filter(b => b.id !== id)
  saveBooths(booths.value)
}

// ── Incoming shares (link with #b=...) ──
async function checkIncoming() {
  try {
    const booth = await boothFromLocation(window.location.hash)
    if (booth) {
      viewing.value = { booth, saved: false }
      // tidy the URL so refresh/back doesn't re-trigger
      history.replaceState(null, '', window.location.pathname)
    }
  } catch {
    scanError.value = "That link looked like a booth, but it couldn't be read."
  }
}

function saveShop() {
  if (!viewing.value) return
  savedShops.value.unshift({ id: generateBoothId(), savedAt: new Date().toISOString(), booth: viewing.value.booth })
  saveSavedShops(savedShops.value)
  viewing.value.saved = true
}

function openSaved(s) {
  viewing.value = { booth: s.booth, saved: true }
}

function removeSaved(id) {
  savedShops.value = savedShops.value.filter(s => s.id !== id)
  saveSavedShops(savedShops.value)
}

function closeViewer() {
  viewing.value = null
}

// ── Scanner (handles both URL QRs and animated RBX2 booths) ──
const scanning = ref(false)
const scanError = ref('')
const scanGot = ref(0)
const scanTotal = ref(0)
const videoEl = ref(null)
let mediaStream = null
let scanTimer = null
let collector = null
let scanCanvas = null

async function startScan() {
  scanError.value = ''
  collector = new FrameCollector()
  scanGot.value = 0
  scanTotal.value = 0
  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false })
  } catch {
    scanError.value = 'Camera unavailable — open the shared link instead.'
    return
  }
  scanning.value = true
  videoEl.value.srcObject = mediaStream
  await videoEl.value.play()
  scanCanvas = scanCanvas || document.createElement('canvas')
  scanTimer = setInterval(scanTick, 120)
}

async function scanTick() {
  const video = videoEl.value
  if (!video || video.readyState < 2 || !video.videoWidth) return
  scanCanvas.width = video.videoWidth
  scanCanvas.height = video.videoHeight
  const ctx = scanCanvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(video, 0, 0)
  const img = ctx.getImageData(0, 0, scanCanvas.width, scanCanvas.height)
  const code = jsQR(img.data, scanCanvas.width, scanCanvas.height, { inversionAttempts: 'dontInvert' })
  if (!code) return

  // Plain URL QR (small booths — also scannable by native cameras)
  if (code.data && code.data.includes('/booth#b=')) {
    stopScan()
    try { viewing.value = { booth: await boothFromLocation(code.data), saved: false } }
    catch { scanError.value = "Couldn't read that booth code." }
    return
  }
  // Animated RBX2 frames (big booths)
  if (code.binaryData?.length) {
    const bytes = Uint8Array.from(code.binaryData)
    if (isFrame(bytes)) {
      if (collector.feed(bytes)) { scanGot.value = collector.received; scanTotal.value = collector.total }
      if (collector.done) {
        stopScan()
        try { viewing.value = { booth: await decodeBoothBytes(collector.assemble()), saved: false } }
        catch { scanError.value = 'Transfer corrupted — try scanning again.' }
      }
    }
  }
}

function stopScan() {
  if (scanTimer) { clearInterval(scanTimer); scanTimer = null }
  if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null }
  scanning.value = false
}

onMounted(checkIncoming)
onBeforeUnmount(stopScan)
</script>

<style scoped>
.booth-page { padding-bottom: 32px; }

.booth-hero { padding: 18px 0 6px; }
.booth-title { font-size: clamp(24px, 4.5vw, 34px); font-weight: 900; letter-spacing: -0.02em; margin-bottom: 8px; }
.booth-sub { font-size: 14px; color: var(--text-secondary); line-height: 1.6; max-width: 560px; }

.booth-section { margin-top: 26px; }
.booth-section-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 6px; }
.booth-section-head h2 { font-size: 19px; font-weight: 900; letter-spacing: -0.01em; }
.booth-section-sub { font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; }

.booth-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr)); gap: 14px; margin-top: 12px; }
.booth-card { padding: 16px; }
.booth-card-name { font-weight: 900; font-size: 16px; margin-bottom: 6px; }
.booth-card-meta { display: flex; flex-wrap: wrap; gap: 10px; font-size: 12.5px; color: var(--text-secondary); margin-bottom: 4px; }
.booth-card-sub { font-size: 11.5px; color: var(--text-muted); margin-bottom: 6px; }
.booth-card-actions { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }

/* shop viewer */
.shop-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; padding: 18px; margin-top: 16px; flex-wrap: wrap; }
.shop-meta { display: flex; gap: 14px; flex-wrap: wrap; font-size: 13px; color: var(--text-secondary); margin-top: 12px; }
.shop-note { font-size: 13px; color: var(--text-secondary); margin-top: 8px; max-width: 480px; }
.shop-total-label { font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); }
.shop-total-val { font-size: 26px; font-weight: 900; }
.shop-actions { display: flex; gap: 10px; align-items: center; margin: 14px 0; }
.shop-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 160px), 1fr)); gap: 12px; }
.shop-item { padding: 10px; display: flex; flex-direction: column; gap: 8px; }
/* Uniform mats: every listing gets the same white frame regardless of the
   product's image shape (tall booster boxes, wide tins, card scans) —
   images letterbox inside via object-fit: contain */
.shop-item-img {
  background: #fff;
  border: var(--bw) solid var(--ink);
  border-radius: 10px;
  padding: 4px;
  aspect-ratio: 3 / 4;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.shop-item-img img { width: 100%; height: 100%; object-fit: contain; border-radius: 6px; }
.shop-item-noimg { font-size: 34px; opacity: 0.35; }
.shop-item-body { display: flex; flex-direction: column; flex: 1; }
.shop-item-body .shop-item-row { margin-top: auto; padding-top: 6px; }

.booth-invite {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 14px;
  margin-top: 16px;
  background: var(--accent-dim);
  border: var(--bw) solid var(--ink);
  border-radius: var(--radius);
  box-shadow: var(--shadow-xs);
}
.booth-invite-mark {
  flex-shrink: 0;
  width: 30px; height: 30px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--accent);
  border: 2px solid var(--on-accent);
  border-radius: 8px;
  font-size: 12px; font-weight: 900; color: var(--on-accent);
  transform: rotate(-6deg);
}
.booth-invite-text { flex: 1; font-size: 12.5px; line-height: 1.45; }
.shop-item-name { font-weight: 800; font-size: 13.5px; line-height: 1.3; }
.shop-item-sub { font-size: 11.5px; color: var(--text-secondary); margin-top: 2px; }
.shop-item-row { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.shop-qty { font-size: 12px; font-weight: 700; }

/* scanner */
.booth-camera { display: flex; flex-direction: column; align-items: center; margin: 12px 0; }
.booth-video { width: 100%; max-width: 420px; max-height: 300px; object-fit: cover; border: var(--bw) solid var(--ink); border-radius: var(--radius); background: #000; }
.booth-scan-status { margin-top: 8px; font-size: 12.5px; font-weight: 700; color: var(--text-secondary); }
.booth-scan-error {
  font-size: 13px; font-weight: 600; color: var(--danger);
  padding: 8px 12px; background: var(--danger-dim);
  border: 1.5px solid var(--ink); border-radius: var(--radius); margin-top: 10px;
}
</style>
