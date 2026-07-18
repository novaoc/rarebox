<template>
  <div class="sets-view">

    <!-- Set list -->
    <div v-if="!selectedSet">
      <div class="sets-header mb-4">
        <div class="lang-tabs">
          <button class="lang-tab" :class="{ active: lang === 'en' }" @click="switchLang('en')">English</button>
          <button class="lang-tab" :class="{ active: lang === 'ja' }" @click="switchLang('ja')">Japanese</button>
        </div>
        <div class="search-input-wrap">
          <span class="search-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-search" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
          </span>
          <input
            v-model="setFilter"
            class="input search-input"
            placeholder="Filter sets..."
          />
          <button v-if="setFilter" class="btn btn-ghost btn-icon search-clear" @click="setFilter = ''" aria-label="Clear filter">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
      </div>

      <div v-if="loadingSets" class="sets-grid">
        <div v-for="i in 12" :key="i" class="skeleton-card shimmer"></div>
      </div>

      <div v-else-if="setsError" class="empty-state">
        <div class="icon">⚠</div>
        <h3>Failed to load sets</h3>
        <p>{{ setsError }}</p>
        <button class="btn btn-primary mt-3" @click="loadSets">Retry</button>
      </div>

      <div v-else>
        <div class="sets-count text-muted mb-3" style="font-size:13px">
          {{ filteredSets.length }} set{{ filteredSets.length !== 1 ? 's' : '' }}
        </div>
        <div class="sets-grid">
          <div
            v-for="set in filteredSets"
            :key="set.id"
            class="set-card"
            @click="openSet(set)"
          >
            <div class="set-logo-wrap">
              <img
                v-if="set.images?.logo"
                :src="set.images.logo"
                :alt="set.name"
                class="set-logo"
                loading="lazy"
                decoding="async"
                draggable="false"
                @error="$event.target.style.display='none'; $event.target.nextElementSibling.style.display=''"
              />
              <span class="set-logo-placeholder" :class="{ 'set-logo-jp': set._lang === 'ja' }" :style="set.images?.logo ? 'display:none' : ''">
                {{ set._lang === 'ja' ? 'ポケ' : '⬡' }}
              </span>
            </div>
            <div class="set-info">
              <div class="set-name">{{ set.name }}</div>
              <div v-if="set.nameJp && set.nameJp !== set.name" class="set-name-jp">{{ set.nameJp }}</div>
              <div class="set-meta">
                <template v-if="set.series">
                  <span class="set-series">{{ set.series }}</span>
                  <span class="set-dot">·</span>
                </template>
                <span class="set-count">{{ set.total }} cards</span>
                <template v-if="ownedCardsBySet[set.id]">
                  <span class="set-dot">·</span>
                  <span class="set-owned">{{ ownedCardsBySet[set.id] }}/{{ set.total }}</span>
                </template>
                <template v-if="set.releaseDate">
                  <span class="set-dot">·</span>
                  <span class="set-date">{{ formatDate(set.releaseDate) }}</span>
                </template>
              </div>
            </div>
            <div class="set-symbol-wrap" v-if="set.images?.symbol">
              <img :src="set.images.symbol" :alt="set.name + ' symbol'" class="set-symbol" draggable="false" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Card browser for selected set -->
    <div v-else>
      <div class="set-browse-header mb-4">
        <button class="btn btn-secondary btn-sm" @click="closeSet">← All Sets</button>
        <div class="set-browse-title">
          <img v-if="selectedSet.images?.symbol" :src="selectedSet.images.symbol" class="browse-symbol" draggable="false" />
          <span>{{ selectedSet.name }}</span>
          <span class="badge badge-accent ml-2">{{ selectedSet.total }} cards</span>
        </div>
        <div class="set-browse-filters">
          <input
            v-model="cardFilter"
            class="input input-sm"
            placeholder="Filter cards..."
            style="width:160px"
          />
          <button class="btn btn-primary btn-sm" @click="openBulkAddModal" :disabled="bulkLoading">
            {{ bulkLoading ? 'Loading...' : '+ Add Set' }}
          </button>
        </div>
      </div>

      <div v-if="loadingCards" class="cards-grid">
        <div v-for="i in 12" :key="i" class="skeleton-card-tall shimmer"></div>
      </div>

      <div v-else-if="cardsError" class="empty-state">
        <div class="icon">⚠</div>
        <h3>Failed to load cards</h3>
        <p>{{ cardsError }}</p>
        <button class="btn btn-primary mt-3" @click="loadSetCards(selectedSet)">Retry</button>
      </div>

      <div v-else>
        <div class="cards-grid">
          <div
            v-for="card in filteredCards"
            :key="card.id"
            class="card-result"
            :class="{ selected: selectedCard?.id === card.id, revealed: revealedCard === card.id }"
            @click="tapCard(card)"
          >
            <div class="card-img-wrap">
              <img
                v-if="card.images?.small"
                :src="card.images.small"
                :alt="card.name"
                loading="lazy"
                class="card-img"
                draggable="false"
                @error="$event.target.style.display='none'; $event.target.nextElementSibling.style.display='flex'"
              />
              <div class="card-img-placeholder" :style="card.images?.small ? 'display:none' : ''">
                <span>{{ card.name }}</span>
                <span class="card-img-num">#{{ card.number }}</span>
              </div>
              <div class="card-overlay">
                <button class="btn btn-primary btn-sm" @click.stop="openAddModal(card)">+ Add</button>
                <button class="btn btn-secondary btn-sm" @click.stop="selectCard(card)">Details</button>
              </div>
            </div>
            <div class="card-meta">
              <div class="card-name">{{ card.name }}</div>
              <div class="card-num text-muted" style="font-size:10px">#{{ card.number }}</div>
              <div class="card-price-row">
                <span v-if="getPrice(card)" class="card-price">${{ getPrice(card).toFixed(2) }}</span>
                <span v-else class="text-muted" style="font-size:11px">—</span>
                <span class="card-rarity badge badge-accent" v-if="card.rarity">{{ shortRarity(card.rarity) }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-if="totalCardPages > 1" class="pagination">
          <button class="btn btn-secondary btn-sm" :disabled="cardPage === 1" @click="goCardPage(cardPage - 1)">← Prev</button>
          <span class="text-muted">Page {{ cardPage }} of {{ totalCardPages }}</span>
          <button class="btn btn-secondary btn-sm" :disabled="cardPage >= totalCardPages" @click="goCardPage(cardPage + 1)">Next →</button>
        </div>
      </div>
    </div>

    <!-- Card detail panel -->
    <transition name="slide-up">
      <div v-if="selectedCard" class="card-detail-panel">
        <div class="panel-header">
          <h3>{{ selectedCard.name }}</h3>
          <button class="btn btn-ghost btn-icon" @click="selectedCard = null" aria-label="Close panel">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>
        <div class="panel-body">
          <div class="panel-top">
            <img v-if="selectedCard.images?.large || selectedCard.images?.small" :src="selectedCard.images?.large || selectedCard.images?.small" class="panel-card-img" draggable="false" @error="$event.target.style.display='none'" />
            <div v-else class="panel-card-img-placeholder">
              <span>{{ selectedCard.name }}</span>
              <span style="font-size:12px;color:var(--text-muted)">#{{ selectedCard.number }}</span>
            </div>
            <div class="panel-card-info">
              <div class="panel-card-set">{{ selectedCard.set?.name }} · #{{ selectedCard.number }}</div>
              <div class="panel-card-rarity">{{ selectedCard.rarity }}</div>
              <div class="panel-card-type">{{ selectedCard.supertype }} · {{ selectedCard.subtypes?.join(', ') }}</div>

              <div class="price-list mt-3" v-if="selectedCard.tcgplayer?.prices">
                <div class="price-list-title">{{ selectedCard._lang === 'ja' ? 'CardMarket (converted)' : 'TCGPlayer Prices' }}</div>
                <div
                  v-for="(vals, key) in selectedCard.tcgplayer.prices"
                  :key="key"
                  class="price-row"
                >
                  <span class="price-variant">{{ selectedCard._lang === 'ja' ? 'Market' : formatVariantLabel(key) }}</span>
                  <span class="price-val">${{ vals.market?.toFixed(2) || vals.mid?.toFixed(2) || '—' }}</span>
                </div>
              </div>

              <!-- Japanese card details -->
              <div v-if="selectedCard._lang === 'ja'" class="mt-3">
                <div v-if="selectedCard.attacks?.length" class="mt-3">
                  <div class="price-list-title">Attacks</div>
                  <div v-for="atk in selectedCard.attacks" :key="atk.name" class="attack-row">
                    <div class="attack-header">
                      <span class="attack-cost">{{ (atk.cost || []).join(' ') }}</span>
                      <span class="attack-name">{{ atk.name }}</span>
                      <span class="attack-damage" v-if="atk.damage">{{ atk.damage }}</span>
                    </div>
                    <div class="attack-text" v-if="atk.text">{{ atk.text }}</div>
                  </div>
                </div>
                <div v-if="selectedCard.weaknesses?.length" class="mt-2" style="font-size:12px;color:var(--text-muted)">
                  Weaknesses: {{ selectedCard.weaknesses.map(w => `${w.type} ${w.value}`).join(', ') }}
                </div>
              </div>

              <div class="panel-actions mt-3">
                <button class="btn btn-primary w-full" @click="openAddModal(selectedCard)">
                  + Add to Shelf
                </button>
              </div>
            </div>
          </div>
          <div class="panel-chart">
            <div class="section-title mb-3">Price History</div>
            <PriceChart
              :cardId="selectedCard.id"
              :cardRef="{ game: 'pokemon', setId: selectedCard.set?.id, number: selectedCard.number, cardId: selectedCard.id, lang: selectedCard._lang }"
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
        @close="showAddModal = false"
        @added="showAddModal = false"
      />
    </transition>

    <!-- Bulk add modal -->
    <transition name="fade">
      <div v-if="showBulkAddModal" class="modal-overlay" @click.self="showBulkAddModal = false">
        <div class="bulk-modal">
          <div class="bulk-header">
            <h3>Add Cards from {{ selectedSet?.name }}</h3>
            <button class="btn btn-ghost btn-icon" @click="showBulkAddModal = false" aria-label="Close modal">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-x" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>

          <div class="bulk-controls">
            <select v-model="bulkAddPortfolioId" class="input input-sm" style="width:160px">
              <option v-for="p in store.portfolios" :key="p.id" :value="p.id">{{ p.name }}</option>
              <option value="__new__">＋ New shelf…</option>
            </select>
            <input
              v-if="bulkAddPortfolioId === '__new__'"
              v-model="newShelfName"
              class="input input-sm"
              style="width:180px"
              :placeholder="selectedSet?.name || 'Shelf name'"
            />
            <div class="bulk-filter-tabs">
              <button class="bulk-tab" :class="{ active: bulkAddFilter === 'all' }" @click="bulkAddFilter = 'all'">
                All ({{ bulkAddCards.length }})
              </button>
              <button class="bulk-tab" :class="{ active: bulkAddFilter === 'needed' }" @click="bulkAddFilter = 'needed'">
                Needed ({{ bulkNeededCount }})
              </button>
            </div>
            <div class="bulk-actions-row">
              <button class="btn btn-ghost btn-sm" @click="bulkSelectAll">Select all</button>
              <button class="btn btn-ghost btn-sm" @click="bulkDeselectAll">Deselect all</button>
            </div>
          </div>

          <div class="bulk-grid">
            <div
              v-for="card in filteredBulkCards"
              :key="card.id"
              class="bulk-card"
              :class="{ 'bulk-checked': card.checked }"
              @click="toggleBulkCard(card.id)"
            >
              <div class="bulk-card-check">
                <input type="checkbox" :checked="card.checked" @click.stop="toggleBulkCard(card.id)" />
              </div>
              <img
                v-if="card.images?.small"
                :src="card.images.small"
                :alt="card.name"
                class="bulk-card-img"
                loading="lazy"
                draggable="false"
              />
              <div class="bulk-card-info">
                <div class="bulk-card-name">{{ card.name }}</div>
                <div class="bulk-card-meta">#{{ card.number }} · {{ card.price ? '$' + card.price.toFixed(2) : '—' }}</div>
              </div>
            </div>
          </div>

          <div class="bulk-footer">
            <div class="bulk-summary">
              <span class="bulk-stat"><strong>{{ bulkSelectedCount }}</strong> selected · <strong>{{ bulkNeededCount }}</strong> needed</span>
              <span class="bulk-cost" v-if="bulkNeededCount > 0">
                ${{ bulkNeededCost.toFixed(2) }} to complete
              </span>
            </div>
            <button
              class="btn btn-primary"
              :disabled="bulkAdding || bulkSelectedCount === 0"
              @click="confirmBulkAdd"
            >
              {{ bulkAdding ? 'Adding...' : bulkAddDone ? '✓ Added!' : 'Add ' + bulkSelectedCount + ' Cards' }}
            </button>
          </div>
        </div>
      </div>
    </transition>

  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { tokenMatch } from '../utils/search.js'
import { getSets, getCardsBySet, getMarketPrice, formatVariantLabel, getJapaneseSets, getJapaneseCardsBySet, getJapaneseCardDetail } from '../services/pokemonApi'
import { sortByNumber } from '../utils/masterSets'
import { usePortfolioStore } from '../stores/portfolio'
import PriceChart from '../components/PriceChart.vue'
import AddItemModal from '../components/AddItemModal.vue'

const store = usePortfolioStore()
const route = useRoute()

// Set list state
const sets = ref([])
const loadingSets = ref(false)
const setsError = ref(null)
const setFilter = ref('')
const lang = ref('en')
const setsCache = { en: [], ja: [] }

// Selected set / card browse state
const selectedSet = ref(null)
const cards = ref([])
const loadingCards = ref(false)
const cardsError = ref(null)
const cardFilter = ref('')
const cardPage = ref(1)
const cardPageSize = 36
const totalCards = ref(0)
const totalCardPages = computed(() => Math.ceil(totalCards.value / cardPageSize))

// Count how many unique cards from each set are owned across all portfolios
const ownedCardsBySet = computed(() => {
  const map = {}
  for (const p of store.portfolios) {
    for (const item of p.items) {
      if (item.type !== 'card' || !item.cardData?.set?.id) continue
      const setId = item.cardData.set.id
      if (!map[setId]) map[setId] = new Set()
      map[setId].add(item.cardId)
    }
  }
  const result = {}
  for (const [setId, ids] of Object.entries(map)) result[setId] = ids.size
  return result
})

// Card detail / add modal
const selectedCard = ref(null)

// Tap-to-reveal on touch devices (desktop reveals on hover; taps no-op there)
const revealedCard = ref(null)
const _canHover = typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches
function tapCard(card) {
  if (_canHover) { selectCard(card); return } // desktop: click = details, as before
  revealedCard.value = revealedCard.value === card.id ? null : card.id
}
const showAddModal = ref(false)
const modalCard = ref(null)

// Bulk add modal
const showBulkAddModal = ref(false)
const bulkAddCards = ref([])
const bulkAddPortfolioId = ref('')
const newShelfName = ref('')
const bulkAddFilter = ref('all') // 'all' | 'needed'
const bulkAdding = ref(false)
const bulkAddDone = ref(false)
const bulkLoading = ref(false)

const filteredBulkCards = computed(() => {
  if (bulkAddFilter.value === 'needed') return bulkAddCards.value.filter(c => !c.checked)
  return bulkAddCards.value
})

const bulkSelectedCount = computed(() => bulkAddCards.value.filter(c => c.checked).length)
const bulkNeededCount = computed(() => bulkAddCards.value.filter(c => !c.checked).length)
const bulkNeededCost = computed(() => {
  return bulkAddCards.value.filter(c => !c.checked).reduce((s, c) => s + (c.price || 0), 0)
})
const bulkSelectedCost = computed(() => {
  return bulkAddCards.value.filter(c => c.checked).reduce((s, c) => s + (c.price || 0), 0)
})

const filteredSets = computed(() => {
  const q = setFilter.value.toLowerCase()
  if (!q) return sets.value
  return sets.value.filter(s =>
    tokenMatch(q, s.name, s.series)
  )
})

const filteredCards = computed(() => {
  const q = cardFilter.value.toLowerCase()
  if (!q) return cards.value
  return cards.value.filter(c => tokenMatch(q, c.name, c.number))
})

async function loadSets() {
  loadingSets.value = true
  setsError.value = null
  try {
    if (lang.value === 'ja') {
      setsCache.ja = await getJapaneseSets()
      sets.value = setsCache.ja
    } else {
      setsCache.en = await getSets()
      sets.value = setsCache.en
    }
  } catch (e) {
    setsError.value = e.message || 'Unknown error'
  } finally {
    loadingSets.value = false
  }
}

async function switchLang(newLang) {
  if (lang.value === newLang) return
  lang.value = newLang
  setFilter.value = ''
  selectedSet.value = null
  selectedCard.value = null
  if (setsCache[newLang].length) {
    sets.value = setsCache[newLang]
  } else {
    await loadSets()
  }
}

async function openSet(set) {
  selectedSet.value = set
  cardPage.value = 1
  cardFilter.value = ''
  selectedCard.value = null
  await loadSetCards(set, 1)
}

function closeSet() {
  selectedSet.value = null
  cards.value = []
  selectedCard.value = null
}

async function loadSetCards(set, page = cardPage.value) {
  loadingCards.value = true
  cardsError.value = null
  try {
    if (set._lang === 'ja' || lang.value === 'ja') {
      const data = await getJapaneseCardsBySet(set.id, page, cardPageSize)
      cards.value = data.data || []
      totalCards.value = data.totalCount || 0
    } else {
      const data = await getCardsBySet(set.id, page, cardPageSize)
      cards.value = data.data || []
      totalCards.value = data.totalCount || 0
    }
  } catch (e) {
    cardsError.value = e.message || 'Unknown error'
  } finally {
    loadingCards.value = false
  }
}

async function goCardPage(p) {
  cardPage.value = p
  await loadSetCards(selectedSet.value, p)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function selectCard(card) {
  if (selectedCard.value?.id === card.id) {
    selectedCard.value = null
    return
  }
  if (card._lang === 'ja') {
    // Fetch full detail for Japanese cards
    try {
      const detail = await getJapaneseCardDetail(card.id)
      selectedCard.value = { ...card, ...detail }
    } catch {
      selectedCard.value = card
    }
  } else {
    selectedCard.value = card
  }
}

function openAddModal(card) {
  modalCard.value = card
  showAddModal.value = true
}

function getPrice(card) {
  // For Japanese cards, price comes from detail fetch (CardMarket)
  if (card._lang === 'ja' && card.tcgplayer?.prices) {
    const vals = Object.values(card.tcgplayer.prices)[0]
    return vals?.market || vals?.mid || null
  }
  const r = getMarketPrice(card)
  return r?.price || null
}

function shortRarity(rarity) {
  const map = {
    'Rare Holo': 'Holo R', 'Rare Ultra': 'Ultra R', 'Rare Secret': 'Secret R',
    'Rare Rainbow': 'Rainbow', 'Rare Holo EX': 'EX', 'Rare Holo GX': 'GX',
    'Rare Holo V': 'V', 'Rare Holo VMAX': 'VMAX', 'Rare Holo VSTAR': 'VSTAR',
    'Illustration Rare': 'IR', 'Special Illustration Rare': 'SIR',
    'Hyper Rare': 'HR', 'Double Rare': '2R', 'Triple Rare': '3R',
  }
  return map[rarity] || (rarity?.length > 10 ? rarity.substring(0, 8) + '…' : rarity)
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('/')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${months[parseInt(m, 10) - 1]} ${y}`
}

async function openBulkAddModal() {
  if (!selectedSet.value || bulkLoading.value) return
  bulkLoading.value = true
  bulkAddDone.value = false
  bulkAddFilter.value = 'all'

  // Default to first portfolio — or to creating one when none exist yet
  if (!bulkAddPortfolioId.value) {
    bulkAddPortfolioId.value = store.portfolios[0]?.id || '__new__'
  }
  newShelfName.value = ''

  // Get already-owned card IDs for this set in the selected portfolio
  const portfolio = store.portfolios.find(p => p.id === bulkAddPortfolioId.value)
  const ownedIds = new Set(
    (portfolio?.items || [])
      .filter(i => i.type === 'card' && i.cardData?.set?.id === selectedSet.value.id)
      .map(i => i.cardId)
  )

  // Load all cards — try/finally so a failed fetch can't leave the
  // "+ Add Set" button wedged at "Loading…" until reload
  let allCards = []
  try {
    if (selectedSet.value._lang === 'ja') {
      const data = await getJapaneseCardsBySet(selectedSet.value.id, 1, 999)
      allCards = data.data || []
    } else {
      // pokemontcg.io caps pageSize at 250 and a few sets exceed it
      // (Surging Sparks is 252) — page until the set runs dry
      for (let page = 1; ; page++) {
        const batch = (await getCardsBySet(selectedSet.value.id, page, 250)).data || []
        allCards.push(...batch)
        if (batch.length < 250) break
      }
    }
  } catch {
    bulkLoading.value = false
    return
  }

  // Build bulk card list with prices
  bulkAddCards.value = sortByNumber(allCards).map(card => {
    let price = 0
    if (selectedSet.value._lang === 'ja') {
      // JP cards: use tcgplayer prices if available (from detail fetch)
      const vals = card.tcgplayer?.prices ? Object.values(card.tcgplayer.prices)[0] : null
      price = vals?.market || vals?.mid || 0
    } else {
      const r = getMarketPrice(card)
      price = r?.price || r || 0
    }
    return {
      id: card.id,
      name: card.name,
      number: card.number,
      images: card.images,
      rarity: card.rarity,
      supertype: card.supertype,
      set: card.set,
      price,
      checked: !ownedIds.has(card.id), // pre-check cards NOT already owned
      _lang: card._lang || 'en',
    }
  })

  bulkLoading.value = false
  showBulkAddModal.value = true
}

function toggleBulkCard(cardId) {
  const card = bulkAddCards.value.find(c => c.id === cardId)
  if (card) card.checked = !card.checked
}

function bulkSelectAll() { bulkAddCards.value.forEach(c => { c.checked = true }) }
function bulkDeselectAll() { bulkAddCards.value.forEach(c => { c.checked = false }) }

async function confirmBulkAdd() {
  if (bulkAdding.value || !bulkAddPortfolioId.value) return
  bulkAdding.value = true

  let targetId = bulkAddPortfolioId.value
  if (targetId === '__new__') {
    // Empty input falls back to the placeholder — the set's own name
    const p = store.createPortfolio(newShelfName.value.trim() || selectedSet.value?.name || 'New Shelf')
    targetId = p.id
    bulkAddPortfolioId.value = p.id
  }

  const toAdd = bulkAddCards.value.filter(c => c.checked)
  for (const card of toAdd) {
    store.addItem(targetId, {
      type: 'card',
      quantity: 1,
      purchasePrice: 0,
      purchaseDate: '',
      notes: '',
      cardId: card.id,
      _lang: card._lang || null,
      cardData: {
        name: card.name,
        number: card.number,
        images: card.images,
        set: { id: card.set?.id, name: card.set?.name },
        rarity: card.rarity,
        supertype: card.supertype,
        _lang: card._lang,
      },
      priceVariant: '',
      currentMarketPrice: card.price,
    })
  }

  bulkAdding.value = false
  bulkAddDone.value = true
  setTimeout(() => { showBulkAddModal.value = false; bulkAddDone.value = false }, 1500)
}

// Update checked state when portfolio changes
watch(bulkAddPortfolioId, () => {
  if (!showBulkAddModal.value || !selectedSet.value) return
  const portfolio = store.portfolios.find(p => p.id === bulkAddPortfolioId.value)
  const ownedIds = new Set(
    (portfolio?.items || [])
      .filter(i => i.type === 'card' && i.cardData?.set?.id === selectedSet.value.id)
      .map(i => i.cardId)
  )
  bulkAddCards.value.forEach(c => { c.checked = !ownedIds.has(c.id) })
})

// Deep links like /sets/pokemon?set=sv10 open that set directly (used by the
// Dashboard "New Releases" cards). Unknown ids (or a ja list) just no-op.
onMounted(async () => {
  await loadSets()
  const wanted = route.query.set
  if (!wanted) return
  const match = sets.value.find(s => s.id === wanted)
  if (match) openSet(match)
})
</script>

<style scoped>
.sets-view { max-width: 1200px; margin: 0 auto; }

.sets-header { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }

/* Language tabs */
.lang-tabs { display: flex; gap: 0; background: var(--bg-card); border-radius: var(--radius); border: var(--bw) solid var(--ink); box-shadow: var(--shadow-pressed); overflow: hidden; }
.lang-tab {
  padding: 7px 16px; font-size: 13px; font-weight: 600; cursor: pointer;
  background: transparent; border: none; color: var(--text-secondary);
  transition: all 0.15s;
}
.lang-tab:hover { color: var(--text-primary); }
.lang-tab.active { background: var(--accent); color: var(--on-accent); font-weight: 700; }
.search-input-wrap { flex: 1; position: relative; display: flex; align-items: center; max-width: 400px; }
.search-icon { position: absolute; left: 12px; font-size: 16px; color: var(--text-muted); pointer-events: none; display: flex; align-items: center; }
.search-input { padding-left: 36px; padding-right: 36px; font-size: 14px; }
.search-clear { position: absolute; right: 4px; display: flex; align-items: center; justify-content: center; }

.sets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr));
  gap: 12px;
}

.set-card {
  background: var(--bg-card);
  border: var(--bw) solid var(--ink);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xs);
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.set-card:hover {
  transform: translate(-1px, -1px);
  box-shadow: var(--shadow-sm);
}

.set-logo-wrap { width: 80px; min-width: 80px; display: flex; align-items: center; justify-content: center; }
.set-logo { max-width: 80px; max-height: 40px; object-fit: contain; pointer-events: none; -webkit-user-drag: none; user-drag: none; }
.set-logo-placeholder { font-size: 28px; color: var(--text-muted); }
.set-logo-jp { font-size: 18px; font-weight: 700; letter-spacing: 2px; }

.set-info { flex: 1; min-width: 0; }
.set-name { font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.set-name-jp { font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 1px; }
.set-meta { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin-top: 3px; font-size: 11px; color: var(--text-muted); }
.set-dot { color: var(--text-muted); }
.set-series { color: var(--text-secondary); }
.set-owned { color: var(--success); font-weight: 700; }

.set-symbol-wrap { flex-shrink: 0; }
.set-symbol { width: 24px; height: 24px; object-fit: contain; opacity: 0.7; pointer-events: none; -webkit-user-drag: none; user-drag: none; }

/* Set card browser */
.set-browse-header {
  display: flex;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}
.set-browse-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 17px;
  font-weight: 700;
  flex: 1;
}
.browse-symbol { width: 22px; height: 22px; object-fit: contain; pointer-events: none; -webkit-user-drag: none; user-drag: none; }
.set-browse-filters { display: flex; gap: 8px; align-items: center; }

/* Skeleton Loader */
.skeleton-card {
  height: 84px;
  background: var(--bg-secondary);
  border: var(--bw) dashed var(--border-subtle);
  border-radius: var(--radius-lg);
}
.skeleton-card-tall {
  aspect-ratio: 2.5 / 4.2;
  background: var(--bg-secondary);
  border: var(--bw) dashed var(--border-subtle);
  border-radius: var(--radius-lg);
}
.shimmer {
  position: relative;
  overflow: hidden;
}
.shimmer::after {
  content: '';
  position: absolute;
  top: 0; right: 0; bottom: 0; left: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.65), transparent);
  animation: shimmer-anim 1.5s infinite;
}

@media (prefers-reduced-motion: reduce) {
  .shimmer::after {
    animation: none;
    background: var(--bg-hover);
  }
  .set-card:hover {
    transform: none;
  }
  .card-result:hover {
    transform: none;
  }
}

@keyframes shimmer-anim {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

/* Bulk add modal */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(20,20,20,0.45);
  display: flex; align-items: center; justify-content: center;
  z-index: 100; padding: 16px;
}
.bulk-modal {
  background: var(--bg-card); border: var(--bw) solid var(--ink);
  border-radius: var(--radius-lg); box-shadow: var(--shadow-lg);
  width: 100%; max-width: 640px; max-height: 85vh;
  display: flex; flex-direction: column;
}
.bulk-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 20px; border-bottom: var(--bw) solid var(--ink);
}
.bulk-header h3 { font-size: 16px; margin: 0; }
.bulk-controls {
  display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  padding: 12px 20px; border-bottom: var(--bw) solid var(--border-subtle);
}
.bulk-filter-tabs { display: flex; gap: 2px; background: var(--bg-secondary); border: var(--bw) solid var(--ink); border-radius: var(--radius); padding: 2px; }
.bulk-tab {
  padding: 4px 10px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer;
  border: none; background: none; color: var(--text-secondary);
}
.bulk-tab.active { background: var(--accent); color: var(--on-accent); font-weight: 700; }
.bulk-actions-row { display: flex; gap: 4px; margin-left: auto; }
.bulk-grid {
  flex: 1; overflow-y: auto; padding: 12px 20px;
  display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 8px;
}
.bulk-card {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 8px; border-radius: 8px; cursor: pointer;
  border: var(--bw) solid var(--border-subtle); background: var(--bg-card);
  transition: border-color 0.15s, background 0.15s;
}
.bulk-card:hover { border-color: var(--ink); }
.bulk-card.bulk-checked { border-color: var(--ink); background: var(--accent-dim); }
.bulk-card-check { flex-shrink: 0; }
.bulk-card-check input[type="checkbox"] { width: 16px; height: 16px; accent-color: var(--accent); cursor: pointer; }
.bulk-card-img { width: 32px; height: 45px; object-fit: contain; border-radius: 4px; flex-shrink: 0; pointer-events: none; -webkit-user-drag: none; user-drag: none; }
.bulk-card-info { flex: 1; min-width: 0; }
.bulk-card-name { font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bulk-card-meta { font-size: 11px; color: var(--text-muted); }
.bulk-footer {
  display: flex; align-items: center; justify-content: space-between; gap: 12px;
  padding: 12px 20px; border-top: var(--bw) solid var(--ink);
}
.bulk-summary { display: flex; flex-direction: column; gap: 2px; }
.bulk-stat { font-size: 12px; color: var(--text-secondary); }
.bulk-cost { font-size: 13px; color: var(--success); font-weight: 700; }

/* Card grid — same as SearchView */
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}
.card-result {
  background: var(--bg-card);
  border: var(--bw) solid var(--ink);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xs);
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.card-result:hover { transform: translate(-1px, -1px); box-shadow: var(--shadow-sm); }
.card-result.selected { box-shadow: 0 0 0 3px var(--accent), var(--shadow-xs); }
.card-img-wrap { position: relative; overflow: hidden; background: #fff; aspect-ratio: 2.5/3.5; border: var(--bw) solid var(--ink); border-radius: 10px; padding: 4px; }
:root[data-theme='dark'] .card-img-wrap { background: var(--bg-card); }
.card-img { width: 100%; height: 100%; object-fit: contain; display: block; transition: transform 0.3s; pointer-events: none; -webkit-user-drag: none; user-drag: none; }
.card-result:hover .card-img { transform: scale(1.04); }
.card-overlay {
  position: absolute; inset: 0; background: rgba(20,20,20,0.55);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 6px; opacity: 0; transition: opacity 0.2s;
}
.card-result:hover .card-overlay { opacity: 1; }

/* Touch: buttons stay hidden until the card is tapped once — art first.
   A second tap (on a button) acts; tapping the card again hides them. */
.card-result.revealed .card-overlay { opacity: 1; }
@media (hover: none) {
  .card-result.revealed .card-overlay { background: rgba(20,20,20,0.45); }
  .card-overlay .btn { font-size: 12px; padding: 6px 12px; }
}
.card-img-placeholder {
  width: 100%; height: 100%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 4px; padding: 12px; text-align: center;
  font-size: 11px; font-weight: 600; color: var(--text-secondary);
  background: var(--bg-secondary);
  border: var(--bw) dashed var(--border-subtle);
}
.card-img-num { font-size: 10px; color: var(--text-muted); }

/* Attack rows */
.attack-row { padding: 6px 0; border-bottom: 1px solid var(--border-subtle); }
.attack-header { display: flex; align-items: center; gap: 8px; }
.attack-cost { font-size: 12px; }
.attack-name { font-weight: 600; flex: 1; }
.attack-damage { font-weight: 700; font-variant-numeric: tabular-nums; }
.attack-text { font-size: 11px; color: var(--text-muted); margin-top: 2px; }
.card-meta { padding: 10px; }
.card-name { font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-price-row { display: flex; align-items: center; justify-content: space-between; margin-top: 4px; }
.card-price { font-size: 12px; font-weight: 800; color: var(--text-primary); font-variant-numeric: tabular-nums; }
.card-rarity { font-size: 9px !important; padding: 1px 5px !important; }

.pagination {
  display: flex; align-items: center; justify-content: center;
  gap: 16px; padding: 20px 0;
}

/* Detail panel — tactile bottom sheet */
.card-detail-panel {
  position: fixed; bottom: 0; left: var(--sidebar-width); right: 0;
  max-height: 70vh; background: var(--bg-primary);
  border-top: var(--bw) solid var(--ink); border-left: var(--bw) solid var(--ink);
  overflow-y: auto; z-index: 100; box-shadow: 0 -6px 24px rgba(20,20,20,0.12);
}
.panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 16px 24px; border-bottom: var(--bw) solid var(--ink);
  position: sticky; top: 0; background: var(--bg-primary); z-index: 1;
}
.panel-header h3 { font-size: 17px; font-weight: 800; }
.panel-body { padding: 20px 24px; }
.panel-top { display: flex; gap: 24px; margin-bottom: 24px; }
.panel-card-img { width: 140px; min-width: 140px; border-radius: 8px; border: var(--bw) solid var(--ink); box-shadow: var(--shadow-sm); pointer-events: none; -webkit-user-drag: none; user-drag: none; }
.panel-card-img-placeholder {
  width: 140px; min-width: 140px; height: 195px; border-radius: 8px;
  background: var(--bg-secondary); border: var(--bw) dashed var(--border-subtle);
  display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 4px;
  font-size: 13px; font-weight: 600; text-align: center; padding: 12px;
}
.panel-card-info { flex: 1; }
.panel-card-set { font-size: 13px; color: var(--text-secondary); margin-bottom: 4px; }
.panel-card-rarity {
  display: inline-block; font-size: 11px; font-weight: 800; color: var(--on-accent);
  background: var(--accent); border: var(--bw) solid var(--on-accent); border-radius: 999px;
  padding: 1px 10px; box-shadow: var(--shadow-pressed);
}
.panel-card-type { font-size: 12px; color: var(--text-muted); margin-top: 6px; }
.price-list-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 8px; }
.price-row { display: flex; align-items: center; justify-content: space-between; padding: 5px 0; border-bottom: var(--bw) solid var(--border-subtle); font-size: 13px; }
.price-variant { color: var(--text-secondary); font-weight: 600; }
.price-val {
  display: inline-block; font-weight: 800; font-variant-numeric: tabular-nums;
  background: var(--accent); border: var(--bw) solid var(--on-accent); border-radius: 999px;
  padding: 1px 10px; font-size: 12px; box-shadow: var(--shadow-pressed); margin: 2px 0;
  color: var(--on-accent);
}
.panel-chart { border-top: var(--bw) solid var(--border-subtle); padding-top: 20px; }

@media (max-width: 768px) {
  .set-browse-header { gap: 10px; }
  .set-browse-title { font-size: 15px; }
  .set-browse-filters { width: 100%; }
  .set-browse-filters .input { flex: 1; width: auto !important; }
  .card-detail-panel {
    left: 0;
    max-height: 85vh;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  }
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
  .sets-grid { grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); gap: 10px; }
}

@media (max-width: 480px) {
  .card-detail-panel { max-height: 90vh; }
  .cards-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
  .card-meta { padding: 8px; }
  .card-name { font-size: 11px; }
}
</style>
