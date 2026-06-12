<template>
  <div class="be-page container" v-if="booth">
    <div class="be-head">
      <router-link to="/booth" class="btn btn-ghost btn-sm">← Booths</router-link>
      <div class="be-head-actions">
        <router-link :to="`/booth/${booth.id}/table`" class="btn btn-secondary btn-sm" :class="{ disabled: !booth.items.length }"><RbIcon name="bolt" :size="14" /> Table mode</router-link>
        <button class="btn btn-primary btn-sm" :disabled="!booth.items.length" @click="showShare = true">📣 Share</button>
      </div>
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
          <input v-model="booth.date" type="date" class="input" @change="persist" />
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
      <div class="be-field">
        <label class="be-sync-row">
          <input type="checkbox" :checked="booth.syncShelf === true" @change="toggleSync($event.target.checked)" />
          <span>Keep a shelf in sync with this booth</span>
        </label>
        <p class="be-sync-note" v-if="booth.syncShelf">
          “Booth: {{ booth.name || 'My booth' }}” mirrors your table: listing from a shelf <strong>moves</strong> the item there,
          sales and trade-outs leave it, buys and trade-ins join it — your curated shelves stay clean and your totals stay true.
        </p>
        <p class="be-sync-note" v-else>Off — listings are standalone copies; sales won't touch your shelves.</p>
      </div>
      <div class="be-field" v-if="brand">
        <label>Branding <span class="text-muted">(optional — your colors on every share)</span></label>
        <div class="be-brand-row">
          <div class="be-swatches">
            <button v-for="c in BRAND_COLORS" :key="c" type="button" class="be-swatch"
                    :class="{ active: brand.color === c }" :style="{ background: c }"
                    :aria-label="`Booth color ${c}`" @click="setBrandColor(c)"></button>
          </div>
          <input v-model="brand.mark" class="input be-mark" placeholder="🔥 or initials" maxlength="12" @change="persist" />
        </div>
        <div class="be-logo-row">
          <input v-model.trim="brand.logo" class="input be-logo" placeholder="Logo image link (https://…) — optional, monogram works without one" @change="persist" />
          <template v-if="canUploadLogo">
            <input ref="logoFile" type="file" accept="image/*" style="display:none" @change="onLogoPicked" />
            <button type="button" class="btn btn-secondary btn-sm" :disabled="logoBusy" @click="$refs.logoFile.click()">
              <RbIcon v-if="!logoBusy" name="upload" :size="15" /> {{ logoBusy ? 'Uploading…' : 'Upload' }}
            </button>
          </template>
          <a v-else class="btn btn-secondary btn-sm" href="https://postimages.org" target="_blank" rel="noopener">
            <RbIcon name="upload" :size="15" /> Get a link ↗
          </a>
        </div>
        <p v-if="logoError" class="be-logo-warn">{{ logoError }}</p>
        <p v-else-if="brand.logo && !/^https:\/\//.test(brand.logo)" class="be-logo-warn">Logo links must start with https:// — it won't be shared otherwise.</p>
        <p v-else-if="canUploadLogo" class="be-logo-note">Upload goes from your device straight to Imgur and saves the link — nothing passes through Rarebox.</p>
        <p v-else class="be-logo-note">No account needed: upload on Postimages (free), copy the <strong>Direct link</strong> it gives you, and paste it here.</p>
        <div v-if="brand.color || brand.mark || brand.logo" class="be-brand-preview">
          <img v-if="/^https:\/\//.test(brand.logo || '')" :src="brand.logo" class="be-brand-logo" alt="" @error="$event.target.style.display='none'" />
          <span v-else class="be-brand-mark" :style="{ background: brand.color || 'var(--accent)', color: markText }">{{ brand.mark || '◆' }}</span>
          <span class="text-muted" style="font-size:12px">how buyers see your booth header</span>
        </div>
      </div>
    </div>

    <div class="be-listings-head">
      <h2>Listings <span class="badge badge-accent" v-if="booth.items.length">{{ booth.items.length }}</span></h2>
      <div class="be-listings-total" v-if="booth.items.length">Table total: <strong>{{ fmtMoney(total) }}</strong></div>
      <button class="btn btn-primary btn-sm" :disabled="atCap" @click="openPicker">+ From shelf</button>
      <button class="btn btn-secondary btn-sm" :disabled="atCap" @click="openSearch"><RbIcon name="magnifier" :size="15" /> Search cards</button>
    </div>
    <p v-if="atCap" class="be-cap-note">Booth is full ({{ MAX_BOOTH_ITEMS }} listings). Split into a second booth and share both with a directory QR.</p>

    <!-- Binders: saved lenses buyers browse by — auto-suggested or custom -->
    <div class="be-binders card" v-if="booth.items.length >= 6 || booth.binders?.length">
      <div class="be-binders-head">
        <h3>🗂 Binders <span class="text-muted be-binders-sub">how buyers browse your table</span></h3>
        <button class="btn btn-secondary btn-sm" @click="autoBinders">✨ Suggest from listings</button>
      </div>
      <div v-if="booth.binders?.length" class="be-binder-list">
        <span v-for="b in booth.binders" :key="b.id" class="be-binder-chip">
          {{ b.icon }} {{ b.name }}
          <span class="be-binder-n">{{ binderCount(b) }}</span>
          <button class="be-binder-x" @click="removeBinder(b.id)" :aria-label="`Remove binder ${b.name}`">✕</button>
        </span>
      </div>
      <p v-else class="be-sync-note">No binders yet — buyers get one big grid. Suggest some from what you've listed, or build your own.</p>
      <details class="be-binder-custom">
        <summary>Custom binder</summary>
        <div class="be-binder-form">
          <input v-model.trim="binderForm.name" class="input input-sm" placeholder="Name — e.g. Vintage WOTC" maxlength="40" />
          <select v-model="binderForm.type" class="select input-sm"><option value="">Any type</option><option value="card">Singles</option><option value="sealed">Sealed</option><option value="graded">Graded</option></select>
          <select v-model="binderForm.set" class="select input-sm"><option value="">Any set</option><option v-for="sn in listedSets" :key="sn" :value="sn">{{ sn }}</option></select>
          <input v-model.number="binderForm.pmin" class="input input-sm" type="number" min="0" placeholder="Min $" />
          <input v-model.number="binderForm.pmax" class="input input-sm" type="number" min="0" placeholder="Max $" />
          <button class="btn btn-primary btn-sm" :disabled="!binderForm.name" @click="addCustomBinder">Add</button>
        </div>
      </details>
    </div>

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
          <input type="number" min="1" class="input be-qty" v-model.number="it.qty" @change="onQtyChange(it)" />
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
          <div class="be-cats">
            <button v-for="cat in CATS" :key="cat.id" class="be-cat" :class="{ active: pickerCat === cat.id }" @click="pickerCat = cat.id">
              {{ cat.label }}<span class="be-cat-n">{{ pickerCatCount(cat.id) }}</span>
            </button>
          </div>
          <div class="be-pick-all">
            <button class="btn btn-secondary btn-sm" :disabled="!pickerItems.length" @click="selectAllVisible">
              Select all {{ pickerItems.length }}{{ pickerCat !== 'all' ? ' ' + pickerCat : '' }}{{ pickerFilter ? ' shown' : '' }}
            </button>
            <button v-if="picked.length" class="btn btn-ghost btn-sm" @click="picked = []">Clear ({{ picked.length }})</button>
            <span v-if="pickerCapped" class="be-pick-cap">QR cap: {{ MAX_BOOTH_ITEMS }} listings per booth</span>
          </div>
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
          <div v-if="searchUnderstood.length" class="be-understood">
            <span v-for="u in searchUnderstood" :key="u" class="be-understood-chip">{{ u }}</span>
          </div>
          <div class="be-cats">
            <button v-for="cat in CATS" :key="cat.id" class="be-cat" :class="{ active: searchCat === cat.id }" @click="setCat(cat.id)">
              {{ cat.label }}<span v-if="searched && catCount(cat.id) !== null" class="be-cat-n">{{ catCount(cat.id) }}</span>
            </button>
          </div>
          <div class="search-list">
            <div v-for="c in visibleResults" :key="(c.graded ? 'g' : '') + (c.game || '') + c.id" class="picker-row search-row">
              <img v-if="c.image" :src="c.image" class="search-img" loading="lazy" @error="$event.target.style.display='none'" />
              <span v-else class="search-img search-noimg">🃏</span>
              <span class="picker-name">{{ c.name }} <span v-if="c.sealed" class="badge badge-info be-sealed-badge">Sealed</span><span v-else-if="c.jp" class="badge badge-info be-sealed-badge">JP</span><span class="picker-sub" style="display:block">{{ [gameLabel(c.game), c.set, c.number ? '#' + c.number : ''].filter(Boolean).join(' · ') }}</span></span>
              <template v-if="c.graded">
                <span class="be-grade-btns">
                  <button v-if="c.psa9" class="btn btn-secondary btn-sm" :disabled="atCap" @click="addGraded(c, 'PSA 9', c.psa9)">9 · {{ fmtMoney(c.psa9) }}</button>
                  <button v-if="c.psa10" class="btn btn-primary btn-sm" :disabled="atCap" @click="addGraded(c, 'PSA 10', c.psa10)">10 · {{ fmtMoney(c.psa10) }}</button>
                </span>
              </template>
              <template v-else>
                <span class="picker-price">{{ c.price ? fmtMoney(c.price) : '—' }}</span>
                <button class="btn btn-primary btn-sm" :disabled="atCap" @click="addFromSearch(c)">+ Add</button>
              </template>
            </div>
            <p v-if="searchBusy || gradedBusy" class="text-muted search-msg">Searching…</p>
            <p v-else-if="searched && searchCat === 'graded' && !visibleResults.length" class="text-muted search-msg">No graded market found — graded prices come from PriceCharting and need a connection.</p>
            <p v-else-if="searched && !visibleResults.length" class="text-muted search-msg">No {{ searchCat === 'all' ? 'matches' : searchCat }} — try fewer words or another type.</p>
            <p v-else-if="!searched" class="text-muted search-msg">Search singles and sealed (boxes, ETBs, decks) across all six games — list things that aren't on your shelves yet.</p>
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
import { ref, computed, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { usePortfolioStore } from '../stores/portfolio'
import BoothShareModal from '../components/BoothShareModal.vue'
import { loadBooths, saveBooths, boothTotal, MAX_BOOTH_ITEMS } from '../utils/booth'
import { smartSearch } from '../utils/searchIntel'
import { syncOn, ensureBoothShelf, shelfAdd, shelfSetQty, returnToSource, moveFromCurated, syncAll } from '../utils/boothShelf'
import { searchGradedProducts } from '../services/priceServer'
import { uploadLogo, logoUploadAvailable } from '../services/imageHost'
import RbIcon from '../components/icons/RbIcon.vue'

const route = useRoute()
const store = usePortfolioStore()

const booths = ref(loadBooths())
const booth = computed(() => booths.value.find(b => b.id === route.params.id))
const showShare = ref(false)

const total = computed(() => boothTotal(booth.value || {}))
const atCap = computed(() => (booth.value?.items.length || 0) >= MAX_BOOTH_ITEMS)

// ── Branding ──
// Tactile-adjacent palette; mark is an emoji or initials. Booths created
// before branding existed get the object lazily.
const BRAND_COLORS = ['#ffd23f', '#ff7ab6', '#6cc6ff', '#5fd68a', '#ff9d4d', '#b78cff', '#ff6b6b', '#141414']
watch(booth, (b) => {
  if (b && !b.brand) b.brand = { color: '', mark: '', logo: '' }
}, { immediate: true })
const brand = computed(() => booth.value?.brand)

function setBrandColor(c) {
  brand.value.color = brand.value.color === c ? '' : c // tap again to clear
  persist()
}

// Logo upload (hidden until an image-host client id is configured)
const canUploadLogo = logoUploadAvailable()
const logoFile = ref(null)
const logoBusy = ref(false)
const logoError = ref('')

async function onLogoPicked(e) {
  const file = e.target.files?.[0]
  e.target.value = '' // same file re-pickable
  if (!file) return
  logoBusy.value = true
  logoError.value = ''
  try {
    brand.value.logo = await uploadLogo(file)
    persist()
  } catch (err) {
    logoError.value = err?.message || 'Upload failed — paste a link instead.'
  } finally {
    logoBusy.value = false
  }
}

// Dark swatches need light text on the monogram chip
const markText = computed(() => {
  const c = brand.value?.color || ''
  if (!/^#[0-9a-f]{6}$/i.test(c)) return '#141414'
  const [r, g, b] = [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16))
  return (0.299 * r + 0.587 * g + 0.114 * b) > 140 ? '#141414' : '#ffffff'
})

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

// ── Binders ──
const binderForm = ref({ name: '', type: '', set: '', pmin: null, pmax: null })
const listedSets = computed(() => [...new Set((booth.value?.items || []).map(i => i.setName).filter(Boolean))].sort())

function binderCount(b) { return binderItems(booth.value, b).length }

function autoBinders() {
  if (!booth.value.binders) booth.value.binders = []
  const have = new Set(booth.value.binders.map(b => b.name.toLowerCase()))
  for (const b of suggestBinders(booth.value)) {
    if (booth.value.binders.length >= MAX_BINDERS) break
    if (!have.has(b.name.toLowerCase())) { booth.value.binders.push(b); have.add(b.name.toLowerCase()) }
  }
  persist()
}

function addCustomBinder() {
  const f = binderForm.value
  if (!f.name || (booth.value.binders?.length || 0) >= MAX_BINDERS) return
  const rule = {}
  if (f.type) rule.type = f.type
  if (f.set) rule.set = f.set
  if (f.pmin != null && f.pmin !== '') rule.pmin = +f.pmin
  if (f.pmax != null && f.pmax !== '') rule.pmax = +f.pmax
  if (!Object.keys(rule).length) rule.pmin = 0 // name-only binder: match everything priced
  if (!booth.value.binders) booth.value.binders = []
  booth.value.binders.push({ id: 'bn-' + Math.random().toString(36).slice(2, 8), name: f.name, icon: '🗂', rule })
  binderForm.value = { name: '', type: '', set: '', pmin: null, pmax: null }
  persist()
}

function removeBinder(id) {
  booth.value.binders = (booth.value.binders || []).filter(b => b.id !== id)
  persist()
}

function toggleSync(on) {
  booth.value.syncShelf = on
  if (on) { ensureBoothShelf(booth.value); syncAll(booth.value) }
  persist()
}

function onQtyChange(it) {
  shelfSetQty(booth.value, it)
  persist()
}

function removeItem(i) {
  returnToSource(booth.value, booth.value.items[i])
  booth.value.items.splice(i, 1)
  persist()
}

function pushItem(item, { fromShelf = false } = {}) {
  if (atCap.value) return false
  booth.value.items.push(item)
  // search/graded adds are new inventory; shelf picks are moved by the caller
  if (!fromShelf) { shelfAdd(booth.value, item); }
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

const pickerCat = ref('all')
const pickerCapped = ref(false)
const pickerRoom = computed(() => Math.max(0, MAX_BOOTH_ITEMS - (booth.value?.items.length || 0)))

/** One tap lists a whole shelf (or the filtered slice of it) — hundreds of
 *  singles without hundreds of taps. Selection stops at the QR cap. */
function selectAllVisible() {
  const ids = new Set(picked.value)
  pickerCapped.value = false
  for (const item of pickerItems.value) {
    if (ids.size >= pickerRoom.value) { pickerCapped.value = true; break }
    ids.add(item.id)
  }
  picked.value = [...ids]
}

// switching shelves drops the old shelf's selection — addPicked resolves
// ids against the CURRENT shelf, stale picks would silently vanish
watch(pickerShelfId, () => { picked.value = []; pickerCapped.value = false })
const pickerItems = computed(() => {
  const shelf = store.portfolios.find(p => p.id === pickerShelfId.value)
  if (!shelf) return []
  const q = pickerFilter.value.trim().toLowerCase()
  return shelf.items.filter((it) => {
    if (pickerCat.value !== 'all' && pickerTypeOf(it) !== pickerCat.value) return false
    return !q || itemName(it).toLowerCase().includes(q)
  })
})
function pickerTypeOf(it) {
  return it.type === 'graded' ? 'graded' : it.type === 'sealed' ? 'sealed' : 'singles'
}
function pickerCatCount(id) {
  const shelf = store.portfolios.find(p => p.id === pickerShelfId.value)
  if (!shelf) return 0
  if (id === 'all') return shelf.items.length
  return shelf.items.filter(it => pickerTypeOf(it) === id).length
}

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
    const listing = {
      type: item.type || 'card',
      game: item.game || 'pokemon',
      cardId: item.cardId || item.cardData?.id || '',
      name: itemName(item),
      setName: item.cardData?.set?.name || item.setName || '',
      number: item.cardData?.number || '',
      _lang: item._lang || null,
      qty: item.quantity || 1,
      price: Math.round(itemValue(item) * 100) / 100, // asking price starts at market — yours to change
      img: itemImg(item),
    }
    const ok = pushItem(listing, { fromShelf: true })
    if (!ok) break
    if (syncOn(booth.value)) {
      const moved = moveFromCurated(booth.value, pickerShelfId.value, item, listing.qty)
      if (moved) { listing.shelfItemId = moved.shelfItemId; listing.srcShelfId = moved.srcShelfId }
      persist()
    }
  }
  pickerOpen.value = false
}

// ── Search the card database (things not on your shelves) ──
const searchOpen = ref(false)
const searchInput = ref(null)
const searchQuery = ref('')
const searchResults = ref([])
const searchUnderstood = ref([])
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
function addGraded(c, gradeLabel, price) {
  addFromSearch({
    gradedAs: gradeLabel, game: '', id: c.id,
    name: `${c.name} · ${gradeLabel}`, set: c.set, number: '', price, image: c.image,
  })
}
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
    // Singles + sealed through the query-understanding layer (set codes,
    // static TCGplayer index — one search box covers the whole table.
    const { cards, sealed, understood } = await smartSearch(q, { pageSize: 30, sealedLimit: 16 })
    searchResults.value = [...cards, ...sealed]
    searchUnderstood.value = understood
  } catch {
    searchResults.value = []
  } finally {
    searchBusy.value = false
    searched.value = true
  }
}

function addFromSearch(c) {
  const ok = pushItem({
    type: c.gradedAs ? 'graded' : (c.sealed ? 'sealed' : 'card'),
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
    if (!window.isSecureContext || !navigator.geolocation) {
      throw { code: 'insecure' }
    }
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
  } catch (e) {
    // GeolocationPositionError codes: 1 denied, 2 unavailable, 3 timeout
    locError.value =
      e?.code === 'insecure' ? 'Location needs a secure (https) page — search the venue instead.'
      : e?.code === 1 ? 'Location permission is blocked — allow it for this site in your browser, or search the venue.'
      : e?.code === 2 ? "Your device couldn't determine a position (on laptops/desktops, OS location services are often off) — search the venue instead."
      : "Couldn't get a location fix — search the venue instead."
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
.be-head-actions { display: flex; gap: 8px; }

.be-form { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.be-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 160px), 1fr)); gap: 12px; }
.be-field label { display: block; font-size: 12px; font-weight: 800; margin-bottom: 5px; }
.be-field-table { max-width: 120px; }

.be-brand-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
.be-swatches { display: flex; gap: 6px; flex-wrap: wrap; }
.be-swatch {
  width: 30px; height: 30px; border-radius: 9px;
  border: 2px solid var(--ink); cursor: pointer; padding: 0;
  box-shadow: var(--shadow-pressed);
}
.be-swatch:active { box-shadow: none; transform: translate(1px, 1px); }
.be-swatch.active { outline: 3px solid var(--accent); outline-offset: 2px; }
.be-mark { width: 130px; }
.be-logo-row { display: flex; gap: 8px; align-items: center; }
.be-logo-row .be-logo { flex: 1; }
.be-logo-warn { font-size: 11.5px; color: var(--danger); font-weight: 600; margin-top: 4px; }
.be-logo-note { font-size: 11.5px; color: var(--text-muted); font-weight: 600; margin-top: 4px; }
.be-brand-preview { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
.be-brand-mark {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 40px; height: 40px; padding: 0 8px;
  border: 2px solid var(--ink); border-radius: 11px;
  font-size: 17px; font-weight: 900;
}
.be-brand-logo { height: 40px; max-width: 150px; object-fit: contain; border: 1.5px solid var(--ink); border-radius: 9px; background: #fff; padding: 3px; }

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
.be-sealed-badge { font-size: 9.5px; vertical-align: 2px; }

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
.be-cats { display: flex; gap: 6px; margin: 8px 0 4px; flex-wrap: wrap; }
.be-cat {
  font: inherit; font-size: 12px; font-weight: 800;
  padding: 5px 11px; cursor: pointer;
  color: var(--ink); background: var(--bg-card);
  border: 1.5px solid var(--ink); border-radius: 99px;
  box-shadow: var(--shadow-pressed);
}
.be-cat:active { box-shadow: none; transform: translate(1px, 1px); }
.be-cat.active { background: var(--accent); color: var(--on-accent); }
.be-cat-n { margin-left: 5px; font-size: 10.5px; opacity: 0.75; }
.be-grade-btns { display: flex; gap: 5px; flex-shrink: 0; }
.be-grade-btns .btn { font-size: 11px; padding: 5px 8px; white-space: nowrap; }
.be-understood { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
.be-understood-chip {
  font-size: 11px; font-weight: 800;
  padding: 2px 9px;
  background: var(--accent-dim); border: 1.5px solid var(--ink); border-radius: 99px;
}
.be-sync-row { display: flex; align-items: center; gap: 8px; font-weight: 800; font-size: 13px; cursor: pointer; }
.be-sync-row input { width: 16px; height: 16px; accent-color: var(--accent); }
.be-sync-note { font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin-top: 6px; }
.be-pick-all { display: flex; align-items: center; gap: 8px; margin: 2px 0 10px; flex-wrap: wrap; }
.be-pick-cap { font-size: 11.5px; font-weight: 700; color: var(--text-secondary); }
.be-binders { padding: 14px 16px; margin: 12px 0; }
.be-binders-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; flex-wrap: wrap; margin-bottom: 8px; }
.be-binders-head h3 { font-size: 15px; font-weight: 900; }
.be-binders-sub { font-size: 11.5px; font-weight: 600; }
.be-binder-list { display: flex; gap: 8px; flex-wrap: wrap; margin: 6px 0; }
.be-binder-chip {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 12.5px; font-weight: 800; padding: 5px 10px;
  background: var(--bg-secondary); border: 1.5px solid var(--ink); border-radius: 99px;
}
.be-binder-n { font-size: 10.5px; opacity: 0.7; }
.be-binder-x { border: none; background: none; cursor: pointer; font-size: 12px; font-weight: 900; color: var(--text-secondary); padding: 0 2px; }
.be-binder-custom { margin-top: 8px; }
.be-binder-custom summary { font-size: 12.5px; font-weight: 700; color: var(--text-secondary); cursor: pointer; }
.be-binder-form { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
.be-binder-form .input, .be-binder-form .select { flex: 1; min-width: 90px; }
</style>
