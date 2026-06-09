<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal">
      <div class="modal-header">
        <h3>Add to Portfolio</h3>
        <button class="btn btn-ghost btn-icon" @click="$emit('close')">✕</button>
      </div>

      <div class="modal-body">
        <!-- Type selector: Raw, Graded, Sealed -->
        <div v-if="!props.defaultType" class="type-tabs mb-4">
          <button
            v-for="t in types"
            :key="t.value"
            class="type-tab"
            :class="{ active: itemType === t.value }"
            @click="itemType = t.value"
          >
            <span class="type-icon">{{ t.icon }}</span>
            <span class="type-label">{{ t.label }}</span>
          </button>
        </div>

        <!-- Item Preview -->
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

        <div v-else-if="itemType === 'sealed'" class="sealed-placeholder">
          <div class="sealed-icon">📦</div>
          <div class="sealed-text">
            <div class="font-bold">Sealed Product</div>
            <div class="text-muted text-sm">Track booster boxes, ETBs, and packs.</div>
          </div>
        </div>

        <!-- Form Fields -->
        <div class="scroll-body mt-4">
          <!-- Graded Specific Fields: Company & Grade -->
          <div v-if="itemType === 'graded'" class="form-row-wrap mb-4">
            <div class="form-group">
              <label class="form-label">Grading Company</label>
              <select v-model="form.gradingCompany" class="select">
                <option v-for="c in gradingCompanies" :key="c" :value="c">{{ c }}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Grade</label>
              <select v-model="form.grade" class="select">
                <option v-for="g in gradeOptions" :key="g" :value="g">{{ g }}</option>
              </select>
            </div>
          </div>

          <!-- Raw Card Specific: Variant -->
          <div v-if="itemType === 'card' && variants.length > 0" class="form-group mb-4">
            <label class="form-label">Variant / Finish</label>
            <select v-model="form.priceVariant" class="select">
              <option v-for="v in variants" :key="v.key" :value="v.key">
                {{ v.label }} — ${{ v.market?.toFixed(2) || '—' }}
              </option>
            </select>
          </div>

          <!-- Sealed Specific: Name & Set -->
          <div v-if="itemType === 'sealed'" class="sealed-fields mb-4">
            <div class="form-group">
              <label class="form-label">Product Name</label>
              <input v-model="form.name" class="input" placeholder="e.g. Silver Tempest Booster Box" />
            </div>
            <div class="form-group">
              <label class="form-label">Set Name</label>
              <input v-model="form.setName" class="input" placeholder="e.g. Silver Tempest" />
            </div>
          </div>

          <!-- Shared Financials -->
          <div class="form-row mt-2">
            <div class="form-group">
              <label class="form-label">Purchase Price ($)</label>
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

const gradingCompanies = ['PSA', 'BGS', 'CGC', 'ACE', 'SGC', 'Other']

const form = ref({
  name: '',
  setName: '',
  purchasePrice: null,
  quantity: 1,
  portfolioId: props.defaultPortfolioId || '',
  gradingCompany: 'PSA',
  grade: '10',
  priceVariant: '',
  purchaseDate: new Date().toISOString().split('T')[0],
  notes: ''
})

const gradeOptions = computed(() => {
  if (form.value.gradingCompany === 'BGS' || form.value.gradingCompany === 'CGC') {
    return ['10', '9.5', '9', '8.5', '8', '7.5', '7', '6.5', '6', '5.5', '5', '4.5', '4', '3', '2', '1']
  }
  return ['10', '9', '8', '7', '6', '5', '4', '3', '2', '1']
})

const variants = computed(() => props.card ? getAllVariants(props.card) : [])
const currentPrice = computed(() => {
  if (!props.card) return null
  const result = getMarketPrice(props.card, form.value.priceVariant)
  return result?.price || result || null
})

const canSubmit = computed(() => {
  if (itemType.value === 'sealed') return form.value.name.trim() !== '' && form.value.portfolioId !== ''
  return props.card != null && form.value.portfolioId !== ''
})

function submit() {
  const item = {
    type: itemType.value,
    quantity: form.value.quantity,
    purchasePrice: form.value.purchasePrice || 0,
    purchaseDate: form.value.purchaseDate,
    notes: form.value.notes,
    portfolioId: form.value.portfolioId
  }

  if (itemType.value === 'card' || itemType.value === 'graded') {
    item.cardId = props.card.id
    item.cardData = {
      name: props.card.name,
      number: props.card.number,
      images: props.card.images,
      set: props.card.set
    }
    item.priceVariant = form.value.priceVariant
    item.currentMarketPrice = currentPrice.value
    
    if (itemType.value === 'graded') {
      item.gradingCompany = form.value.gradingCompany
      item.grade = form.value.grade
    }
  } else {
    // Sealed
    item.name = form.value.name
    item.setName = form.value.setName
    item.currentValue = form.value.purchasePrice || 0
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
.type-tab {
  flex: 1;
  height: 52px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--bg-primary);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
}
.type-tab.active {
  background: var(--accent-dim);
  color: var(--accent);
  border-color: var(--accent);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(245, 166, 35, 0.1);
}
.type-icon { font-size: 18px; line-height: 1; margin-bottom: 2px; }
.type-label { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }

.card-preview { display: flex; align-items: center; gap: 16px; background: var(--bg-card); padding: 14px; border-radius: 16px; border: 1px solid var(--border); box-shadow: inset 0 1px 0 rgba(255,255,255,0.05); }
.card-thumb { width: 64px; height: 88px; object-fit: contain; border-radius: 6px; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.3)); }
.card-preview-name { font-size: 16px; font-weight: 700; color: var(--text-primary); }
.card-preview-set { font-size: 13px; color: var(--text-secondary); }

.sealed-placeholder { display: flex; align-items: center; gap: 16px; background: var(--bg-card); padding: 20px; border-radius: 16px; border: 1px dashed var(--border); }
.sealed-icon { font-size: 32px; }
.text-sm { font-size: 12px; }

.form-row-wrap { display: grid; grid-template-columns: 1.5fr 1fr; gap: 12px; }

.input-with-icon { position: relative; }
.input-with-icon .icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-weight: 700; }
.input-with-icon .input { padding-left: 28px; }

.flex-2 { flex: 2; }

@media (max-width: 640px) {
  .modal { height: 92vh; border-radius: 28px 28px 0 0; }
  .modal-footer { padding: 16px 20px 32px; gap: 12px; border-top: none; }
  .btn-lg { min-height: 56px; border-radius: 18px; font-size: 16px; font-weight: 800; }
  .type-tab { height: 60px; }
}
</style>
