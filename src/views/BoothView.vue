<template>
  <div class="booth-page container">
    <!-- ── Incoming directory (a list of booths someone shared) ──────── -->
    <template v-if="dirViewing">
      <div class="shop-head card">
        <div class="shop-head-main">
          <span class="sticker">{{ dirViewing.title }}</span>
          <div class="shop-meta">
            <span>📦 {{ dirViewing.entries.length }} booth{{ dirViewing.entries.length !== 1 ? 's' : '' }}</span>
            <span v-if="dirChecking" class="text-muted">checking links…</span>
            <span v-else-if="dirExpired" class="badge badge-danger">{{ dirExpired }} expired</span>
          </div>
          <p class="shop-note">A booth directory — each entry downloads as its own shop, saved for offline.</p>
        </div>
      </div>

      <div class="shop-actions">
        <button class="btn btn-primary" :disabled="dirBusy || !dirLive" @click="addAllFromDirectory">
          {{ dirBusy ? `Adding booth ${dirDone + 1} / ${dirViewing.entries.length}…` : `⭐ Add all to saved shops${dirExpired ? ` (${dirLive})` : ''}` }}
        </button>
        <button class="btn btn-secondary" :disabled="dirBusy" @click="dirViewing = null">Back to Booth</button>
      </div>
      <p v-if="dirExpired && !dirChecking" class="shop-compare-note">
        {{ dirExpired }} booth{{ dirExpired !== 1 ? 's' : '' }} expired — the seller's share link no longer exists, so {{ dirExpired !== 1 ? 'they are' : 'it is' }} skipped.
      </p>
      <div v-if="dirBusy" class="dir-progress">
        <div class="bar"><i :style="{ width: (dirDone / dirViewing.entries.length * 100) + '%' }"></i></div>
      </div>

      <div class="booth-grid">
        <div v-for="(en, i) in dirViewing.entries" :key="i" class="booth-card card" :class="{ 'booth-card-dead': en.status === 'dead' }">
          <div class="booth-card-name">{{ en.name }}</div>
          <div class="booth-card-meta">
            <span v-if="en.venue">📍 {{ en.venue }}</span>
            <span>{{ en.count }} listing{{ en.count !== 1 ? 's' : '' }}</span>
            <span class="text-accent" style="font-weight:800">{{ fmtMoney(en.total) }}</span>
          </div>
          <div class="booth-card-sub">
            <span v-if="en.status === 'ok'" class="badge badge-success">✓ Saved</span>
            <span v-else-if="en.status === 'dead'" class="badge badge-danger">Expired — link is gone</span>
            <span v-else-if="en.status === 'err'" class="badge badge-danger">⚠ Couldn't load</span>
            <span v-else-if="en.status === 'busy'" class="badge badge-info">Downloading…</span>
          </div>
        </div>
      </div>
    </template>

    <!-- ── Incoming / opened shop (read-only) ───────────────────────── -->
    <template v-else-if="viewing">
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
            <span v-if="viewing.booth.table">🪧 Table {{ viewing.booth.table }}</span>
            <span v-if="viewing.booth.date">🗓 {{ viewing.booth.date }}</span>
          </div>
          <p v-if="viewing.booth.note" class="shop-note">{{ viewing.booth.note }}</p>
          <a v-if="viewing.booth.loc" class="btn btn-secondary btn-sm shop-directions" :href="directionsUrl(viewing.booth.loc, viewing.booth.locName || viewing.booth.name)" target="_blank" rel="noopener">
            🧭 Get directions{{ viewing.booth.locName ? ` — ${viewing.booth.locName}` : '' }}
          </a>
        </div>
        <div class="shop-total">
          <div class="shop-total-label">Full table</div>
          <div class="shop-total-val">{{ fmtMoney(boothTotal(viewing.booth)) }}</div>
          <div v-if="viewingVerdict" class="badge shop-verdict" :class="`badge-${viewingVerdict.cls}`">{{ viewingVerdict.label }}</div>
        </div>
      </div>

      <div class="shop-actions">
        <button v-if="!viewing.saved" class="btn btn-primary" @click="saveShop">⭐ Save this shop</button>
        <span v-else class="badge badge-success">✓ Saved</span>
        <button class="btn btn-secondary" :disabled="comparing" @click="compareMarket">
          {{ comparing ? `Checking prices ${compareDone}/${compareTotal}…` : '📊 Compare to market' }}
        </button>
        <button class="btn btn-secondary" @click="closeViewer">Back to Booth</button>
      </div>
      <p v-if="viewing.market" class="shop-compare-note">
        {{ viewing.market.matched }} of {{ viewing.market.total }} listings matched to live market prices —
        asking {{ fmtMoney(viewing.market.askTotal) }} vs market {{ fmtMoney(viewing.market.marketTotal) }}.
      </p>

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
              <span v-if="itemDelta(i)" class="shop-mkt" :class="itemDelta(i).cls">{{ itemDelta(i).label }}</span>
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
              <span v-if="b.table">🪧 {{ b.table }}</span>
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
          <div class="booth-head-actions">
            <button v-if="savedShops.length > 1" class="btn btn-secondary btn-sm" @click="shareListOpen = true">📣 Share list</button>
            <button class="btn btn-secondary btn-sm" @click="startScan">📷 Scan a booth</button>
          </div>
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

        <div v-if="savedShops.length" class="booth-tools">
          <input v-model="shopFilter" class="input booth-filter" placeholder="🔍 Find a card across every saved shop…" />
          <select v-model="shopSort" class="select booth-sort" aria-label="Sort saved shops">
            <option value="newest">Newest first</option>
            <option value="cheap">Total: low → high</option>
            <option value="dear">Total: high → low</option>
            <option value="abc">Name A → Z</option>
          </select>
        </div>

        <div v-if="!savedShops.length && !scanning" class="empty-state">
          <p>Nothing saved yet. Scan a seller's QR or open their link, then hit <strong>Save this shop</strong>.</p>
        </div>

        <!-- Cross-shop card search results -->
        <template v-if="shopFilter.trim()">
          <p class="booth-filter-note">
            {{ filterHits.reduce((s, h) => s + h.items.length, 0) }} match{{ filterHits.reduce((s, h) => s + h.items.length, 0) !== 1 ? 'es' : '' }}
            across {{ filterHits.length }} shop{{ filterHits.length !== 1 ? 's' : '' }}
          </p>
          <div class="booth-grid">
            <div v-for="h in filterHits" :key="h.shop.id" class="booth-card card">
              <div class="booth-card-name">{{ h.shop.booth.name }}</div>
              <div class="booth-card-meta">
                <span v-if="h.shop.booth.venue">📍 {{ h.shop.booth.venue }}</span>
                <span v-if="h.shop.booth.table">🪧 {{ h.shop.booth.table }}</span>
              </div>
              <div class="booth-hit" v-for="(it, i) in h.items.slice(0, 6)" :key="i">
                <span class="booth-hit-name">{{ it.name }}</span>
                <span class="badge badge-accent booth-hit-price">{{ fmtMoney(it.price) }}</span>
              </div>
              <div v-if="h.items.length > 6" class="booth-card-sub">+ {{ h.items.length - 6 }} more</div>
              <div class="booth-card-actions">
                <button class="btn btn-primary btn-sm" @click="openSaved(h.shop)">Open shop</button>
              </div>
            </div>
          </div>
          <div v-if="!filterHits.length" class="empty-state"><p>No saved shop lists that card.</p></div>
        </template>

        <!-- Normal saved-shop cards -->
        <div v-else class="booth-grid">
          <div v-for="s in sortedShops" :key="s.id" class="booth-card card">
            <div class="booth-card-name">{{ s.booth.name }}</div>
            <div class="booth-card-meta">
              <span v-if="s.booth.venue">📍 {{ s.booth.venue }}</span>
              <span v-if="s.booth.table">🪧 {{ s.booth.table }}</span>
              <span>{{ s.booth.items.length }} listing{{ s.booth.items.length !== 1 ? 's' : '' }}</span>
              <span class="text-accent" style="font-weight:800">{{ fmtMoney(boothTotal(s.booth)) }}</span>
            </div>
            <div class="booth-card-sub">
              Saved {{ fmtDate(s.savedAt) }}
              <span v-if="shopVerdict(s)" class="badge booth-card-verdict" :class="`badge-${shopVerdict(s).cls}`">{{ shopVerdict(s).label }}</span>
            </div>
            <div class="booth-card-actions">
              <button class="btn btn-primary btn-sm" @click="openSaved(s)">Open</button>
              <button class="btn btn-ghost btn-sm" @click="removeSaved(s.id)">Remove</button>
            </div>
          </div>
        </div>
      </section>
    </template>

    <BoothShareModal v-if="shareBooth" :booth="shareBooth" @close="shareBooth = null" />
    <BoothShareListModal v-if="shareListOpen" :shops="savedShops" @close="shareListOpen = false" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import jsQR from 'jsqr'
import BoothShareModal from '../components/BoothShareModal.vue'
import BoothShareListModal from '../components/BoothShareListModal.vue'
import {
  loadBooths, saveBooths, loadSavedShops, saveSavedShops,
  boothFromLocation, directoryFromLocation, boothFromDirectoryRef, dagdResolve,
  decodeBoothBytes, decodeDirectoryBytes, boothTotal, generateBoothId,
  directionsUrl,
} from '../utils/booth'
import { compareBoothToMarket, marketVerdict } from '../utils/boothMarket'
import { FrameCollector, isFrame } from '../utils/qrTransfer'

const router = useRouter()
const booths = ref(loadBooths())
const savedShops = ref(loadSavedShops())
const shareBooth = ref(null)
const shareListOpen = ref(false)
const viewing = ref(null) // { booth, saved, savedId?, market? }
const dirViewing = ref(null) // { title, entries: [{name, venue, count, total, ref, status}] }
const dirBusy = ref(false)
const dirDone = ref(0)

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
  const booth = { id: generateBoothId(), name: 'My booth', venue: '', table: '', date: '', note: '', loc: null, locName: '', items: [], createdAt: new Date().toISOString() }
  booths.value.unshift(booth)
  saveBooths(booths.value)
  router.push(`/booth/${booth.id}`)
}

function deleteBooth(id) {
  if (!confirm('Delete this booth? Your shelf items are not affected.')) return
  booths.value = booths.value.filter(b => b.id !== id)
  saveBooths(booths.value)
}

// ── Incoming shares (link with #b=... or directory #d=...) ──
async function checkIncoming() {
  try {
    const dir = await directoryFromLocation(window.location.hash)
    if (dir) {
      showDirectory(dir)
      history.replaceState(null, '', window.location.pathname)
      return
    }
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
  const rec = { id: generateBoothId(), savedAt: new Date().toISOString(), booth: viewing.value.booth }
  if (viewing.value.market) rec.market = summaryOf(viewing.value.market)
  savedShops.value.unshift(rec)
  saveSavedShops(savedShops.value)
  viewing.value.saved = true
  viewing.value.savedId = rec.id
}

function openSaved(s) {
  shopFilter.value = ''
  viewing.value = { booth: s.booth, saved: true, savedId: s.id, market: s.market || null }
}

function removeSaved(id) {
  savedShops.value = savedShops.value.filter(s => s.id !== id)
  saveSavedShops(savedShops.value)
}

function closeViewer() {
  viewing.value = null
}

// ── Market comparison ──
const comparing = ref(false)
const compareDone = ref(0)
const compareTotal = ref(0)

function summaryOf(m) {
  // perItem is per-view detail; the saved record keeps just the summary
  const { perItem, ...summary } = m
  return summary
}

const viewingVerdict = computed(() => marketVerdict(viewing.value?.market?.deltaPct))

function itemDelta(i) {
  const m = viewing.value?.market
  const it = viewing.value?.booth.items[i]
  if (!m?.perItem || m.perItem[i] == null || !(it?.price > 0)) return null
  const diff = it.price - m.perItem[i]
  if (Math.abs(diff) < 0.5 || Math.abs(diff) / m.perItem[i] < 0.03) return { cls: 'flat', label: `mkt ${fmtMoney(m.perItem[i])}` }
  return diff < 0
    ? { cls: 'under', label: `${fmtMoney(Math.abs(diff))} under` }
    : { cls: 'over', label: `${fmtMoney(diff)} over` }
}

async function compareMarket() {
  if (!viewing.value || comparing.value) return
  comparing.value = true
  compareDone.value = 0
  compareTotal.value = 0
  try {
    const result = await compareBoothToMarket(viewing.value.booth, (d, t) => {
      compareDone.value = d
      compareTotal.value = t
    })
    viewing.value.market = result
    // persist the summary on the saved record so the list shows the verdict
    if (viewing.value.savedId) {
      const rec = savedShops.value.find(s => s.id === viewing.value.savedId)
      if (rec) { rec.market = summaryOf(result); saveSavedShops(savedShops.value) }
    }
  } finally {
    comparing.value = false
  }
}

function shopVerdict(s) {
  return marketVerdict(s.market?.deltaPct)
}

// ── Saved-shop sorting & cross-shop filtering ──
const shopSort = ref('newest')
const shopFilter = ref('')

const sortedShops = computed(() => {
  const shops = [...savedShops.value]
  if (shopSort.value === 'cheap') shops.sort((a, b) => boothTotal(a.booth) - boothTotal(b.booth))
  else if (shopSort.value === 'dear') shops.sort((a, b) => boothTotal(b.booth) - boothTotal(a.booth))
  else if (shopSort.value === 'abc') shops.sort((a, b) => (a.booth.name || '').localeCompare(b.booth.name || ''))
  else shops.sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''))
  return shops
})

const filterHits = computed(() => {
  const q = shopFilter.value.trim().toLowerCase()
  if (!q) return []
  const hits = []
  for (const s of sortedShops.value) {
    const items = (s.booth.items || []).filter(it =>
      (it.name || '').toLowerCase().includes(q) || (it.setName || '').toLowerCase().includes(q))
    if (items.length) hits.push({ shop: s, items })
  }
  // cheapest matching item first — that's what you're hunting for
  hits.sort((a, b) => Math.min(...a.items.map(i => i.price || Infinity)) - Math.min(...b.items.map(i => i.price || Infinity)))
  return hits
})

// ── Directory import ──
const dirChecking = ref(false)

function showDirectory(dir) {
  dirViewing.value = { ...dir, entries: dir.entries.map(e => ({ ...e, status: '', resolvedUrl: '' })) }
  verifyDirectory()
}

// Short-link entries can rot (the seller's da.gd code is gone). Verify
// them as soon as the directory opens — the check IS the resolve, so
// nothing is wasted: live entries keep their resolved URL and Add All
// skips the second fetch. Self-contained (full-URL) entries can't die.
async function verifyDirectory() {
  const dir = dirViewing.value
  const queue = dir.entries.filter(en => en.ref.startsWith('dgd:'))
  if (!queue.length || !navigator.onLine) return
  dirChecking.value = true
  async function worker() {
    while (queue.length) {
      const en = queue.shift()
      try {
        const url = await dagdResolve(en.ref.slice(4))
        if (!/[#&]b=/.test(url)) throw new Error('not a booth link')
        en.resolvedUrl = url
      } catch {
        en.status = 'dead'
      }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker))
  if (dirViewing.value === dir) dirChecking.value = false
}

const dirExpired = computed(() => dirViewing.value?.entries.filter(e => e.status === 'dead').length || 0)
const dirLive = computed(() => dirViewing.value ? dirViewing.value.entries.length - dirExpired.value : 0)

async function addAllFromDirectory() {
  if (!dirViewing.value || dirBusy.value) return
  dirBusy.value = true
  dirDone.value = 0
  for (const en of dirViewing.value.entries) {
    if (en.status === 'ok' || en.status === 'dead') { dirDone.value++; continue }
    en.status = 'busy'
    try {
      const booth = en.resolvedUrl
        ? await boothFromLocation(en.resolvedUrl)
        : await boothFromDirectoryRef(en.ref)
      if (!booth) throw new Error('not a booth')
      savedShops.value.unshift({ id: generateBoothId(), savedAt: new Date().toISOString(), booth })
      en.status = 'ok'
    } catch {
      en.status = 'err'
    }
    dirDone.value++
  }
  saveSavedShops(savedShops.value)
  dirBusy.value = false
}

// ── Scanner (handles URL QRs, directory QRs, and animated RBX2 booths) ──
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

  // Plain URL QR — single booth or a directory (also scannable by native cameras)
  if (code.data && code.data.includes('/booth#b=')) {
    stopScan()
    try { viewing.value = { booth: await boothFromLocation(code.data), saved: false } }
    catch { scanError.value = "Couldn't read that booth code." }
    return
  }
  if (code.data && code.data.includes('/booth#d=')) {
    stopScan()
    try {
      const dir = await directoryFromLocation(code.data)
      showDirectory(dir)
    } catch { scanError.value = "Couldn't read that directory code." }
    return
  }
  // Animated RBX2 frames (big booths / big directories)
  if (code.binaryData?.length) {
    const bytes = Uint8Array.from(code.binaryData)
    if (isFrame(bytes)) {
      if (collector.feed(bytes)) { scanGot.value = collector.received; scanTotal.value = collector.total }
      if (collector.done) {
        stopScan()
        const payload = collector.assemble()
        try { viewing.value = { booth: await decodeBoothBytes(payload), saved: false } }
        catch {
          try {
            const dir = await decodeDirectoryBytes(payload)
            showDirectory(dir)
          } catch { scanError.value = 'Transfer corrupted — try scanning again.' }
        }
      }
    }
  }
}

function stopScan() {
  if (scanTimer) { clearInterval(scanTimer); scanTimer = null }
  if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null }
  scanning.value = false
}

onMounted(() => {
  checkIncoming()
  // opening a booth/directory link while already on /booth only changes
  // the hash — no remount, so watch for it
  window.addEventListener('hashchange', checkIncoming)
})
onBeforeUnmount(() => {
  stopScan()
  window.removeEventListener('hashchange', checkIncoming)
})
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
.booth-head-actions { display: flex; gap: 8px; flex-wrap: wrap; }

.booth-tools { display: flex; gap: 10px; margin: 4px 0 6px; flex-wrap: wrap; }
.booth-filter { flex: 1; min-width: 200px; }
.booth-sort { width: auto; }
.booth-filter-note { font-size: 12.5px; color: var(--text-secondary); margin: 8px 0 4px; font-weight: 700; }

.booth-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr)); gap: 14px; margin-top: 12px; }
.booth-card { padding: 16px; }
.booth-card-name { font-weight: 900; font-size: 16px; margin-bottom: 6px; }
.booth-card-meta { display: flex; flex-wrap: wrap; gap: 10px; font-size: 12.5px; color: var(--text-secondary); margin-bottom: 4px; }
.booth-card-sub { font-size: 11.5px; color: var(--text-muted); margin-bottom: 6px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.booth-card-verdict { font-size: 10.5px; }
.booth-card-actions { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; }

.booth-hit { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 5px 0; border-bottom: 1.5px solid var(--border-subtle); }
.booth-hit:last-of-type { border-bottom: none; }
.booth-hit-name { font-size: 12.5px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.booth-hit-price { font-size: 11px; flex-shrink: 0; }

/* directory import */
.booth-card-dead { opacity: 0.55; }
.booth-card-dead .booth-card-name { text-decoration: line-through; }
.dir-progress { margin: -4px 0 12px; }
.bar { height: 14px; border: 2px solid var(--ink); border-radius: 8px; background: var(--bg-secondary); overflow: hidden; }
.bar i { display: block; height: 100%; background: var(--success); transition: width .3s ease; }

/* shop viewer */
.shop-head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; padding: 18px; margin-top: 16px; flex-wrap: wrap; }
.shop-meta { display: flex; gap: 14px; flex-wrap: wrap; font-size: 13px; color: var(--text-secondary); margin-top: 12px; }
.shop-note { font-size: 13px; color: var(--text-secondary); margin-top: 8px; max-width: 480px; }
.shop-directions { margin-top: 12px; }
.shop-total-label { font-size: 11.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-secondary); }
.shop-total-val { font-size: 26px; font-weight: 900; }
.shop-verdict { margin-top: 6px; }
.shop-actions { display: flex; gap: 10px; align-items: center; margin: 14px 0; flex-wrap: wrap; }
.shop-compare-note { font-size: 12.5px; color: var(--text-secondary); margin: -6px 0 12px; }
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

.shop-mkt { font-size: 10.5px; font-weight: 800; white-space: nowrap; }
.shop-mkt.under { color: var(--text-success, #1e9e5a); }
.shop-mkt.over { color: var(--danger); }
.shop-mkt.flat { color: var(--text-muted); }

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
.shop-item-row { display: flex; align-items: center; gap: 8px; margin-top: 6px; flex-wrap: wrap; }
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
