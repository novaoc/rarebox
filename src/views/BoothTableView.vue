<template>
  <div class="bt-page" v-if="booth">
    <!-- Sticky head: exit, recap, the two things you reach for between deals -->
    <header class="bt-head">
      <router-link :to="`/booth/${booth.id}`" class="btn btn-ghost btn-sm">← Done</router-link>
      <div class="bt-head-main">
        <div class="bt-title">{{ booth.name }}</div>
        <div class="bt-recap">
          <span class="bt-chip bt-chip-cash" :class="{ neg: totals.cashNet < 0 }"><RbIcon name="coin" :size="13" /> {{ fmtMoney(totals.cashNet) }} today</span>
          <span v-if="totals.sales.count" class="bt-chip bt-chip-trade">{{ totals.sales.count }} sold</span>
          <span class="bt-chip bt-chip-trade"><RbIcon name="swap" :size="13" /> {{ totals.tradesOut.count }} trade{{ totals.tradesOut.count !== 1 ? 's' : '' }}</span>
          <span v-if="totals.buys.count" class="bt-chip bt-chip-trade"><RbIcon name="download" :size="13" /> {{ totals.buys.count }} bought</span>
        </div>
      </div>
      <button class="btn btn-primary btn-sm" @click="kioskOpen = true"><RbIcon name="antenna" :size="15" /> Live QR</button>

      <!-- Undo bar: slides in right under the recap chips, inside the
           sticky head — always visible without covering the deal buttons -->
      <Transition name="bt-undo">
        <div v-if="lastAction" class="undobar bt-undobar">
          <span class="undobar-text">{{ lastAction.label }}</span>
          <button class="btn btn-primary btn-sm" @click="undo">Undo</button>
        </div>
      </Transition>
    </header>

    <div class="bt-tools">
      <input ref="filterInput" v-model="filter" class="input bt-filter" placeholder="🔍 Find a listing…" />
      <button class="btn btn-secondary" :disabled="atCap" @click="openSearch">+ Add</button>
    </div>
    <p v-if="atCap" class="bt-cap-note">Booth is full ({{ MAX_BOOTH_ITEMS }}) — remove something or split into a second booth.</p>

    <div v-if="!visibleItems.length" class="empty-state">
      <template v-if="filter.trim()">
        <p>No listings match.</p>
        <!-- The real table flow: check inventory first, then the catalog -->
        <p v-if="catalogHint" class="bt-catalog-hint">
          Not in your booth — search the catalog →
          <button class="btn btn-secondary btn-sm" @click="searchCatalogFromFilter">Search "{{ filterDebounced.trim() }}"</button>
        </p>
      </template>
      <p v-else>Nothing listed. Hit <strong>+ Add</strong> to put cards or sealed on the table.</p>
    </div>

    <!-- One row per listing: everything reachable with a thumb -->
    <div class="bt-items">
      <div v-for="{ it, i } in visibleItems" :key="i" class="bt-item card">
        <div class="bt-item-img">
          <img v-if="it.img" :src="it.img" :alt="it.name" loading="lazy" @error="$event.target.style.display='none'" />
          <span v-else aria-hidden="true"><RbIcon name="card" :size="26" /></span>
        </div>
        <div class="bt-item-main">
          <div class="bt-item-name">{{ it.name }}</div>
          <div class="bt-item-sub">{{ [it.setName, it.number ? '#' + it.number : ''].filter(Boolean).join(' · ') }}</div>
          <div v-if="demandFlags.get(i)" class="bt-iso-flag" :title="'Wanted by ' + demandFlags.get(i).join(', ')">
            🎯 ISO — {{ demandFlags.get(i)[0] }}<template v-if="demandFlags.get(i).length > 1"> +{{ demandFlags.get(i).length - 1 }}</template>
          </div>
          <div class="bt-item-meta">
            <span class="bt-price">$<input type="number" min="0" step="0.01" class="bt-price-input" v-model.number="it.price" @change="it.price = Math.max(0, +it.price || 0); persist()" /></span>
            <span v-if="(it.qty || 1) > 1" class="badge badge-info">×{{ it.qty }}</span>
            <button class="btn btn-ghost btn-icon" aria-label="Remove listing (not a sale)" @click="removeQuiet(i)">✕</button>
          </div>
        </div>
        <div class="bt-item-actions">
          <button class="bt-deal bt-deal-cash" @click="sell(i)"><RbIcon name="coin" :size="15" /> Sold</button>
          <button class="bt-deal bt-deal-trade" @click="openTrade(i)"><RbIcon name="swap" :size="15" /> Trade</button>
        </div>
      </div>
      <button v-if="hiddenCount" class="btn btn-secondary bt-show-more" @click="listLimit += 160">
        Show more ({{ hiddenCount }} hidden)
      </button>
    </div>

    <!-- Today's log + running ledger -->
    <section v-if="today.length || allBoothEntries.length" class="bt-log">
      <div class="bt-log-head">
        <button class="bt-log-toggle" @click="logOpen = !logOpen">
          {{ logOpen ? '▾' : '▸' }} Today's log ({{ today.length }})
        </button>
        <button class="btn btn-secondary btn-sm" @click="exportLedger"><RbIcon name="chart" :size="15" /> Export Excel</button>
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
            <RbIcon name="coin" :size="15" /> I'm buying these — log what I paid &amp; deduct it from table cash
          </label>
          <!-- Type chips — narrow without retyping; counts come from the
               results already fetched, Graded fetches its own market lazily -->
          <div class="bt-cats">
            <button v-for="cat in CATS" :key="cat.id" class="bt-cat" :class="{ active: searchCat === cat.id }" @click="setCat(cat.id)">
              {{ cat.label }}<span v-if="searched && catCount(cat.id) !== null" class="bt-cat-n">{{ catCount(cat.id) }}</span>
            </button>
          </div>
          <div v-if="searchUnderstood.length" class="bt-understood">
            <span v-for="u in searchUnderstood" :key="u" class="bt-understood-chip">{{ u }}</span>
          </div>
          <div class="bt-search-list">
            <div v-for="(c, ri) in visibleResults" :key="(c.graded ? 'g' : c.sealed ? 's' : 'c') + (c.game || '') + c.id" class="bt-search-row" :class="{ 'bt-top-match': ri === 0 && searchCat !== 'graded' }">
              <span v-if="ri === 0 && searchCat !== 'graded'" class="bt-top-chip">Top match</span>
              <img v-if="c.image" :src="c.image" class="bt-search-img" loading="lazy" @error="$event.target.style.display='none'" />
              <span v-else class="bt-search-img bt-search-noimg"><RbIcon name="card" :size="22" /></span>
              <span class="bt-search-name">{{ c.name }} <span v-if="c.sealed" class="badge badge-info bt-sealed">Sealed</span><span v-else-if="c.jp" class="badge badge-info bt-sealed">JP</span>
                <span class="bt-search-sub">{{ [c.set, c.number ? '#' + c.number : ''].filter(Boolean).join(' · ') }}</span>
              </span>
              <template v-if="c.graded">
                <span v-if="buyMode" class="bt-cost-wrap">paid $<input type="number" min="0" step="0.01" class="bt-cost" v-model.number="c._cost" /></span>
                <span class="bt-grade-btns">
                  <button v-if="c.psa9" class="btn btn-secondary btn-sm" :disabled="atCap" @click="addGraded(c, 'PSA 9', c.psa9, buyMode)">9 · {{ fmtMoney(c.psa9) }}</button>
                  <button v-if="c.psa10" class="btn btn-primary btn-sm" :disabled="atCap" @click="addGraded(c, 'PSA 10', c.psa10, buyMode)">10 · {{ fmtMoney(c.psa10) }}</button>
                </span>
              </template>
              <template v-else-if="buyMode">
                <span class="bt-cost-wrap">paid $<input type="number" min="0" step="0.01" class="bt-cost" v-model.number="c._cost" :placeholder="c.price ? c.price.toFixed(2) : '0'" /></span>
                <button class="btn btn-primary btn-sm" :disabled="atCap" @click="addFromSearch(c, true)"><RbIcon name="coin" :size="14" /> Buy</button>
              </template>
              <template v-else>
                <span class="bt-search-price">{{ c.price ? fmtMoney(c.price) : '—' }}</span>
                <button class="btn btn-primary btn-sm" :disabled="atCap" @click="addFromSearch(c)">+ Add</button>
              </template>
            </div>
            <p v-if="searchBusy || gradedBusy" class="text-muted bt-search-msg">Searching…</p>
            <p v-else-if="searched && searchCat === 'graded' && !visibleResults.length" class="text-muted bt-search-msg">No graded market found — graded prices come from PriceCharting and need a connection.</p>
            <p v-else-if="searched && !visibleResults.length" class="text-muted bt-search-msg">No {{ searchCat === 'all' ? 'matches' : searchCat }} — try fewer words or another type.</p>
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
          <h3><RbIcon name="swap" :size="18" /> Log a trade</h3>
          <button class="btn btn-ghost btn-icon" @click="closeTrade">✕</button>
        </div>
        <div class="modal-body">
          <div class="bt-trade-out">
            <span class="bt-trade-label">Going out</span>
            <div class="bt-trade-outrow">
              <img v-if="trade.it.img" :src="trade.it.img" class="bt-search-img" @error="$event.target.style.display='none'" />
              <span v-else class="bt-search-img bt-search-noimg"><RbIcon name="card" :size="22" /></span>
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
              <span v-else class="bt-search-img bt-search-noimg"><RbIcon name="card" :size="22" /></span>
              <span class="bt-search-name">{{ c.name }} <span v-if="c.sealed" class="badge badge-info bt-sealed">Sealed</span><span v-else-if="c.jp" class="badge badge-info bt-sealed">JP</span>
                <span class="bt-search-sub">{{ [c.set, c.number ? '#' + c.number : ''].filter(Boolean).join(' · ') }}</span>
              </span>
              <span class="bt-search-price">{{ c.price ? fmtMoney(c.price) : '—' }}</span>
              <button class="btn btn-primary btn-sm" @click="takeIncoming(c)"><RbIcon name="download" :size="14" /> Take</button>
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
          <BoothLiveQr :booth="booth" status="live" />

          <div class="bt-remote">
            <button v-if="!remoteArmed" class="btn btn-secondary btn-sm" @click="armRemote"><RbIcon name="antenna" :size="15" /> Show on another device</button>
            <template v-else>
              <canvas ref="pairCanvas" class="bt-pair-qr"></canvas>
              <div class="bt-remote-hint">Scan with the display device's camera — its QR follows this table live.
                <span class="bt-remote-status"><RbIcon name="antenna" :size="13" /> {{ remoteStatus }}</span></div>
              <p class="bt-remote-note">Devices link directly when the network allows; otherwise updates relay through ntfy.sh end-to-end encrypted — it only ever sees scrambled bytes; the key lives in this pairing code.
                <button class="bt-tip-link" @click="hotspotTipOpen = true">Best setup tip</button></p>
              <button class="btn btn-ghost btn-sm" @click="disarmRemote">Stop broadcasting</button>
            </template>
          </div>

          <!-- One-time hotspot tip — the recommended (but optional) setup -->
          <Teleport to="body">
            <transition name="fade">
              <div v-if="hotspotTipOpen" class="modal-overlay" style="z-index:600" @click.self="dismissHotspotTip">
                <div class="modal" style="max-width:420px">
                  <div class="modal-header">
                    <h3>📶 Best setup (optional)</h3>
                    <button class="btn btn-ghost btn-icon" @click="dismissHotspotTip" aria-label="Close">✕</button>
                  </div>
                  <div class="modal-body">
                    <p class="bt-tip-lead">For the fastest updates — and a live QR that works with <strong>no internet at all</strong>:</p>
                    <ol class="bt-tip-steps">
                      <li>Turn on your phone's <strong>Personal Hotspot</strong></li>
                      <li>Connect the display device to that hotspot</li>
                      <li>Scan the pairing code as usual</li>
                    </ol>
                    <p class="bt-tip-why">The two devices then talk <strong>directly</strong> — instant updates, immune to venue Wi-Fi, works in a dead zone. You'll see <strong>LIVE · DIRECT</strong> on the display.</p>
                    <p class="bt-tip-optional">Totally optional — on any normal connection it works without this, just via an encrypted relay instead.</p>

                    <button v-if="!tipKnowMore" class="bt-tip-link bt-tip-more" @click="tipKnowMore = true">Know more — how the tech works</button>
                    <div v-else class="bt-tip-deep">
                      <h4>How it works</h4>
                      <p>
                        Your phone and the display pair through the QR code, then try to talk
                        <strong>directly to each other</strong> over the local network (WebRTC, end-to-end
                        encrypted). When that works, price updates are a few kilobytes traveling between two
                        devices at the same table — they never leave the building and never touch the internet.
                      </p>
                      <p>
                        If the network <em>blocks</em> devices from seeing each other (common on guest Wi-Fi —
                        it's called <strong>client isolation</strong>), both devices fall back to an encrypted
                        internet relay. That still works, but it uses the venue's internet connection and the
                        free relay caps messages per day <strong>per public IP</strong> — so at a big show where
                        every dealer shares one connection, everyone's broadcasts compete for the same budget.
                      </p>
                      <h4>For venue &amp; show organizers</h4>
                      <p>
                        Allowing device-to-device traffic on the dealers' Wi-Fi (turning off client isolation,
                        e.g. on a separate dealers-only network) means booth traffic stays local: faster
                        updates for dealers, <strong>less load on your internet line</strong>, and no shared
                        rate limits. Each dealer's phone hotspot achieves the same thing without any venue help.
                      </p>
                    </div>
                  </div>
                  <div class="modal-footer">
                    <button class="btn btn-primary" @click="dismissHotspotTip">Got it</button>
                  </div>
                </div>
              </div>
            </transition>
          </Teleport>

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
import { loadBooths, saveBooths, loadSavedShops, boothTotal, encodeBoothBytes, MAX_BOOTH_ITEMS } from '../utils/booth'
import { itemMatchesWant } from '../utils/wantlist'
import BoothLiveQr from '../components/BoothLiveQr.vue'
import RbIcon from '../components/icons/RbIcon.vue'
import { loadJournal, addEntry, removeEntry, todayEntries, boothEntries, journalTotals, generateJournalId } from '../utils/boothJournal'
import { exportBoothLedger } from '../utils/boothExcel'
import { smartSearch, warmSearchIntel } from '../utils/searchIntel'
import { rankForTable, dedupeForTable } from '../utils/tableSearchRank'
import { searchGradedProducts } from '../services/priceServer'
import { tokenMatch } from '../utils/search'
import { generateSecret, displayUrl, deriveChannel, deriveSigChannel, publishState, subscribeSig } from '../utils/remoteQr'
import { phonePeer } from '../utils/remoteP2p'
import { shelfAdd, shelfRemove, returnToSource, reclaimFromSource } from '../utils/boothShelf'

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

// Typing debounce: filtering is cheap, but each keystroke re-rendering a
// 600-card DOM is not — let the input settle first
const filterDebounced = ref('')
let filterTimer = null
watch(filter, (v) => {
  clearTimeout(filterTimer)
  filterTimer = setTimeout(() => { filterDebounced.value = v }, 160)
})

// ── ISO demand flags (6.6): listings other scanned vendors want ────────
// Saved shops whose shares carried a wantlist (wl) mark demand on MY
// table: "the vendor at that booth is hunting this card". Matching reuses
// the wantlist rules (exact id first, name/number fallback).
const shopsWithWants = loadSavedShops()
  .filter(s => s.booth?.wl?.length)
  .map(s => ({ name: s.booth.name || 'Saved shop', wl: s.booth.wl }))

const demandFlags = computed(() => {
  const out = new Map() // item index → [shop names]
  if (!shopsWithWants.length || !booth.value) return out
  const items = booth.value.items || []
  for (let i = 0; i < items.length; i++) {
    let names = null
    for (const s of shopsWithWants) {
      if (s.wl.some(w => itemMatchesWant(items[i], w))) (names ||= []).push(s.name)
    }
    if (names) out.set(i, names)
  }
  return out
})

const matchedItems = computed(() => {
  const items = booth.value?.items || []
  const q = filterDebounced.value.trim()
  const out = []
  for (let i = 0; i < items.length; i++) {
    if (!q || tokenMatch(q, items[i].name, items[i].setName, items[i].number)) out.push({ it: items[i], i })
  }
  return out
})

// Windowed rendering: 600 image cards at once chokes mid phones — render
// in slabs of 80 with a Show-more; the window resets when the filter moves
const LIST_WINDOW = 80
const listLimit = ref(LIST_WINDOW)
watch(filterDebounced, () => { listLimit.value = LIST_WINDOW })
const visibleItems = computed(() => matchedItems.value.slice(0, listLimit.value))
const hiddenCount = computed(() => Math.max(0, matchedItems.value.length - listLimit.value))

// Filter found nothing on the table → offer the catalog (debounced value so
// the hint can't flash while the list is still narrowing)
const catalogHint = computed(() =>
  filterDebounced.value.trim().length >= 2 && matchedItems.value.length === 0)

async function searchCatalogFromFilter() {
  searchQuery.value = filterDebounced.value.trim()
  await openSearch() // opens the modal + focuses the input
  runSearch()
}

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
  shelfRemove(booth.value, snapshot, 1)
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

let tradeSeq = 0
async function runTradeSearch() {
  const q = tradeQuery.value.trim()
  if (q.length < 2) return
  const seq = ++tradeSeq
  tradeBusy.value = true
  try {
    const { cards, sealed } = await smartSearch(q, { pageSize: 16, sealedLimit: 10 })
    if (seq !== tradeSeq) return
    tradeResults.value = dedupeForTable(rankForTable([...cards, ...sealed], q))
  } catch {
    if (seq !== tradeSeq) return
    tradeResults.value = []
  } finally {
    if (seq === tradeSeq) tradeBusy.value = false
  }
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
  const received = [] // every trade-in, listed or not — undo must reverse all shelf mirrors
  for (const inc of tradeIncoming.value) {
    ids.push(addEntry(journal.value, {
      boothId: booth.value.id, boothName: booth.value.name, kind: 'trade-in',
      name: inc.name, setName: inc.setName, price: inc.value || 0, cash: 0,
      game: inc.game, type: inc.type, cardId: inc.cardId, tradeId,
    }).id)
    const incomingItem = {
      type: inc.type, game: inc.game, cardId: inc.cardId, name: inc.name,
      setName: inc.setName, number: inc.number, qty: 1,
      price: inc.value || 0, img: inc.img,
    }
    // trade-ins are inventory whether or not they go on the table;
    // cost basis = the value you gave up for them
    shelfAdd(booth.value, incomingItem, { qty: 1, purchasePrice: inc.value || 0 })
    received.push(incomingItem)
    if (inc.list && !atCap.value) {
      booth.value.items.unshift(incomingItem)
      listed.push(incomingItem)
    }
  }
  const snapshot = decrementListing(booth.value.items.indexOf(it))
  shelfRemove(booth.value, snapshot, 1)
  persist()
  closeTrade()
  showUndo({
    label: `Traded ${snapshot.name}${listed.length ? ` (+${listed.length} listed)` : ''}`,
    journalIds: ids, snapshot, index: i, incoming: received,
  })
}

function removeQuiet(i) {
  const it = booth.value.items[i]
  if (!it) return
  const snapshot = { ...it }
  returnToSource(booth.value, it)
  booth.value.items.splice(i, 1)
  persist()
  showUndo({ label: `Removed ${it.name}`, journalIds: [], snapshot, index: i, incoming: [], delisted: true, wholeRow: true })
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
  // shelf mirror: a sale/trade-out comes back, trade-ins leave again,
  // a delisted row is re-listed as new inventory
  const undoQty = a.wholeRow ? (a.snapshot.qty || 1) : 1
  if (a.delisted) reclaimFromSource(booth.value, a.snapshot, undoQty)
  shelfAdd(booth.value, a.snapshot, { qty: undoQty, purchasePrice: 0 })
  for (const inc of a.incoming || []) shelfRemove(booth.value, inc, inc.qty || 1)
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
const searchUnderstood = ref([])
// ── Type chips: singles/sealed filter the fetched results instantly;
//    graded lazily searches PriceCharting (the only graded-price source)
const CATS = [
  { id: 'all', label: 'All' },
  { id: 'singles', label: 'Singles' },
  { id: 'sealed', label: 'Sealed' },
  { id: 'graded', label: 'Graded' },
]
const searchCat = ref('all')
const gradedResults = ref([])
const gradedBusy = ref(false)
let gradedFor = ''

const visibleResults = computed(() => {
  if (searchCat.value === 'graded') return gradedResults.value
  if (searchCat.value === 'singles') return searchResults.value.filter(c => !c.sealed)
  if (searchCat.value === 'sealed') return searchResults.value.filter(c => c.sealed)
  return searchResults.value
})

function catCount(id) {
  if (id === 'all') return searchResults.value.length
  if (id === 'singles') return searchResults.value.filter(c => !c.sealed).length
  if (id === 'sealed') return searchResults.value.filter(c => c.sealed).length
  return gradedFor === searchQuery.value.trim() ? gradedResults.value.length : null
}

function setCat(id) {
  searchCat.value = id
  if (id === 'graded') ensureGraded()
}

async function ensureGraded() {
  const q = searchQuery.value.trim()
  if (q.length < 2 || gradedFor === q) return
  gradedBusy.value = true
  try {
    gradedResults.value = await searchGradedProducts(q, { limit: 14 })
    gradedFor = q
  } catch { gradedResults.value = [] } finally { gradedBusy.value = false }
}

function addGraded(c, gradeLabel, price, asBuy = false) {
  addFromSearch({
    gradedAs: gradeLabel,
    game: '',
    id: c.id,
    name: `${c.name} · ${gradeLabel}`,
    set: c.set,
    number: '',
    price,
    image: c.image,
    _cost: c._cost,
  }, asBuy)
}
const searchBusy = ref(false)
const searched = ref(false)
const addedFlash = ref(false)
const buyMode = ref(false)

async function openSearch() {
  searchOpen.value = true
  await nextTick()
  searchInput.value?.focus()
}

let searchSeq = 0
async function runSearch() {
  const q = searchQuery.value.trim()
  if (q.length < 2) return
  const seq = ++searchSeq
  searchBusy.value = true
  try {
    const { cards, sealed, understood } = await smartSearch(q, { pageSize: 24, sealedLimit: 12 })
    if (seq !== searchSeq) return // a newer search superseded this one
    // table mode: precision re-rank (exact id/number/set/variant first,
    // price-desc tiebreak) + collapse duplicate rows before they render
    searchResults.value = dedupeForTable(rankForTable([...cards, ...sealed], q))
    searchUnderstood.value = understood
  } catch {
    if (seq !== searchSeq) return
    searchResults.value = []
    searchUnderstood.value = []
  } finally {
    if (seq === searchSeq) { searchBusy.value = false; searched.value = true }
  }
  gradedFor = ''
  gradedResults.value = []
  if (searchCat.value === 'graded') ensureGraded()
}

function addFromSearch(c, asBuy = false) {
  if (atCap.value) return
  const listing = {
    type: c.gradedAs ? 'graded' : (c.sealed ? 'sealed' : 'card'),
    game: c.game || 'pokemon',
    cardId: c.id || '',
    name: c.name || '',
    setName: c.set || '',
    number: c.number || '',
    _lang: c._lang || null,
    qty: 1,
    price: c.price ? Math.round(c.price * 100) / 100 : 0,
    img: c.image || '',
  }
  booth.value.items.unshift(listing)
  shelfAdd(booth.value, listing, { qty: 1, purchasePrice: asBuy ? +(c._cost ?? c.price ?? 0) : 0 })
  if (asBuy) {
    // cost defaults to market when the input is left blank
    const cost = Math.round(((c._cost ?? c.price) || 0) * 100) / 100
    addEntry(journal.value, {
      boothId: booth.value.id, boothName: booth.value.name, kind: 'buy',
      name: c.name || '', setName: c.set || '', price: cost, cash: -cost,
      game: c.game || '', type: listing.type, cardId: c.id || '', // graded buys ledger as 'graded', not 'card'
    })
  }
  persist()
  addedFlash.value = true
  setTimeout(() => { addedFlash.value = false }, 1500)
}

function exportLedger() {
  exportBoothLedger(booth.value, allBoothEntries.value)
}

// ── Kiosk QR (rendering lives in BoothLiveQr — it watches the booth) ──
const kioskOpen = ref(false)
let wakeLock = null

watch(kioskOpen, async (open) => {
  if (open) {
    if (remoteArmed.value && booth.value?.remoteSecret) {
      await nextTick()
      if (pairCanvas.value) QRCode.toCanvas(pairCanvas.value, displayUrl(booth.value.remoteSecret), {
        width: 200, margin: 2, color: { dark: '#141414', light: '#ffffff' }, errorCorrectionLevel: 'M',
      })
    }
    // Keep the stand's screen awake while the kiosk is up (best-effort)
    try { wakeLock = await navigator.wakeLock?.request('screen') } catch { /* unsupported/denied */ }
  } else {
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
// Hotspot tip: shown once, the first time a seller arms the second screen
const HOTSPOT_TIP_KEY = 'rarebox_hotspot_tip_seen'
const hotspotTipOpen = ref(false)
const tipKnowMore = ref(false)
function dismissHotspotTip() {
  hotspotTipOpen.value = false
  try { localStorage.setItem(HOTSPOT_TIP_KEY, '1') } catch { /* quota */ }
}
const pairCanvas = ref(null)
let remoteChannel = null
let publishDebounce = null
// P2P leg: live updates go phone→display directly when WebRTC connects;
// ntfy stays for the handshake, the initial state, and as the fallback.
let peer = null
let sigStop = null

async function armRemote() {
  if (!booth.value.remoteSecret) {
    booth.value.remoteSecret = generateSecret()
    persist()
  }
  remoteChannel = await deriveChannel(booth.value.remoteSecret)
  const sigChannel = await deriveSigChannel(booth.value.remoteSecret)
  peer = phonePeer({
    sigChannel,
    key: remoteChannel.key,
    onUp: () => { remoteStatus.value = 'broadcasting · direct'; publishNow() },
    onDown: () => {
      remoteStatus.value = 'broadcasting · relay'
      publishNow() // make sure the display has the latest via ntfy
      setTimeout(() => { if (remoteArmed.value && !peer?.connected) peer?.offer() }, 5500)
    },
  })
  sigStop = subscribeSig(sigChannel, (msg) => {
    if (msg.t === 'hello') peer?.offer()        // a display just paired/reloaded
    else if (msg.t === 'answer') peer?.onAnswer(msg.sdp)
  })
  remoteArmed.value = true
  await nextTick()
  if (pairCanvas.value) {
    await QRCode.toCanvas(pairCanvas.value, displayUrl(booth.value.remoteSecret), {
      width: 200, margin: 2, color: { dark: '#141414', light: '#ffffff' }, errorCorrectionLevel: 'M',
    })
  }
  publishNow()
  peer.offer()
  try { if (!localStorage.getItem(HOTSPOT_TIP_KEY)) hotspotTipOpen.value = true } catch { /* private mode */ }
}

function disarmRemote() {
  remoteArmed.value = false
  remoteChannel = null
  peer?.stop(); peer = null
  sigStop?.(); sigStop = null
  clearTimeout(publishDebounce)
}

async function publishNow() {
  if (!booth.value) return
  const bytes = await encodeBoothBytes(booth.value)
  // Direct first: free, instant, works offline on a hotspot
  if (peer?.connected && await peer.send(bytes)) {
    remoteStatus.value = 'broadcasting · direct'
    return
  }
  if (!remoteChannel) return
  remoteStatus.value = 'sending…'
  const ok = await publishState(remoteChannel, bytes)
  remoteStatus.value = ok ? 'broadcasting · relay' : (navigator.onLine ? 'send failed — retrying on next change' : 'offline — will send when back')
}

// iOS suspends WebRTC when Safari backgrounds; coming back, reconnect fast
function onVisible() {
  if (document.visibilityState === 'visible' && remoteArmed.value && peer && !peer.connected) peer.offer()
}
document.addEventListener('visibilitychange', onVisible)

// Inventory changed → push to the paired display (debounced: a burst of
// taps publishes once). The on-screen kiosk re-renders itself.
watch(() => booth.value && JSON.stringify(booth.value.items), () => {
  if (remoteArmed.value) {
    clearTimeout(publishDebounce)
    publishDebounce = setTimeout(publishNow, 1500)
  }
})

onMounted(() => { filterInput.value?.focus(); warmSearchIntel() })
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisible)
  peer?.stop()
  sigStop?.()
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
  flex-wrap: wrap; /* the undo bar docks as its own full-width row */
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
.bt-iso-flag {
  display: inline-block;
  margin-top: 3px;
  font-size: 11px; font-weight: 800;
  padding: 1px 8px;
  background: var(--pink-dim); border: 1.5px solid var(--ink); border-radius: 99px;
  max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
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

/* undo bar rides the sticky head as a full-width row under the recap */
.bt-undobar { flex-basis: 100%; order: 10; margin-bottom: 4px; }
.bt-undo-enter-active, .bt-undo-leave-active { transition: opacity .18s, transform .18s; }
.bt-undo-enter-from, .bt-undo-leave-to { opacity: 0; transform: translateY(-6px); }

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

/* best-match affordance: the seller's eye lands on row one instantly */
.bt-search-row.bt-top-match {
  position: relative;
  border: 2px solid var(--accent);
  background: var(--accent-dim, transparent);
  margin-top: 8px; /* room for the chip riding the border */
}
.bt-top-chip {
  position: absolute; top: -9px; right: 10px;
  font-size: 9.5px; font-weight: 900; letter-spacing: 0.04em; text-transform: uppercase;
  padding: 1px 8px;
  background: var(--accent); color: var(--on-accent);
  border: 1.5px solid var(--ink); border-radius: 99px;
  pointer-events: none;
}

/* inventory miss → catalog handoff */
.bt-catalog-hint {
  display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap;
  font-size: 13px; font-weight: 700; margin-top: 8px;
}

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
  display: flex; justify-content: center;
  /* taller than the screen once the pairing section is open — scroll, and
     let margin:auto center the short case */
  overflow-y: auto;
  padding: calc(24px + env(safe-area-inset-top, 0px)) 24px calc(24px + env(safe-area-inset-bottom, 0px));
}
.bt-kiosk-inner { display: flex; flex-direction: column; align-items: center; gap: 14px; text-align: center; max-width: 92vw; margin: auto; }
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
.bt-tip-link {
  display: inline;
  border: none; background: none; padding: 0;
  font: inherit; font-weight: 800; font-size: inherit;
  color: var(--accent-text, inherit); text-decoration: underline;
  cursor: pointer;
}
.bt-tip-lead { font-size: 13.5px; line-height: 1.55; }
.bt-tip-steps { margin: 12px 0; padding-left: 22px; display: flex; flex-direction: column; gap: 6px; font-size: 13.5px; font-weight: 700; }
.bt-tip-why { font-size: 13px; line-height: 1.55; color: var(--text-secondary); }
.bt-tip-optional {
  margin-top: 12px; padding: 9px 12px;
  background: var(--accent-dim); border: 1.5px solid var(--ink); border-radius: var(--radius);
  font-size: 12.5px; line-height: 1.5;
}
.bt-tip-more { display: block; margin-top: 12px; font-size: 12.5px; }
.bt-tip-deep { margin-top: 12px; border-top: 1.5px dashed var(--ink); padding-top: 10px; }
.bt-tip-deep h4 { font-size: 12px; font-weight: 900; letter-spacing: 0.4px; text-transform: uppercase; margin: 10px 0 4px; }
.bt-tip-deep p { font-size: 12.5px; line-height: 1.55; color: var(--text-secondary); margin-bottom: 8px; }
.bt-cats { display: flex; gap: 6px; margin: 8px 0 2px; flex-wrap: wrap; }
.bt-cat {
  font: inherit; font-size: 12px; font-weight: 800;
  padding: 5px 11px; cursor: pointer;
  color: var(--ink); background: var(--bg-card);
  border: 1.5px solid var(--ink); border-radius: 99px;
  box-shadow: var(--shadow-pressed);
}
.bt-cat:active { box-shadow: none; transform: translate(1px, 1px); }
.bt-cat.active { background: var(--accent); color: var(--on-accent); }
.bt-cat-n { margin-left: 5px; font-size: 10.5px; opacity: 0.75; }
.bt-grade-btns { display: flex; gap: 5px; flex-shrink: 0; }
.bt-grade-btns .btn { font-size: 11px; padding: 5px 8px; white-space: nowrap; }
.bt-understood { display: flex; gap: 6px; margin-top: 6px; flex-wrap: wrap; }
.bt-understood-chip {
  font-size: 11px; font-weight: 800;
  padding: 2px 9px;
  background: var(--accent-dim); border: 1.5px solid var(--ink); border-radius: 99px;
}
.bt-show-more { width: 100%; margin-top: 10px; }
</style>
