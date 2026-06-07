<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTradeStore } from '../stores/trade'
import { useScannerStore } from '../stores/scanner'
import CameraViewfinder from '../components/scanner/CameraViewfinder.vue'
import { scanCardFromImage } from '../services/scanPipeline'
import { imageElementToImageData } from '../services/ocrWorker'

const tradeStore = useTradeStore()
const scannerStore = useScannerStore()

const activeSide = ref<'A' | 'B'>('A')

// ─── Computed ─────────────────────────────────────────────────────────────────

const deltaFormatted = computed(() => {
  const delta = tradeStore.priceDelta
  const abs = Math.abs(delta)
  if (abs < 0.01) return '$0.00'
  const sign = delta > 0 ? '+' : '-'
  return `${sign}$${abs.toFixed(2)}`
})

const deltaClass = computed(() => {
  const delta = tradeStore.priceDelta
  if (delta > 0.01) return 'text-rb-success'
  if (delta < -0.01) return 'text-rb-danger'
  return 'text-rb-accent'
})

const deltaBgClass = computed(() => {
  const delta = tradeStore.priceDelta
  if (delta > 0.01) return 'bg-rb-success-dim'
  if (delta < -0.01) return 'bg-rb-danger-dim'
  return 'bg-rb-accent-dim'
})

const deltaLabel = computed(() => {
  const delta = tradeStore.priceDelta
  if (delta > 0.01) return 'You\'re winning'
  if (delta < -0.01) return 'You\'re losing'
  return 'Even trade'
})

// ─── Actions ──────────────────────────────────────────────────────────────────

function openScanner(side: 'A' | 'B') {
  activeSide.value = side
  scannerStore.openCamera()
}

async function onCapture(imageDataUrl: string) {
  scannerStore.isProcessing = true
  
  try {
    // 1. Create temporary image to convert to ImageData
    const img = new Image()
    const imageData = await new Promise<ImageData>((resolve, reject) => {
      img.onload = () => resolve(imageElementToImageData(img))
      img.onerror = reject
      img.src = imageDataUrl
    })

    // 2. Run through identification pipeline
    const result = await scanCardFromImage(imageData)
    
    if (result.success && result.card) {
      // 3. Map to Trade Card format
      const card = {
        id: result.card.id,
        name: result.card.name,
        setName: result.card.set.name,
        number: result.card.number,
        imageUrl: result.card.images.small,
        marketPrice: result.card.prices?.market || 0
      }
      
      tradeStore.addToSide(activeSide.value, card)
      scannerStore.addScanResult(result)
      scannerStore.closeCamera()
    } else {
      alert(result.status || 'Could not identify card. Please try again with better lighting.')
    }
  } catch (err) {
    console.error('Scan failed:', err)
    alert('An error occurred during scanning.')
  } finally {
    scannerStore.isProcessing = false
  }
}

onMounted(() => {
  // Ensure trade store is initialized for IDB persistence
  // In a real app, this would be handled by a global init
})
</script>

<template>
  <!-- Full-screen scanner overlay -->
  <Teleport to="body">
    <Transition name="scanner">
      <div
        v-if="scannerStore.isCameraOpen"
        class="fixed inset-0 z-50 bg-black"
      >
        <div v-if="scannerStore.isProcessing" class="absolute inset-0 z-[60] flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
          <div class="spinner-lg mb-4"></div>
          <p class="text-white font-medium">Identifying card...</p>
        </div>
        
        <CameraViewfinder
          @capture="onCapture"
          @close="scannerStore.closeCamera"
        />
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
            aria-label="Back to dashboard"
            class="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-rb-hover transition-colors text-rb-text-secondary"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </router-link>
          <h1 class="text-lg font-semibold text-rb-text">Trade Analyzer</h1>
        </div>

        <!-- Delta badge -->
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
            <!-- Side A header -->
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
                <p class="text-rb-text-muted text-xs mt-1">Tap scan to add cards</p>
              </div>
              <div
                v-for="(card, index) in tradeStore.sideA.items"
                :key="card.id"
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
                  :aria-label="\`Remove \${card.name} from Side A\`"
                  class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded text-rb-text-muted hover:text-rb-danger hover:bg-rb-danger-dim transition-colors"
                  @click="tradeStore.removeFromSide('A', card.id)"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Scan button -->
            <div class="px-4 py-3 border-t border-rb-border">
              <button
                aria-label="Scan a card to add to Side A"
                class="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-rb-accent/10 text-rb-accent font-medium text-sm hover:bg-rb-accent/20 transition-colors min-h-[44px]"
                @click="openScanner('A')"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Scan Card
              </button>
            </div>
          </div>
        </div>

        <!-- Divider (desktop) -->
        <div class="hidden md:flex items-start justify-center pt-16">
          <div class="flex flex-col items-center gap-2">
            <div class="w-px h-8 bg-rb-border" />
            <span class="text-xs font-bold text-rb-text-muted">VS</span>
            <div class="w-px h-8 bg-rb-border" />
          </div>
        </div>
        <!-- Divider (mobile) -->
        <div class="md:hidden flex items-center gap-3 px-4">
          <div class="flex-1 h-px bg-rb-border" />
          <span class="text-xs font-bold text-rb-text-muted">VS</span>
          <div class="flex-1 h-px bg-rb-border" />
        </div>

        <!-- Side B: Their Cards -->
        <div class="flex-1 min-w-0">
          <div class="bg-rb-card rounded-xl border border-rb-border overflow-hidden">
            <!-- Side B header -->
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
                <p class="text-rb-text-muted text-xs mt-1">Tap scan to add cards</p>
              </div>
              <div
                v-for="(card, index) in tradeStore.sideB.items"
                :key="card.id"
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
                  :aria-label="\`Remove \${card.name} from Side B\`"
                  class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded text-rb-text-muted hover:text-rb-danger hover:bg-rb-danger-dim transition-colors"
                  @click="tradeStore.removeFromSide('B', card.id)"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Scan button -->
            <div class="px-4 py-3 border-t border-rb-border">
              <button
                aria-label="Scan a card to add to Side B"
                class="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-rb-info/10 text-rb-info font-medium text-sm hover:bg-rb-info/20 transition-colors min-h-[44px]"
                @click="openScanner('B')"
              >
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Scan Card
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<style scoped>
/* Scanner overlay transitions */
.scanner-enter-active { transition: opacity 0.2s ease-out; }
.scanner-leave-active { transition: opacity 0.15s ease-in; }
.scanner-enter-from, .scanner-leave-to { opacity: 0; }
</style>
