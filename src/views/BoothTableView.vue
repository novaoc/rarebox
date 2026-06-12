<template>
  <div class="bt-page" v-if="booth">
    <!-- Sticky head: exit, recap, the two things you reach for between deals -->
    <header class="bt-head">
      <router-link :to="`/booth/${booth.id}`" class="btn btn-ghost btn-sm">← Done</router-link>
      <div class="bt-head-main">
        <div class="bt-title">{{ booth.name }}</div>
        <div class="bt-recap">
          <span class="bt-chip bt-chip-cash">💵 {{ fmtMoney(totals.cashTotal) }}<template v-if="totals.cashCount"> · {{ totals.cashCount }}</template></span>
          <span class="bt-chip bt-chip-trade">🔁 {{ totals.tradeCount }} trade{{ totals.tradeCount !== 1 ? 's' : '' }}<template v-if="totals.tradeCount"> · {{ fmtMoney(totals.tradeTotal) }}</template></span>
        </div>
      </div>
      <button class="btn btn-primary btn-sm" @click="kioskOpen = true">📺 Live QR</button>
    </header>

    <div class="bt-tools">
      <input ref="filterInput" v-model="filter" class="input bt-filter" placeholder="🔍 Find a listing…" />
      <button class="btn btn-secondary" :disabled="atCap" @click="openSearch">+ Add</button>
    </div>
    <p v-if="atCap" class="bt-cap-note">Booth is full ({{ MAX_BOOTH_ITEMS }}) — remove something or split into a second booth.</p>

    <div v-if="!visibleItems.length" class="empty-state">
      <p v-if="filter.trim()">No listings match.</p>
      <p v-else>Nothing listed. Hit <strong>+ Add</strong> to put cards or sealed on the table.</p>
    </div>

    <!-- One row per listing: everything reachable with a thumb -->
    <div class="bt-items">
      <div v-for="{ it, i } in visibleItems" :key="i" class="bt-item card">
        <div class="bt-item-img">
          <img v-if="it.img" :src="it.img" :alt="it.name" loading="lazy" @error="$event.target.style.display='none'" />
          <span v-else aria-hidden="true">🃏</span>
        </div>
        <div class="bt-item-main">
          <div class="bt-item-name">{{ it.name }}</div>
          <div class="bt-item-sub">{{ [it.setName, it.number ? '#' + it.number : ''].filter(Boolean).join(' · ') }}</div>
          <div class="bt-item-meta">
            <span class="bt-price">$<input type="number" min="0" step="0.01" class="bt-price-input" v-model.number="it.price" @change="persist" /></span>
            <span v-if="(it.qty || 1) > 1" class="badge badge-info">×{{ it.qty }}</span>
            <button class="btn btn-ghost btn-icon" aria-label="Remove listing (not a sale)" @click="removeQuiet(i)">✕</button>
          </div>
        </div>
        <div class="bt-item-actions">
          <button class="bt-deal bt-deal-cash" @click="deal(i, 'cash')">💵 Sold</button>
          <button class="bt-deal bt-deal-trade" @click="deal(i, 'trade')">🔁 Trade</button>
        </div>
      </div>
    </div>

    <!-- Today's log -->
    <section v-if="today.length" class="bt-log">
      <button class="bt-log-toggle" @click="logOpen = !logOpen">
        {{ logOpen ? '▾' : '▸' }} Today's log ({{ today.length }})
      </button>
      <div v-if="logOpen" class="bt-log-list">
        <div v-for="e in today" :key="e.id" class="bt-log-row">
          <span class="bt-log-time">{{ fmtTime(e.ts) }}</span>
          <span class="bt-log-name">{{ e.name }}</span>
          <span class="badge" :class="e.mode === 'trade' ? 'badge-info' : 'badge-success'">{{ e.mode === 'trade' ? '🔁 trade' : '💵 ' + fmtMoney(e.price) }}</span>
        </div>
      </div>
    </section>

    <!-- Undo toast -->
    <Transition name="bt-toast">
      <div v-if="lastAction" class="bt-toast">
        <span class="bt-toast-text">{{ lastAction.label }}</span>
        <button class="btn btn-primary btn-sm" @click="undo">Undo</button>
      </div>
    </Transition>

    <!-- Add: search cards + sealed -->
    <div v-if="searchOpen" class="modal-overlay" @click.self="searchOpen = false">
      <div class="modal" style="max-width: 560px">
        <div class="modal-header">
          <h3>Add to the table</h3>
          <button class="btn btn-ghost btn-icon" @click="searchOpen = false">✕</button>
        </div>
        <div class="modal-body">
          <form class="bt-search-bar" @submit.prevent="runSearch">
            <input ref="searchInput" v-model="searchQuery" class="input" placeholder="Card or product name…" />
            <button class="btn btn-primary btn-sm" type="submit" :disabled="searchBusy || searchQuery.trim().length < 2">
              {{ searchBusy ? '…' : 'Search' }}
            </button>
          </form>
          <div class="bt-search-list">
            <div v-for="c in searchResults" :key="(c.sealed ? 's' : 'c') + c.game + c.id" class="bt-search-row">
              <img v-if="c.image" :src="c.image" class="bt-search-img" loading="lazy" @error="$event.target.style.display='none'" />
              <span v-else class="bt-search-img bt-search-noimg">🃏</span>
              <span class="bt-search-name">{{ c.name }} <span v-if="c.sealed" class="badge badge-info bt-sealed">Sealed</span>
                <span class="bt-search-sub">{{ [c.set, c.number ? '#' + c.number : ''].filter(Boolean).join(' · ') }}</span>
              </span>
              <span class="bt-search-price">{{ c.price ? fmtMoney(c.price) : '—' }}</span>
              <button class="btn btn-primary btn-sm" :disabled="atCap" @click="addFromSearch(c)">+ Add</button>
            </div>
            <p v-if="searchBusy" class="text-muted bt-search-msg">Searching…</p>
            <p v-else-if="searched && !searchResults.length" class="text-muted bt-search-msg">No matches — try fewer words.</p>
            <p v-else-if="!searched" class="text-muted bt-search-msg">Singles and sealed, all six games. Bought a collection mid-show? Add it here.</p>
          </div>
        </div>
        <div class="modal-footer">
          <span v-if="addedFlash" class="badge badge-success">✓ On the table</span>
          <button class="btn btn-secondary" @click="searchOpen = false">Done</button>
        </div>
      </div>
    </div>

    <!-- Kiosk: a live QR for the table stand — always shows the booth as it
         is RIGHT NOW. Printed QRs are snapshots; this one never goes stale. -->
    <Teleport to="body">
      <div v-if="kioskOpen" class="bt-kiosk" @click="kioskOpen = false">
        <div class="bt-kiosk-inner" @click.stop>
          <div class="bt-kiosk-name">{{ booth.name }}</div>
          <canvas ref="kioskCanvas" class="bt-kiosk-qr"></canvas>
          <div v-if="kioskFrames > 1" class="bt-kiosk-frames">{{ kioskFrame + 1 }} / {{ kioskFrames }} — scan from Rarebox (Booth → Scan)</div>
          <div class="bt-kiosk-sub">
            <span class="bt-kiosk-live">● LIVE</span>
            {{ booth.items.length }} listing{{ booth.items.length !== 1 ? 's' : '' }} · {{ fmtMoney(total) }} —
            updates as the table changes
          </div>
          <button class="btn btn-secondary btn-sm" @click="kioskOpen = false">Close</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useRoute } from 'vue-router'
import QRCode from 'qrcode'
import { loadBooths, saveBooths, boothTotal, boothToUrl, encodeBoothBytes, MAX_BOOTH_ITEMS } from '../utils/booth'
import { buildFrames } from '../utils/qrTransfer'
import { loadJournal, addEntry, removeEntry, todayEntries, journalTotals } from '../utils/boothJournal'
import { multiSearch } from '../services/tcg/multiSearch'
import { searchSealed } from '../services/sealedIndex'
import { tokenMatch } from '../utils/search'

const route = useRoute()
const booths = ref(loadBooths())
const booth = computed(() => booths.value.find(b => b.id === route.params.id))

const filter = ref('')
const filterInput = ref(null)
const logOpen = ref(false)
const journal = ref(loadJournal())

const total = computed(() => boothTotal(booth.value || {}))
const atCap = computed(() => (booth.value?.items.length || 0) >= MAX_BOOTH_ITEMS)
const today = computed(() => todayEntries(journal.value, booth.value?.id))
const totals = computed(() => journalTotals(today.value))

const visibleItems = computed(() => {
  const items = booth.value?.items || []
  const q = filter.value.trim()
  const out = []
  for (let i = 0; i < items.length; i++) {
    if (!q || tokenMatch(q, items[i].name, items[i].setName, items[i].number)) out.push({ it: items[i], i })
  }
  return out
})

function fmtMoney(n) {
  return '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function persist() {
  saveBooths(booths.value)
}

// ── Deals: the two-tap core ──
const lastAction = ref(null)
let toastTimer = null

function deal(i, mode) {
  const it = booth.value.items[i]
  if (!it) return
  const entry = addEntry(journal.value, {
    boothId: booth.value.id, boothName: booth.value.name,
    name: it.name, setName: it.setName, price: it.price,
    mode, game: it.game, type: it.type, cardId: it.cardId,
  })
  const snapshot = { ...it }
  if ((it.qty || 1) > 1) it.qty -= 1
  else booth.value.items.splice(i, 1)
  persist()
  showUndo({
    label: `${mode === 'trade' ? 'Traded' : 'Sold'} ${it.name}${mode === 'trade' ? '' : ' — ' + fmtMoney(snapshot.price)}`,
    journalId: entry.id, snapshot, index: i,
  })
}

function removeQuiet(i) {
  const it = booth.value.items[i]
  if (!it) return
  const snapshot = { ...it }
  booth.value.items.splice(i, 1)
  persist()
  showUndo({ label: `Removed ${it.name}`, journalId: null, snapshot, index: i, wholeRow: true })
}

function showUndo(action) {
  lastAction.value = action
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => { lastAction.value = null }, 6000)
}

function undo() {
  const a = lastAction.value
  if (!a) return
  const items = booth.value.items
  // The row may still exist (qty was decremented) — find it by identity
  const found = !a.wholeRow && items.find(it =>
    it.name === a.snapshot.name && it.cardId === a.snapshot.cardId && it.price === a.snapshot.price)
  if (found && !a.wholeRow) found.qty = (found.qty || 1) + 1
  else items.splice(Math.min(a.index, items.length), 0, { ...a.snapshot, qty: a.wholeRow ? a.snapshot.qty : 1 })
  if (a.journalId) removeEntry(journal.value, a.journalId)
  persist()
  lastAction.value = null
  clearTimeout(toastTimer)
}

// ── Add (same combined search as the editor) ──
const searchOpen = ref(false)
const searchInput = ref(null)
const searchQuery = ref('')
const searchResults = ref([])
const searchBusy = ref(false)
const searched = ref(false)
const addedFlash = ref(false)

async function openSearch() {
  searchOpen.value = true
  await nextTick()
  searchInput.value?.focus()
}

async function runSearch() {
  const q = searchQuery.value.trim()
  if (q.length < 2) return
  searchBusy.value = true
  try {
    const [cardsRes, sealedRes] = await Promise.allSettled([
      multiSearch(q, { page: 1, pageSize: 24 }),
      searchSealed(q, { limit: 12 }),
    ])
    searchResults.value = [
      ...(cardsRes.status === 'fulfilled' ? cardsRes.value.cards : []),
      ...(sealedRes.status === 'fulfilled' ? sealedRes.value : []),
    ]
  } catch {
    searchResults.value = []
  } finally {
    searchBusy.value = false
    searched.value = true
  }
}

function addFromSearch(c) {
  if (atCap.value) return
  booth.value.items.unshift({
    type: c.sealed ? 'sealed' : 'card',
    game: c.game || 'pokemon',
    cardId: c.id || '',
    name: c.name || '',
    setName: c.set || '',
    number: c.number || '',
    qty: 1,
    price: c.price ? Math.round(c.price * 100) / 100 : 0,
    img: c.image || '',
  })
  persist()
  addedFlash.value = true
  setTimeout(() => { addedFlash.value = false }, 1500)
}

// ── Kiosk QR: re-renders whenever the booth changes ──
const kioskOpen = ref(false)
const kioskCanvas = ref(null)
const kioskFrames = ref(0)
const kioskFrame = ref(0)
const SINGLE_QR_LIMIT = 2300
const FRAME_MS = 400
let kioskAnim = null
let kioskDebounce = null
let frames = []
let wakeLock = null

async function renderKiosk() {
  if (!kioskOpen.value || !booth.value) return
  await nextTick()
  if (!kioskCanvas.value) return
  if (kioskAnim) { clearInterval(kioskAnim); kioskAnim = null }
  const url = await boothToUrl(booth.value)
  const opts = { width: 420, margin: 2, color: { dark: '#141414', light: '#ffffff' }, errorCorrectionLevel: 'M' }
  if (url.length <= SINGLE_QR_LIMIT) {
    frames = []
    kioskFrames.value = 1
    await QRCode.toCanvas(kioskCanvas.value, url, opts)
  } else {
    frames = buildFrames(await encodeBoothBytes(booth.value))
    kioskFrames.value = frames.length
    kioskFrame.value = 0
    const draw = (i) => kioskCanvas.value && QRCode.toCanvas(kioskCanvas.value, [{ data: frames[i], mode: 'byte' }], opts)
    draw(0)
    kioskAnim = setInterval(() => {
      kioskFrame.value = (kioskFrame.value + 1) % frames.length
      draw(kioskFrame.value)
    }, FRAME_MS)
  }
}

watch(kioskOpen, async (open) => {
  if (open) {
    renderKiosk()
    // Keep the stand's screen awake while the kiosk is up (best-effort)
    try { wakeLock = await navigator.wakeLock?.request('screen') } catch { /* unsupported/denied */ }
  } else {
    if (kioskAnim) { clearInterval(kioskAnim); kioskAnim = null }
    try { wakeLock?.release() } catch { /* already gone */ }
    wakeLock = null
  }
})

// Inventory changed mid-display → refresh the code (debounced: a burst of
// taps re-encodes once)
watch(() => booth.value && JSON.stringify(booth.value.items), () => {
  if (!kioskOpen.value) return
  clearTimeout(kioskDebounce)
  kioskDebounce = setTimeout(renderKiosk, 400)
})

onMounted(() => { filterInput.value?.focus() })
onBeforeUnmount(() => {
  if (kioskAnim) clearInterval(kioskAnim)
  clearTimeout(kioskDebounce)
  clearTimeout(toastTimer)
  try { wakeLock?.release() } catch { /* already gone */ }
})
</script>

<style scoped>
.bt-page { max-width: 720px; margin: 0 auto; padding: 0 14px calc(90px + env(safe-area-inset-bottom, 0px)); }

/* bare route = no app chrome, so the header pads for the device status bar
   itself (clock/battery on notched phones) plus breathing room everywhere */
.bt-head {
  position: sticky; top: 0; z-index: 20;
  display: flex; align-items: center; gap: 10px;
  padding: calc(18px + env(safe-area-inset-top, 0px)) 0 10px;
  background: var(--bg-body, var(--bg-secondary));
  border-bottom: var(--bw) solid var(--ink);
}
.bt-head-main { flex: 1; min-width: 0; }
.bt-title { font-size: 15px; font-weight: 900; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bt-recap { display: flex; gap: 6px; margin-top: 3px; flex-wrap: wrap; }
.bt-chip {
  font-size: 11px; font-weight: 800;
  padding: 2px 8px;
  border: 1.5px solid var(--ink); border-radius: 99px;
}
.bt-chip-cash { background: var(--success-dim, var(--accent-dim)); }
.bt-chip-trade { background: var(--bg-card); }

.bt-tools { display: flex; gap: 8px; margin: 12px 0 4px; }
.bt-filter { flex: 1; font-size: 16px; /* ≥16px stops iOS zoom-on-focus */ }
.bt-cap-note { font-size: 12.5px; color: var(--text-secondary); margin: 6px 0; }

.bt-items { display: flex; flex-direction: column; gap: 10px; margin-top: 10px; }
.bt-item { display: flex; gap: 10px; align-items: center; padding: 10px 12px; }
.bt-item-img { width: 48px; height: 64px; flex-shrink: 0; background: #fff; border: 1.5px solid var(--ink); border-radius: 7px; padding: 2px; display: flex; align-items: center; justify-content: center; overflow: hidden; font-size: 20px; }
.bt-item-img img { width: 100%; height: 100%; object-fit: contain; border-radius: 4px; }
.bt-item-main { flex: 1; min-width: 0; }
.bt-item-name { font-weight: 800; font-size: 14px; line-height: 1.25; }
.bt-item-sub { font-size: 11.5px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bt-item-meta { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
.bt-price { font-weight: 800; font-size: 13px; display: inline-flex; align-items: center; }
.bt-price-input {
  width: 88px; font: inherit; font-weight: 800;
  border: 1.5px solid var(--border-subtle); border-radius: 7px;
  padding: 4px 6px; margin-left: 2px;
  background: var(--bg-card); color: inherit;
}
.bt-item-actions { display: flex; flex-direction: column; gap: 6px; align-items: stretch; }
.bt-deal {
  font: inherit; font-size: 13px; font-weight: 900;
  padding: 10px 14px; min-width: 96px;
  border: var(--bw) solid var(--ink); border-radius: 10px;
  box-shadow: var(--shadow-pressed);
  cursor: pointer;
  color: var(--ink);
}
.bt-deal:active { box-shadow: none; transform: translate(1px, 1px); }
.bt-deal-cash { background: var(--accent); color: var(--on-accent); }
.bt-deal-trade { background: var(--bg-card); }

.bt-log { margin-top: 20px; }
.bt-log-toggle {
  font: inherit; font-size: 13px; font-weight: 800; color: var(--ink);
  background: none; border: none; cursor: pointer; padding: 6px 0;
}
.bt-log-list { display: flex; flex-direction: column; gap: 6px; margin-top: 6px; }
.bt-log-row { display: flex; align-items: center; gap: 10px; font-size: 12.5px; padding: 6px 10px; border: 1.5px solid var(--border-subtle); border-radius: 9px; }
.bt-log-time { color: var(--text-muted); font-weight: 700; flex-shrink: 0; }
.bt-log-name { flex: 1; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.bt-toast {
  position: fixed; left: 50%; bottom: calc(22px + env(safe-area-inset-bottom, 0px)); transform: translateX(-50%);
  z-index: 120;
  display: flex; align-items: center; gap: 12px;
  padding: 10px 14px;
  background: var(--bg-card);
  border: var(--bw) solid var(--ink); border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
  max-width: min(92vw, 440px);
}
.bt-toast-text { font-size: 13px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.bt-toast-enter-active, .bt-toast-leave-active { transition: opacity .18s, transform .18s; }
.bt-toast-enter-from, .bt-toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(8px); }

.bt-search-bar { display: flex; gap: 8px; margin-bottom: 12px; }
.bt-search-bar .input { flex: 1; font-size: 16px; }
.bt-search-list { max-height: 46vh; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.bt-search-row { display: flex; align-items: center; gap: 10px; padding: 9px 10px; border: 1.5px solid var(--border-subtle); border-radius: 10px; font-size: 13.5px; }
.bt-search-img { width: 38px; height: 52px; object-fit: contain; border: 1.5px solid var(--ink); border-radius: 6px; background: #fff; flex-shrink: 0; }
.bt-search-noimg { display: inline-flex; align-items: center; justify-content: center; font-size: 20px; opacity: .4; }
.bt-search-name { font-weight: 700; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.bt-search-sub { display: block; font-size: 11.5px; color: var(--text-muted); font-weight: 600; }
.bt-search-price { font-weight: 800; font-size: 12.5px; white-space: nowrap; }
.bt-search-msg { font-size: 13px; text-align: center; padding: 16px 0; }
.bt-sealed { font-size: 9.5px; vertical-align: 2px; }

/* kiosk */
.bt-kiosk {
  position: fixed; inset: 0; z-index: 400;
  background: var(--bg-secondary, #faf6ef);
  display: flex; align-items: center; justify-content: center;
  padding: calc(24px + env(safe-area-inset-top, 0px)) 24px calc(24px + env(safe-area-inset-bottom, 0px));
}
.bt-kiosk-inner { display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; max-width: 92vw; }
.bt-kiosk-name { font-size: clamp(20px, 4vw, 30px); font-weight: 900; }
.bt-kiosk-qr {
  border: var(--bw) solid var(--ink); border-radius: var(--radius);
  background: #fff; box-shadow: var(--shadow-sm);
  max-width: min(78vw, 56vh);
  height: auto !important; width: min(78vw, 56vh) !important;
}
.bt-kiosk-frames { font-size: 12.5px; font-weight: 700; color: var(--text-secondary); }
.bt-kiosk-sub { font-size: 13.5px; font-weight: 700; color: var(--text-secondary); max-width: 420px; }
.bt-kiosk-live { color: #c92f2f; font-weight: 900; letter-spacing: 0.04em; animation: bt-pulse 1.6s ease infinite; }
@keyframes bt-pulse { 50% { opacity: 0.45; } }

@media (max-width: 480px) {
  .bt-deal { min-width: 84px; padding: 9px 10px; }
  /* Narrow phones & foldable cover screens: the one-row header truncates
     the booth name into "Wren'…" — wrap instead: buttons up top, then the
     full title + recap chips on their own line */
  .bt-head { flex-wrap: wrap; justify-content: space-between; }
  .bt-head-main { order: 3; flex-basis: 100%; }
  .bt-title { white-space: normal; }
}
</style>
