<template>
  <div class="portfolio-view" v-if="portfolio">
    <!-- Header -->
    <div class="portfolio-header">
      <div class="portfolio-title-row">
        <span class="portfolio-dot-lg" :style="{ background: portfolio.color }"></span>
        <div>
          <h2 class="portfolio-name" v-if="!editingName" @click="startEditName">
            {{ portfolio.name }}
            <span class="edit-icon text-muted" style="font-size:13px;margin-left:6px">✎</span>
          </h2>
          <div v-else class="name-edit-row">
            <input v-model="editName" class="input name-input" @keyup.enter="saveName" @keyup.escape="editingName = false" ref="nameInputRef" />
            <button class="btn btn-primary btn-sm" @click="saveName">Save</button>
            <button class="btn btn-ghost btn-sm" @click="editingName = false">Cancel</button>
          </div>
          <div class="portfolio-meta text-muted">{{ portfolio.items.length }} items · Created {{ formatDate(portfolio.createdAt) }}</div>
        </div>
      </div>
      <div class="portfolio-header-actions">
        <router-link to="/search" class="btn btn-primary btn-sm">+ Add Card</router-link>
        <button class="btn btn-secondary btn-sm" @click="showAddSealed = true">+ Sealed</button>
        <button class="btn btn-secondary btn-sm" @click="showBulkImport = true">↑ Import</button>
        <button class="btn btn-secondary btn-sm" :disabled="refreshing" @click="refreshPrices">
          <span v-if="refreshing" class="spinner spinner-sm"></span>
          <span v-else>↻ Prices</span>
        </button>
        <span v-if="refreshStatus" class="text-muted" style="font-size:12px;align-self:center">{{ refreshStatus }}</span>
        <button class="btn btn-secondary btn-sm" @click="exportPortfolio">↓ Export</button>
        <button class="btn btn-danger btn-sm" @click="confirmDelete = true">Delete</button>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats-row">
      <div class="stat-tile">
        <div class="label">Total Value</div>
        <div class="value text-accent">${{ stats.totalValue.toFixed(2) }}</div>
        <div class="sub">{{ stats.itemCount }} items</div>
      </div>
      <div class="stat-tile">
        <div class="label">Cost Basis</div>
        <div class="value">${{ stats.totalCost.toFixed(2) }}</div>
      </div>
      <div class="stat-tile">
        <div class="label">Total Gain/Loss</div>
        <div class="value" :class="stats.gain >= 0 ? 'text-success' : 'text-danger'">
          {{ stats.gain >= 0 ? '+' : '' }}${{ Math.abs(stats.gain).toFixed(2) }}
        </div>
        <div class="sub" :class="stats.gainPct >= 0 ? 'text-success' : 'text-danger'">
          {{ stats.gainPct >= 0 ? '+' : '' }}{{ stats.gainPct.toFixed(1) }}%
        </div>
      </div>
      <div class="stat-tile" v-if="stats.topGainer">
        <div class="label">Top Gainer</div>
        <div class="value" style="font-size:16px">{{ stats.topGainer.item.cardData?.name || stats.topGainer.item.name }}</div>
        <div class="sub text-success">+{{ stats.topGainer.gain.toFixed(1) }}%</div>
      </div>
    </div>

    <!-- Portfolio chart -->
    <div class="card mb-4">
      <div class="section-header">
        <div>
          <div class="section-title">Portfolio Value</div>
          <div class="section-subtitle">Historical value over time</div>
        </div>
      </div>
      <PortfolioChart :portfolios="[portfolio]" :height="280" :label="portfolio.name" />
    </div>

    <!-- Items table -->
    <div class="card">
      <div class="section-header">
        <div>
          <div class="section-title">Items</div>
          <div class="section-subtitle">{{ filteredItems.length }} of {{ portfolio.items.length }}</div>
        </div>
        <div class="flex gap-2 items-center">
          <div class="sort-mini-wrap">
            <select v-model="sortBy" class="input input-sm">
              <option value="added">Recently Added</option>
              <option value="value">Value (High-Low)</option>
              <option value="gain">Gain (High-Low)</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
          <div class="filter-tabs">
            <button
              v-for="f in filters"
              :key="f.value"
              class="filter-tab"
              :class="{ active: activeFilter === f.value }"
              @click="activeFilter = f.value"
            >{{ f.label }} <span class="filter-count">{{ filterCount(f.value) }}</span></button>
          </div>
          <div class="search-mini-wrap">
            <input v-model="itemSearch" class="input input-sm" placeholder="Filter items..." />
          </div>
        </div>
      </div>

      <div v-if="filteredItems.length === 0" class="empty-state">
        <div class="icon">📭</div>
        <h3>No items here</h3>
        <p>Add cards, sealed products, or graded slabs to this portfolio</p>
        <router-link to="/search" class="btn btn-primary mt-3">Search Cards</router-link>
      </div>

      <div v-else>
        <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Type</th>
              <th>Qty</th>
              <th>Paid</th>
              <th>Value</th>
              <th>Gain/Loss</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in filteredItems" :key="item.id" class="item-row" @click="selectItem(item)">
              <td>
                <div class="item-name-cell">
                  <img
                    v-if="item.cardData?.images?.small"
                    :src="item.cardData.images.small"
                    class="item-thumb"
                    loading="lazy"
                    draggable="false"
                  />
                  <img
                    v-else-if="item.imageUrl"
                    :src="item.imageUrl"
                    class="item-thumb item-thumb-sealed"
                    loading="lazy"
                    draggable="false"
                  />
                  <div class="item-sealed-icon" v-else>📦</div>
                  <div>
                    <div class="item-name">
                      {{ getItemName(item) }}
                      <span v-if="item.rating" class="item-rating text-accent ml-1">★{{ item.rating }}</span>
                    </div>
                    <div class="item-sub">{{ getItemSub(item) }}</div>
                  </div>
                </div>
              </td>
              <td>
                <span class="badge" :class="typeBadgeClass(item.type)">{{ item.type }}</span>
              </td>
              <td class="font-mono">{{ item.quantity || 1 }}</td>
              <td class="font-mono">${{ ((item.purchasePrice || 0) * (item.quantity || 1)).toFixed(2) }}</td>
              <td class="font-mono">
                <span class="text-accent">${{ (getCurrentValue(item) * (item.quantity || 1)).toFixed(2) }}</span>
              </td>
              <td>
                <div class="gain-cell">
                  <span :class="getGain(item) >= 0 ? 'text-success' : 'text-danger'">
                    {{ getGain(item) >= 0 ? '+' : '' }}${{ Math.abs(getGain(item)).toFixed(2) }}
                  </span>
                  <span class="gain-pct text-muted">({{ getGainPct(item) >= 0 ? '+' : '' }}{{ getGainPct(item).toFixed(1) }}%)</span>
                </div>
              </td>
              <td>
                <div class="actions flex gap-2">
                  <button class="btn btn-ghost btn-icon btn-sm" @click.stop="editItem(item)" title="Edit">✎</button>
                  <button class="btn btn-ghost btn-icon btn-sm" @click.stop="removeItem(item)" title="Remove" style="color:var(--danger)">✕</button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
        </div><!-- end table-wrap -->
      </div>
    </div>

    <!-- Item detail panel -->
    <transition name="slide-up">
      <div v-if="selectedItem" class="item-detail-panel card">
        <div class="panel-header-row">
          <h3>{{ getItemName(selectedItem) }}</h3>
          <button class="btn btn-ghost btn-icon" @click="selectedItem = null">✕</button>
        </div>
        <div class="panel-body-row">
          <div class="panel-left" v-if="selectedItem.cardData?.images?.small || selectedItem.imageUrl">
            <img :src="selectedItem.cardData?.images?.large || selectedItem.cardData?.images?.small || selectedItem.imageUrl" class="panel-img" draggable="false" />
          </div>
          <div class="panel-right">
            <div class="panel-info-grid">
              <div class="info-row"><span class="info-label">Type</span><span>{{ selectedItem.type }}</span></div>
              <div class="info-row" v-if="selectedItem.gradingCompany"><span class="info-label">Grade</span><span>{{ selectedItem.gradingCompany }} {{ selectedItem.grade }}</span></div>
              <div class="info-row" v-if="selectedItem.priceVariant"><span class="info-label">Variant</span><span>{{ selectedItem.priceVariant }}</span></div>
              <div class="info-row">
                <span class="info-label">Rating</span>
                <div class="rating-picker">
                  <button v-for="r in 5" :key="r" @click="setRating(selectedItem, r)" :class="{ active: (selectedItem.rating || 0) >= r }">★</button>
                  <button @click="setRating(selectedItem, 0)" class="rating-clear" v-if="selectedItem.rating">✕</button>
                </div>
              </div>
              <div class="info-row"><span class="info-label">Quantity</span><span>{{ selectedItem.quantity || 1 }}</span></div>
              <div class="info-row"><span class="info-label">Paid (each)</span><span>${{ (selectedItem.purchasePrice || 0).toFixed(2) }}</span></div>
              <div class="info-row"><span class="info-label">Current Value</span><span class="text-accent">${{ getCurrentValue(selectedItem).toFixed(2) }}</span></div>
              <div class="info-row"><span class="info-label">Purchased</span><span>{{ selectedItem.purchaseDate || '—' }}</span></div>
            </div>

            <div v-if="selectedItem.type === 'graded' || selectedItem.type === 'sealed'" class="mt-3">
              <div class="form-group">
                <label class="form-label">Update Current Value ($)</label>
                <div class="flex gap-2">
                  <input v-model.number="editCurrentValue" class="input input-sm" type="number" step="0.01" :placeholder="getCurrentValue(selectedItem).toFixed(2)" />
                  <button class="btn btn-primary btn-sm" @click="saveCurrentValue">Save</button>
                </div>
              </div>

              <!-- eBay price fetch -->
              <div class="pc-fetch-section mt-3">
                <div class="pc-fetch-label">Fetch from eBay Sold</div>
                <div class="flex gap-2">
                  <input v-model="pcQuery" class="input input-sm" placeholder="Search query…" @keyup.enter="searchPC" />
                  <button class="btn btn-secondary btn-sm" :disabled="pcSearching || !pcQuery.trim()" @click="searchPC" style="flex-shrink:0">
                    <span v-if="pcSearching" class="spinner spinner-sm"></span>
                    <span v-else>Fetch</span>
                  </button>
                </div>
                <div v-if="pcError" class="text-danger mt-2" style="font-size:12px">{{ pcError }}</div>
                <div v-if="pcResult" class="pc-result-box mt-2">
                  <div class="pc-result-price-main">${{ pcResult.price.toFixed(2) }}</div>
                  <div class="pc-result-meta">{{ pcResult.product_name }} · grade {{ pcResult.grade }} · PriceCharting</div>
                  <button class="btn btn-primary btn-sm mt-2" @click="applyPCPrice">Apply price</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="selectedItem.type === 'card' && selectedItem.cardId" class="panel-chart-section">
          <div class="section-title mb-3">Price History</div>
          <PriceChart
            :cardId="selectedItem.cardId"
            :currentPrice="selectedItem.currentMarketPrice"
            :height="220"
          />
        </div>
      </div>
    </transition>

    <!-- Bulk Import Modal -->
    <transition name="fade">
      <BulkImportModal
        v-if="showBulkImport"
        :portfolioId="portfolio.id"
        @close="showBulkImport = false"
        @imported="onBulkImported"
      />
    </transition>

    <!-- Add Sealed Modal -->
    <transition name="fade">
      <AddItemModal
        v-if="showAddSealed"
        :card="null"
        :defaultPortfolioId="portfolio.id"
        defaultType="sealed"
        @close="showAddSealed = false"
        @added="showAddSealed = false"
      />
    </transition>

    <!-- Edit item modal -->
    <transition name="fade">
      <div v-if="editingItem" class="modal-overlay" @click.self="editingItem = null">
        <div class="modal">
          <div class="modal-header">
            <h3>Edit Item</h3>
            <button class="btn btn-ghost btn-icon" @click="editingItem = null">✕</button>
          </div>
          <div class="modal-body">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Purchase Price ($)</label>
                <input v-model.number="editForm.purchasePrice" class="input" type="number" step="0.01" />
              </div>
              <div class="form-group">
                <label class="form-label">Quantity</label>
                <input v-model.number="editForm.quantity" class="input" type="number" min="1" />
              </div>
            </div>
            <div v-if="editingItem.type !== 'card'" class="form-group">
              <label class="form-label">Current Market Value ($)</label>
              <input v-model.number="editForm.currentValue" class="input" type="number" step="0.01" />
            </div>
            <div class="form-group">
              <label class="form-label">Purchase Date</label>
              <input v-model="editForm.purchaseDate" class="input" type="date" />
            </div>
            <div class="form-group">
              <label class="form-label">Notes</label>
              <textarea v-model="editForm.notes" class="textarea"></textarea>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="editingItem = null">Cancel</button>
            <button class="btn btn-primary" @click="saveEditItem">Save Changes</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Delete confirm -->
    <transition name="fade">
      <div v-if="confirmDelete" class="modal-overlay" @click.self="confirmDelete = false">
        <div class="modal" style="max-width:400px">
          <div class="modal-header">
            <h3>Delete Portfolio</h3>
            <button class="btn btn-ghost btn-icon" @click="confirmDelete = false">✕</button>
          </div>
          <div class="modal-body">
            <p class="text-secondary">Are you sure you want to delete <strong>{{ portfolio.name }}</strong>? This will remove all {{ portfolio.items.length }} items. This cannot be undone.</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="confirmDelete = false">Cancel</button>
            <button class="btn btn-danger" @click="deletePortfolio">Delete Forever</button>
          </div>
        </div>
      </div>
    </transition>
  </div>

  <div v-else class="empty-state">
    <div class="icon">📂</div>
    <h3>Portfolio not found</h3>
    <router-link to="/" class="btn btn-primary mt-3">Go Home</router-link>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePortfolioStore } from '../stores/portfolio'
import { exportPortfolioToExcel } from '../utils/excel'
import { getCard, getJapaneseCardDetail, getMarketPrice } from '../services/pokemonApi'
import { fetchPrice } from '../services/priceServer'
import { checkAlerts, notifyTriggered } from '../utils/alerts'
import PriceChart from '../components/PriceChart.vue'
import PortfolioChart from '../components/PortfolioChart.vue'
import AddItemModal from '../components/AddItemModal.vue'
import BulkImportModal from '../components/BulkImportModal.vue'

const route = useRoute()
const router = useRouter()
const store = usePortfolioStore()

const portfolio = computed(() => store.portfolios.find(p => p.id === route.params.id))
const stats = computed(() => store.getPortfolioStats(route.params.id) || { totalValue: 0, totalCost: 0, gain: 0, gainPct: 0, itemCount: 0 })

const activeFilter = ref('all')
const itemSearch = ref('')
const sortBy = ref('added')
const editingName = ref(false)
const editName = ref('')
const nameInputRef = ref(null)
const selectedItem = ref(null)
const showAddSealed = ref(false)
const showBulkImport = ref(false)
const editingItem = ref(null)
const editForm = ref({})
const confirmDelete = ref(false)
const editCurrentValue = ref(null)
const refreshing = ref(false)
const refreshStatus = ref('')

// PriceCharting fetch (direct browser API)
const pcQuery = ref('')
const pcSearching = ref(false)
const pcResult = ref(null)   // { median, mean, min, max, count }
const pcError = ref('')

watch(selectedItem, (item) => {
  pcResult.value = null
  pcError.value = ''
  if (item?.type === 'graded') {
    pcQuery.value = `${item.cardData?.name || ''} PSA ${item.grade || ''}`.trim()
  } else if (item?.type === 'sealed') {
    pcQuery.value = item.name || ''
  } else {
    pcQuery.value = ''
  }
})

async function searchPC() {
  if (!pcQuery.value.trim()) return
  pcSearching.value = true
  pcError.value = ''
  pcResult.value = null
  try {
    const grade = selectedItem.value?.type === 'graded' ? (selectedItem.value.grade || '10') : 'ungraded'
    pcResult.value = await fetchPrice(pcQuery.value, grade)
  } catch (e) {
    if (e.message === 'server_down') pcError.value = 'PriceCharting unavailable — check your connection'
    else if (e.message === 'timeout') pcError.value = 'Request timed out'
    else if (e.message === 'no_results') pcError.value = 'No results found — try a different query'
    else pcError.value = 'Fetch failed'
  } finally {
    pcSearching.value = false
  }
}

function applyPCPrice() {
  if (!selectedItem.value || !pcResult.value) return
  const price = pcResult.value.price
  const key = selectedItem.value.type === 'card' ? 'currentMarketPrice' : 'currentValue'
  store.updateItem(portfolio.value.id, selectedItem.value.id, { [key]: price })
  editCurrentValue.value = price
  pcResult.value = null
  pcError.value = ''
}

const filters = [
  { label: 'All', value: 'all' },
  { label: 'Cards', value: 'card' },
  { label: 'Graded', value: 'graded' },
  { label: 'Sealed', value: 'sealed' },
]

const filteredItems = computed(() => {
  if (!portfolio.value) return []
  let items = [...portfolio.value.items]
  
  // Filter by type
  if (activeFilter.value !== 'all') items = items.filter(i => i.type === activeFilter.value)
  
  // Search
  if (itemSearch.value) {
    const q = itemSearch.value.toLowerCase()
    items = items.filter(i =>
      getItemName(i).toLowerCase().includes(q) ||
      getItemSub(i).toLowerCase().includes(q)
    )
  }

  // Sort
  if (sortBy.value === 'value') {
    items.sort((a, b) => (getCurrentValue(b) * (b.quantity || 1)) - (getCurrentValue(a) * (a.quantity || 1)))
  } else if (sortBy.value === 'gain') {
    items.sort((a, b) => getGain(b) - getGain(a))
  } else if (sortBy.value === 'name') {
    items.sort((a, b) => getItemName(a).localeCompare(getItemName(b)))
  } else {
    // default: added (desc)
    items.sort((a, b) => new Date(b.addedAt || 0) - new Date(a.addedAt || 0))
  }
  
  return items
})

function filterCount(type) {
  if (!portfolio.value) return 0
  if (type === 'all') return portfolio.value.items.length
  return portfolio.value.items.filter(i => i.type === type).length
}

function getItemName(item) {
  if (item.type === 'sealed') return item.name
  return item.cardData?.name || '—'
}

function getItemSub(item) {
  if (item.type === 'card') return `${item.cardData?.set?.name || ''} #${item.cardData?.number || ''} · ${item.priceVariant || ''}`
  if (item.type === 'graded') return `${item.gradingCompany} ${item.grade} · ${item.cardData?.set?.name || ''}`
  if (item.type === 'sealed') return item.setName || ''
  return ''
}

function getCurrentValue(item) {
  if (item.type === 'card') return item.currentMarketPrice || item.purchasePrice || 0
  return item.currentValue || item.purchasePrice || 0
}

function getGain(item) {
  const qty = item.quantity || 1
  return (getCurrentValue(item) - (item.purchasePrice || 0)) * qty
}

function getGainPct(item) {
  const cost = item.purchasePrice || 0
  if (cost === 0) return 0
  return ((getCurrentValue(item) - cost) / cost) * 100
}

function typeBadgeClass(type) {
  return { card: 'badge-info', graded: 'badge-accent', sealed: 'badge-success' }[type] || 'badge-info'
}

function formatDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function startEditName() {
  editName.value = portfolio.value.name
  editingName.value = true
  nextTick(() => nameInputRef.value?.focus())
}

function saveName() {
  if (editName.value.trim()) {
    store.updatePortfolio(portfolio.value.id, { name: editName.value.trim() })
  }
  editingName.value = false
}

function selectItem(item) {
  selectedItem.value = selectedItem.value?.id === item.id ? null : item
  editCurrentValue.value = getCurrentValue(item)
}

function editItem(item) {
  editingItem.value = item
  editForm.value = {
    purchasePrice: item.purchasePrice,
    quantity: item.quantity || 1,
    currentValue: item.currentValue,
    purchaseDate: item.purchaseDate,
    notes: item.notes || ''
  }
}

function saveEditItem() {
  store.updateItem(portfolio.value.id, editingItem.value.id, editForm.value)
  editingItem.value = null
}

function saveCurrentValue() {
  if (selectedItem.value && editCurrentValue.value !== null) {
    const key = selectedItem.value.type === 'card' ? 'currentMarketPrice' : 'currentValue'
    store.updateItem(portfolio.value.id, selectedItem.value.id, { [key]: editCurrentValue.value })
  }
}

function setRating(item, r) {
  store.updateItem(portfolio.value.id, item.id, { rating: r })
}

function onBulkImported(count) {
  refreshStatus.value = `Imported ${count} card${count !== 1 ? 's' : ''}`
  setTimeout(() => { refreshStatus.value = '' }, 3000)
}

function removeItem(item) {
  if (confirm(`Remove ${getItemName(item)} from portfolio?`)) {
    store.removeItem(portfolio.value.id, item.id)
    if (selectedItem.value?.id === item.id) selectedItem.value = null
  }
}

function pcQueryForItem(item) {
  if (item.type === 'graded') {
    const name = item.cardData?.name || item.name || ''
    const set = item.cardData?.set?.name || ''
    return `${name} ${set}`.trim()
  }
  if (item.type === 'sealed') {
    // Include set name so PriceCharting returns the right product, not just the most popular one
    const name = item.name || ''
    const set = item.setName || ''
    return `${set} ${name}`.trim()
  }
  return null
}

function pcGradeForItem(item) {
  if (item.type === 'graded') {
    const company = (item.gradingCompany || 'PSA').toLowerCase()
    const grade = item.grade || '10'
    // Map to our grade keys
    if (company === 'psa') return grade === '10' ? 'psa10' : grade
    if (company === 'bgs') return grade === '10' ? 'bgs10' : grade
    if (company === 'cgc') return grade === '10' ? 'cgc10' : grade
    if (company === 'sgc') return grade === '10' ? 'sgc10' : grade
    return grade
  }
  return 'ungraded'
}

async function refreshPrices() {
  if (!portfolio.value || refreshing.value) return
  refreshing.value = true
  refreshStatus.value = ''

  const cardItems = portfolio.value.items.filter(i => i.type === 'card' && i.cardId)
  const ebayItems = portfolio.value.items.filter(i => i.type === 'graded' || i.type === 'sealed')
  let updated = 0

  await Promise.allSettled([
    // Raw EN cards — pokemontcg.io (bulk-friendly)
    ...cardItems.filter(i => !store.isJPCard(i)).map(async item => {
      try {
        const card = await getCard(item.cardId, item._lang)
        const priceResult = getMarketPrice(card, item.priceVariant)
        const price = priceResult?.price || priceResult
        if (price) {
          store.updateItem(portfolio.value.id, item.id, { currentMarketPrice: price, lastPriceUpdate: new Date().toISOString() })
          updated++
        }
      }
      catch {}
    }),
    // JP cards — tcgdex (one request per card, stagger)
    ...cardItems.filter(i => store.isJPCard(i)).map(async (item, idx) => {
      await new Promise(r => setTimeout(r, idx * 500)) // stagger 500ms apart
      try {
        const card = await getCard(item.cardId, item._lang)
        const priceResult = getMarketPrice(card, item.priceVariant)
        const price = priceResult?.price || priceResult
        if (price) {
          store.updateItem(portfolio.value.id, item.id, { currentMarketPrice: price, lastPriceUpdate: new Date().toISOString() })
          updated++
        }
      } catch {}
    }),
    // Graded slabs + sealed — PriceCharting (direct browser API)
    ...ebayItems.map(async item => {
      const query = pcQueryForItem(item)
      const grade = pcGradeForItem(item)
      if (!query) return
      const result = await fetchPrice(query, grade)
      if (result?.price) {
        const updates = { currentValue: result.price }
        // Always update image for sealed items on refresh — corrects wrong images from generic queries
        if (result.image) {
          updates.imageUrl = result.image
        }
        store.updateItem(portfolio.value.id, item.id, updates)
        updated++
      }
    })
  ])

  if (updated > 0) store.recordSnapshot(portfolio.value.id)

  // Check price alerts
  const priceMap = new Map()
  for (const item of portfolio.value.items) {
    if (item.type === 'card' && item.cardId) {
      priceMap.set(item.cardId, item.currentMarketPrice || item.purchasePrice || 0)
    }
  }
  const triggered = checkAlerts(priceMap)
  if (triggered.length > 0) notifyTriggered(triggered)

  refreshStatus.value = updated > 0 ? `Updated ${updated} item${updated > 1 ? 's' : ''}` : 'No updates'
  setTimeout(() => { refreshStatus.value = '' }, 3000)
  refreshing.value = false
}

onMounted(() => {
  refreshPrices()
})

function exportPortfolio() {
  if (portfolio.value) exportPortfolioToExcel(portfolio.value)
}

function deletePortfolio() {
  store.deletePortfolio(portfolio.value.id)
  confirmDelete.value = false
  router.push('/')
}
</script>

<style scoped>
.portfolio-view { max-width: 1200px; margin: 0 auto; }

.portfolio-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 24px;
}
.portfolio-title-row { display: flex; align-items: flex-start; gap: 14px; }
.portfolio-dot-lg { width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; margin-top: 6px; }
.portfolio-name { font-size: 22px; font-weight: 700; cursor: pointer; }
.portfolio-name:hover .edit-icon { opacity: 1; }
.edit-icon { opacity: 0; transition: opacity 0.15s; }
.portfolio-meta { font-size: 12px; margin-top: 4px; }
.name-edit-row { display: flex; gap: 8px; align-items: center; }
.name-input { width: 250px; font-size: 16px; font-weight: 600; }
.portfolio-header-actions { display: flex; gap: 8px; flex-wrap: wrap; }

.stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 24px; }

.sort-mini-wrap { flex-shrink: 0; }
.filter-tabs { display: flex; gap: 4px; }
.filter-tab {
  background: none;
  border: 1px solid var(--border);
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 500;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  gap: 4px;
}
.filter-tab:hover { color: var(--text-primary); }
.filter-tab.active { background: var(--accent-dim); color: var(--accent); border-color: var(--accent); }
.filter-count { font-size: 10px; background: var(--bg-hover); padding: 1px 5px; border-radius: 8px; }

.input-sm { padding: 5px 10px; font-size: 12px; }
.search-mini-wrap { width: 180px; }

.item-name-cell { display: flex; align-items: center; gap: 10px; }
.item-thumb { width: 36px; height: 50px; object-fit: contain; border-radius: 3px; flex-shrink: 0; pointer-events: none; -webkit-user-drag: none; user-drag: none; }
.item-thumb-sealed { background: var(--bg-primary); border-radius: 4px; }
.item-sealed-icon { width: 36px; height: 50px; display: flex; align-items: center; justify-content: center; font-size: 20px; flex-shrink: 0; }
.item-name { font-size: 13px; font-weight: 600; }
.item-sub { font-size: 11px; color: var(--text-muted); margin-top: 1px; }
.item-rating { font-size: 11px; font-weight: 700; }

.gain-cell { display: flex; flex-direction: column; font-size: 13px; font-variant-numeric: tabular-nums; }
.gain-pct { font-size: 11px; }

/* Item detail panel */
.item-detail-panel { margin-top: 24px; }
.panel-header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.panel-header-row h3 { font-size: 16px; font-weight: 700; }
.panel-body-row { display: flex; gap: 24px; margin-bottom: 20px; }
.panel-left { flex-shrink: 0; }
.panel-img { width: 120px; border-radius: 8px; pointer-events: none; -webkit-user-drag: none; user-drag: none; }
.panel-right { flex: 1; }
.panel-info-grid { display: flex; flex-direction: column; gap: 6px; }
.info-row { display: flex; justify-content: space-between; align-items: center; font-size: 13px; padding: 4px 0; border-bottom: 1px solid var(--border-subtle); }
.info-label { color: var(--text-muted); }

.rating-picker { display: flex; align-items: center; gap: 2px; }
.rating-picker button { background: none; border: none; color: var(--text-muted); font-size: 18px; cursor: pointer; padding: 0 2px; line-height: 1; transition: color 0.1s; }
.rating-picker button.active { color: var(--accent); }
.rating-clear { font-size: 11px !important; margin-left: 6px; opacity: 0.6; }
.rating-clear:hover { opacity: 1; }

.panel-chart-section { border-top: 1px solid var(--border); padding-top: 20px; }

/* eBay price fetch */
.pc-fetch-section {
  border-top: 1px solid var(--border-subtle);
  padding-top: 12px;
}
.pc-fetch-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-muted);
  margin-bottom: 8px;
}
.pc-result-box {
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px 12px;
}
.pc-result-price-main {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-accent, var(--accent));
}
.pc-result-meta {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}

/* Item detail panel — mobile bottom sheet */
@media (max-width: 768px) {
  .item-detail-panel {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    margin: 0;
    max-height: 85vh;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
    overflow-y: auto;
    z-index: 100;
    box-shadow: 0 -8px 32px rgba(0,0,0,0.5);
  }
  .item-detail-panel::before {
    content: '';
    display: block;
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: var(--border);
    margin: 8px auto 4px;
  }
  .panel-body-row { flex-direction: column; }
  .panel-left { display: flex; justify-content: center; }
  .panel-img { width: 120px; }
  .filter-tabs { flex-wrap: wrap; }
  .search-mini-wrap { width: 100%; }
  .portfolio-header { flex-direction: column; gap: 12px; }
  .portfolio-header-actions { width: 100%; justify-content: flex-start; }
  .portfolio-header-actions .btn { font-size: 11px; padding: 5px 8px; }
  .portfolio-name { font-size: 18px; }
  .portfolio-dot-lg { width: 12px; height: 12px; margin-top: 4px; }
  /* Hide less critical columns */
  .table th:nth-child(2), .table td:nth-child(2) { display: none; } /* Type */
  .table th:last-child, .table td:last-child { display: none; } /* Actions */
  .table { min-width: 360px; }
  .item-thumb { width: 30px; height: 42px; }
  .item-name { font-size: 12px; }
  .item-sub { font-size: 10px; }
}

@media (max-width: 640px) {
  .item-detail-panel { max-height: 90vh; }
  /* Make items table scrollable horizontally */
  .table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
  /* Collapse section header on mobile */
  .section-header { flex-direction: column; align-items: flex-start; gap: 10px; }
  .section-header > div:last-child { width: 100%; }
  /* Filter tabs — full width grid */
  .filter-tabs { width: 100%; }
  .filter-tab { flex: 1; justify-content: center; padding: 6px 4px; }
  /* Stats */
  .stats-row { grid-template-columns: 1fr 1fr; gap: 8px; }
  .stat-tile { padding: 12px 10px; }
  .stat-tile .value { font-size: 18px; }
  /* Compact gain/loss on small screens */
  .gain-pct { display: none; }
  /* Name edit */
  .name-edit-row { flex-wrap: wrap; }
  .name-input { width: 100%; }
  .portfolio-header-actions { flex-wrap: wrap; }
}
</style>
