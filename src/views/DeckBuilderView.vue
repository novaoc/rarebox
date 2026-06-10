<template>
  <div class="deck-builder" v-if="deck">
    <!-- Header -->
    <div class="deck-builder-header">
      <div>
        <router-link to="/decks" class="btn btn-ghost btn-sm" style="margin-bottom:8px">← All Decks</router-link>
        <div class="deck-title-row">
          <h2 v-if="!editingName" @click="startEditName">{{ deck.name }} <span class="edit-icon text-muted" style="font-size:13px;margin-left:6px">✎</span></h2>
          <div v-else class="name-edit-row">
            <input v-model="editName" class="input name-input" @keyup.enter="saveName" @keyup.escape="editingName = false" ref="nameInputRef" />
            <button class="btn btn-primary btn-sm" @click="saveName">Save</button>
          </div>
        </div>
        <div class="deck-meta text-muted"><span class="badge badge-info">{{ gameLabel(deck.game) }}</span> {{ deck.cards.length }} unique cards · {{ stats?.totalCards || 0 }} total</div>
      </div>
      <div class="deck-builder-actions">
        <button
          class="btn btn-ghost btn-sm"
          @click="refreshPrices"
          :disabled="refreshing"
          v-if="deck.cards.some(c => !c.price)"
          title="Fetch missing card prices"
        >
          <span v-if="refreshing" class="spinner spinner-sm"></span>
          <span v-else>↻ Refresh Prices</span>
        </button>
        <button class="btn btn-danger btn-sm" @click="confirmDelete = true">Delete</button>
      </div>
    </div>

    <div class="deck-builder-layout">
      <!-- Left: Card search -->
      <div class="deck-search-panel">
        <div class="search-bar-wrapper">
          <div class="search-input-wrap">
            <span class="search-icon">⌕</span>
            <input
              v-model="query"
              class="input search-input"
              :placeholder="'Search ' + gameLabel(deck?.game) + ' cards...'"
              @input="onInput"
              @keyup.enter="doSearch"
            />
            <button v-if="query" class="btn btn-ghost btn-icon search-clear" @click="clearSearch">✕</button>
          </div>
          <button class="btn btn-primary btn-sm" @click="doSearch" :disabled="searching">
            <span v-if="searching" class="spinner spinner-sm"></span>
            <span v-else>Search</span>
          </button>
        </div>

        <!-- Search results -->
        <div v-if="searchResults.length > 0" class="search-results">
          <div
            v-for="card in searchResults"
            :key="card.id"
            class="search-result"
            @click="addCard(card)"
          >
            <img :src="card.images?.small" class="search-result-img" loading="lazy" />
            <div class="search-result-info">
              <div class="search-result-name">{{ card.name }}</div>
              <div class="search-result-set">{{ card.set }} · #{{ card.number }}</div>
            </div>
            <div class="search-result-price text-accent" v-if="getPrice(card) != null">${{ getPrice(card).toFixed(2) }}</div>
            <div class="search-result-price text-muted" v-else>—</div>
            <button class="btn btn-primary btn-icon btn-sm add-btn" @click.stop="addCard(card)">+</button>
          </div>
        </div>
        <div v-else-if="searched && !searching" class="text-muted" style="font-size:13px;padding:12px 0">No cards found</div>
      </div>

      <!-- Right: Deck list -->
      <div class="deck-list-panel">
        <!-- Stats bar -->
        <div class="deck-stats-bar" v-if="deck.cards.length > 0">
          <div class="deck-stat-pill" :class="stats?.neededCards > 0 ? 'needed' : 'complete'">
            <span class="pill-num">{{ stats?.neededCards || 0 }}</span>
            <span class="pill-label">Needed</span>
          </div>
          <div class="deck-stat-pill owned">
            <span class="pill-num">{{ stats?.ownedCards || 0 }}</span>
            <span class="pill-label">Owned</span>
          </div>
          <div class="deck-stat-pill cost">
            <span class="pill-num">${{ (stats?.totalCost || 0).toFixed(2) }}</span>
            <span class="pill-label">To Buy</span>
          </div>
          <div class="deck-stat-pill pct" v-if="stats">
            <div class="pill-progress">
              <div class="pill-bar" :style="{ width: stats.completionPct + '%' }" :class="stats.isComplete ? 'complete' : ''"></div>
            </div>
            <span class="pill-label">{{ stats.completionPct }}%</span>
          </div>
        </div>

        <!-- Deck cards -->
        <div v-if="deck.cards.length === 0" class="deck-empty">
          <p class="text-muted">Search for cards on the left to add them to your deck.</p>
        </div>

        <div v-else class="deck-cards-list">
          <div v-for="card in sortedCards" :key="card.cardId" class="deck-card-row">
            <img v-if="card.image" :src="card.image" class="deck-card-img" loading="lazy" @error="$event.target.style.display='none'" />
            <div class="deck-card-info">
              <div class="deck-card-name">{{ card.name }}</div>
              <div class="deck-card-set">{{ card.setName }} · #{{ card.number }}</div>
            </div>
            <div class="deck-card-owned" :title="ownedTitle(card)">
              <span v-if="getOwnedQty(card.cardId) >= card.quantity" class="badge badge-success">✓ Owned</span>
              <span v-else-if="getOwnedQty(card.cardId) > 0" class="badge badge-accent">{{ getOwnedQty(card.cardId) }}/{{ card.quantity }}</span>
              <span v-else class="badge badge-danger">Need</span>
            </div>
            <div class="deck-card-price font-mono">
              <span v-if="card.price">${{ (card.price * card.quantity).toFixed(2) }}</span>
              <span v-else class="text-muted">—</span>
            </div>
            <div class="deck-card-qty">
              <button class="btn btn-ghost btn-icon btn-sm" @click="changeQty(card, -1)">−</button>
              <span class="qty-num">{{ card.quantity }}</span>
              <button class="btn btn-ghost btn-icon btn-sm" @click="changeQty(card, 1)">+</button>
            </div>
            <button class="btn btn-ghost btn-icon btn-sm" @click="removeCard(card.cardId)" style="color:var(--danger)">✕</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Delete confirm -->
    <transition name="fade">
      <div v-if="confirmDelete" class="modal-overlay" @click.self="confirmDelete = false">
        <div class="modal" style="max-width:400px">
          <div class="modal-header">
            <h3>Delete Deck</h3>
            <button class="btn btn-ghost btn-icon" @click="confirmDelete = false">✕</button>
          </div>
          <div class="modal-body">
            <p class="text-secondary">Delete <strong>{{ deck.name }}</strong>? This cannot be undone.</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="confirmDelete = false">Cancel</button>
            <button class="btn btn-danger" @click="deleteDeck">Delete</button>
          </div>
        </div>
      </div>
    </transition>
  </div>

  <div v-else class="empty-state">
    <div class="icon">🃏</div>
    <h3>Deck not found</h3>
    <router-link to="/decks" class="btn btn-primary mt-3">All Decks</router-link>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDeckStore } from '../stores/decks'
import { usePortfolioStore } from '../stores/portfolio'
import { multiSearch } from '../services/tcg/multiSearch'
import { getMarketPrice } from '../services/pokemonApi'

const route = useRoute()
const router = useRouter()
const deckStore = useDeckStore()
const portfolioStore = usePortfolioStore()

const GAME_LABELS = {
  pokemon: 'Pokémon', mtg: 'MTG', lorcana: 'Lorcana',
  'one-piece': 'One Piece', riftbound: 'Riftbound', yugioh: 'Yu-Gi-Oh',
}

const deck = computed(() => deckStore.decks.find(d => d.id === route.params.id))
const stats = computed(() => deck.value ? deckStore.getDeckStats(deck.value.id) : null)

const editingName = ref(false)
const editName = ref('')
const nameInputRef = ref(null)
const confirmDelete = ref(false)
const refreshing = ref(false)

async function refreshPrices() {
  refreshing.value = true
  await deckStore.refreshDeckPrices(deck.value.id)
  refreshing.value = false
}

function startEditName() {
  editName.value = deck.value.name
  editingName.value = true
  nextTick(() => nameInputRef.value?.focus())
}

function saveName() {
  if (editName.value.trim()) {
    deckStore.updateDeck(deck.value.id, { name: editName.value.trim() })
  }
  editingName.value = false
}

function deleteDeck() {
  deckStore.deleteDeck(deck.value.id)
  router.push('/decks')
}

// Card search
const query = ref('')
const searchResults = ref([])
const searching = ref(false)
const searched = ref(false)
let debounceTimer = null

function onInput() {
  clearTimeout(debounceTimer)
  if (query.value.length >= 2) {
    debounceTimer = setTimeout(doSearch, 500)
  }
}

async function doSearch() {
  if (!query.value.trim()) return
  searching.value = true
  searched.value = true
  try {
    const result = await multiSearch(query.value, {
      page: 1,
      pageSize: 20,
      providers: [deck.value?.game || 'pokemon'],
    })
    searchResults.value = result.cards || []
  } catch {
    searchResults.value = []
  } finally {
    searching.value = false
  }
}

function clearSearch() {
  query.value = ''
  searchResults.value = []
  searched.value = false
}

function getPrice(card) {
  if (card.price != null) return card.price
  const r = getMarketPrice(card)
  return r?.price || null
}

function addCard(card) {
  deckStore.addCardToDeck(deck.value.id, card)
}

// Deck card management
const sortedCards = computed(() => {
  if (!deck.value) return []
  return [...deck.value.cards].sort((a, b) => {
    const aOwned = getOwnedQty(a.cardId) >= a.quantity
    const bOwned = getOwnedQty(b.cardId) >= b.quantity
    if (aOwned !== bOwned) return aOwned ? 1 : -1
    return a.name.localeCompare(b.name)
  })
})

const ownedMap = computed(() => {
  const map = {}
  for (const p of portfolioStore.portfolios) {
    for (const item of p.items) {
      if (item.type === 'card' && item.cardId) {
        map[item.cardId] = (map[item.cardId] || 0) + (item.quantity || 1)
      }
    }
  }
  return map
})

function getOwnedQty(cardId) {
  return ownedMap.value[cardId] || 0
}

function ownedTitle(card) {
  const owned = getOwnedQty(card.cardId)
  if (owned >= card.quantity) return `You own ${owned}`
  if (owned > 0) return `You own ${owned} of ${card.quantity}`
  return 'Not in your collection'
}

function changeQty(card, delta) {
  deckStore.updateCardQuantity(deck.value.id, card.cardId, card.quantity + delta)
}

function removeCard(cardId) {
  deckStore.removeCardFromDeck(deck.value.id, cardId)
}

function gameLabel(game) {
  return GAME_LABELS[game] || game
}
</script>

<style scoped>
.deck-builder { max-width: 1200px; margin: 0 auto; }

.deck-builder-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}
.deck-title-row h2 { font-size: 22px; font-weight: 700; cursor: pointer; }
.deck-title-row h2:hover .edit-icon { opacity: 1; }
.edit-icon { opacity: 0; transition: opacity 0.15s; }
.name-edit-row { display: flex; gap: 8px; align-items: center; }
.name-input { width: 280px; font-size: 18px; font-weight: 600; }
.deck-meta { font-size: 12px; margin-top: 4px; }

.deck-builder-layout {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

/* Search panel */
.deck-search-panel {
  background: var(--bg-card);
  border: var(--bw) solid var(--ink);
  border-radius: var(--radius-lg);
  padding: 16px;
  box-shadow: var(--shadow-sm);
  align-self: flex-start;
}
.search-bar-wrapper { display: flex; gap: 8px; margin-bottom: 12px; }
.search-input-wrap {
  flex: 1; position: relative; display: flex; align-items: center;
}
.search-icon {
  position: absolute; left: 10px; font-size: 14px; color: var(--text-muted); pointer-events: none;
}
.search-input { padding-left: 30px; padding-right: 30px; font-size: 13px; }
.search-clear { position: absolute; right: 2px; }

.search-results { display: flex; flex-direction: column; gap: 2px; max-height: 500px; overflow-y: auto; }
.search-result {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px; border-radius: var(--radius); cursor: pointer;
  transition: background 0.12s;
}
.search-result:hover { background: var(--bg-hover); }
.search-result-img { width: 32px; height: 44px; object-fit: contain; border-radius: 3px; flex-shrink: 0; }
.search-result-info { flex: 1; min-width: 0; }
.search-result-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.search-result-set { font-size: 10px; color: var(--text-muted); }
.search-result-price { font-size: 12px; font-weight: 700; flex-shrink: 0; margin-right: 4px; }
.add-btn { flex-shrink: 0; }

/* Deck list panel */
.deck-list-panel {
  background: var(--bg-card);
  border: var(--bw) solid var(--ink);
  border-radius: var(--radius-lg);
  padding: 16px;
  box-shadow: var(--shadow-sm);
}

.deck-stats-bar {
  display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;
}
.deck-stat-pill {
  display: flex; flex-direction: column; align-items: center;
  padding: 8px 14px; border-radius: var(--radius);
  background: var(--bg-primary); border: var(--bw) solid var(--ink);
  box-shadow: var(--shadow-pressed);
  min-width: 64px;
}
.deck-stat-pill.needed { background: var(--accent-dim); }
.deck-stat-pill.needed .pill-num { color: var(--ink); }
.deck-stat-pill.complete { background: var(--success-dim); }
.deck-stat-pill.owned { background: var(--success-dim); }
.deck-stat-pill.owned .pill-num { color: var(--ink); }
.deck-stat-pill.cost { background: var(--accent); }
.deck-stat-pill.cost .pill-num { color: var(--ink); }
.deck-stat-pill.pct { min-width: 80px; }
.pill-num { font-size: 18px; font-weight: 700; font-variant-numeric: tabular-nums; }
.pill-label { font-size: 9px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); margin-top: 2px; }
.pill-progress { width: 100%; height: 8px; background: var(--bg-card); border: 1.5px solid var(--ink); border-radius: 4px; overflow: hidden; margin-bottom: 4px; }
.pill-bar { height: 100%; background: var(--success); transition: width 0.3s; }
.pill-bar.complete { background: var(--success); }

.deck-empty { padding: 40px 20px; text-align: center; }

.deck-cards-list { display: flex; flex-direction: column; gap: 4px; }
.deck-card-row {
  display: flex; align-items: center; gap: 10px;
  padding: 8px 10px; border-radius: var(--radius);
  transition: background 0.12s;
}
.deck-card-row:hover { background: var(--bg-hover); }
.deck-card-img { width: 32px; height: 44px; object-fit: contain; border-radius: 3px; flex-shrink: 0; }
.deck-card-info { flex: 1; min-width: 0; }
.deck-card-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.deck-card-set { font-size: 10px; color: var(--text-muted); }
.deck-card-owned { flex-shrink: 0; }
.deck-card-price { font-size: 13px; font-weight: 700; flex-shrink: 0; min-width: 60px; text-align: right; }
.deck-card-qty { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
.qty-num { font-size: 14px; font-weight: 700; min-width: 20px; text-align: center; font-variant-numeric: tabular-nums; }

@media (max-width: 768px) {
  .deck-builder-layout { grid-template-columns: 1fr; }
  .deck-builder-header { flex-direction: column; gap: 12px; }
  .deck-stats-bar { gap: 6px; }
  .deck-card-qty { min-width: auto; }
  .deck-card-price { min-width: auto; }
  .deck-card-owned { display: none; }
}
</style>
