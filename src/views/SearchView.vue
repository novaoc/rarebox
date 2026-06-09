<template>
  <div class="search-view">
    <!-- Search bar -->
    <div class="search-bar-wrapper">
      <div class="search-input-row">
        <div class="search-input-wrap">
          <span class="search-icon">⌕</span>
          <input
            v-model="query"
            class="input search-input"
            placeholder="Search any TCG card — Pokémon, Magic, Yu-Gi-Oh!, Lorcana..."
            @input="onInput"
            @keyup.enter="doSearch"
          />
          <button v-if="query" class="btn btn-ghost btn-icon search-clear" @click="clearSearch">✕</button>
        </div>
        <button class="btn btn-primary" @click="doSearch" :disabled="loading">
          <span v-if="loading" class="spinner spinner-sm"></span>
          <span v-else>Search</span>
        </button>
      </div>
    </div>

    <!-- TCG filter pills -->
    <div class="tcg-filters" v-if="searched && !loading">
      <button
        v-for="f in tcgFilters"
        :key="f.id"
        class="btn btn-sm"
        :class="activeFilter === f.id ? 'btn-primary' : 'btn-secondary'"
        @click="activeFilter = f.id"
      >{{ f.label }}</button>
    </div>

    <!-- Results -->
    <div v-if="searched">
      <div class="search-meta" v-if="!loading">
        <span class="text-secondary">{{ totalCount }} result{{ totalCount !== 1 ? 's' : '' }} for "{{ lastQuery }}"</span>
      </div>

      <div v-if="loading" class="search-loading flex-center">
        <div class="spinner spinner-lg"></div>
      </div>

      <div v-else-if="results.length === 0" class="empty-state">
        <div class="icon">🔍</div>
        <h3>No cards found</h3>
        <p>Try a different name or check the spelling</p>
      </div>

      <div v-else class="cards-grid">
        <div
          v-for="card in filteredResults"
          :key="card.id"
          class="card-result"
          @click="selectCard(card)"
          :class="{ selected: selectedCard?.id === card.id }"
        >
          <div class="card-img-wrap">
            <img
              :src="card.image || card.images?.small"
              :alt="card.name"
              loading="lazy"
              class="card-img"
              draggable="false"
            />
            <div class="card-overlay">
              <button class="btn btn-primary btn-sm" @click.stop="openAddModal(card)">
                + Add
              </button>
              <button class="btn btn-secondary btn-sm" @click.stop="selectCard(card)">
                Details
              </button>
            </div>
          </div>
          <div class="card-meta">
            <div class="card-name">{{ card.name }}</div>
            <div class="card-set-info">
              <span class="card-game-badge" :class="'game-' + card.game">{{ gameLabel(card.game) }}</span>
              {{ card.set }}
            </div>
            <div class="card-price-row">
              <span v-if="getPrice(card)" class="card-price">${{ getPrice(card)?.toFixed(2) }}</span>
              <span v-else class="text-muted" style="font-size:11px">No price</span>
              <span class="card-rarity badge badge-accent" v-if="card.rarity">{{ shortRarity(card.rarity) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1 && !loading" class="pagination">
        <button class="btn btn-secondary btn-sm" :disabled="page === 1" @click="goPage(page - 1)">← Prev</button>
        <span class="text-muted">Page {{ page }} of {{ totalPages }}</span>
        <button class="btn btn-secondary btn-sm" :disabled="page >= totalPages" @click="goPage(page + 1)">Next →</button>
      </div>
    </div>

    <!-- Card detail panel -->
    <transition name="slide-up">
      <div v-if="selectedCard" class="card-detail-panel">
        <div class="panel-header">
          <h3>{{ selectedCard.name }}</h3>
          <button class="btn btn-ghost btn-icon" @click="selectedCard = null">✕</button>
        </div>
        <div class="panel-body">
          <div class="panel-top">
            <img :src="selectedCard.image || selectedCard.images?.large || selectedCard.images?.small" class="panel-card-img" draggable="false" @error="$event.target.style.display='none'" />
            <div class="panel-card-info">
              <div class="panel-card-set">{{ selectedCard.set }} · #{{ selectedCard.number }}</div>
              <div class="panel-card-rarity">{{ selectedCard.rarity }}</div>
              <div class="panel-card-type">{{ selectedCard.supertype }} · {{ selectedCard.subtypes?.join(', ') }}</div>

              <div class="price-list mt-3" v-if="selectedCard.tcgplayer?.prices">
                <div class="price-list-title">TCGPlayer Prices</div>
                <div
                  v-for="(vals, key) in selectedCard.tcgplayer.prices"
                  :key="key"
                  class="price-row"
                >
                  <span class="price-variant">{{ formatVariantLabel(key) }}</span>
                  <span class="price-val">${{ vals.market?.toFixed(2) || vals.mid?.toFixed(2) || '—' }}</span>
                </div>
              </div>

              <div class="panel-actions mt-3">
                <button class="btn btn-primary w-full" @click="openAddModal(selectedCard)">
                  + Add to Portfolio
                </button>
              </div>

              <!-- Price alert -->
              <div class="alert-section mt-3">
                <div v-if="!showAlertForm && !activeAlert.length">
                  <button class="btn btn-secondary btn-sm w-full" @click="showAlertForm = true">
                    🔔 Set Price Alert
                  </button>
                </div>
                <div v-if="activeAlert.length" class="active-alerts">
                  <div v-for="a in activeAlert" :key="a.id" class="active-alert-row">
                    <span class="alert-badge">
                      🔔 {{ a.condition === 'above' ? '↑' : '↓' }} ${{ a.threshold.toFixed(2) }}
                    </span>
                    <button class="btn btn-ghost btn-icon btn-sm" @click="removeAlertById(a.id)" title="Remove">✕</button>
                  </div>
                  <button class="btn btn-ghost btn-sm" style="font-size:11px" @click="showAlertForm = true">+ Add another</button>
                </div>
                <div v-if="showAlertForm" class="alert-form">
                  <div class="alert-form-row">
                    <select v-model="alertCondition" class="input" style="width:auto;font-size:13px;padding:4px 8px">
                      <option value="above">Above</option>
                      <option value="below">Below</option>
                    </select>
                    <span style="color:var(--text-muted);font-size:13px">$</span>
                    <input v-model.number="alertThreshold" type="number" step="0.01" min="0" class="input" style="width:100px;font-size:13px;padding:4px 8px" placeholder="0.00" />
                    <button class="btn btn-primary btn-sm" :disabled="!alertThreshold" @click="saveAlert">Set</button>
                    <button class="btn btn-ghost btn-sm" @click="showAlertForm = false">Cancel</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Price history chart -->
          <div class="panel-chart">
            <div class="section-title mb-3">Price History</div>
            <PriceChart
              :cardId="selectedCard.id"
              :currentPrice="getPrice(selectedCard)"
              :height="240"
            />
          </div>
        </div>
      </div>
    </transition>

    <!-- Add modal -->
    <transition name="fade">
      <AddItemModal
        v-if="showAddModal"
        :card="modalCard"
        :tcg-card="addingTcgCard"
        @close="showAddModal = false"
        @added="onAdded"
      />
    </transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { getMarketPrice, formatVariantLabel } from '../services/pokemonApi'
import { multiSearch } from '../services/tcg/multiSearch'
import { getAlertsForCard, addAlert, removeAlert, requestNotificationPermission } from '../utils/alerts'
import PriceChart from '../components/PriceChart.vue'
import AddItemModal from '../components/AddItemModal.vue'

const query = ref('')
const results = ref([])
const loading = ref(false)
const searched = ref(false)
const lastQuery = ref('')
const totalCount = ref(0)
const page = ref(1)
const pageSize = 20
const totalPages = computed(() => Math.ceil(totalCount.value / pageSize))
const selectedCard = ref(null)
const showAddModal = ref(false)
const modalCard = ref(null)

// TCG filter
const activeFilter = ref('all')
const tcgFilters = [
  { id: 'all', label: 'All TCGs' },
  { id: 'pokemon', label: 'Pokémon' },
  { id: 'mtg', label: 'Magic' },
  { id: 'yugioh', label: 'Yu-Gi-Oh!' },
  { id: 'lorcana', label: 'Lorcana' },
  { id: 'one-piece', label: 'One Piece' },
  { id: 'riftbound', label: 'Riftbound' },
]
const allResults = ref([])

const filteredResults = computed(() => {
  if (activeFilter.value === 'all') return results.value
  return results.value.filter(c => c.game === activeFilter.value)
})

const gameLabels = { pokemon: 'PKM', mtg: 'MTG', yugioh: 'YGO', lorcana: 'LRC', 'one-piece': 'OP', riftbound: 'RIF' }
function gameLabel(game) { return gameLabels[game] || game }

// Alert state
const showAlertForm = ref(false)
const alertCondition = ref('below')
const alertThreshold = ref(null)

const activeAlert = computed(() => {
  if (!selectedCard.value) return []
  return getAlertsForCard(selectedCard.value.id)
})

async function saveAlert() {
  if (!selectedCard.value || !alertThreshold.value) return
  await requestNotificationPermission()
  addAlert(
    selectedCard.value.id,
    selectedCard.value.name,
    alertCondition.value,
    alertThreshold.value,
    getPrice(selectedCard.value)
  )
  showAlertForm.value = false
  alertThreshold.value = null
}

function removeAlertById(id) {
  removeAlert(id)
}

let debounceTimer = null

function onInput() {
  clearTimeout(debounceTimer)
  if (query.value.length >= 3) {
    debounceTimer = setTimeout(doSearch, 500)
  }
}

async function doSearch(resetPage = true) {
  if (!query.value.trim()) return
  if (resetPage === true) { page.value = 1; activeFilter.value = 'all' }
  loading.value = true
  searched.value = true
  lastQuery.value = query.value
  try {
    const data = await multiSearch(query.value, { page: page.value, pageSize })
    allResults.value = data.cards || []
    results.value = data.cards || []
    totalCount.value = data.totalCount || 0
  } catch (e) {
    allResults.value = []
    results.value = []
    totalCount.value = 0
  } finally {
    loading.value = false
  }
}

async function goPage(p) {
  page.value = p
  await doSearch(false)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function clearSearch() {
  query.value = ''
  results.value = []
  allResults.value = []
  searched.value = false
  selectedCard.value = null
  activeFilter.value = 'all'
}

function selectCard(card) {
  selectedCard.value = selectedCard.value?.id === card.id ? null : card
}

function openAddModal(card) {
  if (card.game && card.game !== 'pokemon') {
    // Non-Pokémon card — use tcgCard prop
    modalCard.value = null
    // Set a temporary tcgCard ref for the template
    addingTcgCard.value = {
      game: card.game,
      name: card.name,
      set: card.set || '',
      number: card.number,
      image: card.image,
      price: card.price,
    }
  } else {
    addingTcgCard.value = null
    modalCard.value = card._raw || card
  }
  showAddModal.value = true
}

const addingTcgCard = ref(null)

function getPrice(card) {
  // Multi-TCG cards have price pre-extracted
  if (card.price != null) return card.price
  // Pokémon cards from old flow use getMarketPrice on _raw
  if (card._raw) {
    const r = getMarketPrice(card._raw)
    return r?.price || null
  }
  return null
}

function shortRarity(rarity) {
  const map = {
    'Rare Holo': 'Holo R',
    'Rare Ultra': 'Ultra R',
    'Rare Secret': 'Secret R',
    'Rare Rainbow': 'Rainbow',
    'Rare Holo EX': 'EX',
    'Rare Holo GX': 'GX',
    'Rare Holo V': 'V',
    'Rare Holo VMAX': 'VMAX',
    'Rare Holo VSTAR': 'VSTAR',
    'Illustration Rare': 'IR',
    'Special Illustration Rare': 'SIR',
    'Hyper Rare': 'HR',
    'Double Rare': '2R',
    'Triple Rare': '3R',
  }
  return map[rarity] || (rarity?.length > 10 ? rarity.substring(0, 8) + '…' : rarity)
}

function onAdded() {
  showAddModal.value = false
  addingTcgCard.value = null
}
</script>

<style scoped>
.search-view { max-width: 1200px; margin: 0 auto; }

.search-bar-wrapper {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px;
  margin-bottom: 24px;
}
.search-input-row { display: flex; gap: 10px; }
.search-input-wrap {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
}
.search-icon {
  position: absolute;
  left: 12px;
  font-size: 16px;
  color: var(--text-muted);
  pointer-events: none;
}
.search-input { padding-left: 36px; padding-right: 36px; font-size: 15px; }
.search-clear { position: absolute; right: 4px; }

.tcg-filters { display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; }

.search-meta { margin-bottom: 16px; font-size: 13px; }
.search-loading { padding: 60px; }

.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}

.card-result {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
}
.card-result:hover { border-color: var(--accent); transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
.card-result.selected { border-color: var(--accent); }

.card-img-wrap { position: relative; overflow: hidden; background: #1a1f28; aspect-ratio: 2.5/3.5; }
.card-img { width: 100%; height: 100%; object-fit: contain; display: block; transition: transform 0.3s; pointer-events: none; -webkit-user-drag: none; user-drag: none; }
.card-result:hover .card-img { transform: scale(1.04); }

.card-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  opacity: 0;
  transition: opacity 0.2s;
}
.card-result:hover .card-overlay { opacity: 1; }

/* Touch devices: show overlay always at reduced opacity */
@media (hover: none) {
  .card-overlay {
    opacity: 1;
    background: rgba(0,0,0,0.5);
  }
  .card-overlay .btn { font-size: 12px; padding: 6px 12px; }
}

.card-meta { padding: 10px; }
.card-name { font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-set-info { font-size: 10px; color: var(--text-muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 4px; }
.card-game-badge { font-size: 8px; font-weight: 700; padding: 1px 4px; border-radius: 3px; text-transform: uppercase; letter-spacing: 0.3px; flex-shrink: 0; }
.game-pokemon { background: #ffcb05; color: #1a1a2e; }
.game-mtg { background: #f8991c; color: #1a1a2e; }
.game-lorcana { background: #7b2c9e; color: #fff; }
.game-one-piece { background: #d7263d; color: #fff; }
.game-riftbound { background: #0bc6e3; color: #1a1a2e; }
.game-yugioh { background: #c0202a; color: #fff; }
.card-price-row { display: flex; align-items: center; justify-content: space-between; margin-top: 4px; }
.card-price { font-size: 12px; font-weight: 700; color: var(--accent); }
.card-rarity { font-size: 9px !important; padding: 1px 5px !important; }

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 20px 0;
}

/* Detail panel */
.card-detail-panel {
  position: fixed;
  bottom: 0;
  left: var(--sidebar-width);
  right: 0;
  max-height: 70vh;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border);
  border-left: 1px solid var(--border);
  overflow-y: auto;
  z-index: 100;
  box-shadow: 0 -8px 32px rgba(0,0,0,0.5);
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border);
  position: sticky;
  top: 0;
  background: var(--bg-secondary);
  z-index: 1;
}
.panel-header h3 { font-size: 17px; font-weight: 700; }

.panel-body { padding: 20px 24px; }
.panel-top { display: flex; gap: 24px; margin-bottom: 24px; }
.panel-card-img { width: 140px; min-width: 140px; border-radius: 8px; box-shadow: var(--shadow); pointer-events: none; -webkit-user-drag: none; user-drag: none; }
.panel-card-info { flex: 1; }
.panel-card-set { font-size: 13px; color: var(--text-secondary); margin-bottom: 4px; }
.panel-card-rarity { font-size: 12px; color: var(--accent); }
.panel-card-type { font-size: 12px; color: var(--text-muted); margin-top: 4px; }

.price-list-title { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 8px; }
.price-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid var(--border-subtle); font-size: 13px; }
.price-variant { color: var(--text-secondary); }
.price-val { font-weight: 600; font-variant-numeric: tabular-nums; }

.panel-chart { border-top: 1px solid var(--border); padding-top: 20px; }

/* Alert styles */
.active-alerts { display: flex; flex-direction: column; gap: 4px; }
.active-alert-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: rgba(245, 166, 35, 0.1);
  border-radius: var(--radius);
}
.alert-badge { font-size: 13px; font-weight: 600; color: var(--accent); }
.alert-form-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

@media (max-width: 768px) {
  .card-detail-panel {
    left: 0;
    max-height: 85vh;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  }
  /* Drag handle */
  .card-detail-panel::before {
    content: '';
    display: block;
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: var(--border);
    margin: 8px auto 4px;
  }
  .panel-top { flex-direction: column; align-items: center; }
  .panel-card-img { width: 160px; min-width: 160px; }
  .panel-body { padding: 12px 16px; }
  .panel-header { padding: 12px 16px; }
}

@media (max-width: 480px) {
  .card-detail-panel { max-height: 90vh; }
  .cards-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
  .card-meta { padding: 8px; }
  .card-name { font-size: 11px; }
}
</style>
