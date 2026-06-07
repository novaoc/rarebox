<script setup>
import { ref, computed } from 'vue'
// Missing component fallback or removal for now since it doesn't exist in the repo
// import CameraViewfinder from '../components/scanner/CameraViewfinder.vue'
import { identifyCard } from '../services/scanPipeline.js'
import { getMarketPrice } from '../services/pokemonApi.js'

const sideACards = ref([])
const sideBCards = ref([])

const showScanner = ref(false)
const isProcessing = ref(false)
const showManualSearch = ref(false)
const manualQuery = ref('')
const activeSide = ref('A')

const totalA = computed(() => sideACards.value.reduce((s, c) => s + c.marketPrice, 0))
const totalB = computed(() => sideBCards.value.reduce((s, c) => s + c.marketPrice, 0))

const delta = computed(() => totalA.value - totalB.value)
const deltaFormatted = computed(() => {
  const abs = Math.abs(delta.value)
  if (abs < 0.01) return '$0.00'
  const sign = delta.value > 0 ? '+' : '-'
  return `${sign}$${abs.toFixed(2)}`
})
const deltaClass = computed(() => {
  if (delta.value > 0.01) return 'text-rb-success'
  if (delta.value < -0.01) return 'text-rb-danger'
  return 'text-rb-accent'
})
const deltaBgClass = computed(() => {
  if (delta.value > 0.01) return 'bg-rb-success-dim'
  if (delta.value < -0.01) return 'bg-rb-danger-dim'
  return 'bg-rb-accent-dim'
})

async function onCapture(imageData) {
  isProcessing.value = true
  
  const result = await identifyCard(imageData)
  
  if (result.success && result.card) {
    const market = getMarketPrice(result.card)
    const card = {
      id: result.card.id,
      name: result.card.name,
      setName: result.card.set.name,
      number: result.card.number,
      imageUrl: result.card.images.small,
      marketPrice: market ? market.price : 0
    }
    addCardToSide(card)
    showScanner.value = false
  } else {
    // OCR failed or no match - prompt manual search
    showManualSearch.value = true
  }
  
  isProcessing.value = false
}

function addCardToSide(card) {
  if (activeSide.value === 'A') {
    sideACards.value.push(card)
  } else {
    sideBCards.value.push(card)
  }
}

function openScanner(side) {
  activeSide.value = side
  showScanner.value = true
}

function removeCard(side, index) {
  if (side === 'A') {
    sideACards.value.splice(index, 1)
  } else {
    sideBCards.value.splice(index, 1)
  }
}

function clearSide(side) {
  if (side === 'A') sideACards.value = []
  else sideBCards.value = []
}
</script>

<template>
  <!-- Full-screen scanner overlay -->
  <Teleport to="body">
    <Transition name="scanner">
      <div v-if="showScanner" class="fixed inset-0 z-50 bg-black">
        <div v-if="isProcessing" class="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm">
          <div class="w-12 h-12 border-4 border-rb-accent border-t-transparent rounded-full animate-spin mb-4"></div>
          <p class="text-white font-medium">Analyzing Card Content...</p>
        </div>
        
        <!-- Fallback message since CameraViewfinder is missing in repo -->
        <div class="flex flex-col items-center justify-center h-full text-white p-6">
           <p class="mb-4">Scanner component is currently unavailable.</p>
           <button @click="showScanner = false" class="px-6 py-2 bg-rb-accent text-black rounded-lg">Close</button>
        </div>
        
        <!-- Manual Search Fallback Triggered via result -->
        <div v-if="showManualSearch" class="absolute inset-0 z-[70] flex items-center justify-center p-6 bg-black/90">
          <div class="w-full max-w-md bg-rb-card p-6 rounded-2xl border border-rb-border shadow-2xl">
            <h2 class="text-xl font-bold text-rb-text mb-2">Identify Card</h2>
            <p class="text-sm text-rb-text-secondary mb-6">OCR could not uniquely identify this card. Please enter the name or set number manually.</p>
            
            <input 
              v-model="manualQuery"
              type="text"
              placeholder="e.g. Charizard 108/106"
              class="w-full bg-rb-bg border border-rb-border rounded-xl px-4 py-3 text-rb-text focus:outline-none focus:border-rb-accent mb-4 min-h-[44px]"
              aria-label="Manual card search input"
            />
            
            <div class="flex gap-3">
              <button 
                class="flex-1 py-3 px-4 rounded-xl bg-rb-hover text-rb-text font-medium min-h-[44px]"
                @click="showManualSearch = false"
              >
                Cancel
              </button>
              <button 
                class="flex-1 py-3 px-4 rounded-xl bg-rb-accent text-black font-bold min-h-[44px]"
                @click="/* Manual search logic would go here */ showManualSearch = false; showScanner = false"
              >
                Search
              </button>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>

  <div class="min-h-screen bg-rb-bg">
    <!-- Header -->
    <div class="sticky top-0 z-40 bg-rb-surface border-b border-rb-border px-4 py-3">
      <div class="max-w-5xl mx-auto flex items-center justify-between">
        <div class="flex items-center gap-3">
          <router-link
            to="/"
            class="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-rb-hover transition-colors text-rb-text-secondary"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </router-link>
          <h1 class="text-lg font-semibold text-rb-text">Trade Analyzer</h1>
        </div>

        <div class="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold" :class="[deltaBgClass, deltaClass]">
          <span>{{ deltaFormatted }}</span>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-5xl mx-auto px-4 py-6">
       <div class="flex flex-col md:flex-row gap-6">
          <div class="flex-1 bg-rb-card rounded-2xl border border-rb-border overflow-hidden">
             <div class="p-4 border-b border-rb-border flex justify-between items-center">
                <span class="text-xs font-bold text-rb-accent">SIDE A</span>
                <span class="font-bold">${{ totalA.toFixed(2) }}</span>
             </div>
             <div class="p-4">
                <button @click="openScanner('A')" class="w-full py-4 rounded-xl bg-rb-accent/10 text-rb-accent font-bold border border-rb-accent/20 min-h-[44px]">
                   Scan Card
                </button>
             </div>
          </div>
          <div class="flex-1 bg-rb-card rounded-2xl border border-rb-border overflow-hidden">
             <div class="p-4 border-b border-rb-border flex justify-between items-center">
                <span class="text-xs font-bold text-rb-info">SIDE B</span>
                <span class="font-bold">${{ totalB.toFixed(2) }}</span>
             </div>
             <div class="p-4">
                <button @click="openScanner('B')" class="w-full py-4 rounded-xl bg-rb-info/10 text-rb-info font-bold border border-rb-info/20 min-h-[44px]">
                   Scan Card
                </button>
             </div>
          </div>
       </div>
    </div>
  </div>
</template>

<style scoped>
.scanner-enter-active, .scanner-leave-active { transition: opacity 0.3s ease; }
.scanner-enter-from, .scanner-leave-to { opacity: 0; }
</style>
