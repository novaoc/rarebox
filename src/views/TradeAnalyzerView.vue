<script setup>
import { ref, computed, onMounted } from 'vue'
import { useTradeStore } from '../stores/trade'
import { multiSearch } from '../services/tcg/multiSearch'

const tradeStore = useTradeStore()

const activeSide = ref('A')
const searchQuery = ref('')
const searchResults = ref([])
const searchBusy = ref(false)
let searchTimer = null

const deltaFormatted = computed(() => {
  const delta = tradeStore.priceDelta
  const abs = Math.abs(delta)
  if (abs < 0.01) return '$0.00'
  const sign = delta > 0 ? '+' : '-'
  return `${sign}$${abs.toFixed(2)}`
})

const deltaClass = computed(() => {
  const d = tradeStore.priceDelta
  if (d > 0.01) return 'text-rb-success'
  if (d < -0.01) return 'text-rb-danger'
  return 'text-rb-accent'
})

const deltaBgClass = computed(() => {
  const d = tradeStore.priceDelta
  if (d > 0.01) return 'bg-rb-success-dim'
  if (d < -0.01) return 'bg-rb-danger-dim'
  return 'bg-rb-accent-dim'
})

const deltaLabel = computed(() => {
  const d = tradeStore.priceDelta
  if (d > 0.01) return "You're winning"
  if (d < -0.01) return "You're losing"
  return 'Even trade'
})

function onSearchInput() {
  clearTimeout(searchTimer)
  const q = searchQuery.value.trim()
  if (q.length < 2) { searchResults.value = []; return }
  searchTimer = setTimeout(doSearch, 300)
}

async function doSearch() {
  const q = searchQuery.value.trim()
  if (q.length < 2) return
  searchBusy.value = true
  try {
    const res = await multiSearch(q, { page: 1, pageSize: 20 })
    searchResults.value = res.cards || []
  } catch {
    searchResults.value = []
  } finally {
    searchBusy.value = false
  }
}

function openSearch(side) {
  activeSide.value = side
  searchQuery.value = ''
  searchResults.value = []
}

function addCard(card) {
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
  <div class="min-h-screen bg-rb-bg">
    <!-- Header -->
    <div class="sticky top-0 z-40 bg-rb-surface border-b border-rb-border px-4 py-3">
      <div class="max-w-5xl mx-auto flex items-center justify-between">
        <div class="flex items-center gap-3">
          <router-link
            to="/trade"
            aria-label="Back to trade landing"
            class="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-rb-hover transition-colors text-rb-text-secondary"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </router-link>
          <h1 class="text-lg font-semibold text-rb-text">Trade Analyzer</h1>
        </div>

        <div
          class="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold"
          :class="[deltaBgClass, deltaClass]"
        >
          <svg
            v-if="tradeStore.priceDelta > 0.01"
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
          <svg
            v-else-if="tradeStore.priceDelta < -0.01"
            class="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
          <span>{{ deltaFormatted }}</span>
        </div>
      </div>
    </div>

    <!-- Delta detail bar -->
    <div class="max-w-5xl mx-auto px-4 pt-3">
      <div
        class="flex items-center justify-center gap-3 py-2 px-4 rounded-lg text-sm"
        :class="deltaBgClass"
      >
        <span class="text-rb-text-secondary">{{ deltaLabel }}</span>
        <span class="font-semibold" :class="deltaClass">{{ deltaFormatted }}</span>
      </div>
    </div>

    <!-- Split screen -->
    <div class="max-w-5xl mx-auto px-4 py-4">
      <div class="flex flex-col md:flex-row gap-4">

        <!-- Side A: My Cards -->
        <div class="flex-1 min-w-0">
          <div class="bg-rb-card rounded-xl border border-rb-border overflow-hidden">
            <div class="flex items-center justify-between px-4 py-3 border-b border-rb-border">
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold uppercase tracking-wider text-rb-accent">Side A</span>
                <span class="text-sm text-rb-text-secondary">My Cards</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold text-rb-text">${{ tradeStore.sideA.totalValue.toFixed(2) }}</span>
                <button
                  v-if="tradeStore.sideA.items.length > 0"
                  aria-label="Clear all Side A cards"
                  class="text-rb-text-muted hover:text-rb-danger transition-colors"
                  @click="tradeStore.clearSide('A')"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Card list -->
            <div class="divide-y divide-rb-border">
              <div
                v-if="tradeStore.sideA.items.length === 0"
                class="flex flex-col items-center justify-center py-12 text-center"
              >
                <div class="text-3xl mb-2">📦</div>
                <p class="text-rb-text-secondary text-sm">No cards added</p>
                <p class="text-rb-text-muted text-xs mt-1">Search below to add cards</p>
              </div>
              <div
                v-for="card in tradeStore.sideA.items"
                :key="card.tradeId"
                class="flex items-center gap-3 px-4 py-3 hover:bg-rb-hover transition-colors"
              >
                <img
                  :src="card.imageUrl"
                  :alt="card.name"
                  class="w-10 h-14 rounded object-cover flex-shrink-0"
                  draggable="false"
                />
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-rb-text truncate">{{ card.name }}</p>
                  <p class="text-xs text-rb-text-muted">{{ card.setName }} · {{ card.number }}</p>
                </div>
                <div class="text-right flex-shrink-0">
                  <p class="text-sm font-semibold text-rb-text">${{ card.marketPrice.toFixed(2) }}</p>
                </div>
                <button
                  class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded text-rb-text-muted hover:text-rb-danger hover:bg-rb-danger-dim transition-colors"
                  @click="tradeStore.removeFromSide('A', card.tradeId)"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Search bar (shown only when Side A is active) -->
            <div class="px-4 py-3 border-t border-rb-border" v-if="activeSide === 'A'">
              <input
                v-model="searchQuery"
                @input="onSearchInput"
                placeholder="Search cards to add to Side A..."
                class="input w-full"
              />
              <div v-if="searchBusy" class="mt-2 text-xs text-rb-text-muted">Searching...</div>
              <div v-if="searchResults.length > 0" class="mt-2 max-h-48 overflow-y-auto divide-y divide-rb-border rounded-lg border border-rb-border">
                <div
                  v-for="card in searchResults"
                  :key="card.id"
                  class="flex items-center gap-2 px-3 py-2 hover:bg-rb-hover cursor-pointer transition-colors"
                  @click="addCard(card)"
                >
                  <img :src="card.image" class="w-7 h-10 rounded object-cover flex-shrink-0" />
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-medium text-rb-text truncate">{{ card.name }}</p>
                    <p class="text-[10px] text-rb-text-muted">{{ card.set }} · #{{ card.number }}</p>
                  </div>
                  <span class="text-xs font-semibold text-rb-text">${{ (card.price || 0).toFixed(2) }}</span>
                </div>
              </div>
            </div>
            <div v-else class="px-4 py-3 border-t border-rb-border">
              <button
                class="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-rb-accent/10 text-rb-accent font-medium text-sm hover:bg-rb-accent/20 transition-colors"
                @click="openSearch('A')"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                </svg>
                Add Cards to Side A
              </button>
            </div>
          </div>
        </div>

        <!-- Divider -->
        <div class="hidden md:flex items-start justify-center pt-16">
          <div class="flex flex-col items-center gap-2">
            <div class="w-px h-8 bg-rb-border" />
            <span class="text-xs font-bold text-rb-text-muted">VS</span>
            <div class="w-px h-8 bg-rb-border" />
          </div>
        </div>
        <div class="md:hidden flex items-center gap-3 px-4">
          <div class="flex-1 h-px bg-rb-border" />
          <span class="text-xs font-bold text-rb-text-muted">VS</span>
          <div class="flex-1 h-px bg-rb-border" />
        </div>

        <!-- Side B: Their Cards -->
        <div class="flex-1 min-w-0">
          <div class="bg-rb-card rounded-xl border border-rb-border overflow-hidden">
            <div class="flex items-center justify-between px-4 py-3 border-b border-rb-border">
              <div class="flex items-center gap-2">
                <span class="text-xs font-bold uppercase tracking-wider text-rb-info">Side B</span>
                <span class="text-sm text-rb-text-secondary">Their Cards</span>
              </div>
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold text-rb-text">${{ tradeStore.sideB.totalValue.toFixed(2) }}</span>
                <button
                  v-if="tradeStore.sideB.items.length > 0"
                  aria-label="Clear all Side B cards"
                  class="text-rb-text-muted hover:text-rb-danger transition-colors"
                  @click="tradeStore.clearSide('B')"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Card list -->
            <div class="divide-y divide-rb-border">
              <div
                v-if="tradeStore.sideB.items.length === 0"
                class="flex flex-col items-center justify-center py-12 text-center"
              >
                <div class="text-3xl mb-2">📦</div>
                <p class="text-rb-text-secondary text-sm">No cards added</p>
                <p class="text-rb-text-muted text-xs mt-1">Search below to add cards</p>
              </div>
              <div
                v-for="card in tradeStore.sideB.items"
                :key="card.tradeId"
                class="flex items-center gap-3 px-4 py-3 hover:bg-rb-hover transition-colors"
              >
                <img
                  :src="card.imageUrl"
                  :alt="card.name"
                  class="w-10 h-14 rounded object-cover flex-shrink-0"
                  draggable="false"
                />
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-rb-text truncate">{{ card.name }}</p>
                  <p class="text-xs text-rb-text-muted">{{ card.setName }} · {{ card.number }}</p>
                </div>
                <div class="text-right flex-shrink-0">
                  <p class="text-sm font-semibold text-rb-text">${{ card.marketPrice.toFixed(2) }}</p>
                </div>
                <button
                  class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded text-rb-text-muted hover:text-rb-danger hover:bg-rb-danger-dim transition-colors"
                  @click="tradeStore.removeFromSide('B', card.tradeId)"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Search bar (shown only when Side B is active) -->
            <div class="px-4 py-3 border-t border-rb-border" v-if="activeSide === 'B'">
              <input
                v-model="searchQuery"
                @input="onSearchInput"
                placeholder="Search cards to add to Side B..."
                class="input w-full"
              />
              <div v-if="searchBusy" class="mt-2 text-xs text-rb-text-muted">Searching...</div>
              <div v-if="searchResults.length > 0" class="mt-2 max-h-48 overflow-y-auto divide-y divide-rb-border rounded-lg border border-rb-border">
                <div
                  v-for="card in searchResults"
                  :key="card.id"
                  class="flex items-center gap-2 px-3 py-2 hover:bg-rb-hover cursor-pointer transition-colors"
                  @click="addCard(card)"
                >
                  <img :src="card.image" class="w-7 h-10 rounded object-cover flex-shrink-0" />
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-medium text-rb-text truncate">{{ card.name }}</p>
                    <p class="text-[10px] text-rb-text-muted">{{ card.set }} · #{{ card.number }}</p>
                  </div>
                  <span class="text-xs font-semibold text-rb-text">${{ (card.price || 0).toFixed(2) }}</span>
                </div>
              </div>
            </div>
            <div v-else class="px-4 py-3 border-t border-rb-border">
              <button
                class="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-rb-info/10 text-rb-info font-medium text-sm hover:bg-rb-info/20 transition-colors"
                @click="openSearch('B')"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
                </svg>
                Add Cards to Side B
              </button>
            </div>
          </div>
        </div>

      </div>

      <!-- Reset button -->
      <div v-if="tradeStore.sideA.items.length > 0 || tradeStore.sideB.items.length > 0" class="flex justify-center mt-6">
        <button class="btn btn-secondary btn-sm" @click="tradeStore.resetTrade()">Reset Trade</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
</style>
