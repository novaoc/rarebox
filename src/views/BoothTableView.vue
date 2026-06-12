<template>
  <div class="bt-page" v-if="booth">
    <!-- Sticky head: exit, recap, the two things you reach for between deals -->
    <header class="bt-head">
      <router-link :to="`/booth/${booth.id}`" class="btn btn-ghost btn-sm">← Done</router-link>
      <div class="bt-head-main">
        <div class="bt-title">{{ booth.name }}</div>
        <div class="bt-recap">
          <span class="bt-chip bt-chip-cash" :class="{ neg: totals.cashNet < 0 }">💵 {{ fmtMoney(totals.cashNet) }} today</span>
          <span class="bt-chip bt-chip-trade">🔁 {{ totals.tradesOut.count }} trade{{ totals.tradesOut.count !== 1 ? 's' : '' }}</span>
          <span v-if="totals.buys.count" class="bt-chip bt-chip-trade">💰 {{ totals.buys.count }} bought</span>
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
          <button class="bt-deal bt-deal-cash" @click="sell(i)">💵 Sold</button>
          <button class="bt-deal bt-deal-trade" @click="openTrade(i)">🔁 Trade</button>
        </div>
      </div>
    </div>

    <!-- Today's log + running ledger -->
    <section v-if="today.length || allBoothEntries.length" class="bt-log">
      <div class="bt-log-head">
        <button class="bt-log-toggle" @click="logOpen = !logOpen">
          {{ logOpen ? '▾' : '▸' }} Today's log ({{ today.length }})
        </button>
        <button class="btn btn-secondary btn-sm" @click="exportLedger">📊 Export Excel</button>
      </div>
      <p class="bt-log-summary">
        Sales {{ fmtMoney(totals.sales.cash) }} ({{ totals.sales.count }})
        · Bought {{ fmtMoney(totals.buys.cost) }} ({{ totals.buys.count }})
        · Trades {{ totals.tradesOut.count }} (out {{ fmtMoney(totals.tradesOut.value) }} / in {{ fmtMoney(totals.tradesIn.value) }})
        · Net <strong :class="{ 'bt-neg': totals.cashNet < 0 }">{{ fmtMoney(totals.cashNet) }}</strong>
      </p>
      <div v-if="logOpen" class="bt-log-list">
        <div v-for="e in today" :key="e.id" class="bt-log-row">
          <span class="bt-log-time">{{ fmtTime(e.ts) }}</span>
          <span class="bt-log-name">{{ e.name }}</span>
          <span class="badge" :class="kindBadge(e)">{{ kindLabel(e) }}</span>
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
          <label class="bt-buy-toggle">
            <input type="checkbox" v-model="buyMode" />
            💰 I'm buying these — log what I paid &amp; deduct it from table cash
          </label>
          <div class="bt-search-list">
            <div v-for="c in searchResults" :key="(c.sealed ? 's' : 'c') + c.game + c.id" class="bt-search-row">
              <img v-if="c.image" :src="c.image" class="bt-search-img" loading="lazy" @error="$event.target.style.display='none'" />
              <span v-else class="bt-search-img bt-search-noimg">🃏</span>
              <span class="bt-search-name">{{ c.name }} <span v-if="c.sealed" class="badge badge-info bt-sealed">Sealed</span>
                <span class="bt-search-sub">{{ [c.set, c.number ? '#' + c.number : ''].filter(Boolean).join(' · ') }}</span>
              </span>
              <template v-if="buyMode">
                <span class="bt-cost-wrap">paid $<input type="number" min="0" step="0.01" class="bt-cost" v-model.number="c._cost" :placeholder="c.price ? c.price.toFixed(2) : '0'" /></span>
                <button class="btn btn-primary btn-sm" :disabled="atCap" @click="addFromSearch(c, true)">💰 Buy</button>
              </template>
              <template v-else>
                <span class="bt-search-price">{{ c.price ? fmtMoney(c.price) : '—' }}</span>
                <button class="btn btn-primary btn-sm" :disabled="atCap" @click="addFromSearch(c)">+ Add</button>
              </template>
            </div>
            <p v-if="searchBusy" class="text-muted bt-search-msg">Searching…</p>
            <p v-else-if="searched && !searchResults.length" class="text-muted bt-search-msg">No matches — try fewer words.</p>
            <p v-else-if="!searched" class="text-muted bt-search-msg">Singles and sealed, all six games. Bought a collection mid-show? Flip the toggle and the cost comes off your table cash.</p>
          </div>
        </div>
        <div class="modal-footer">
          <span v-if="addedFlash" class="badge badge-success">✓ On the table</span>
          <button class="btn btn-secondary" @click="searchOpen = false">Done</button>
        </div>
      </div>
    </div>

    <!-- Trade sheet: what left, what came in, cash either direction -->
    <div v-if="trade" class="modal-overlay" @click.self="closeTrade">
      <div class="modal" style="max-width: 580px">
        <div class="modal-header">
          <h3>🔁 Log a trade</h3>
          <button class="btn btn-ghost btn-icon" @click="closeTrade">✕</button>
        </div>
        <div class="modal-body">
          <div class="bt-trade-out">
            <span class="bt-trade-label">Going out</span>
            <div class="bt-trade-outrow">
              <img v-if="trade.it.img" :src="trade.it.img" class="bt-search-img" @error="$event.target.style.display='none'" />
              <span v-else class="bt-search-img bt-search-noimg">🃏</span>
              <span class="bt-search-name">{{ trade.it.name }}
                <span class="bt-search-sub">{{ [trade.it.setName, trade.it.number ? '#' + trade.it.number : ''].filter(Boolean).join(' · ') }}</span>
              </span>
              <span class="bt-search-price">{{ fmtMoney(trade.it.price) }}</span>
            </div>
          </div>

          <span class="bt-trade-label">What came in? <span class="text-muted">(optional — search &amp; take)</span></span>
          <form class="bt-search-bar" @submit.prevent="runTradeSearch">
            <input v-model="tradeQuery" class="input" placeholder="e.g. OP-05 booster box" />
            <button class="btn btn-secondary btn-sm" type="submit" :disabled="tradeBusy || tradeQuery.trim().length < 2">{{ tradeBusy ? '…' : 'Search' }}</button>
          </form>
          <div v-if="tradeResults.length" class="bt-search-list bt-trade-results">
            <div v-for="c in tradeResults" :key="(c.sealed ? 's' : 'c') + c.game + c.id" class="bt-search-row">
              <img v-if="c.image" :src="c.image" class="bt-search-img" loading="lazy" @error="$event.target.style.display='none'" />
              <span v-else class="bt-search-img bt-search-noimg">🃏</span>
              <span class="bt-search-name">{{ c.name }} <span v-if="c.sealed" class="badge badge-info bt-sealed">Sealed</span>
                <span class="bt-search-sub">{{ [c.set, c.number ? '#' + c.number : ''].filter(Boolean).join(' · ') }}</span>
              </span>
              <span class="bt-search-price">{{ c.price ? fmtMoney(c.price) : '—' }}</span>
              <button class="btn btn-primary btn-sm" @click="takeIncoming(c)">📥 Take</button>
            </div>
          </div>

          <div v-if="tradeIncoming.length" class="bt-incoming">
            <div v-for="(inc, ii) in tradeIncoming" :key="ii" class="bt-incoming-row">
              <span class="bt-search-name">{{ inc.name }}<span class="bt-search-sub">{{ inc.setName }}</span></span>
              <label class="bt-mini">value $<input type="number" min="0" step="0.01" class="bt-cost" v-model.number="inc.value" /></label>
              <label class="bt-mini bt-list-toggle"><input type="checkbox" v-model="inc.list" /> list it</label>
              <button class="btn btn-ghost btn-icon" aria-label="Remove incoming item" @click="tradeIncoming.splice(ii, 1)">✕</button>
            </div>
          </div>

          <span class="bt-trade-label">Cash on top?</span>
          <div class="bt-cash-row">
            <button class="btn btn-sm" :class="tradeCashDir === 'in' ? 'btn-primary' : 'btn-secondary'" @click="tradeCashDir = tradeCashDir === 'in' ? '' : 'in'">They paid me</button>
            <button class="btn btn-sm" :class="tradeCashDir === 'out' ? 'btn-primary' : 'btn-secondary'" @click="tradeCashDir = tradeCashDir === 'out' ? '' : 'out'">I paid them</button>
            <span class="bt-cost-wrap">$<input type="number" min="0" step="0.01" class="bt-cost" v-model.number="tradeCashAmt" :disabled="!tradeCashDir" /></span>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="closeTrade">Cancel</button>
          <button class="btn btn-primary" @click="logTrade">
            Log trade{{ tradeIncoming.filter(x => x.list).length ? ` (+${tradeIncoming.filter(x => x.list).length} to table)` : '' }}
          </button>
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

          <div class="bt-remote">
            <button v-if="!remoteArmed" class="btn btn-secondary btn-sm" @click="armRemote">📡 Show on another device</button>
            <template v-else>
              <canvas ref="pairCanvas" class="bt-pair-qr"></canvas>
              <div class="bt-remote-hint">Scan with the display device's camera — its QR follows this table live.
                <span class="bt-remote-status">📡 {{ remoteStatus }}</span></div>
              <p class="bt-remote-note">Updates travel through ntfy.sh end-to-end encrypted — the relay only sees scrambled bytes; the key lives in this pairing code.</p>
              <button class="btn btn-ghost btn-sm" @click="disarmRemote">Stop broadcasting</button>
            </template>
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
import { loadJournal, addEntry, removeEntry, todayEntries, boothEntries, journalTotals, generateJournalId } from '../utils/boothJournal'
import { exportBoothLedger } from '../utils/boothExcel'
import { multiSearch } from '../services/tcg/multiSearch'
import { searchSealed } from '../services/sealedIndex'
import { tokenMatch } from '../utils/search'
import { generateSecret, displayUrl, deriveChannel, publishState } from '../utils/remoteQr'

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
const allBoothEntries = computed(() => boothEntries(journal.value, booth.value?.id))

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
  // table cash can run negative — buying hard mid-show is normal dealering
  const v = n || 0
  return (v < 0 ? '−$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function kindLabel(e) {
  if (e.kind === 'sale') return '💵 ' + fmtMoney(e.cash)
  if (e.kind === 'buy') return '💰 ' + fmtMoney(e.cash) // cash is negative
  if (e.kind === 'trade-in') return '📥 in · ' + fmtMoney(e.price)
  return '🔁 out' + (e.cash ? ` · ${fmtMoney(e.cash)} cash` : '')
}
function kindBadge(e) {
  return { sale: 'badge-success', buy: 'badge-danger', 'trade-in': 'badge-info', 'trade-out': 'badge-info' }[e.kind] || 'badge-info'
}

function persist() {
  saveBooths(booths.value)
}

// ── Deals: the two-tap core ──
const lastAction = ref(null)
let toastTimer = null

function decrementListing(i) {
  const it = booth.value.items[i]
  const snapshot = { ...it }
  if ((it.qty || 1) > 1) it.qty -= 1
  else booth.value.items.splice(i, 1)
  return snapshot
}

function sell(i) {
  const it = booth.value.items[i]
  if (!it) return
  const entry = addEntry(journal.value, {
    boothId: booth.value.id, boothName: booth.value.name, kind: 'sale',
    name: it.name, setName: it.setName, price: it.price, cash: it.price,
    game: it.game, type: it.type, cardId: it.cardId,
  })
  const snapshot = decrementListing(i)
  persist()
  showUndo({
    label: `Sold ${snapshot.name} — ${fmtMoney(snapshot.price)}`,
    journalIds: [entry.id], snapshot, index: i, incoming: [],
  })
}

// ── Trade sheet: out + optional in + cash either way ──
const trade = ref(null) // { i, it }
const tradeQuery = ref('')
const tradeResults = ref([])
const tradeBusy = ref(false)
const tradeIncoming = ref([]) // { ...itemFields, value, list }
const tradeCashDir = ref('')
const tradeCashAmt = ref(0)

function openTrade(i) {
  const it = booth.value.items[i]
  if (!it) return
  trade.value = { i, it }
  tradeQuery.value = ''
  tradeResults.value = []
  tradeIncoming.value = []
  tradeCashDir.value = ''
  tradeCashAmt.value = 0
}
function closeTrade() { trade.value = null }

async function runTradeSearch() {
  const q = tradeQuery.value.trim()
  if (q.length < 2) return
  tradeBusy.value = true
  try {
    const [cardsRes, sealedRes] = await Promise.allSettled([
      multiSearch(q, { page: 1, pageSize: 16 }),
      searchSealed(q, { limit: 10 }),
    ])
    tradeResults.value = [
      ...(cardsRes.status === 'fulfilled' ? cardsRes.value.cards : []),
      ...(sealedRes.status === 'fulfilled' ? sealedRes.value : []),
    ]
  } catch { tradeResults.value = [] } finally { tradeBusy.value = false }
}

function takeIncoming(c) {
  tradeIncoming.value.push({
    type: c.sealed ? 'sealed' : 'card',
    game: c.game || 'pokemon',
    cardId: c.id || '',
    name: c.name || '',
    setName: c.set || '',
    number: c.number || '',
    img: c.image || '',
    value: c.price ? Math.round(c.price * 100) / 100 : 0,
    list: true,
  })
}

function logTrade() {
  if (!trade.value) return
  const { i } = trade.value
  const it = booth.value.items[i]
  if (!it) { closeTrade(); return }
  const tradeId = generateJournalId()
  const cash = tradeCashDir.value === 'in' ? +(tradeCashAmt.value || 0)
    : tradeCashDir.value === 'out' ? -(tradeCashAmt.value || 0) : 0
  const ids = []
  ids.push(addEntry(journal.value, {
    boothId: booth.value.id, boothName: booth.value.name, kind: 'trade-out',
    name: it.name, setName: it.setName, price: it.price, cash,
    game: it.game, type: it.type, cardId: it.cardId, tradeId,
  }).id)
  const listed = []
  for (const inc of tradeIncoming.value) {
    ids.push(addEntry(journal.value, {
      boothId: booth.value.id, boothName: booth.value.name, kind: 'trade-in',
      name: inc.name, setName: inc.setName, price: inc.value || 0, cash: 0,
      game: inc.game, type: inc.type, cardId: inc.cardId, tradeId,
    }).id)
    if (inc.list && !atCap.value) {
      const item = {
        type: inc.type, game: inc.game, cardId: inc.cardId, name: inc.name,
        setName: inc.setName, number: inc.number, qty: 1,
        price: inc.value || 0, img: inc.img,
      }
      booth.value.items.unshift(item)
      listed.push(item)
    }
  }
  const snapshot = decrementListing(booth.value.items.indexOf(it))
  persist()
  closeTrade()
  showUndo({
    label: `Traded ${snapshot.name}${listed.length ? ` (+${listed.length} listed)` : ''}`,
    journalIds: ids, snapshot, index: i, incoming: listed,
  })
}

function removeQuiet(i) {
  const it = booth.value.items[i]
  if (!it) return
  const snapshot = { ...it }
  booth.value.items.splice(i, 1)
  persist()
  showUndo({ label: `Removed ${it.name}`, journalIds: [], snapshot, index: i, incoming: [], wholeRow: true })
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
  // Items a trade listed onto the table leave with the undo
  for (const inc of a.incoming || []) {
    const at = items.indexOf(inc)
    if (at !== -1) items.splice(at, 1)
  }
  // The outgoing row may still exist (qty was decremented) — find it by identity
  const found = !a.wholeRow && items.find(it =>
    it.name === a.snapshot.name && it.cardId === a.snapshot.cardId && it.price === a.snapshot.price)
  if (found && !a.wholeRow) found.qty = (found.qty || 1) + 1
  else items.splice(Math.min(a.index, items.length), 0, { ...a.snapshot, qty: a.wholeRow ? a.snapshot.qty : 1 })
  for (const id of a.journalIds || []) removeEntry(journal.value, id)
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
const buyMode = ref(false)

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

function addFromSearch(c, asBuy = false) {
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
  if (asBuy) {
    // cost defaults to market when the input is left blank
    const cost = Math.round(((c._cost ?? c.price) || 0) * 100) / 100
    addEntry(journal.value, {
      boothId: booth.value.id, boothName: booth.value.name, kind: 'buy',
      name: c.name || '', setName: c.set || '', price: cost, cash: -cost,
      game: c.game || '', type: c.sealed ? 'sealed' : 'card', cardId: c.id || '',
    })
  }
  persist()
  addedFlash.value = true
  setTimeout(() => { addedFlash.value = false }, 1500)
}

function exportLedger() {
  exportBoothLedger(booth.value, allBoothEntries.value)
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
    if (remoteArmed.value && booth.value?.remoteSecret) {
      await nextTick()
      if (pairCanvas.value) QRCode.toCanvas(pairCanvas.value, displayUrl(booth.value.remoteSecret), {
        width: 200, margin: 2, color: { dark: '#141414', light: '#ffffff' }, errorCorrectionLevel: 'M',
      })
    }
    // Keep the stand's screen awake while the kiosk is up (best-effort)
    try { wakeLock = await navigator.wakeLock?.request('screen') } catch { /* unsupported/denied */ }
  } else {
    if (kioskAnim) { clearInterval(kioskAnim); kioskAnim = null }
    try { wakeLock?.release() } catch { /* already gone */ }
    wakeLock = null
  }
})

// ── Remote display: broadcast state to a paired second screen ──
// The pairing secret persists on the booth record (it never enters the
// share codec — packBooth picks fields explicitly), so re-arming later
// reuses the same channel and an already-paired tablet just keeps working.
const remoteArmed = ref(false)
const remoteStatus = ref('starting…')
const pairCanvas = ref(null)
let remoteChannel = null
let publishDebounce = null

async function armRemote() {
  if (!booth.value.remoteSecret) {
    booth.value.remoteSecret = generateSecret()
    persist()
  }
  remoteChannel = await deriveChannel(booth.value.remoteSecret)
  remoteArmed.value = true
  await nextTick()
  if (pairCanvas.value) {
    await QRCode.toCanvas(pairCanvas.value, displayUrl(booth.value.remoteSecret), {
      width: 200, margin: 2, color: { dark: '#141414', light: '#ffffff' }, errorCorrectionLevel: 'M',
    })
  }
  publishNow()
}

function disarmRemote() {
  remoteArmed.value = false
  remoteChannel = null
  clearTimeout(publishDebounce)
}

async function publishNow() {
  if (!remoteChannel || !booth.value) return
  remoteStatus.value = 'sending…'
  const ok = await publishState(remoteChannel, await encodeBoothBytes(booth.value))
  remoteStatus.value = ok ? 'broadcasting' : (navigator.onLine ? 'send failed — retrying on next change' : 'offline — will send when back')
}

// Inventory changed mid-display → refresh the code (debounced: a burst of
// taps re-encodes once) and push to the paired display
watch(() => booth.value && JSON.stringify(booth.value.items), () => {
  if (kioskOpen.value) {
    clearTimeout(kioskDebounce)
    kioskDebounce = setTimeout(renderKiosk, 400)
  }
  if (remoteArmed.value) {
    clearTimeout(publishDebounce)
    publishDebounce = setTimeout(publishNow, 1500)
  }
})

onMounted(() => { filterInput.value?.focus() })
onBeforeUnmount(() => {
  if (kioskAnim) clearInterval(kioskAnim)
  clearTimeout(kioskDebounce)
  clearTimeout(publishDebounce)
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
.bt-chip-cash.neg { background: var(--danger-dim, #ffdede); }
.bt-chip-trade { background: var(--bg-card); }
.bt-neg { color: var(--danger); }

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
.bt-log-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.bt-log-summary { font-size: 12.5px; color: var(--text-secondary); font-weight: 600; margin: 2px 0 8px; }
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

/* buy mode + trade sheet */
.bt-buy-toggle { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 700; margin: -4px 0 10px; cursor: pointer; }
.bt-buy-toggle input { width: 17px; height: 17px; accent-color: var(--accent); }
.bt-cost-wrap { font-weight: 800; font-size: 13px; white-space: nowrap; display: inline-flex; align-items: center; }
.bt-cost {
  width: 80px; font: inherit; font-weight: 800;
  border: 1.5px solid var(--border-subtle); border-radius: 7px;
  padding: 4px 6px; margin-left: 2px;
  background: var(--bg-card); color: inherit;
}
.bt-trade-label { display: block; font-size: 12px; font-weight: 800; margin: 12px 0 6px; }
.bt-trade-outrow { display: flex; gap: 10px; align-items: center; border: 1.5px solid var(--border-subtle); border-radius: 10px; padding: 8px 10px; }
.bt-trade-results { max-height: 28vh; }
.bt-incoming { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
.bt-incoming-row { display: flex; gap: 10px; align-items: center; border: 1.5px solid var(--accent); border-radius: 10px; padding: 8px 10px; flex-wrap: wrap; }
.bt-mini { font-size: 12px; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; }
.bt-list-toggle input { width: 16px; height: 16px; accent-color: var(--accent); }
.bt-cash-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }

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
.bt-remote { display: flex; flex-direction: column; align-items: center; gap: 8px; margin-top: 4px; }
.bt-pair-qr { border: 2px solid var(--ink); border-radius: 10px; background: #fff; }
.bt-remote-hint { font-size: 12.5px; font-weight: 700; color: var(--text-secondary); max-width: 380px; }
.bt-remote-status { display: block; margin-top: 3px; color: var(--ink); }
.bt-remote-note { font-size: 11px; color: var(--text-muted); font-weight: 600; max-width: 380px; }

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
