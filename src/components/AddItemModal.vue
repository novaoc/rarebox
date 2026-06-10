<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h3>Add to Shelf</h3>
        <button class="btn btn-ghost btn-icon" @click="$emit('close')">✕</button>
      </div>

      <div class="modal-body">
        <!-- Game / TCG selector — only when adding freshly (not from a card) -->
        <div v-if="!props.card && !props.tcgCard" class="form-group mb-3">
          <label class="form-label">Game / TCG</label>
          <select v-model="game" class="select">
            <option v-for="g in games" :key="g.id" :value="g.id">{{ g.label }}</option>
          </select>
        </div>

        <!-- Type selector: card + graded for all TCGs, sealed only for Pokémon -->
        <div v-if="!props.defaultType" class="type-tabs mb-4">
          <button
            v-for="t in visibleTypes"
            :key="t.value"
            class="type-tab"
            :class="{ active: itemType === t.value }"
            @click="itemType = t.value"
          >
            <span>{{ t.icon }}</span> {{ t.label }}
          </button>
        </div>

        <!-- Card / Graded: show card info -->
        <div v-if="card && (itemType === 'card' || itemType === 'graded')" class="card-preview">
          <img v-if="card.images?.small" :src="card.images.small" :alt="card.name" class="card-thumb" @error="$event.target.style.display='none'" />
          <div class="card-preview-info">
            <div class="card-preview-name">{{ card.name }}</div>
            <div class="card-preview-set">{{ card.set?.name }} · #{{ card.number }}</div>
            <div class="card-preview-price" v-if="currentPrice">
              Market: <span class="text-accent font-bold">${{ currentPrice.toFixed(2) }}</span>
            </div>
          </div>
        </div>

        <!-- Graded specific -->
        <div v-if="itemType === 'graded' && game !== 'riftbound'" class="form-row mt-3">
          <div class="form-group">
            <label class="form-label">Grading Company</label>
            <select v-model="form.gradingCompany" class="select">
              <option value="PSA">PSA</option>
              <option value="BGS">BGS</option>
              <option value="CGC">CGC</option>
              <option value="ACE">ACE</option>
              <option value="Other">Other</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Grade</label>
            <select v-model="form.grade" class="select">
              <option v-for="g in gradeOptions" :key="g" :value="g">{{ g }}</option>
            </select>
          </div>
        </div>

        <!-- Card variant selector -->
        <div v-if="itemType === 'card' && variants.length > 0" class="form-group mt-2">
          <label class="form-label">Variant / Finish</label>
          <select v-model="form.priceVariant" class="select">
            <option v-for="v in variants" :key="v.key" :value="v.key">
              {{ v.label }} — ${{ v.market?.toFixed(2) || '—' }}
            </option>
          </select>
        </div>

        <!-- Sealed (Pokémon) + any non-Pokémon TCG: PriceCharting search -->
        <div v-if="itemType === 'sealed' || !isPokemon">
          <!-- Search -->
          <div class="form-group">
            <label class="form-label">{{ isPokemon ? 'Search by Set Name' : 'Search cards & sealed products' }}</label>
            <div class="flex gap-2">
              <input
                v-model="sealedQuery"
                class="input"
                :placeholder="isPokemon ? 'e.g. Fusion Strike, Phantasmal Flames case…' : 'e.g. card or set name…'"
                @keyup.enter="doSealedSearch"
              />
              <button
                class="btn btn-secondary btn-sm"
                :disabled="sealedSearching || !sealedQuery.trim()"
                @click="doSealedSearch"
                style="flex-shrink:0"
              >
                <span v-if="sealedSearching" class="spinner spinner-sm"></span>
                <span v-else>Search</span>
              </button>
            </div>
            <div v-if="sealedError" class="text-danger mt-1" style="font-size:12px">{{ sealedError }}</div>
          </div>

          <!-- Results -->
          <div v-if="sealedResults.length > 0" class="sealed-results mb-3">
            <div
              v-for="r in sealedResults"
              :key="r.url"
              class="sealed-result"
              :class="{ selected: form.name === r.name && form.setName === r.set }"
              @click="selectSealed(r)"
            >
              <img v-if="r.image" :src="r.image" class="sealed-result-img" loading="lazy" />
              <div class="sealed-result-info">
                <div class="sealed-result-name">{{ r.name }}</div>
                <div class="sealed-result-set">{{ r.set }}</div>
              </div>
              <div class="sealed-result-price text-accent" v-if="r.price">${{ r.price.toFixed(2) }}</div>
              <div class="sealed-result-price text-muted" v-else>—</div>
            </div>
          </div>

          <!-- Selected product preview -->
          <div v-if="form.name" class="sealed-selected mb-3">
            <div class="sealed-selected-label">Selected</div>
            <div class="sealed-selected-row">
              <img v-if="form.imageUrl" :src="form.imageUrl" class="sealed-selected-img" />
              <div>
                <div class="sealed-selected-name">{{ form.name }}</div>
                <div class="sealed-selected-set">{{ form.setName }}</div>
              </div>
            </div>
            <button class="btn btn-ghost btn-sm mt-1" style="font-size:11px" @click="clearSealed">✕ Clear</button>
          </div>

          <!-- Manual fallback -->
          <details class="mt-1 mb-2">
            <summary style="font-size:12px;color:var(--text-muted);cursor:pointer">Enter manually instead</summary>
            <div class="form-group mt-2">
              <label class="form-label">Product Name</label>
              <input v-model="form.name" class="input" placeholder="e.g. Scarlet & Violet Booster Box" />
            </div>
            <div class="form-group">
              <label class="form-label">Set / Series</label>
              <input v-model="form.setName" class="input" placeholder="e.g. Scarlet & Violet Base" />
            </div>
          </details>

          <div class="form-group">
            <label class="form-label">Current Market Value ($)</label>
            <input v-model.number="form.currentValue" class="input" type="number" min="0" step="0.01" placeholder="0.00" />
          </div>
        </div>

        <!-- Shared fields -->
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Purchase Price ($)</label>
            <input v-model.number="form.purchasePrice" class="input" type="number" min="0" step="0.01" placeholder="0.00" />
          </div>
          <div class="form-group">
            <label class="form-label">Quantity</label>
            <input v-model.number="form.quantity" class="input" type="number" min="1" step="1" placeholder="1" />
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Purchase Date</label>
          <input v-model="form.purchaseDate" class="input" type="date" />
        </div>

        <div class="form-group">
          <label class="form-label">Shelf</label>
          <select v-model="form.portfolioId" class="select">
            <option v-for="p in store.portfolios" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Notes (optional)</label>
          <textarea v-model="form.notes" class="textarea" placeholder="Any notes about this item..."></textarea>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-secondary" @click="$emit('close')">Cancel</button>
        <button class="btn btn-primary" :disabled="!canSubmit" @click="submit">
          Add to Shelf
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { usePortfolioStore } from '../stores/portfolio'
import { getAllVariants, getMarketPrice } from '../services/pokemonApi'
import { searchSealed } from '../services/priceServer'
import { SUPPORTED_GAMES, searchProducts } from '../services/priceFeedService'

const props = defineProps({
  card: { type: Object, default: null },
  defaultPortfolioId: { type: String, default: null },
  defaultType: { type: String, default: null },
  // Pre-filled non-Pokémon card from the Browse view:
  // { game, name, set, number, image, price }
  tcgCard: { type: Object, default: null }
})

const emit = defineEmits(['close', 'added'])
const store = usePortfolioStore()

const itemType = ref(props.defaultType || 'card')
const types = [
  { value: 'card', label: 'Raw Card', icon: '🃏' },
  { value: 'graded', label: 'Graded Slab', icon: '🏆' },
  { value: 'sealed', label: 'Sealed Product', icon: '📦' },
]

// Game / TCG. Pokémon keeps the rich pokemontcg.io flow; any other game is
// tracked via PriceCharting search (singles + sealed). A card passed in from
// Pokémon search locks the game to pokemon.
const game = ref(props.tcgCard?.game || 'pokemon')
const games = SUPPORTED_GAMES
const isPokemon = computed(() => game.value === 'pokemon')
// All TCGs get card/graded/sealed. Riftbound hides graded.
const visibleTypes = computed(() => {
  if (game.value === 'riftbound') {
    if (itemType.value === 'graded') itemType.value = 'card'
    return types.filter(t => t.value !== 'graded')
  }
  return types
})
// Whether the currently-selected non-Pokémon product is a sealed product.
const selectedIsSealed = ref(false)

const gradesByCompany = {
  PSA:   ['10', '9', '8', '7', '6', '5', '4', '3', '2', '1'],
  BGS:   ['10', '9.5', '9', '8.5', '8', '7.5', '7', '6', '5', '4', '3', '2', '1'],
  CGC:   ['10', '9.5', '9', '8.5', '8', '7.5', '7', '6', '5', '4', '3', '2', '1'],
  ACE:   ['10', '9', '8', '7', '6', '5', '4', '3', '2', '1'],
  Other: ['10', '9.5', '9', '8', '7', '6', '5', '4', '3', '2', '1'],
}
const gradeOptions = computed(() => gradesByCompany[form.value.gradingCompany] || gradesByCompany.PSA)

// Sealed search
const sealedQuery = ref('')
const sealedSearching = ref(false)
const sealedResults = ref([])
const sealedError = ref('')

async function doSealedSearch() {
  if (!sealedQuery.value.trim()) return
  sealedSearching.value = true
  sealedError.value = ''
  sealedResults.value = []
  try {
    if (isPokemon.value) {
      const data = await searchSealed(sealedQuery.value)
      sealedResults.value = data.results || []
    } else {
      // Any other TCG: PriceCharting search covers both singles and sealed.
      sealedResults.value = await searchProducts(sealedQuery.value, game.value)
    }
    if (sealedResults.value.length === 0) sealedError.value = 'No products found'
  } catch (e) {
    if (e.message === 'server_down') sealedError.value = 'PriceCharting unavailable — check your connection'
    else if (e.message === 'timeout') sealedError.value = 'Request timed out'
    else sealedError.value = 'Search failed'
  } finally {
    sealedSearching.value = false
  }
}

function selectSealed(result) {
  form.value.name = result.name
  form.value.setName = result.set
  form.value.pcUrl = result.url
  form.value.imageUrl = result.image || ''
  if (result.price) form.value.currentValue = result.price
  // Pokémon results are always sealed; other TCGs carry an inferred `sealed` flag.
  selectedIsSealed.value = isPokemon.value ? true : (result.sealed !== false)
  sealedResults.value = []
}

function clearSealed() {
  form.value.name = ''
  form.value.setName = ''
  form.value.currentValue = null
  form.value.pcUrl = ''
  form.value.imageUrl = ''
}

const form = ref({
  name: '',
  setName: '',
  pcUrl: '',
  imageUrl: '',
  sealedType: 'booster_box',
  priceVariant: '',
  gradingCompany: 'PSA',
  grade: '10',
  purchasePrice: null,
  currentValue: null,
  quantity: 1,
  purchaseDate: new Date().toISOString().split('T')[0],
  portfolioId: '',
  notes: ''
})

const variants = computed(() => {
  if (!props.card) return []
  return getAllVariants(props.card)
})

const currentPrice = computed(() => {
  if (!props.card) return null
  if (form.value.priceVariant) {
    const v = variants.value.find(v => v.key === form.value.priceVariant)
    return v?.market || null
  }
  const result = getMarketPrice(props.card)
  return result?.price || null
})

const canSubmit = computed(() => {
  if (!isPokemon.value) return form.value.name.trim().length > 0
  if (itemType.value === 'sealed') return form.value.name.trim().length > 0
  return !!props.card
})

function submit() {
  const portfolioId = form.value.portfolioId || store.portfolios[0]?.id
  if (!portfolioId) return

  let item = {
    type: itemType.value,
    quantity: form.value.quantity || 1,
    purchasePrice: form.value.purchasePrice || 0,
    purchaseDate: form.value.purchaseDate,
    notes: form.value.notes,
  }

  if (!isPokemon.value) {
    // Non-Pokémon TCG item, sourced from PriceCharting. Modeled with the same
    // generic fields the rest of the app already renders/values/refreshes.
    const value = form.value.currentValue || form.value.purchasePrice || 0
    if (selectedIsSealed.value) {
      item = {
        ...item,
        type: 'sealed',
        game: game.value,
        name: form.value.name,
        setName: form.value.setName,
        pcUrl: form.value.pcUrl,
        imageUrl: form.value.imageUrl,
        sealedType: 'sealed',
        currentValue: value,
      }
    } else if (itemType.value === 'graded') {
      item = {
        ...item,
        type: 'graded',
        game: game.value,
        cardData: {
          name: form.value.name,
          number: '',
          set: { name: form.value.setName },
          images: { small: form.value.imageUrl },
        },
        gradingCompany: form.value.gradingCompany,
        grade: form.value.grade,
        currentValue: value,
      }
    } else {
      item = {
        ...item,
        type: 'card',
        game: game.value,
        cardData: {
          name: form.value.name,
          number: '',
          set: { name: form.value.setName },
          images: { small: form.value.imageUrl },
        },
        pcUrl: form.value.pcUrl,
        currentMarketPrice: value,
      }
    }
  } else if (itemType.value === 'card') {
    item = {
      ...item,
      cardId: props.card.id,
      _lang: props.card._lang || null,
      cardData: {
        name: props.card.name,
        number: props.card.number,
        images: props.card.images,
        set: { id: props.card.set?.id, name: props.card.set?.name },
        rarity: props.card.rarity,
        supertype: props.card.supertype,
        subtypes: props.card.subtypes,
      },
      priceVariant: form.value.priceVariant,
      currentMarketPrice: currentPrice.value,
    }
  } else if (itemType.value === 'graded') {
    item = {
      ...item,
      cardId: props.card.id,
      _lang: props.card._lang || null,
      cardData: {
        name: props.card.name,
        number: props.card.number,
        images: props.card.images,
        set: { id: props.card.set?.id, name: props.card.set?.name },
        rarity: props.card.rarity,
      },
      gradingCompany: form.value.gradingCompany,
      grade: form.value.grade,
      currentValue: form.value.currentValue || form.value.purchasePrice || 0,
    }
  } else {
    item = {
      ...item,
      name: form.value.name,
      setName: form.value.setName,
      pcUrl: form.value.pcUrl,
      imageUrl: form.value.imageUrl,
      sealedType: form.value.sealedType,
      currentValue: form.value.currentValue || form.value.purchasePrice || 0,
    }
  }

  store.addItem(portfolioId, item)
  emit('added', item)
  emit('close')
}

onMounted(() => {
  form.value.portfolioId = props.defaultPortfolioId || store.activePortfolio?.id || store.portfolios[0]?.id || ''

  // Pre-fill from a Browse-view non-Pokémon card (skips the search step).
  if (props.tcgCard) {
    form.value.name = props.tcgCard.name || ''
    form.value.setName = props.tcgCard.set || ''
    form.value.imageUrl = props.tcgCard.image || ''
    if (props.tcgCard.price != null) form.value.currentValue = props.tcgCard.price
    selectedIsSealed.value = false // singles from Browse
  }

  // Pre-select best variant
  if (props.card && variants.value.length > 0) {
    const priority = ['holofoil', '1stEditionHolofoil', 'unlimitedHolofoil', 'reverseHolofoil', 'normal']
    const best = priority.find(k => variants.value.some(v => v.key === k))
    form.value.priceVariant = best || variants.value[0]?.key || ''
  }
})

watch(() => props.card, () => {
  if (props.card && variants.value.length > 0) {
    const priority = ['holofoil', '1stEditionHolofoil', 'unlimitedHolofoil', 'reverseHolofoil', 'normal']
    const best = priority.find(k => variants.value.some(v => v.key === k))
    form.value.priceVariant = best || variants.value[0]?.key || ''
  }
})
</script>

<style scoped>
.type-tabs { display: flex; gap: 6px; }
.type-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  border: var(--bw) solid var(--border);
  border-radius: var(--radius);
  background: var(--bg-card);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.12s, box-shadow 0.12s;
}
.type-tab:hover { background: var(--bg-hover); }
.type-tab.active { background: var(--accent); color: var(--on-accent); box-shadow: var(--shadow-xs); }

.card-preview {
  display: flex;
  align-items: center;
  gap: 14px;
  background: var(--bg-card);
  border: var(--bw) solid var(--border);
  border-radius: var(--radius);
  box-shadow: var(--shadow-xs);
  padding: 12px;
}
.card-thumb {
  width: 52px;
  height: 72px;
  object-fit: contain;
  border-radius: 4px;
}
.card-preview-name { font-weight: 600; font-size: 15px; }
.card-preview-set { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
.card-preview-price { font-size: 12px; color: var(--text-muted); margin-top: 4px; }

.sealed-results {
  background: var(--bg-card);
  border: var(--bw) solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  max-height: 240px;
  overflow-y: auto;
}
.sealed-result {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-subtle);
  cursor: pointer;
  transition: background 0.12s;
}
.sealed-result:last-child { border-bottom: none; }
.sealed-result:hover { background: var(--bg-hover); }
.sealed-result.selected { background: var(--accent-dim); }
.sealed-result-img {
  width: 36px;
  height: 36px;
  object-fit: contain;
  border-radius: 4px;
  background: var(--bg-secondary);
  flex-shrink: 0;
}
.sealed-result-info { flex: 1; min-width: 0; }
.sealed-result-name { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sealed-result-set { font-size: 11px; color: var(--text-muted); flex-shrink: 0; }
.sealed-result-price { font-size: 13px; font-weight: 700; flex-shrink: 0; margin-left: 8px; }

.sealed-selected {
  background: var(--accent-dim);
  border: var(--bw) solid var(--border);
  border-radius: var(--radius);
  padding: 10px 12px;
}
.sealed-selected-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 2px; }
.sealed-selected-row { display: flex; align-items: center; gap: 12px; }
.sealed-selected-img {
  width: 48px;
  height: 48px;
  object-fit: contain;
  border-radius: 6px;
  background: var(--bg-card);
  border: 1px solid var(--border-subtle);
  flex-shrink: 0;
}
.sealed-selected-name { font-size: 14px; font-weight: 600; }
.sealed-selected-set { font-size: 12px; color: var(--text-secondary); }

/* Mobile responsive */
@media (max-width: 640px) {
  .modal-overlay { align-items: flex-end; padding: 0; }
  .modal {
    max-height: 92vh;
    width: 100%;
    max-width: 100%;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  }
  .modal-body { padding: 16px; overflow-y: auto; }
  .type-tab { font-size: 12px; padding: 8px 6px; gap: 4px; }
  .card-preview { flex-direction: column; text-align: center; gap: 8px; }
  .form-row { flex-direction: column; gap: 0; }
  .sealed-result { flex-wrap: wrap; }
  .sealed-result-price { margin-left: 0; }
}
</style>
