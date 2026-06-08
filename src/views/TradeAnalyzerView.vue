<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import CameraViewfinder from '../components/scanner/CameraViewfinder.vue'
import { useTradeStore } from '../stores/trade'
import { multiSearch } from '../services/tcg/multiSearch'
import { scanCard } from '../utils/scanPipeline'

interface SearchResult {
  id: string
  name: string
  set: string
  number: string
  image: string
  price: number | null
  game: string
}

const tradeStore = useTradeStore()

const showScanner = ref(false)
const showSearch = ref<'A' | 'B' | null>(null)
const showScanReview = ref(false)
const activeSide = ref<'A' | 'B'>('A')
const searchQuery = ref('')
const searchResults = ref<SearchResult[]>([])
const capturedPhoto = ref('')
const scanError = ref('')
const searchBusy = ref(false)
const scanStatus = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null

const searchCache = new Map<string, SearchResult[]>()

const deltaFormatted = computed(() => {
  const d = tradeStore.priceDelta
  const abs = Math.abs(d)
  if (abs < 0.01) return '$0.00'
  const sign = d > 0 ? '+' : '-'
  return `${sign}$${abs.toFixed(2)}`
})

const deltaLabel = computed(() => {
  const d = tradeStore.priceDelta
  if (d > 0.01) return "You're winning"
  if (d < -0.01) return "You're losing"
  return 'Even trade'
})

function openScanner(side: 'A' | 'B') {
  activeSide.value = side
  showSearch.value = null
  showScanner.value = true
}

function openSearch(side: 'A' | 'B') {
  activeSide.value = side
  showScanner.value = false
  showSearch.value = side
  searchQuery.value = ''
  searchResults.value = []
}

function onCapture(imageData: string) {
  showScanner.value = false
  scanStatus.value = ''
  capturedPhoto.value = imageData
  showScanReview.value = true
  searchQuery.value = ''
  searchResults.value = []

  // Run OCR in background — if it completes, fill in the search query
  scanCard(imageData).then(result => {
    if (result.candidates.length > 0) {
      // Found cards — pre-fill search with best match name
      const best = result.candidates[0]
      searchQuery.value = best.name
      doSearch()
    } else if (result.ocrText.length >= 5) {
      const q = result.ocrText.replace(/[^a-zA-Z\s]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60)
      if (q.length >= 3) {
        searchQuery.value = q
        doSearch()
      }
    }
  }).catch(() => {
    // OCR failed silently — user can type manually
  })
}

function addScannedCard(card: SearchResult) {
  tradeStore.addToSide(activeSide.value, {
    id: card.id,
    name: card.name,
    setName: card.set,
    number: card.number,
    imageUrl: capturedPhoto.value,
    marketPrice: card.price || 0,
    game: card.game,
  })
  showScanReview.value = false
  capturedPhoto.value = ''
  searchQuery.value = ''
  searchResults.value = []
}

function cancelScan() {
  showScanReview.value = false
  capturedPhoto.value = ''
  searchQuery.value = ''
  searchResults.value = []
}

function dismissError() {
  scanError.value = ''
}

function onScannerClose() {
  showScanner.value = false
  scanStatus.value = ''
}

function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer)
  const q = searchQuery.value.trim()
  if (q.length < 2) { searchResults.value = []; return }
  if (searchCache.has(q)) {
    searchResults.value = searchCache.get(q)!
    return
  }
  searchTimer = setTimeout(doSearch, 150)
}

async function doSearch() {
  const q = searchQuery.value.trim()
  if (q.length < 2) return
  searchBusy.value = true
  try {
    const res = await multiSearch(q, { page: 1, pageSize: 15 })
    const cards = (res.cards || []) as SearchResult[]
    searchCache.set(q, cards)
    if (searchCache.size > 50) {
      const first = searchCache.keys().next().value
      if (first) searchCache.delete(first)
    }
    searchResults.value = cards
  } catch {
    searchResults.value = []
  } finally {
    searchBusy.value = false
  }
}

function addCard(card: SearchResult) {
  tradeStore.addToSide(activeSide.value, {
    id: card.id,
    name: card.name,
    setName: card.set,
    number: card.number,
    imageUrl: card.image,
    marketPrice: card.price || 0,
    game: card.game,
  })
  searchQuery.value = ''
  searchResults.value = []
}

onMounted(async () => {
  if (!tradeStore.initialized) await tradeStore.init()
})
</script>

<template>
  <!-- Scanner overlay -->
  <Teleport to="body">
    <transition name="fade">
      <div v-if="showScanner" class="modal-overlay" style="padding:0;align-items:stretch;background:#000" @click.self="onScannerClose">
        <CameraViewfinder @capture="onCapture" @close="onScannerClose" />
        <div v-if="scanStatus" class="scan-status-overlay">
          <div class="spinner" />
          <span>{{ scanStatus }}</span>
        </div>
      </div>
    </transition>
  </Teleport>

  <div class="trade-analyzer">
    <!-- Header -->
    <div class="trade-header">
      <div class="flex items-center gap-3">
        <router-link
          to="/trade"
          aria-label="Back"
          class="btn btn-ghost btn-icon"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </router-link>
        <h1 class="section-title">Trade Analyzer</h1>
      </div>

      <!-- Delta badge -->
      <div
        v-if="Math.abs(tradeStore.priceDelta) >= 0.01"
        class="badge"
        :class="tradeStore.priceDelta > 0 ? 'badge-success' : 'badge-danger'"
      >
        {{ deltaFormatted }}
      </div>
      <div v-else class="badge badge-accent">$0.00</div>
    </div>

    <!-- Delta detail bar -->
    <div
      class="delta-bar"
      :class="tradeStore.priceDelta > 0.01 ? 'delta-win' : tradeStore.priceDelta < -0.01 ? 'delta-lose' : 'delta-even'"
    >
      <span class="text-secondary" style="font-size:13px">{{ deltaLabel }}</span>
      <span class="font-bold font-mono">{{ deltaFormatted }}</span>
    </div>

    <!-- Split screen -->
    <div class="trade-split">

      <!-- Side A -->
      <div class="card side-card">
        <div class="side-header">
          <div class="flex items-center gap-2">
            <span class="badge badge-accent">Side A</span>
            <span class="text-secondary" style="font-size:13px">My Cards</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="font-bold font-mono">${{ tradeStore.sideA.totalValue.toFixed(2) }}</span>
            <button
              v-if="tradeStore.sideA.items.length > 0"
              class="btn btn-ghost btn-icon btn-sm"
              style="color:var(--danger)"
              aria-label="Clear all Side A cards"
              @click="tradeStore.clearSide('A')"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        <hr class="divider" />

        <!-- Card list -->
        <div v-if="tradeStore.sideA.items.length === 0" class="empty-state" style="padding:40px 20px">
          <div class="icon">📦</div>
          <h3>No cards added</h3>
          <p>Scan or search to add cards to Side A</p>
        </div>

        <div v-else class="card-list">
          <div
            v-for="card in tradeStore.sideA.items"
            :key="card.tradeId"
            class="card-row"
          >
            <img
              :src="card.imageUrl"
              :alt="card.name"
              class="card-thumb"
              draggable="false"
            />
            <div class="card-row-info">
              <div class="card-row-name">{{ card.name }}</div>
              <div class="card-row-sub">{{ card.setName }} &middot; {{ card.number }}</div>
            </div>
            <div class="text-right" style="flex-shrink:0">
              <div class="font-bold font-mono">${{ card.marketPrice.toFixed(2) }}</div>
            </div>
            <button
              class="btn btn-ghost btn-icon btn-sm"
              style="color:var(--danger);flex-shrink:0"
              :aria-label="`Remove ${card.name}`"
              @click="tradeStore.removeFromSide('A', card.tradeId)"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <hr class="divider" />

        <!-- Search panel -->
        <div v-if="showSearch === 'A'" class="search-panel">
          <input
            v-model="searchQuery"
            @input="onSearchInput"
            placeholder="Search cards to add…"
            class="input"
          />
          <div v-if="searchBusy" class="spinner spinner-sm mt-2" />
          <div v-if="searchResults.length > 0" class="search-results">
            <div
              v-for="card in searchResults"
              :key="card.id"
              class="search-result-row"
              @click="addCard(card)"
            >
              <img :src="card.image" class="search-result-thumb" />
              <div class="search-result-info">
                <div class="search-result-name">{{ card.name }}</div>
                <div class="search-result-sub">{{ card.set }} &middot; #{{ card.number }}</div>
              </div>
              <span class="font-bold font-mono" style="font-size:12px;flex-shrink:0">${{ (card.price || 0).toFixed(2) }}</span>
            </div>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="side-actions">
          <button
            class="btn btn-secondary"
            style="flex:1"
            @click="openScanner('A')"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Scan
          </button>
          <button
            class="btn btn-secondary"
            style="flex:1"
            @click="openSearch('A')"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
            Search
          </button>
        </div>
      </div>

      <!-- VS divider -->
      <div class="vs-divider">
        <div class="vs-line" />
        <span class="badge badge-accent">VS</span>
        <div class="vs-line" />
      </div>

      <!-- Side B -->
      <div class="card side-card">
        <div class="side-header">
          <div class="flex items-center gap-2">
            <span class="badge badge-info">Side B</span>
            <span class="text-secondary" style="font-size:13px">Their Cards</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="font-bold font-mono">${{ tradeStore.sideB.totalValue.toFixed(2) }}</span>
            <button
              v-if="tradeStore.sideB.items.length > 0"
              class="btn btn-ghost btn-icon btn-sm"
              style="color:var(--danger)"
              aria-label="Clear all Side B cards"
              @click="tradeStore.clearSide('B')"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        <hr class="divider" />

        <!-- Card list -->
        <div v-if="tradeStore.sideB.items.length === 0" class="empty-state" style="padding:40px 20px">
          <div class="icon">📦</div>
          <h3>No cards added</h3>
          <p>Scan or search to add cards to Side B</p>
        </div>

        <div v-else class="card-list">
          <div
            v-for="card in tradeStore.sideB.items"
            :key="card.tradeId"
            class="card-row"
          >
            <img
              :src="card.imageUrl"
              :alt="card.name"
              class="card-thumb"
              draggable="false"
            />
            <div class="card-row-info">
              <div class="card-row-name">{{ card.name }}</div>
              <div class="card-row-sub">{{ card.setName }} &middot; {{ card.number }}</div>
            </div>
            <div class="text-right" style="flex-shrink:0">
              <div class="font-bold font-mono">${{ card.marketPrice.toFixed(2) }}</div>
            </div>
            <button
              class="btn btn-ghost btn-icon btn-sm"
              style="color:var(--danger);flex-shrink:0"
              :aria-label="`Remove ${card.name}`"
              @click="tradeStore.removeFromSide('B', card.tradeId)"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <hr class="divider" />

        <!-- Search panel -->
        <div v-if="showSearch === 'B'" class="search-panel">
          <input
            v-model="searchQuery"
            @input="onSearchInput"
            placeholder="Search cards to add…"
            class="input"
          />
          <div v-if="searchBusy" class="spinner spinner-sm mt-2" />
          <div v-if="searchResults.length > 0" class="search-results">
            <div
              v-for="card in searchResults"
              :key="card.id"
              class="search-result-row"
              @click="addCard(card)"
            >
              <img :src="card.image" class="search-result-thumb" />
              <div class="search-result-info">
                <div class="search-result-name">{{ card.name }}</div>
                <div class="search-result-sub">{{ card.set }} &middot; #{{ card.number }}</div>
              </div>
              <span class="font-bold font-mono" style="font-size:12px;flex-shrink:0">${{ (card.price || 0).toFixed(2) }}</span>
            </div>
          </div>
        </div>

        <!-- Action buttons -->
        <div class="side-actions">
          <button
            class="btn btn-secondary"
            style="flex:1"
            @click="openScanner('B')"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Scan
          </button>
          <button
            class="btn btn-secondary"
            style="flex:1"
            @click="openSearch('B')"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
            </svg>
            Search
          </button>
        </div>
      </div>

    </div>

    <!-- Scan error notification -->
    <transition name="fade">
      <div v-if="scanError" class="scan-error" @click="dismissError">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span>{{ scanError }}</span>
        <button class="btn btn-ghost btn-icon btn-sm" style="flex-shrink:0;color:var(--danger)" @click.stop="dismissError">✕</button>
      </div>
    </transition>

    <!-- Scan review dialog -->
    <transition name="fade">
      <div v-if="showScanReview" class="modal-overlay" @click.self="cancelScan">
        <div class="modal" style="max-width:480px">
          <div class="modal-header">
            <h3>Add Scanned Card</h3>
            <button class="btn btn-ghost btn-icon" @click="cancelScan">✕</button>
          </div>
          <div class="modal-body">
            <!-- Captured photo -->
            <div v-if="capturedPhoto" class="scan-photo-preview">
              <img :src="capturedPhoto" alt="Captured card" />
            </div>

            <!-- Search input -->
            <div class="form-group">
              <label class="form-label">Card Name</label>
              <input
                v-model="searchQuery"
                @input="onSearchInput"
                placeholder="Type card name…"
                class="input"
                autofocus
              />
            </div>

            <!-- Search results -->
            <div v-if="searchBusy" class="spinner spinner-sm mt-2" />
            <div v-if="searchResults.length > 0" class="scan-candidate-list">
              <div
                v-for="card in searchResults"
                :key="card.id"
                class="scan-candidate-row"
                @click="addScannedCard(card)"
              >
                <img :src="card.image" class="search-result-thumb" />
                <div class="search-result-info">
                  <div class="search-result-name">{{ card.name }}</div>
                  <div class="search-result-sub">{{ card.set }} &middot; #{{ card.number }}</div>
                </div>
                <span class="font-bold font-mono" style="font-size:12px;flex-shrink:0">
                  ${{ (card.price || 0).toFixed(2) }}
                </span>
              </div>
            </div>

            <p v-if="searchQuery.length >= 2 && searchResults.length === 0 && !searchBusy" class="text-secondary mt-2" style="font-size:13px">
              No cards found. Try a different name.
            </p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="cancelScan">Cancel</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Reset button -->
    <div v-if="tradeStore.sideA.items.length > 0 || tradeStore.sideB.items.length > 0" class="mt-4 text-center">
      <button class="btn btn-secondary" @click="tradeStore.resetTrade()">Reset Trade</button>
    </div>
  </div>
</template>

<style scoped>
.trade-analyzer {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 16px 32px;
}

.trade-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 0;
  gap: 12px;
}

.delta-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 10px 16px;
  border-radius: var(--radius-lg);
  margin-bottom: 20px;
  font-size: 14px;
}
.delta-win {
  background: var(--success-dim);
  border: 1px solid rgba(63, 185, 80, 0.3);
}
.delta-win .font-bold { color: var(--success); }
.delta-lose {
  background: var(--danger-dim);
  border: 1px solid rgba(248, 81, 73, 0.3);
}
.delta-lose .font-bold { color: var(--danger); }
.delta-even {
  background: var(--accent-dim);
  border: 1px solid rgba(245, 166, 35, 0.3);
}
.delta-even .font-bold { color: var(--accent); }

.trade-split {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 16px;
  align-items: start;
}

.side-card {
  padding: 16px;
}

.side-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.card-list {
  display: flex;
  flex-direction: column;
}

.card-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid var(--border-subtle);
}
.card-row:last-child { border-bottom: none; }

.card-thumb {
  width: 40px;
  height: 56px;
  border-radius: var(--radius);
  object-fit: cover;
  flex-shrink: 0;
}

.card-row-info {
  flex: 1;
  min-width: 0;
}

.card-row-name {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-row-sub {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 1px;
}

.side-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.vs-divider {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding-top: 80px;
}

.vs-line {
  width: 1px;
  flex: 1;
  background: var(--border);
  min-height: 20px;
}

/* Search panel */
.search-panel {
  margin-top: 4px;
}

.search-results {
  margin-top: 8px;
  max-height: 240px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-primary);
}

.search-result-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  cursor: pointer;
  transition: background 0.15s;
  border-bottom: 1px solid var(--border-subtle);
}
.search-result-row:last-child { border-bottom: none; }
.search-result-row:hover { background: var(--bg-hover); }

.search-result-thumb {
  width: 28px;
  height: 40px;
  border-radius: 4px;
  object-fit: cover;
  flex-shrink: 0;
}

.search-result-info {
  flex: 1;
  min-width: 0;
}

.search-result-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-result-sub {
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 1px;
}

.scan-photo-preview {
  margin-bottom: 16px;
  border-radius: var(--radius);
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--bg-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  max-height: 200px;
}
.scan-photo-preview img {
  max-width: 100%;
  max-height: 200px;
  object-fit: contain;
}

.scan-candidate-list {
  max-height: 280px;
  overflow-y: auto;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-primary);
}

.scan-candidate-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  cursor: pointer;
  transition: background 0.15s;
  border-bottom: 1px solid var(--border-subtle);
}
.scan-candidate-row:last-child { border-bottom: none; }
.scan-candidate-row:hover { background: var(--bg-hover); }

.scan-error {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  margin-bottom: 16px;
  background: var(--danger-dim);
  border: 1px solid rgba(248, 81, 73, 0.3);
  border-radius: var(--radius-lg);
  color: var(--danger);
  font-size: 13px;
  cursor: pointer;
}

.scan-status-overlay {
  position: absolute;
  inset: 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: rgba(0,0,0,0.85);
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 500;
}

/* Responsive */
@media (max-width: 768px) {
  .trade-split {
    grid-template-columns: 1fr;
  }
  .vs-divider {
    flex-direction: row;
    padding-top: 0;
    gap: 12px;
  }
  .vs-line {
    width: auto;
    height: 1px;
    flex: 1;
    min-height: 0;
  }
  .trade-analyzer {
    padding: 0 12px 24px;
  }
}

@media (max-width: 640px) {
  .trade-header {
    padding: 12px 0;
  }
  .delta-bar {
    font-size: 13px;
    padding: 8px 12px;
  }
  .side-card {
    padding: 12px;
  }
  .card-thumb {
    width: 36px;
    height: 50px;
  }
  .card-row-name {
    font-size: 13px;
  }
  .side-actions {
    flex-direction: column;
  }
  .side-actions .btn {
    justify-content: center;
  }
}
</style>
