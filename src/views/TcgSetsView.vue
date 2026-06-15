<template>
  <div class="sets-view">
    <div class="tcg-crumb mb-3">
      <router-link to="/sets" class="btn btn-ghost btn-sm">← All TCGs</router-link>
      <span class="tcg-crumb-name">{{ meta?.name || 'Sets' }}</span>
    </div>

    <!-- Unknown / unsupported game -->
    <div v-if="!provider" class="empty-state">
      <div class="icon"><RbIcon name="question" :size="44" /></div>
      <h3>Not available</h3>
      <p>This TCG isn't supported yet.</p>
      <router-link to="/sets" class="btn btn-primary mt-3">Back to all TCGs</router-link>
    </div>

    <!-- Set list -->
    <div v-else-if="!selectedSet">
      <div class="sets-header mb-4">
        <div v-if="languages.length" class="lang-tabs" role="tablist" aria-label="Card language">
          <button
            v-for="l in languages"
            :key="l.id"
            class="lang-tab"
            :class="{ active: activeLang === l.id }"
            type="button"
            role="tab"
            :aria-selected="activeLang === l.id"
            @click="switchLang(l.id)"
          >
            {{ l.label }}
          </button>
        </div>
        <div class="search-input-wrap">
          <input v-model="setFilter" class="input search-input" placeholder="Filter sets..." style="padding-left:12px" />
          <button v-if="setFilter" class="btn btn-ghost btn-icon search-clear" @click="setFilter = ''" aria-label="Clear filter">✕</button>
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
          <div v-for="set in filteredSets" :key="set.id" class="set-card" @click="openSet(set)">
            <div class="set-logo-wrap">
              <img v-if="set.logo" :src="set.logo" :alt="set.name" class="set-logo" loading="lazy" draggable="false"
                   @error="$event.target.style.display='none'" />
              <span v-else class="set-logo-placeholder" :class="'set-badge-' + gameId">{{ set.code || meta?.emoji || '◆' }}</span>
            </div>
            <div class="set-info">
              <div class="set-name">{{ set.name }}</div>
              <div class="set-meta">
                <span v-if="set.code" class="set-series">{{ set.code }}</span>
                <template v-if="set.total"><span class="set-dot">·</span><span class="set-count">{{ set.total }} cards</span></template>
                <template v-if="set.releaseDate"><span class="set-dot">·</span><span class="set-date">{{ formatDate(set.releaseDate) }}</span></template>
              </div>
            </div>
            <span class="set-go" aria-hidden="true">→</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Card browser for selected set -->
    <div v-else>
      <div class="set-browse-header mb-4">
        <button class="btn btn-secondary btn-sm" @click="closeSet">← All Sets</button>
        <div class="set-browse-title">
          <span>{{ selectedSet.name }}</span>
          <span v-if="cards.length" class="badge badge-accent ml-2">{{ cards.length }} cards</span>
        </div>
        <div class="set-browse-filters">
          <input v-model="cardFilter" class="input input-sm" placeholder="Filter cards..." style="width:160px" />
          <button class="btn btn-primary btn-sm" @click="startBulkAddFromHeader" :disabled="bulkLoading">
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
          <div v-for="card in filteredCards" :key="card.id" class="card-result" :class="{ revealed: revealedCard === card.id }" @click="tapCard(card)">
            <div class="card-img-wrap">
              <img v-if="card.image" :src="card.image" :alt="card.name" class="card-img" loading="lazy" draggable="false"
                   @error="$event.target.style.display='none'; $event.target.nextElementSibling.style.display='flex'" />
              <div class="card-img-ph" :style="card.image ? 'display:none' : ''">
                <span>{{ card.name }}</span>
                <span class="card-img-num">#{{ card.number }}</span>
              </div>
              <div class="card-overlay">
                <button class="btn btn-primary btn-sm" @click.stop="addCard(card)">+ Add</button>
                <button class="btn btn-secondary btn-sm" @click.stop="detailCard = card">Details</button>
              </div>
            </div>
            <div class="card-meta">
              <div class="card-name">{{ card.name }}</div>
              <div class="card-num text-muted">#{{ card.number }}</div>
              <div class="card-price-row">
                <span v-if="card.price != null" class="card-price">${{ card.price.toFixed(2) }}</span>
                <span v-else class="text-muted" style="font-size:11px">—</span>
                <span v-if="card.rarity" class="card-rarity badge badge-accent">{{ card.rarity }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <AddItemModal
      v-if="addingCard"
      :tcg-card="addingCard"
      default-type="card"
      @close="addingCard = null"
      @added="addingCard = null"
    />

    <!-- Card detail: price history chart -->
    <transition name="fade">
      <div v-if="detailCard" class="modal-overlay" @click.self="detailCard = null">
        <div class="modal" style="max-width:560px">
          <div class="modal-header">
            <h3>{{ detailCard.name }}</h3>
            <button class="btn btn-ghost btn-icon" @click="detailCard = null" aria-label="Close">✕</button>
          </div>
          <div class="modal-body">
            <div class="detail-sub text-muted">
              {{ selectedSet?.name }} · #{{ detailCard.number }}<template v-if="detailCard.rarity"> · {{ detailCard.rarity }}</template>
            </div>
            <PriceChart
              :cardRef="{ game: gameId, setId: selectedSet?.id, setName: selectedSet?.name, number: detailCard.number, cardId: detailCard.id, tcgplayerId: detailCard.tcgplayerId, lang: detailCard._lang || selectedSet?._lang || activeLang }"
              :currentPrice="detailCard.price"
              :height="240"
            />
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="detailCard = null">Close</button>
            <button class="btn btn-primary" @click="addCard(detailCard); detailCard = null">+ Add to Shelf</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Bulk Add Set Modal -->
    <div v-if="showBulkModal" class="modal-overlay" @click.self="showBulkModal = false">
      <div class="modal" style="max-width:600px;max-height:80vh;display:flex;flex-direction:column">
        <div class="modal-header">
          <h3>Add Set — {{ bulkSetName }}</h3>
          <button class="btn btn-ghost btn-icon" @click="showBulkModal = false">✕</button>
        </div>
        <div class="modal-body" style="flex:1;overflow-y:auto">
          <!-- Loading -->
          <div v-if="bulkLoading" class="empty-state">
            <div class="spinner"></div>
            <p class="mt-2">Loading cards...</p>
          </div>
          <!-- Done -->
          <div v-else-if="bulkDone" class="empty-state">
            <div class="icon"><RbIcon name="check" :size="44" /></div>
            <h3>Added {{ bulkSelectedCount }} cards</h3>
          </div>
          <!-- Cards list -->
          <template v-else>
            <div class="bulk-controls mb-3">
              <button class="btn btn-ghost btn-sm" @click="bulkSelectAll">Select All</button>
              <button class="btn btn-ghost btn-sm" @click="bulkDeselectAll">Deselect All</button>
              <span class="text-muted" style="font-size:12px;margin-left:auto">
                {{ bulkSelectedCount }} / {{ bulkCards.length }} selected
                <template v-if="bulkTotalCost > 0"> · ${{ bulkTotalCost.toFixed(2) }}</template>
              </span>
            </div>
            <div class="form-group mb-3">
              <label class="form-label">Shelf</label>
              <select v-model="bulkPortfolioId" class="select">
                <option v-for="p in store.portfolios" :key="p.id" :value="p.id">{{ p.name }}</option>
                <option value="__new__">＋ New shelf…</option>
              </select>
              <input
                v-if="bulkPortfolioId === '__new__'"
                v-model="newShelfName"
                class="input mt-2"
                :placeholder="bulkSetName || 'Shelf name'"
              />
            </div>
            <div class="bulk-list">
              <div v-for="(card, idx) in filteredBulkCards" :key="card.id || idx" class="bulk-card-row" @click="toggleBulkCard(idx)">
                <input type="checkbox" :checked="card.checked" class="bulk-checkbox" @click.stop="toggleBulkCard(idx)" />
                <img v-if="card.image" :src="card.image" class="bulk-card-img" loading="lazy" />
                <div class="bulk-card-info">
                  <div class="bulk-card-name">{{ card.name }}</div>
                  <div class="bulk-card-meta text-muted">#{{ card.number }}<template v-if="card.rarity"> · {{ card.rarity }}</template></div>
                </div>
                <span v-if="card.price != null" class="bulk-card-price">${{ card.price.toFixed(2) }}</span>
                <span v-else class="bulk-card-price text-muted">—</span>
              </div>
            </div>
          </template>
        </div>
        <div class="modal-footer" v-if="!bulkLoading && !bulkDone">
          <button class="btn btn-secondary" @click="showBulkModal = false">Cancel</button>
          <button class="btn btn-primary" :disabled="bulkAdding || bulkSelectedCount === 0" @click="confirmBulkAdd">
            <span v-if="bulkAdding" class="spinner spinner-sm"></span>
            Add {{ bulkSelectedCount }} Cards
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import RbIcon from '../components/icons/RbIcon.vue'
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { tokenMatch } from '../utils/search.js'
import { useRoute } from 'vue-router'
import { getProvider, TCGS } from '../services/tcg/providers'
import { usePortfolioStore } from '../stores/portfolio'
import AddItemModal from '../components/AddItemModal.vue'
import PriceChart from '../components/PriceChart.vue'

const store = usePortfolioStore()

const route = useRoute()
const gameId = computed(() => route.params.game)
const provider = computed(() => getProvider(gameId.value))
const meta = computed(() => TCGS.find(t => t.id === gameId.value))
const languages = computed(() => provider.value?.languages || [])
const selectedLang = ref('en')
const activeLang = computed(() => languages.value.some(l => l.id === selectedLang.value) ? selectedLang.value : 'en')

const sets = ref([])
const loadingSets = ref(false)
const setsError = ref('')
const setFilter = ref('')

const selectedSet = ref(null)
const cards = ref([])
const loadingCards = ref(false)
const cardsError = ref('')
const cardFilter = ref('')

const addingCard = ref(null)
const detailCard = ref(null)

// Abort in-flight API calls when navigating away
let _abort = null
function abortPending() { if (_abort) { _abort.abort(); _abort = null } }
onUnmounted(abortPending)

const filteredSets = computed(() => {
  const q = setFilter.value.trim().toLowerCase()
  if (!q) return sets.value
  return sets.value.filter(s => tokenMatch(q, s.name, s.code))
})

const filteredCards = computed(() => {
  const q = cardFilter.value.trim().toLowerCase()
  if (!q) return cards.value
  return cards.value.filter(c => tokenMatch(q, c.name, String(c.number)))
})

async function switchLang(lang) {
  if (activeLang.value === lang) return
  selectedLang.value = lang
  selectedSet.value = null
  cards.value = []
  detailCard.value = null
  setFilter.value = ''
  cardFilter.value = ''
  await loadSets()
}

// Tap-to-reveal on touch devices (desktop reveals on hover; taps no-op there)
const revealedCard = ref(null)
const _canHover = typeof window !== 'undefined' && window.matchMedia('(hover: hover)').matches
function tapCard(card) {
  if (_canHover) return
  revealedCard.value = revealedCard.value === card.id ? null : card.id
}

async function loadSets() {
  if (!provider.value) return
  abortPending()
  const ac = new AbortController()
  _abort = ac
  loadingSets.value = true
  setsError.value = ''
  try {
    sets.value = await provider.value.getSets({ signal: ac.signal, lang: activeLang.value })
  } catch (e) {
    if (e.name !== 'AbortError') setsError.value = navigator.onLine ? 'Could not reach the card database. Please try again.' : 'You\'re offline and this list hasn\'t been viewed yet — open it once online and it stays available offline.'
  } finally {
    if (_abort === ac) _abort = null
    loadingSets.value = false
  }
}

async function openSet(set) {
  selectedSet.value = set
  cards.value = []
  await loadSetCards(set)
}

async function loadSetCards(set) {
  abortPending()
  const ac = new AbortController()
  _abort = ac
  loadingCards.value = true
  cardsError.value = ''
  try {
    const lang = set._lang || activeLang.value
    const result = await provider.value.getSetCards(set.id, { signal: ac.signal, lang })
    // Provider aborts don't reach the fetch layer, so a slow set A can
    // resolve after the user opened set B — drop stale responses
    if (selectedSet.value?.id !== set.id) return
    cards.value = result
    if (cards.value.length === 0) cardsError.value = 'No cards found for this set.'
  } catch (e) {
    if (selectedSet.value?.id !== set.id) return
    if (e.name !== 'AbortError') cardsError.value = navigator.onLine ? 'Could not load cards for this set. Please try again.' : 'You\'re offline and this set hasn\'t been opened yet — open it once online and it stays available offline.'
  } finally {
    if (_abort === ac) _abort = null
    if (selectedSet.value?.id === set.id) loadingCards.value = false
  }
}

function closeSet() {
  selectedSet.value = null
  cards.value = []
  cardFilter.value = ''
}

function addCard(card) {
  const lang = card._lang || selectedSet.value?._lang || activeLang.value
  addingCard.value = {
    game: gameId.value,
    id: card.id,
    name: card.name,
    set: selectedSet.value?.name || '',
    setId: selectedSet.value?.id || '',
    number: card.number,
    image: card.image,
    price: card.price,
    rarity: card.rarity,
    _lang: lang,
  }
}

// ── Bulk add set ─────────────────────────────────────────────────────────────
const showBulkModal = ref(false)
const bulkSetName = ref('')
const bulkSetId = ref('')
const bulkCards = ref([])
const bulkPortfolioId = ref('')
const newShelfName = ref('')
const bulkAdding = ref(false)
const bulkDone = ref(false)
const bulkLoading = ref(false)

const bulkSelectedCount = computed(() => bulkCards.value.filter(c => c.checked).length)
const bulkTotalCost = computed(() => bulkCards.value.filter(c => c.checked).reduce((s, c) => s + (c.price || 0), 0))

const filteredBulkCards = computed(() => bulkCards.value)

async function startBulkAdd(set) {
  if (bulkLoading.value) return
  showBulkModal.value = true
  bulkLoading.value = true
  bulkDone.value = false
  bulkSetName.value = set.name
  bulkSetId.value = set.id
  bulkPortfolioId.value = store.portfolios[0]?.id || '__new__'
  newShelfName.value = ''
  bulkCards.value = []
  try {
    const lang = set._lang || activeLang.value
    const allCards = await provider.value.getSetCards(set.id, { lang })
    // Check which cards are already in the selected portfolio
    const portfolio = store.portfolios.find(p => p.id === bulkPortfolioId.value)
    const ownedKeys = new Set(
      (portfolio?.items || [])
        .filter(i => i.type === 'card' && i.game === gameId.value && (i._lang || i.cardData?._lang || 'en') === lang)
        .flatMap(i => [i.cardId, (i.cardData?.name || '').toLowerCase()].filter(Boolean))
    )
    bulkCards.value = allCards.map(c => ({
      ...c,
      checked: !ownedKeys.has(c.id) && !ownedKeys.has(c.name.toLowerCase()),
    }))
  } catch {
    bulkCards.value = []
  } finally {
    bulkLoading.value = false
  }
}

function startBulkAddFromHeader() {
  if (!selectedSet.value) return
  startBulkAdd(selectedSet.value)
}

function toggleBulkCard(idx) {
  bulkCards.value[idx].checked = !bulkCards.value[idx].checked
}
function bulkSelectAll() { bulkCards.value.forEach(c => { c.checked = true }) }
function bulkDeselectAll() { bulkCards.value.forEach(c => { c.checked = false }) }

async function confirmBulkAdd() {
  if (bulkAdding.value || !bulkPortfolioId.value) return
  bulkAdding.value = true
  let targetId = bulkPortfolioId.value
  if (targetId === '__new__') {
    // Empty input falls back to the placeholder — the set's own name
    const p = store.createPortfolio(newShelfName.value.trim() || bulkSetName.value || 'New Shelf')
    targetId = p.id
    bulkPortfolioId.value = p.id
  }
  const toAdd = bulkCards.value.filter(c => c.checked)
  for (const card of toAdd) {
    store.addItem(targetId, {
      type: 'card',
      quantity: 1,
      purchasePrice: 0,
      purchaseDate: '',
      notes: '',
      game: gameId.value,
      _lang: card._lang || selectedSet.value?._lang || activeLang.value,
      // cardId + set.id are what master-set detection and the Hunt gallery
      // match on — without them grouping never finds these items
      cardId: card.id,
      cardData: {
        name: card.name,
        number: card.number,
        set: { id: bulkSetId.value, name: bulkSetName.value },
        images: { small: card.image },
        rarity: card.rarity,
        _lang: card._lang || selectedSet.value?._lang || activeLang.value,
      },
      pcUrl: '',
      currentMarketPrice: card.price,
    })
  }
  bulkAdding.value = false
  bulkDone.value = true
  setTimeout(() => { showBulkModal.value = false; bulkDone.value = false }, 1500)
}

function formatDate(d) {
  if (!d) return ''
  const dt = new Date(d)
  if (isNaN(dt)) return ''
  return dt.toLocaleDateString('en-US', { year: 'numeric', month: 'short' })
}

// Reset + reload when the game in the route changes
watch(gameId, () => {
  selectedSet.value = null
  cards.value = []
  setFilter.value = ''
  cardFilter.value = ''
  selectedLang.value = 'en'
  loadSets()
})

onMounted(loadSets)
</script>

<style scoped>
.sets-view { max-width: 1100px; margin: 0 auto; }

.tcg-crumb { display: flex; align-items: center; gap: 10px; }
.tcg-crumb-name { font-size: 13px; color: var(--text-muted); font-weight: 600; }

.sets-header { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
.lang-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.lang-tab {
  min-height: 44px;
  padding: 8px 14px;
  border: var(--bw) solid var(--ink);
  border-radius: var(--radius);
  background: var(--bg-card);
  color: var(--text-primary);
  box-shadow: var(--shadow-xs);
  font: inherit;
  font-size: 13px;
  font-weight: 800;
  cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.lang-tab:hover { transform: translate(-1px, -1px); box-shadow: var(--shadow-sm); }
.lang-tab:active { transform: translate(1px, 1px); box-shadow: var(--shadow-pressed); }
.lang-tab.active { background: var(--accent); color: var(--on-accent); }
.search-input-wrap { flex: 1; position: relative; display: flex; align-items: center; max-width: 400px; }
.search-input { flex: 1; }
.search-clear { position: absolute; right: 4px; }

.sets-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 12px; }
.set-card {
  background: var(--bg-card); border: var(--bw) solid var(--ink); border-radius: var(--radius-lg);
  box-shadow: var(--shadow-xs);
  padding: 14px 16px; display: flex; align-items: center; gap: 14px; cursor: pointer;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.set-card:hover { transform: translate(-1px, -1px); box-shadow: var(--shadow-sm); }
.set-logo-wrap { width: 48px; min-width: 48px; display: flex; align-items: center; justify-content: center; }
.set-logo { max-width: 48px; max-height: 40px; object-fit: contain; }
.set-logo-placeholder { font-size: 26px; }
.set-badge-lorcana { font-size: 11px; font-weight: 700; background: linear-gradient(135deg, #7b2c9e, #0f9b8e); color: #fff; padding: 4px 8px; border: var(--bw) solid var(--ink); border-radius: 8px; box-shadow: var(--shadow-pressed); letter-spacing: 0.5px; }
.set-badge-one-piece { font-size: 11px; font-weight: 700; background: linear-gradient(135deg, #d7263d, #1b1b3a); color: #fff; padding: 4px 8px; border: var(--bw) solid var(--ink); border-radius: 8px; box-shadow: var(--shadow-pressed); letter-spacing: 0.5px; }
.set-badge-riftbound { font-size: 11px; font-weight: 700; background: linear-gradient(135deg, #0bc6e3, #0a2540); color: #fff; padding: 4px 8px; border: var(--bw) solid var(--ink); border-radius: 8px; box-shadow: var(--shadow-pressed); letter-spacing: 0.5px; }
.set-info { flex: 1; min-width: 0; }
.set-name { font-size: 13px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.set-meta { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin-top: 3px; font-size: 11px; color: var(--text-muted); }
.set-dot { color: var(--text-muted); }
.set-series { color: var(--text-secondary); }
.set-go { color: var(--text-muted); flex-shrink: 0; transition: transform 0.12s ease, color 0.12s ease; }
.set-card:hover .set-go { color: var(--ink); transform: translateX(2px); }

.set-browse-header { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.set-browse-title { display: flex; align-items: center; gap: 8px; font-size: 17px; font-weight: 700; flex: 1; }
.set-browse-filters { display: flex; gap: 8px; align-items: center; }

.cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-bottom: 24px; }
.card-result { background: var(--bg-card); border: var(--bw) solid var(--ink); border-radius: var(--radius-lg); box-shadow: var(--shadow-xs); overflow: hidden; transition: transform 0.12s ease, box-shadow 0.12s ease; }
.card-result:hover { transform: translate(-1px, -1px); box-shadow: var(--shadow-sm); }
.card-img-wrap { position: relative; overflow: hidden; background: #fff; aspect-ratio: 2.5/3.5; border: var(--bw) solid var(--ink); border-radius: 10px; padding: 4px; }
:root[data-theme='dark'] .card-img-wrap { background: var(--bg-card); }
.card-img { width: 100%; height: 100%; object-fit: contain; display: block; }
.card-img-ph { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px; padding: 8px; text-align: center; font-size: 11px; font-weight: 600; color: var(--text-secondary); background: var(--bg-secondary); border: var(--bw) dashed var(--border-subtle); }
.card-overlay { position: absolute; inset: 0; background: rgba(20,20,20,0.55); display: flex; align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s; }
.card-result:hover .card-overlay { opacity: 1; }
/* Touch: buttons stay hidden until the card is tapped once — art first.
   A second tap (on a button) acts; tapping the card again hides them. */
.card-result.revealed .card-overlay { opacity: 1; }
@media (hover: none) { .card-result.revealed .card-overlay { background: linear-gradient(transparent 60%, rgba(20,20,20,0.65)); align-items: flex-end; padding-bottom: 8px; } }
.card-meta { padding: 8px 10px; }
.card-name { font-size: 12px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.card-num { font-size: 10px; }
.card-price-row { display: flex; align-items: center; justify-content: space-between; gap: 6px; margin-top: 4px; }
.card-price { font-size: 13px; font-weight: 800; color: var(--text-primary); font-variant-numeric: tabular-nums; }
.card-rarity { font-size: 9px; }

.skeleton-card { height: 76px; background: var(--bg-secondary); border: var(--bw) dashed var(--border-subtle); border-radius: var(--radius-lg); }
.skeleton-card-tall { aspect-ratio: 2.5/3.5; background: var(--bg-secondary); border: var(--bw) dashed var(--border-subtle); border-radius: var(--radius-lg); }
.shimmer { position: relative; overflow: hidden; }
.shimmer::after { content: ''; position: absolute; inset: 0; background: linear-gradient(90deg, transparent, rgba(255,255,255,0.65), transparent); animation: shimmer-anim 1.5s infinite; }
@keyframes shimmer-anim { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
@media (prefers-reduced-motion: reduce) {
  .shimmer::after { animation: none; background: var(--bg-hover); }
  .set-card:hover, .card-result:hover { transform: none; }
}

/* Bulk add set */
.set-sealed-btn { opacity: 0; transition: opacity 0.15s; flex-shrink: 0; font-size: 16px; padding: 4px 8px; }
.set-card:hover .set-sealed-btn { opacity: 1; }
@media (hover: none) { .set-sealed-btn { opacity: 0.6; } }

.bulk-controls { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.bulk-list { max-height: 50vh; overflow-y: auto; }
.bulk-card-row {
  display: flex; align-items: center; gap: 10px; padding: 8px 10px;
  border-radius: var(--radius); cursor: pointer; transition: background 0.1s;
}
.bulk-card-row:hover { background: var(--bg-hover); }
.bulk-checkbox { flex-shrink: 0; width: 16px; height: 16px; accent-color: var(--accent); }
.bulk-card-img { width: 36px; height: 50px; object-fit: contain; border-radius: 4px; flex-shrink: 0; background: var(--bg-secondary); }
.bulk-card-info { flex: 1; min-width: 0; }
.bulk-card-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bulk-card-meta { font-size: 11px; }
.bulk-card-price { font-size: 13px; font-weight: 800; color: var(--text-primary); flex-shrink: 0; font-variant-numeric: tabular-nums; }
</style>
