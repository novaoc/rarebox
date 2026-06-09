<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h3>Add to Portfolio</h3>
        <button class="btn btn-ghost btn-icon" @click="$emit('close')">✕</button>
      </div>

      <div class="modal-body">
        <!-- Type selector -->
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

        <!-- Card Preview -->
        <div v-if="card && (itemType === 'card' || itemType === 'graded')" class="card-preview">
          <img :src="card.images?.small" :alt="card.name" class="card-thumb" />
          <div class="card-preview-info">
            <div class="card-preview-name">{{ card.name }}</div>
            <div class="card-preview-set">{{ card.set?.name }} · #{{ card.number }}</div>
            <div class="card-preview-price mt-1" v-if="currentPrice">
              Market: <span class="text-accent font-bold">${{ currentPrice.toFixed(2) }}</span>
            </div>
          </div>
        </div>

        <!-- Form Fields -->
        <div class="scroll-body mt-4">
          <div v-if="itemType === 'graded'" class="form-row">
            <div class="form-group">
              <label class="form-label">Company</label>
              <select v-model="form.gradingCompany" class="select">
                <option v-for="c in ['PSA','BGS','CGC','ACE','SGC']" :key="c" :value="c">{{ c }}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Grade</label>
              <select v-model="form.grade" class="select">
                <option v-for="g in gradeOptions" :key="g" :value="g">{{ g }}</option>
              </select>
            </div>
          </div>

          <div v-if="itemType === 'card' && variants.length > 0" class="form-group">
            <label class="form-label">Variant / Finish</label>
            <select v-model="form.priceVariant" class="select">
              <option v-for="v in variants" :key="v.key" :value="v.key">
                {{ v.label }} — ${{ v.market?.toFixed(2) || '—' }}
              </option>
            </select>
          </div>

          <div class="form-row mt-2">
            <div class="form-group">
              <label class="form-label">Paid (Each)</label>
              <div class="input-with-icon">
                <span class="icon">$</span>
                <input v-model.number="form.purchasePrice" class="input" type="number" step="0.01" placeholder="0.00" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Quantity</label>
              <input v-model.number="form.quantity" class="input" type="number" min="1" />
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Portfolio</label>
            <select v-model="form.portfolioId" class="select">
              <option v-for="p in store.portfolios" :key="p.id" :value="p.id">{{ p.name }}</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label">Purchase Date</label>
            <input v-model="form.purchaseDate" class="input" type="date" />
          </div>

          <div class="form-group">
            <label class="form-label">Notes (Optional)</label>
            <textarea v-model="form.notes" class="textarea" placeholder="e.g. Bought from eBay, mint condition..."></textarea>
          </div>
        </div>
      </div>

      <div class="modal-footer">
        <button class="btn btn-ghost btn-lg flex-1" @click="$emit('close')">Cancel</button>
        <button class="btn btn-primary btn-lg flex-2" :disabled="!canSubmit" @click="submit">
          Add to Portfolio
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { usePortfolioStore } from '../stores/portfolio'
import { getAllVariants, getMarketPrice } from '../services/pokemonApi'

const props = defineProps({
  card: { type: Object, default: null },
  defaultPortfolioId: { type: String, default: null },
  defaultType: { type: String, default: 'card' }
})

const emit = defineEmits(['close', 'added'])
const store = usePortfolioStore()

const itemType = ref(props.defaultType)
const types = [
  { value: 'card', label: 'Raw', icon: '🃏' },
  { value: 'graded', label: 'Graded', icon: '🏆' },
  { value: 'sealed', label: 'Sealed', icon: '📦' },
]

const visibleTypes = computed(() => types)

const form = ref({
  purchasePrice: null,
  quantity: 1,
  portfolioId: props.defaultPortfolioId || '',
  gradingCompany: 'PSA',
  grade: '10',
  priceVariant: '',
  purchaseDate: new Date().toISOString().split('T')[0],
  notes: ''
})

const gradeOptions = ['10', '9.5', '9', '8.5', '8', '7', '6', '5', '4', '3', '2', '1']

const variants = computed(() => props.card ? getAllVariants(props.card) : [])
const currentPrice = computed(() => {
  if (!props.card) return null
  const result = getMarketPrice(props.card, form.value.priceVariant)
  return result?.price || result || null
})

const canSubmit = computed(() => props.card != null && form.value.portfolioId != '')

function submit() {
  const item = {
    type: itemType.value,
    cardId: props.card.id,
    cardData: {
      name: props.card.name,
      number: props.card.number,
      images: props.card.images,
      set: props.card.set
    },
    quantity: form.value.quantity,
    purchasePrice: form.value.purchasePrice || 0,
    purchaseDate: form.value.purchaseDate,
    notes: form.value.notes,
    priceVariant: form.value.priceVariant,
    gradingCompany: itemType.value === 'graded' ? form.value.gradingCompany : null,
    grade: itemType.value === 'graded' ? form.value.grade : null,
    currentMarketPrice: currentPrice.value
  }
  store.addItem(form.value.portfolioId, item)
  emit('close')
}

onMounted(() => {
  if (!form.value.portfolioId && store.portfolios.length > 0) {
    form.value.portfolioId = store.portfolios[0].id
  }
})
</script>

<style scoped>
.modal { max-width: 480px; display: flex; flex-direction: column; }
.modal-body { flex: 1; overflow: hidden; display: flex; flex-direction: column; }
.scroll-body { overflow-y: auto; padding-bottom: 20px; }

.type-tabs { display: flex; gap: 8px; }
.type-tab { flex: 1; height: 44px; display: flex; align-items: center; justify-content: center; gap: 6px; border: 1px solid var(--border); border-radius: 12px; background: none; color: var(--text-secondary); cursor: pointer; font-weight: 600; }
.type-tab.active { background: var(--accent-dim); color: var(--accent); border-color: var(--accent); }

.card-preview { display: flex; align-items: center; gap: 16px; background: var(--bg-card); padding: 12px; border-radius: 12px; border: 1px solid var(--border); }
.card-thumb { width: 60px; height: 84px; object-fit: contain; border-radius: 4px; }
.card-preview-name { font-size: 16px; font-weight: 700; }
.card-preview-set { font-size: 13px; color: var(--text-muted); }

.input-with-icon { position: relative; }
.input-with-icon .icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-weight: 600; }
.input-with-icon .input { padding-left: 28px; }

.flex-2 { flex: 2; }

@media (max-width: 640px) {
  .modal { height: 90vh; border-radius: 24px 24px 0 0; }
  .modal-footer { padding: 16px; gap: 12px; }
  .btn-lg { min-height: 52px; font-size: 16px; font-weight: 700; }
}
</style>
