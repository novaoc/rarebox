<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import CameraViewfinder from '../components/scanner/CameraViewfinder.vue'
import { useTradeStore } from '../stores/trade'
import { multiSearch } from '../services/tcg/multiSearch'
import { scanCard } from '../utils/scanPipeline'
import { preloadOcrWorker } from '../utils/ocrService'

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
const showScanResults = ref(false)
const activeSide = ref<'A' | 'B'>('A')
const searchQuery = ref('')
const searchResults = ref<SearchResult[]>([])
const scanCandidates = ref<SearchResult[]>([])
const scanError = ref('')
const scanHint = ref('')
const searchBusy = ref(false)
const scanStatus = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null

const searchCache = new Map<string, SearchResult[]>()

const searchCategory = ref<'cards' | 'sealed'>('cards')
const activeGradeCard = ref<string | null>(null)

const GRADE_COMPANIES = ['PSA', 'BGS', 'CGC', 'SGC'] as const
const GRADES: Record<string, string[]> = {
  PSA: ['10', '9', '8', '7', '6', '5', '4', '3', '2', '1'],
  BGS: ['10', '9.5', '9', '8.5', '8', '7', '6', '5', '4', '3', '2', '1'],
  CGC: ['10', '9.5', '9', '8.5', '8', '7', '6', '5', '4', '3', '2', '1'],
  SGC: ['10', '9.5', '9', '8', '7', '6', '5', '4', '3', '2', '1'],
}

// Grading prompt state
const pendingCard = ref<SearchResult | null>(null)
const pendingGraded = ref(false)
const pendingGradeCompany = ref('PSA')
const pendingGrade = ref('9')

function effectivePrice(card: any): number {
  const base = card.currentMarketPrice ?? card.marketPrice ?? card.purchasePrice ?? 0
  if (!card.graded) return base
  const mults: Record<string, Record<string, number>> = {
    PSA:  { '10': 2.0, '9': 1.5, '8': 1.2, '7': 1.0, '6': 0.8, '5': 0.7, '4': 0.5, '3': 0.4, '2': 0.3, '1': 0.2 },
    BGS:  { '10': 2.0, '9.5': 1.7, '9': 1.4, '8.5': 1.2, '8': 1.1, '7': 1.0, '6': 0.8, '5': 0.7, '4': 0.5, '3': 0.4, '2': 0.3, '1': 0.2 },
    CGC:  { '10': 2.0, '9.5': 1.5, '9': 1.3, '8.5': 1.1, '8': 1.0, '7': 0.8, '6': 0.7, '5': 0.6, '4': 0.5, '3': 0.4, '2': 0.3, '1': 0.2 },
    SGC:  { '10': 1.8, '9.5': 1.4, '9': 1.2, '8': 1.0, '7': 0.8, '6': 0.7, '5': 0.6, '4': 0.5, '3': 0.4, '2': 0.3, '1': 0.2 },
  }
  const mult = mults[card.gradeCompany]?.[card.grade] || 1.0
  return base * mult
}

const deltaFormatted = computed(() => {
  const a = tradeStore.sideA.items.reduce((s, c) => s + effectivePrice(c), 0)
  const b = tradeStore.sideB.items.reduce((s, c) => s + effectivePrice(c), 0)
  const d = b - a
  const abs = Math.abs(d)
  if (abs < 0.01) return '$0.00'
  const sign = d > 0 ? '+' : '-'
  return `${sign}$${abs.toFixed(2)}`
})

const deltaLabel = computed(() => {
  const a = tradeStore.sideA.items.reduce((s, c) => s + effectivePrice(c), 0)
  const b = tradeStore.sideB.items.reduce((s, c) => s + effectivePrice(c), 0)
  const d = b - a
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
  scanHint.value = ''
}

// Normalize capture toward ~1100px wide: downscale huge frames for speed, but
// also UPSCALE small ones — tesseract needs ~20px+ glyph height to read card
// text, and a 400px-wide card frame is illegible to it.
function resizeImage(dataUrl: string, targetWidth = 1100): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      if (img.width >= targetWidth * 0.6 && img.width <= targetWidth * 1.3) { resolve(dataUrl); return }
      const scale = targetWidth / img.width
      const w = targetWidth
      const h = Math.round(img.height * scale)
      const c = document.createElement('canvas')
      c.width = w; c.height = h
      const ctx = c.getContext('2d')!
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, w, h)
      resolve(c.toDataURL('image/jpeg', 0.9))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

async function onCapture(imageData: string) {
  scanStatus.value = 'Processing…'
  showScanner.value = false
  const resized = await resizeImage(imageData)

  let result: any
  try {
    result = await Promise.race([
      scanCard(resized, (pct) => {
        scanStatus.value = pct < 100 ? `Reading card… ${pct}%` : 'Identifying card…'
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 45000)),
    ])
  } catch (e: any) {
    scanStatus.value = ''
    scanError.value = e?.message === 'timeout'
      ? 'Scan timed out. Try search instead.'
      : 'Could not identify card. Try search instead.'
    return
  }

  scanStatus.value = ''
  if (!result || result.candidates.length === 0) {
    const guess = (result?.usedQuery || '').trim()
    if (guess.length >= 2) {
      // Hand the OCR text to the search box — fixing a few wrong characters
      // beats retaking the photo, especially on phones.
      openSearch(activeSide.value)
      searchQuery.value = guess
      scanHint.value = 'Scanned text below — fix any wrong characters.'
      doSearch()
    } else {
      scanError.value = 'Could not read any text on the card — try more light, less glare, and fill the frame.'
    }
    return
  }

  if (result.candidates.length === 1 && result.ocrConfidence > 15) {
    const c = result.candidates[0]
    tradeStore.addToSide(activeSide.value, {
      id: c.id,
      name: c.name,
      setName: c.setName,
      number: c.number,
      imageUrl: c.image,
      marketPrice: c.price || 0,
      game: c.game,
    })
    return
  }

  scanCandidates.value = result.candidates.map((c: any) => ({
    id: c.id,
    name: c.name,
    set: c.setName || c.set || '',
    number: c.number,
    image: c.image,
    price: c.price,
    game: c.game,
  })) as SearchResult[]
  showScanResults.value = true
}

function addScannedCard(card: SearchResult) {
  tradeStore.addToSide(activeSide.value, {
    id: card.id,
    name: card.name,
    setName: card.set,
    number: card.number,
    imageUrl: card.image,
    marketPrice: card.price || 0,
    game: card.game,
  })
  showScanResults.value = false
  scanCandidates.value = []
}

function dismissError() {
  scanError.value = ''
}

function onScannerClose() {
  showScanner.value = false
  scanStatus.value = ''
}

function onSearchAfterError() {
  scanError.value = ''
  openSearch(activeSide.value)
}

function onSearchInput() {
  if (searchTimer) clearTimeout(searchTimer)
  const q = searchQuery.value.trim()
  if (q.length < 2) { searchResults.value = []; return }
  const cacheKey = `${searchCategory.value}:${q}`
  if (searchCache.has(cacheKey)) {
    searchResults.value = searchCache.get(cacheKey)!
    return
  }
  searchTimer = setTimeout(doSearch, 150)
}

async function doSearch() {
  const q = searchQuery.value.trim()
  const cat = searchCategory.value
  if (q.length < 2) return
  searchBusy.value = true
  try {
    const res = await multiSearch(q, { page: 1, pageSize: 30, category: cat })
    // Guard: discard if query or category changed while we were fetching
    if (searchQuery.value.trim() !== q || searchCategory.value !== cat) return
    const cards = (res.cards || []) as SearchResult[]
    searchCache.set(`${cat}:${q}`, cards)
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
  // Sealed products don't get graded — add directly
  if (card.game === 'sealed') {
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
    return
  }
  // Cards: show grading prompt (unless Riftbound)
  if (card.game === 'riftbound') {
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
    return
  }

  pendingCard.value = card
  pendingGraded.value = false
  pendingGradeCompany.value = 'PSA'
  pendingGrade.value = '9'
  searchQuery.value = ''
  searchResults.value = []
}

function confirmAddCard() {
  const card = pendingCard.value
  if (!card) return
  tradeStore.addToSide(activeSide.value, {
    id: card.id,
    name: card.name,
    setName: card.set,
    number: card.number,
    imageUrl: card.image,
    marketPrice: card.price || 0,
    game: card.game,
    graded: pendingGraded.value,
    gradeCompany: pendingGraded.value ? pendingGradeCompany.value : undefined,
    grade: pendingGraded.value ? pendingGrade.value : undefined,
  })
  pendingCard.value = null
}

function cancelAddCard() {
  pendingCard.value = null
}

onMounted(async () => {
  if (!tradeStore.initialized) await tradeStore.init()
  preloadOcrWorker().catch(e => console.warn('OCR preload failed:', e))
})
</script>

<template>
  <!-- Scanner overlay -->
  <Teleport to="body">
    <transition name="fade">
      <div v-if="showScanner" class="modal-overlay" style="padding:0;align-items:stretch;background:#000" @click.self="onScannerClose">
        <CameraViewfinder @capture="onCapture" @close="onScannerClose" />
      </div>
    </transition>
  </Teleport>

  <!-- Processing overlay -->
  <Teleport to="body">
    <transition name="fade">
      <div v-if="scanStatus" class="modal-overlay scan-processing-overlay">
        <div class="scan-status-overlay">
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
              <div class="card-row-name">
                {{ card.name }}
                <template v-if="card.game !== 'riftbound'">
                  <span
                    v-if="card.graded"
                    class="grade-badge"
                    @click.stop="activeGradeCard = activeGradeCard === card.tradeId ? null : card.tradeId"
                  >{{ card.gradeCompany }} {{ card.grade }}</span>
                  <span
                    v-else
                    class="grade-badge ungraded"
                    @click.stop="activeGradeCard = activeGradeCard === card.tradeId ? null : card.tradeId"
                  >Add Grade</span>
                </template>
              </div>
              <div class="card-row-sub">{{ card.setName }} &middot; {{ card.number }}</div>
              <div v-if="activeGradeCard === card.tradeId && card.game !== 'riftbound'" class="grade-picker" @click.stop>
                <label class="grade-toggle">
                  <input
                    type="checkbox"
                    :checked="card.graded"
                    @change="tradeStore.updateCardGrade('A', card.tradeId, {
                      graded: !card.graded,
                      gradeCompany: card.gradeCompany || 'PSA',
                      grade: card.grade || '9',
                    })"
                  />
                  Graded
                </label>
                <div v-if="card.graded" class="grade-selects">
                  <select
                    :value="card.gradeCompany"
                    @change="tradeStore.updateCardGrade('A', card.tradeId, {
                      graded: true,
                      gradeCompany: ($event.target as HTMLSelectElement).value,
                      grade: card.grade || '9',
                    })"
                  >
                    <option v-for="c in GRADE_COMPANIES" :key="c" :value="c">{{ c }}</option>
                  </select>
                  <select
                    :value="card.grade"
                    @change="tradeStore.updateCardGrade('A', card.tradeId, {
                      graded: true,
                      gradeCompany: card.gradeCompany || 'PSA',
                      grade: ($event.target as HTMLSelectElement).value,
                    })"
                  >
                    <option v-for="g in GRADES[card.gradeCompany || 'PSA'] || []" :key="g" :value="g">{{ g }}</option>
                  </select>
                </div>
              </div>
            </div>
            <div class="text-right" style="flex-shrink:0">
              <div class="font-bold font-mono">${{ effectivePrice(card).toFixed(2) }}</div>
              <div v-if="card.graded" class="text-secondary" style="font-size:11px">raw ${{ (card.marketPrice || 0).toFixed(2) }}</div>
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
          <div class="search-category-toggle">
            <button
              :class="['btn btn-sm', searchCategory === 'cards' ? 'btn-primary' : 'btn-ghost']"
              @click="searchCategory = 'cards'; searchQuery = ''; searchResults = []"
            >Cards</button>
            <button
              :class="['btn btn-sm', searchCategory === 'sealed' ? 'btn-primary' : 'btn-ghost']"
              @click="searchCategory = 'sealed'; searchQuery = ''; searchResults = []"
            >Sealed</button>
          </div>
          <div v-if="scanHint" class="text-muted" style="font-size:12px;margin-bottom:6px">📷 {{ scanHint }}</div>
          <input
            v-model="searchQuery"
            @input="onSearchInput"
            :placeholder="searchCategory === 'cards' ? 'Search cards to add…' : 'Search sealed products…'"
            class="input"
            autofocus
          />
          <div v-if="searchBusy" class="spinner spinner-sm mt-2" />
          <div v-if="searchResults.length > 0" class="search-results">
            <div
              v-for="card in searchResults"
              :key="card.id"
              class="search-result-row"
              @click="addCard(card)"
            >
              <img v-if="card.image" :src="card.image" class="search-result-thumb" @error="$event.target.style.display='none'" />
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
              <div class="card-row-name">
                {{ card.name }}
                <template v-if="card.game !== 'riftbound'">
                  <span
                    v-if="card.graded"
                    class="grade-badge"
                    @click.stop="activeGradeCard = activeGradeCard === card.tradeId ? null : card.tradeId"
                  >{{ card.gradeCompany }} {{ card.grade }}</span>
                  <span
                    v-else
                    class="grade-badge ungraded"
                    @click.stop="activeGradeCard = activeGradeCard === card.tradeId ? null : card.tradeId"
                  >Add Grade</span>
                </template>
              </div>
              <div class="card-row-sub">{{ card.setName }} &middot; {{ card.number }}</div>
              <div v-if="activeGradeCard === card.tradeId && card.game !== 'riftbound'" class="grade-picker" @click.stop>
                <label class="grade-toggle">
                  <input
                    type="checkbox"
                    :checked="card.graded"
                    @change="tradeStore.updateCardGrade('B', card.tradeId, {
                      graded: !card.graded,
                      gradeCompany: card.gradeCompany || 'PSA',
                      grade: card.grade || '9',
                    })"
                  />
                  Graded
                </label>
                <div v-if="card.graded" class="grade-selects">
                  <select
                    :value="card.gradeCompany"
                    @change="tradeStore.updateCardGrade('B', card.tradeId, {
                      graded: true,
                      gradeCompany: ($event.target as HTMLSelectElement).value,
                      grade: card.grade || '9',
                    })"
                  >
                    <option v-for="c in GRADE_COMPANIES" :key="c" :value="c">{{ c }}</option>
                  </select>
                  <select
                    :value="card.grade"
                    @change="tradeStore.updateCardGrade('B', card.tradeId, {
                      graded: true,
                      gradeCompany: card.gradeCompany || 'PSA',
                      grade: ($event.target as HTMLSelectElement).value,
                    })"
                  >
                    <option v-for="g in GRADES[card.gradeCompany || 'PSA'] || []" :key="g" :value="g">{{ g }}</option>
                  </select>
                </div>
              </div>
            </div>
            <div class="text-right" style="flex-shrink:0">
              <div class="font-bold font-mono">${{ effectivePrice(card).toFixed(2) }}</div>
              <div v-if="card.graded" class="text-secondary" style="font-size:11px">raw ${{ (card.marketPrice || 0).toFixed(2) }}</div>
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
          <div class="search-category-toggle">
            <button
              :class="['btn btn-sm', searchCategory === 'cards' ? 'btn-primary' : 'btn-ghost']"
              @click="searchCategory = 'cards'; searchQuery = ''; searchResults = []"
            >Cards</button>
            <button
              :class="['btn btn-sm', searchCategory === 'sealed' ? 'btn-primary' : 'btn-ghost']"
              @click="searchCategory = 'sealed'; searchQuery = ''; searchResults = []"
            >Sealed</button>
          </div>
          <div v-if="scanHint" class="text-muted" style="font-size:12px;margin-bottom:6px">📷 {{ scanHint }}</div>
          <input
            v-model="searchQuery"
            @input="onSearchInput"
            :placeholder="searchCategory === 'cards' ? 'Search cards to add…' : 'Search sealed products…'"
            class="input"
            autofocus
          />
          <div v-if="searchBusy" class="spinner spinner-sm mt-2" />
          <div v-if="searchResults.length > 0" class="search-results">
            <div
              v-for="card in searchResults"
              :key="card.id"
              class="search-result-row"
              @click="addCard(card)"
            >
              <img v-if="card.image" :src="card.image" class="search-result-thumb" @error="$event.target.style.display='none'" />
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
      <div v-if="scanError" class="scan-error">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span style="flex:1">{{ scanError }}</span>
        <button class="btn btn-sm" style="flex-shrink:0" @click="onSearchAfterError">Search Manually</button>
        <button class="btn btn-ghost btn-icon btn-sm" style="flex-shrink:0;color:var(--danger)" @click="dismissError">✕</button>
      </div>
    </transition>

    <!-- Scan candidates picker -->
    <transition name="fade">
      <div v-if="showScanResults" class="modal-overlay" @click.self="dismissError">
        <div class="modal" style="max-width:480px">
          <div class="modal-header">
            <h3>Select Card</h3>
            <button class="btn btn-ghost btn-icon" @click="showScanResults = false; scanCandidates = []">✕</button>
          </div>
          <div class="modal-body">
            <div v-if="scanCandidates.length > 0" class="scan-candidate-list">
              <div
                v-for="card in scanCandidates"
                :key="card.id"
                class="scan-candidate-row"
                @click="addScannedCard(card)"
              >
                <img v-if="card.image" :src="card.image" class="search-result-thumb" @error="$event.target.style.display='none'" />
                <div class="search-result-info">
                  <div class="search-result-name">{{ card.name }}</div>
                  <div class="search-result-sub">{{ card.set }} &middot; #{{ card.number }}</div>
                </div>
                <span class="font-bold font-mono" style="font-size:12px;flex-shrink:0">
                  ${{ (card.price || 0).toFixed(2) }}
                </span>
              </div>
            </div>
            <p v-else class="text-secondary" style="font-size:13px">No candidates found.</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="openSearch(activeSide)">Search Manually</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Grading prompt modal -->
    <transition name="fade">
      <div v-if="pendingCard" class="modal-overlay" @click.self="cancelAddCard">
        <div class="modal" style="max-width:400px">
          <div class="modal-header">
            <h3>Add Card</h3>
            <button class="btn btn-ghost btn-icon" @click="cancelAddCard">✕</button>
          </div>
          <div class="modal-body">
            <div class="grade-pending-preview">
              <img v-if="pendingCard.image" :src="pendingCard.image" class="grade-pending-thumb" />
              <div>
                <div style="font-weight:500;font-size:14px">{{ pendingCard.name }}</div>
                <div style="font-size:12px;color:var(--text-muted)">{{ pendingCard.set }} · #{{ pendingCard.number }}</div>
                <div style="font-size:14px;font-weight:600;margin-top:4px">${{ (pendingCard.price || 0).toFixed(2) }}</div>
              </div>
            </div>
            <label class="grade-toggle" style="margin-top:12px">
              <input type="checkbox" v-model="pendingGraded" />
              This card is graded
            </label>
            <div v-if="pendingGraded" class="grade-selects" style="margin-top:8px">
              <select v-model="pendingGradeCompany">
                <option v-for="c in GRADE_COMPANIES" :key="c" :value="c">{{ c }}</option>
              </select>
              <select v-model="pendingGrade">
                <option v-for="g in GRADES[pendingGradeCompany] || []" :key="g" :value="g">{{ g }}</option>
              </select>
            </div>
          </div>
          <div class="modal-footer" style="gap:8px">
            <button class="btn btn-secondary" @click="cancelAddCard">Cancel</button>
            <button class="btn btn-primary" @click="confirmAddCard">Add to Side {{ activeSide }}</button>
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
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  color: var(--text-primary);
  font-size: 15px;
  font-weight: 500;
}

.scan-processing-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.85);
  z-index: 1000;
}

/* Grade picker */
.grade-badge {
  display: inline-flex;
  align-items: center;
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--accent-dim);
  color: var(--accent);
  cursor: pointer;
  vertical-align: middle;
  margin-left: 4px;
  letter-spacing: 0.3px;
}
.grade-badge.ungraded {
  background: var(--bg-hover);
  color: var(--text-muted);
  font-weight: 400;
}
.grade-picker {
  margin-top: 6px;
  padding: 8px 10px;
  background: var(--bg-hover);
  border-radius: var(--radius);
  border: 1px solid var(--border-subtle);
}
.grade-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-primary);
  cursor: pointer;
}
.grade-toggle input { margin: 0; }
.grade-selects {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}
.grade-selects select {
  flex: 1;
  font-size: 12px;
  padding: 3px 6px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-primary);
  color: var(--text-primary);
}

/* Grade pending preview */
.grade-pending-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px;
  background: var(--bg-hover);
  border-radius: var(--radius);
  border: 1px solid var(--border-subtle);
}
.grade-pending-thumb {
  width: 48px;
  height: 68px;
  border-radius: var(--radius);
  object-fit: cover;
  flex-shrink: 0;
}

/* Search category toggle */
.search-category-toggle {
  display: flex;
  gap: 4px;
  margin-bottom: 6px;
}
.search-category-toggle .btn {
  font-size: 12px;
  padding: 4px 12px;
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
