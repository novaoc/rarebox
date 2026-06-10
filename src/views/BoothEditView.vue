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
          <label>Where</label>
          <input v-model="booth.venue" class="input" placeholder="Card show, store, table #…" @change="persist" />
        </div>
        <div class="be-field">
          <label>When</label>
          <input v-model="booth.date" class="input" placeholder="e.g. Sat June 14" @change="persist" />
        </div>
      </div>
      <div class="be-field">
        <label>Note for buyers <span class="text-muted">(optional)</span></label>
        <input v-model="booth.note" class="input" placeholder="Trades welcome · cash & QR payments · prices firm" @change="persist" />
      </div>
    </div>

    <div class="be-listings-head">
      <h2>Listings <span class="badge badge-accent" v-if="booth.items.length">{{ booth.items.length }}</span></h2>
      <div class="be-listings-total" v-if="booth.items.length">Table total: <strong>{{ fmtMoney(total) }}</strong></div>
      <button class="btn btn-primary btn-sm" @click="openPicker">+ Add from shelf</button>
    </div>

    <div v-if="!booth.items.length" class="empty-state">
      <p>Nothing listed yet. Pull cards and sealed products straight from your shelves and put your price on them.</p>
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

    <BoothShareModal v-if="showShare" :booth="booth" @close="showShare = false" />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { usePortfolioStore } from '../stores/portfolio'
import BoothShareModal from '../components/BoothShareModal.vue'
import { loadBooths, saveBooths, boothTotal } from '../utils/booth'

const route = useRoute()
const store = usePortfolioStore()

const booths = ref(loadBooths())
const booth = computed(() => booths.value.find(b => b.id === route.params.id))
const showShare = ref(false)

const total = computed(() => boothTotal(booth.value || {}))

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

// ── Picker ──
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
    booth.value.items.push({
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
  }
  persist()
  pickerOpen.value = false
}
</script>

<style scoped>
.be-page { padding-bottom: 32px; }
.be-head { display: flex; justify-content: space-between; align-items: center; margin: 14px 0; }

.be-form { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
.be-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 200px), 1fr)); gap: 12px; }
.be-field label { display: block; font-size: 12px; font-weight: 800; margin-bottom: 5px; }

.be-listings-head { display: flex; align-items: center; gap: 12px; margin: 22px 0 10px; flex-wrap: wrap; }
.be-listings-head h2 { font-size: 19px; font-weight: 900; flex: 1; }
.be-listings-total { font-size: 13.5px; color: var(--text-secondary); }

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

.picker-list { max-height: 46vh; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; }
.picker-row {
  display: flex; align-items: center; gap: 10px;
  padding: 9px 10px; border: 1.5px solid var(--border-subtle); border-radius: 10px;
  cursor: pointer; font-size: 13.5px;
}
.picker-row:hover { background: var(--bg-hover); }
.picker-row input { width: 18px; height: 18px; accent-color: var(--accent); }
.picker-name { font-weight: 700; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.picker-sub { font-size: 11.5px; color: var(--text-muted); white-space: nowrap; }
.picker-price { font-weight: 800; font-size: 12.5px; }
</style>
