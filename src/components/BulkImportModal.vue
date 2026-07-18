<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal bulk-modal">

      <!-- Header -->
      <div class="modal-header">
        <h3>Bulk Import</h3>
        <button class="btn btn-ghost btn-icon" @click="$emit('close')">✕</button>
      </div>

      <!-- Step 1: Paste -->
      <div v-if="step === 'input'" class="modal-body">
        <p class="hint">Paste a PTCGL/PTCGO deck list. Each line should look like:<br>
          <code>4 Charizard ex OBF 125</code>
        </p>
        <textarea
          v-model="deckText"
          class="textarea deck-input"
          placeholder="4 Charizard ex OBF 125&#10;3 Pidgeot ex OBF 164&#10;4 Arven SVI 166&#10;..."
          rows="12"
          ref="textareaRef"
        ></textarea>
        <div v-if="parseError" class="text-danger mt-2" style="font-size:13px">{{ parseError }}</div>
      </div>

      <!-- Step 2: Loading -->
      <div v-else-if="step === 'loading'" class="modal-body flex-center" style="flex-direction:column;gap:16px;padding:48px 24px">
        <div class="spinner spinner-lg"></div>
        <div class="text-secondary" style="font-size:14px">
          Looking up cards... {{ resolvedCount }} / {{ totalCount }}
        </div>
        <div class="progress-bar-wrap">
          <div class="progress-bar" :style="{ width: progressPct + '%' }"></div>
        </div>
      </div>

      <!-- Step 3: Preview -->
      <div v-else-if="step === 'preview'" class="modal-body preview-body">
        <div class="preview-summary">
          <span class="text-success">{{ resolved.length }} found</span>
          <span v-if="unresolved.length" class="text-danger ml-3">{{ unresolved.length }} not found</span>
          <span class="text-muted ml-3">Total: <strong class="text-accent">${{ totalValue.toFixed(2) }}</strong></span>
        </div>

        <div class="preview-table-wrap">
          <table class="table">
            <thead>
              <tr>
                <th>Card</th>
                <th>Set</th>
                <th>Qty</th>
                <th>Price ea.</th>
                <th>Line</th>
                <th style="width:32px"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in resolved" :key="i" :class="{ excluded: r.excluded }">
                <td>
                  <div class="preview-card-cell">
                    <img v-if="r.card?.images?.small" :src="r.card.images.small" class="preview-thumb" />
                    <span>{{ r.card?.name || r.rawName }}</span>
                  </div>
                </td>
                <td style="font-size:11px;color:var(--text-muted)">{{ r.card?.set?.name }}</td>
                <td class="font-mono">{{ r.qty }}</td>
                <td class="font-mono">
                  <span v-if="r.price != null" class="text-accent">${{ r.price.toFixed(2) }}</span>
                  <span v-else class="text-muted">—</span>
                </td>
                <td class="font-mono">
                  <span v-if="r.price != null">${{ (r.price * r.qty).toFixed(2) }}</span>
                  <span v-else class="text-muted">—</span>
                </td>
                <td>
                  <button
                    class="btn btn-ghost btn-icon btn-sm"
                    :title="r.excluded ? 'Include' : 'Exclude'"
                    @click="r.excluded = !r.excluded"
                    style="font-size:14px"
                  >{{ r.excluded ? '○' : '●' }}</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div v-if="unresolved.length" class="unresolved-section">
          <div class="unresolved-label text-danger">Not found (will be skipped):</div>
          <div v-for="u in unresolved" :key="u.raw" class="unresolved-row text-muted">
            {{ u.raw }}
          </div>
        </div>

        <div class="import-options">
          <div class="form-group">
            <label class="form-label">Purchase price</label>
            <div class="radio-row">
              <label class="radio-opt">
                <input type="radio" v-model="priceMode" value="market" /> Use market price
              </label>
              <label class="radio-opt">
                <input type="radio" v-model="priceMode" value="zero" /> Set to $0.00
              </label>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Purchase date</label>
            <input v-model="purchaseDate" type="date" class="input input-sm" style="max-width:180px" />
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="modal-footer">
        <button class="btn btn-secondary" @click="handleBack">
          {{ step === 'input' ? 'Cancel' : '← Back' }}
        </button>
        <button
          v-if="step === 'input'"
          class="btn btn-primary"
          :disabled="!deckText.trim()"
          @click="startLookup"
        >
          Look Up Cards →
        </button>
        <button
          v-if="step === 'preview'"
          class="btn btn-primary"
          :disabled="activeResolved.length === 0"
          @click="doImport"
        >
          Add {{ activeResolved.length }} Card{{ activeResolved.length !== 1 ? 's' : '' }} to Shelf
        </button>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick, onMounted } from 'vue'
import { usePortfolioStore } from '../stores/portfolio'
import { getMarketPrice } from '../services/pokemonApi'
import { getEnPriceMap, enrichPokemonCard } from '../services/tcg/enPrices'

const props = defineProps({
  portfolioId: { type: String, required: true }
})
const emit = defineEmits(['close', 'imported'])

const store = usePortfolioStore()
const textareaRef = ref(null)

const step = ref('input')
const deckText = ref('')
const parseError = ref('')
const resolved = ref([])   // { qty, rawName, card, price, variant, excluded }
const unresolved = ref([]) // { raw }
const resolvedCount = ref(0)
const totalCount = ref(0)
const priceMode = ref('market')
const purchaseDate = ref(new Date().toISOString().split('T')[0])

const progressPct = computed(() =>
  totalCount.value > 0 ? Math.round((resolvedCount.value / totalCount.value) * 100) : 0
)

const activeResolved = computed(() => resolved.value.filter(r => !r.excluded))

const totalValue = computed(() =>
  activeResolved.value.reduce((s, r) => s + (r.price ?? 0) * r.qty, 0)
)

onMounted(() => nextTick(() => textareaRef.value?.focus()))

// ── Deck list parser ──────────────────────────────────────────────────────────
// Handles PTCGL format: "4 Charizard ex OBF 125"
// Also handles lines like "Pokémon: 12", "Trainer: 28", etc. (section headers — skip)
// Energy lines like "4 Basic {R} Energy SVE 2" are parsed the same way
function parseDeckList(text) {
  const entries = []
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  for (const line of lines) {
    // Skip section headers (e.g. "Pokémon: 12", "Trainer:", "Energy:")
    if (/^(Pokémon|Pokemon|Trainer|Energy|Total\s*Cards?)[\s:]/i.test(line)) continue
    if (/^\*/.test(line)) continue // skip comment lines

    // Match: QTY NAME SETCODE NUMBER
    // Set codes are 2-3 uppercase letters+digits (e.g. OBF, SVI, PAL, SVP, PR-SW)
    const m = line.match(/^(\d+)\s+(.+?)\s+([A-Z]{1,3}(?:-[A-Z]{1,3})?(?:[A-Z0-9]+)?)\s+(\d+[A-Z]?)$/)
    if (m) {
      entries.push({
        qty: parseInt(m[1], 10),
        name: m[2].trim(),
        setCode: m[3].trim(),
        number: m[4].trim(),
        raw: line
      })
    }
    // Try fallback: "QTY NAME" with no set info (just add by name)
    else {
      const m2 = line.match(/^(\d+)\s+(.+)$/)
      if (m2) {
        entries.push({
          qty: parseInt(m2[1], 10),
          name: m2[2].trim(),
          setCode: null,
          number: null,
          raw: line
        })
      }
    }
  }
  return entries
}

async function lookupCard(entry) {
  const BASE = 'https://api.pokemontcg.io/v2/cards'
  const cache = window.__rarebox_lookup_cache__ || (window.__rarebox_lookup_cache__ = new Map())

  let q
  if (entry.setCode && entry.number) {
    // Normalize set code to lowercase for the API
    q = `set.id:${entry.setCode.toLowerCase()} number:${entry.number}`
  } else {
    q = `name:"${entry.name}"`
  }

  if (cache.has(q)) return cache.get(q)

  try {
    const res = await fetch(`${BASE}?q=${encodeURIComponent(q)}&pageSize=1`, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) return null
    const data = await res.json()
    const card = data.data?.[0] || null
    // me2pt5+ cards arrive URL-only — fill from the shared EN fallback
    // BEFORE caching so getMarketPrice (and the import) sees the price.
    // Strict no-op for live-priced cards and other games' lookups.
    if (card) enrichPokemonCard(card, await getEnPriceMap())
    cache.set(q, card)
    return card
  } catch {
    return null
  }
}

async function startLookup() {
  parseError.value = ''
  const entries = parseDeckList(deckText.value)
  if (entries.length === 0) {
    parseError.value = 'No valid card lines found. Format: "4 Charizard ex OBF 125"'
    return
  }

  step.value = 'loading'
  resolved.value = []
  unresolved.value = []
  resolvedCount.value = 0
  totalCount.value = entries.length

  // Deduplicate by key, merge quantities
  const deduped = new Map()
  for (const e of entries) {
    const key = e.setCode && e.number ? `${e.setCode}-${e.number}` : e.name
    if (deduped.has(key)) {
      deduped.get(key).qty += e.qty
    } else {
      deduped.set(key, { ...e })
    }
  }

  const dedupeList = [...deduped.values()]
  totalCount.value = dedupeList.length

  for (const entry of dedupeList) {
    const card = await lookupCard(entry)
    resolvedCount.value++

    if (card) {
      const priceResult = getMarketPrice(card)
      resolved.value.push({
        qty: entry.qty,
        rawName: entry.name,
        card,
        price: priceResult?.price ?? null,
        variant: priceResult?.variant || null,
        excluded: false,
      })
    } else {
      unresolved.value.push({ raw: entry.raw, name: entry.name, qty: entry.qty })
    }

    // Small delay to avoid hammering the API
    await new Promise(r => setTimeout(r, 80))
  }

  step.value = 'preview'
}

function handleBack() {
  if (step.value === 'input') {
    emit('close')
  } else {
    step.value = 'input'
  }
}

function doImport() {
  const today = purchaseDate.value || new Date().toISOString().split('T')[0]
  let added = 0

  for (const r of activeResolved.value) {
    // $0 market is real — never collapse with || to 0/null incorrectly
    const market = (typeof r.price === 'number' && Number.isFinite(r.price)) ? r.price : null
    const purchasePrice = priceMode.value === 'market' ? (market ?? 0) : 0

    store.addItem(props.portfolioId, {
      type: 'card',
      cardId: r.card.id,
      _lang: r.card._lang || null,
      cardData: r.card,
      quantity: r.qty,
      purchasePrice,
      currentMarketPrice: market,
      priceVariant: r.variant || null,
      purchaseDate: today,
    })
    added++
  }

  emit('imported', added)
  emit('close')
}
</script>

<style scoped>
.bulk-modal {
  max-width: 680px;
  width: 95vw;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.hint {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 12px;
  line-height: 1.6;
}
.hint code {
  background: var(--accent-dim);
  border: 1px solid var(--border-subtle);
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 12px;
  color: var(--ink);
  font-weight: 600;
}

.deck-input {
  width: 100%;
  font-family: monospace;
  font-size: 13px;
  resize: vertical;
}

.progress-bar-wrap {
  width: 260px;
  height: 12px;
  background: var(--bg-card);
  border: var(--bw) solid var(--ink);
  border-radius: 999px;
  overflow: hidden;
}
.progress-bar {
  height: 100%;
  background: var(--accent);
  transition: width 0.3s;
}

.preview-body {
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.preview-summary {
  font-size: 14px;
  font-weight: 600;
  padding-bottom: 4px;
}

.preview-table-wrap {
  overflow-x: auto;
  overflow-y: auto;
  max-height: 340px;
  background: var(--bg-card);
  border: var(--bw) solid var(--ink);
  border-radius: var(--radius);
}

.preview-thumb {
  width: 28px;
  height: 39px;
  object-fit: contain;
  border-radius: 2px;
  border: 1px solid var(--border-subtle);
}

.preview-card-cell {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

tr.excluded {
  opacity: 0.35;
}

.unresolved-section {
  font-size: 12px;
}
.unresolved-label {
  font-weight: 600;
  margin-bottom: 4px;
  font-size: 12px;
}
.unresolved-row {
  padding: 2px 0;
  font-family: monospace;
}

.import-options {
  display: flex;
  gap: 24px;
  flex-wrap: wrap;
  border-top: var(--bw) solid var(--border-subtle);
  padding-top: 12px;
}

.radio-row {
  display: flex;
  gap: 16px;
  margin-top: 6px;
}
.radio-opt {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  cursor: pointer;
}

/* Mobile — bottom sheet */
@media (max-width: 640px) {
  .modal-overlay { align-items: flex-end; padding: 0; }
  .bulk-modal {
    max-height: 95vh;
    width: 100%;
    max-width: 100%;
    border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  }
  .import-options { flex-direction: column; gap: 12px; }
  .radio-row { flex-direction: column; gap: 8px; }
  .preview-table-wrap { max-height: 260px; }
}
</style>
