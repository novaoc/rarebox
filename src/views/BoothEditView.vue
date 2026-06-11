<template>
  <div class="be-page container" v-if="booth">
    <div class="be-head">
      <router-link to="/booth" class="btn btn-ghost btn-sm">← Booths</router-link>
      <button class="btn btn-primary btn-sm" :disabled="!booth.items.length" @click="showShare = true">📣 Share</button>
    </div>

    <div class="card be-form">
      <div class="be-field">
        <label>Booth name</label>
        <input v-model="booth.name" class="input" placeholder="e.g. Wren's table — Regionals" @change="persist" />
      </div>
      <div class="be-row">
        <div class="be-field">
          <label>Store / event</label>
          <input v-model="booth.venue" class="input" placeholder="e.g. Regionals, Hobby Hive" @change="persist" />
        </div>
        <div class="be-field be-field-table">
          <label>Table #</label>
          <input v-model="booth.table" class="input" placeholder="e.g. 42" @change="persist" />
        </div>
        <div class="be-field">
          <label>When</label>
          <input v-model="booth.date" class="input" placeholder="e.g. Sat June 14" @change="persist" />
        </div>
      </div>
      <div class="be-field">
        <label>Location <span class="text-muted">(optional — buyers get a directions button)</span></label>
        <div v-if="booth.loc" class="be-loc-set">
          <span class="badge badge-info be-loc-chip">📍 {{ booth.locName || `${booth.loc[0]}, ${booth.loc[1]}` }}</span>
          <button class="btn btn-ghost btn-icon" aria-label="Clear location" @click="clearLoc">✕</button>
        </div>
        <button v-else class="btn btn-secondary btn-sm" @click="locOpen = true">📍 Set location</button>
      </div>
      <div class="be-field">
        <label>Note for buyers <span class="text-muted">(optional)</span></label>
        <input v-model="booth.note" class="input" placeholder="Trades welcome · cash & QR payments · prices firm" @change="persist" />
      </div>
    </div>

    <div class="be-listings-head">
      <h2>Listings <span class="badge badge-accent" v-if="booth.items.length">{{ booth.items.length }}</span></h2>
      <div class="be-listings-total" v-if="booth.items.length">Table total: <strong>{{ fmtMoney(total) }}</strong></div>
      <button class="btn btn-primary btn-sm" :disabled="atCap" @click="openPicker">+ From shelf</button>
      <button class="btn btn-secondary btn-sm" :disabled="atCap" @click="openSearch">🔍 Search cards</button>
    </div>
    <p v-if="atCap" class="be-cap-note">Booth is full ({{ MAX_BOOTH_ITEMS }} listings) — that keeps the QR scannable. Split into a second booth for more.</p>

    <div v-if="!booth.items.length" class="empty-state">
      <p>Nothing listed yet. Pull items straight from your shelves, or search the card database for things you haven't tracked.</p>
    </div>

    <div class="be-items">
      <div v-for="(it, i) in booth.items" :key="i" class="be-item card-sm card">
        <div class="be-item-img" v-if="it.img"><img :src="it.img" :alt="it.name" loading="lazy" @error="$event.target.style.display='none'" /></div>
        <div class="be-item-main">
          <div class="be-item-name">{{ it.name }}</div>
          <div class="be-item-sub">{{ [it.setName, it.number ? '#' + it.number : ''].filter(Boolean).join(' · ') }}</div>
        </div>
        <div class="be-item-controls">
          <label class="be-mini-label">Qty</label>
          <input type="number" min="1" class="input be-qty" v-model.number="it.qty" @change="persist" />
          <label class="be-mini-label">Asking $</label>
          <input type="number" min="0" step="0.01" class="input be-price" v-model.number="it.price" @change="persist" />
          <button class="btn btn-ghost btn-icon" aria-label="Remove listing" @click="removeItem(i)">✕</button>
        </div>
      </div>
    </div>

    <!-- Picker: items from your shelves -->
    <div v-if="pickerOpen" class="modal-overlay" @click.self="pickerOpen = false">
      <div class="modal" style="max-width: 560px">
        <div class="modal-header">
          <h3>Add from your shelves</h3>
          <button class="btn btn-ghost btn-icon" @click="pickerOpen = false">✕</button>
        </div>
        <div class="modal-body">
          <select v-model="pickerShelfId" class="select" style="margin-bottom: 12px">
            <option v-for="p in store.portfolios" :key="p.id" :value="p.id">{{ p.name }} ({{ p.items.length }})</option>
          </select>
          <input v-model="pickerFilter" class="input" placeholder="Filter by name…" style="margin-bottom: 12px" />
          <div class="picker-list">
            <label v-for="item in pickerItems" :key="item.id" class="picker-row">
              <input type="checkbox" v-model="picked" :value="item.id" />
              <span class="picker-name">{{ itemName(item) }}</span>
              <span class="picker-sub">{{ itemSub(item) }}</span>
              <span class="picker-price">{{ fmtMoney(itemValue(item)) }}</span>
            </label>
            <p v-if="!pickerItems.length" class="text-muted" style="font-size:13px; text-align:center; padding: 16px 0">No items match.</p>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn btn-secondary" @click="pickerOpen = false">Cancel</button>
          <button class="btn btn-primary" :disabled="!picked.length" @click="addPicked">
            Add {{ picked.length || '' }} listing{{ picked.length !== 1 ? 's' : '' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Search the card database: list things not on your shelves -->
    <div v-if="searchOpen" class="modal-overlay" @click.self="searchOpen = false">
      <div class="modal" style="max-width: 560px">
        <div class="modal-header">
          <h3>Search cards &amp; products</h3>
          <button class="btn btn-ghost btn-icon" @click="searchOpen = false">✕</button>
        </div>
        <div class="modal-body">
          <form class="search-bar" @submit.prevent="runSearch">
            <input ref="searchInput" v-model="searchQuery" class="input" placeholder="Card name — e.g. Charizard ex" />
            <button class="btn btn-primary btn-sm" type="submit" :disabled="searchBusy || searchQuery.trim().length < 2">
              {{ searchBusy ? '…' : 'Search' }}
            </button>
          </form>
          <div class="search-list">
            <div v-for="c in searchResults" :key="c.game + c.id" class="picker-row search-row">
              <img v-if="c.image" :src="c.image" class="search-img" loading="lazy" @error="$event.target.style.display='none'" />
              <span v-else class="search-img search-noimg">🃏</span>
              <span class="picker-name">{{ c.name }}<span class="picker-sub" style="display:block">{{ [gameLabel(c.game), c.set, c.number ? '#' + c.number : ''].filter(Boolean).join(' · ') }}</span></span>
              <span class="picker-price">{{ c.price ? fmtMoney(c.price) : '—' }}</span>
              <button class="btn btn-primary btn-sm" :disabled="atCap" @click="addFromSearch(c)">+ Add</button>
            </div>
            <p v-if="searchBusy" class="text-muted search-msg">Searching all games…</p>
            <p v-else-if="searched && !searchResults.length" class="text-muted search-msg">No matches — try fewer words.</p>
            <p v-else-if="!searched" class="text-muted search-msg">Search the card database across all six games — list things that aren't on your shelves yet.</p>
          </div>
        </div>
        <div class="modal-footer">
          <span v-if="addedFlash" class="badge badge-success">✓ Added to booth</span>
          <button class="btn btn-secondary" @click="searchOpen = false">Done</button>
        </div>
      </div>
    </div>

    <!-- Location picker: search a place or use GPS — no address typing -->
    <div v-if="locOpen" class="modal-overlay" @click.self="locOpen = false">
      <div class="modal" style="max-width: 480px">
        <div class="modal-header">
          <h3>📍 Booth location</h3>
          <button class="btn btn-ghost btn-icon" @click="locOpen = false">✕</button>
        </div>
        <div class="modal-body">
          <button class="btn btn-primary be-gps-btn" :disabled="locBusy" @click="useMyLocation">
            {{ locBusy === 'gps' ? 'Locating…' : '🧭 Use my current location' }}
          </button>
          <div class="be-loc-or">or search the venue</div>
          <form class="search-bar" @submit.prevent="searchPlace">
            <input v-model="locQuery" class="input" placeholder="e.g. Anaheim Convention Center" />
            <button class="btn btn-secondary btn-sm" type="submit" :disabled="locBusy || locQuery.trim().length < 3">
              {{ locBusy === 'search' ? '…' : 'Find' }}
            </button>
          </form>
          <div class="search-list">
            <button v-for="(p, i) in locResults" :key="i" class="picker-row be-loc-row" @click="pickPlace(p)">
              <span class="picker-name">{{ p.shortName }}<span class="picker-sub" style="display:block">{{ p.detail }}</span></span>
            </button>
            <p v-if="locError" class="text-muted search-msg" style="color: var(--danger)">{{ locError }}</p>
          </div>
          <p class="be-loc-credit">Place search by OpenStreetMap (Nominatim)</p>
        </div>
      </div>
    </div>

    <BoothShareModal v-if="showShare" :booth="booth" @close="showShare = false" />
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { usePortfolioStore } from '../stores/portfolio'
import BoothShareModal from '../components/BoothShareModal.vue'
import { loadBooths, saveBooths, boothTotal, MAX_BOOTH_ITEMS } from '../utils/booth'
import { multiSearch } from '../services/tcg/multiSearch'

const route = useRoute()
const store = usePortfolioStore()

const booths = ref(loadBooths())
const booth = computed(() => booths.value.find(b => b.id === route.params.id))
const showShare = ref(false)

const total = computed(() => boothTotal(booth.value || {}))
const atCap = computed(() => (booth.value?.items.length || 0) >= MAX_BOOTH_ITEMS)

const GAME_LABELS = {
  pokemon: 'Pokémon', mtg: 'Magic', yugioh: 'Yu-Gi-Oh!', lorcana: 'Lorcana',
  'one-piece': 'One Piece', riftbound: 'Riftbound', sealed: 'Sealed',
}
function gameLabel(g) { return GAME_LABELS[g] || g }

function fmtMoney(n) {
  return '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function persist() {
  saveBooths(booths.value)
}

function removeItem(i) {
  booth.value.items.splice(i, 1)
  persist()
}

function pushItem(item) {
  if (atCap.value) return false
  booth.value.items.push(item)
  persist()
  return true
}

// ── Picker (from shelves) ──
const pickerOpen = ref(false)
const pickerShelfId = ref(null)
const pickerFilter = ref('')
const picked = ref([])

function openPicker() {
  pickerShelfId.value = store.activePortfolioId || store.portfolios[0]?.id || null
  picked.value = []
  pickerFilter.value = ''
  pickerOpen.value = true
}

const pickerItems = computed(() => {
  const shelf = store.portfolios.find(p => p.id === pickerShelfId.value)
  if (!shelf) return []
  const q = pickerFilter.value.trim().toLowerCase()
  return shelf.items.filter(it => !q || itemName(it).toLowerCase().includes(q))
})

function itemName(item) {
  return item.cardData?.name || item.name || 'Item'
}
function itemSub(item) {
  const set = item.cardData?.set?.name || item.setName || ''
  const num = item.cardData?.number || ''
  return [set, num ? '#' + num : ''].filter(Boolean).join(' · ')
}
function itemValue(item) {
  if (item.type === 'card') {
    return item.currentMarketPrice
      || item.cardData?.tcgplayer?.prices?.holofoil?.market
      || item.cardData?.tcgplayer?.prices?.normal?.market
      || item.purchasePrice || 0
  }
  return item.currentValue || item.purchasePrice || 0
}
function itemImg(item) {
  return item.cardData?.images?.small || item.imageUrl || ''
}

function addPicked() {
  const shelf = store.portfolios.find(p => p.id === pickerShelfId.value)
  if (!shelf) return
  for (const id of picked.value) {
    const item = shelf.items.find(i => i.id === id)
    if (!item) continue
    const ok = pushItem({
      type: item.type || 'card',
      game: item.game || 'pokemon',
      cardId: item.cardData?.id || '',
      name: itemName(item),
      setName: item.cardData?.set?.name || item.setName || '',
      number: item.cardData?.number || '',
      qty: item.quantity || 1,
      price: Math.round(itemValue(item) * 100) / 100, // asking price starts at market — yours to change
      img: itemImg(item),
    })
    if (!ok) break
  }
  pickerOpen.value = false
}

// ── Search the card database (things not on your shelves) ──
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
    const { cards } = await multiSearch(q, { page: 1, pageSize: 30 })
    searchResults.value = cards
  } catch {
    searchResults.value = []
  } finally {
    searchBusy.value = false
    searched.value = true
  }
}

function addFromSearch(c) {
  const ok = pushItem({
    type: 'card',
    game: c.game || 'pokemon',
    cardId: c.id || '',
    name: c.name,
    setName: c.set || '',
    number: c.number || '',
    qty: 1,
    price: c.price ? Math.round(c.price * 100) / 100 : 0,
    img: c.image || '',
  })
  if (ok) {
    addedFlash.value = true
    setTimeout(() => { addedFlash.value = false }, 1500)
  }
}

// ── Location picker ──
const locOpen = ref(false)
const locQuery = ref('')
const locResults = ref([])
const locBusy = ref('')
const locError = ref('')

// Nominatim usage policy: identify the app, ≤1 req/s — searches are
// submit-driven (no per-keystroke calls), which stays well under it.
const NOMINATIM = 'https://nominatim.openstreetmap.org'

function placeFromResult(r) {
  const parts = (r.display_name || '').split(', ')
  return {
    shortName: parts[0] || r.display_name,
    detail: parts.slice(1, 4).join(', '),
    lat: parseFloat(r.lat),
    lon: parseFloat(r.lon),
  }
}

async function searchPlace() {
  locBusy.value = 'search'
  locError.value = ''
  locResults.value = []
  try {
    const res = await fetch(`${NOMINATIM}/search?q=${encodeURIComponent(locQuery.value.trim())}&format=json&limit=5`)
    const data = await res.json()
    locResults.value = data.map(placeFromResult)
    if (!locResults.value.length) locError.value = 'No places found — try adding the city.'
  } catch {
    locError.value = navigator.onLine ? 'Place search is unavailable right now.' : 'Place search needs a connection.'
  } finally {
    locBusy.value = ''
  }
}

async function useMyLocation() {
  locBusy.value = 'gps'
  locError.value = ''
  try {
    const pos = await new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 12000 }))
    const { latitude: lat, longitude: lon } = pos.coords
    let label = ''
    try {
      const r = await fetch(`${NOMINATIM}/reverse?lat=${lat}&lon=${lon}&format=json&zoom=17`)
      const d = await r.json()
      label = d.name || d.display_name?.split(', ').slice(0, 2).join(', ') || ''
    } catch { /* coords alone are fine */ }
    setLoc(lat, lon, label)
  } catch {
    locError.value = 'Location unavailable — check the browser permission, or search the venue instead.'
  } finally {
    locBusy.value = ''
  }
}

function pickPlace(p) {
  setLoc(p.lat, p.lon, p.shortName)
}

function setLoc(lat, lon, label) {
  booth.value.loc = [+lat.toFixed(5), +lon.toFixed(5)]
  booth.value.locName = (label || '').slice(0, 60)
  persist()
  locOpen.value = false
  locQuery.value = ''
  locResults.value = []
}

function clearLoc() {
  booth.value.loc = null
  booth.value.locName = ''
  persist()
}
</script>

<style scoped>
.be-page { padding-bottom: 32px; }
.be-head { display: flex; justify-content: space-between; align-items: center; margin: 14px 0; }

.be-form { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.be-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 160px), 1fr)); gap: 12px; }
.be-field label { display: block; font-size: 12px; font-weight: 800; margin-bottom: 5px; }
.be-field-table { max-width: 120px; }

.be-loc-set { display: flex; align-items: center; gap: 6px; }
.be-loc-chip { font-size: 12.5px; max-width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.be-gps-btn { width: 100%; }
.be-loc-or { text-align: center; font-size: 12px; font-weight: 700; color: var(--text-muted); margin: 12px 0 8px; }
.be-loc-row { width: 100%; text-align: left; background: none; font: inherit; color: inherit; }
.be-loc-credit { font-size: 10.5px; color: var(--text-muted); text-align: center; margin-top: 10px; }

.be-listings-head { display: flex; align-items: center; gap: 10px; margin: 22px 0 10px; flex-wrap: wrap; }
.be-listings-head h2 { font-size: 19px; font-weight: 900; flex: 1; }
.be-listings-total { font-size: 13.5px; color: var(--text-secondary); }
.be-cap-note { font-size: 12.5px; color: var(--text-secondary); margin: -4px 0 10px; }

.be-items { display: flex; flex-direction: column; gap: 10px; }
.be-item { display: flex; gap: 12px; align-items: center; padding: 10px 12px; flex-wrap: wrap; }
.be-item-img { width: 44px; height: 58px; flex-shrink: 0; background: #fff; border: 1.5px solid var(--ink); border-radius: 7px; padding: 2px; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.be-item-img img { width: 100%; height: 100%; object-fit: contain; border-radius: 4px; }
.be-item-main { flex: 1; min-width: 140px; }
.be-item-name { font-weight: 800; font-size: 14px; }
.be-item-sub { font-size: 12px; color: var(--text-secondary); }
.be-item-controls { display: flex; align-items: center; gap: 7px; }
.be-mini-label { font-size: 10.5px; font-weight: 800; color: var(--text-secondary); text-transform: uppercase; }
.be-qty { width: 62px; }
.be-price { width: 96px; }

.search-bar { display: flex; gap: 8px; margin-bottom: 12px; }
.search-bar .input { flex: 1; }
.search-list { max-height: 46vh; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.search-row { cursor: default; }
.search-img { width: 38px; height: 52px; object-fit: contain; border: 1.5px solid var(--ink); border-radius: 6px; background: #fff; flex-shrink: 0; }
.search-noimg { display: inline-flex; align-items: center; justify-content: center; font-size: 20px; opacity: .4; }
.search-msg { font-size: 13px; text-align: center; padding: 16px 0; }

.picker-list { max-height: 46vh; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.picker-row {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 10px; border: 1.5px solid var(--border-subtle); border-radius: 10px;
  cursor: pointer; font-size: 13.5px;
}
.picker-row:hover { background: var(--bg-hover); }
.picker-row input[type="checkbox"] { width: 18px; height: 18px; accent-color: var(--accent); }
.picker-name { font-weight: 700; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
.picker-sub { font-size: 11.5px; color: var(--text-muted); font-weight: 600; }
.picker-price { font-weight: 800; font-size: 12.5px; white-space: nowrap; }
</style>
