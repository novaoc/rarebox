<!--
  ScanAddModal — the disc fan's "Scan card" path: camera → identify (same
  pHash/OCR pipeline the trade analyzer uses) → prefilled AddItemModal.
  Point at a card, confirm the match, it's shelved.
-->
<template>
  <div>
    <!-- Camera -->
    <transition name="fade">
      <div v-if="stage === 'camera'" class="modal-overlay" style="padding:0;align-items:stretch;background:#000" @click.self="close">
        <CameraViewfinder @capture="onCapture" @close="close" />
      </div>
    </transition>

    <!-- Processing -->
    <transition name="fade">
      <div v-if="stage === 'processing'" class="modal-overlay" @click.self="close">
        <div class="modal" style="max-width:340px;text-align:center">
          <div class="modal-body">
            <div class="spinner" style="margin:0 auto 12px"></div>
            <p style="font-weight:700">{{ status }}</p>
          </div>
        </div>
      </div>
    </transition>

    <!-- Error -->
    <transition name="fade">
      <div v-if="stage === 'error'" class="modal-overlay" @click.self="close">
        <div class="modal" style="max-width:380px">
          <div class="modal-header">
            <h3>Couldn't identify it</h3>
            <button class="btn btn-ghost btn-icon" @click="close" aria-label="Close">✕</button>
          </div>
          <div class="modal-body">
            <p style="font-size:14px">{{ error }}</p>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="retry">Try again</button>
            <button class="btn btn-primary" @click="goSearch">Search instead</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Candidates -->
    <transition name="fade">
      <div v-if="stage === 'candidates'" class="modal-overlay" @click.self="close">
        <div class="modal" style="max-width:440px">
          <div class="modal-header">
            <h3>Is it one of these?</h3>
            <button class="btn btn-ghost btn-icon" @click="close" aria-label="Close">✕</button>
          </div>
          <div class="modal-body">
            <div class="scan-add-list">
              <button v-for="c in candidates" :key="c.id" class="scan-add-row" @click="pick(c)">
                <img v-if="c.image" :src="c.image" class="scan-add-thumb" loading="lazy" @error="$event.target.style.display='none'" />
                <span class="scan-add-info">
                  <span class="scan-add-name">{{ c.name }}</span>
                  <span class="scan-add-set">{{ c.set }} · #{{ c.number }}</span>
                </span>
                <span class="scan-add-price">{{ c.price != null ? '$' + Number(c.price).toFixed(2) : '—' }}</span>
              </button>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="retry">Rescan</button>
            <button class="btn btn-ghost" @click="goSearch">Search instead</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Add modal, prefilled with the identified card -->
    <AddItemModal
      v-if="stage === 'add'"
      :card="pokemonCard"
      :tcgCard="tcgCard"
      :defaultPortfolioId="defaultShelfId"
      @close="close"
      @added="close"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePortfolioStore } from '../stores/portfolio'
import CameraViewfinder from './scanner/CameraViewfinder.vue'
import AddItemModal from './AddItemModal.vue'
import { scanCard } from '../utils/scanPipeline'
import { preloadScanIndexes } from '../utils/scanMatch'
import { resolveCard } from '../services/tcg/multiSearch'

const emit = defineEmits(['close'])
const router = useRouter()
const store = usePortfolioStore()

const stage = ref('camera') // camera | processing | candidates | error | add
const status = ref('Processing…')
const error = ref('')
const candidates = ref([])
const pokemonCard = ref(null)
const tcgCard = ref(null)
const defaultShelfId = store.activePortfolioId || store.portfolios[0]?.id || null

preloadScanIndexes()

function close() { emit('close') }
function retry() {
  candidates.value = []
  error.value = ''
  stage.value = 'camera'
}
function goSearch() {
  emit('close')
  router.push('/search')
}

// Match the trade scanner's capture normalization: tesseract needs ~20px
// glyph height, so tiny frames upscale and huge ones downscale toward 1100px.
function resizeImage(dataUrl, targetWidth = 1100) {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      if (img.width >= targetWidth * 0.6 && img.width <= targetWidth * 1.3) { resolve(dataUrl); return }
      const scale = targetWidth / img.width
      const c = document.createElement('canvas')
      c.width = targetWidth
      c.height = Math.round(img.height * scale)
      const ctx = c.getContext('2d')
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, c.width, c.height)
      resolve(c.toDataURL('image/jpeg', 0.9))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

async function onCapture(imageData) {
  stage.value = 'processing'
  status.value = 'Processing…'
  const resized = await resizeImage(imageData)

  let result
  try {
    result = await Promise.race([
      scanCard(resized, (pct) => {
        status.value = pct < 100 ? `Reading card… ${pct}%` : 'Identifying card…'
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 45000)),
    ])
  } catch (e) {
    error.value = e?.message === 'timeout'
      ? 'Scan timed out. Try again with more light, or search instead.'
      : 'Could not identify the card. Try again with more light, less glare — or search instead.'
    stage.value = 'error'
    return
  }

  const list = (result?.candidates || []).map(c => ({
    id: c.id,
    name: c.name,
    set: c.setName || c.set || '',
    number: c.number,
    image: c.image,
    price: c.price,
    game: c.game,
  }))

  if (list.length === 0) {
    error.value = 'Could not read any text on the card — more light, less glare, fill the frame.'
    stage.value = 'error'
    return
  }

  if (list.length === 1 && result.ocrConfidence > 15) {
    await pick(list[0])
    return
  }

  candidates.value = list
  stage.value = 'candidates'
}

async function pick(c) {
  stage.value = 'processing'
  status.value = 'Loading card…'
  pokemonCard.value = null
  tcgCard.value = null
  if (c.game === 'pokemon') {
    // The Pokémon add flow wants the rich pokemontcg.io card (variants,
    // tcgplayer prices); fall back to the generic prefill if resolve fails.
    const full = await resolveCard(c.id, 'pokemon').catch(() => null)
    if (full?._raw || full?.tcgplayer || full?.images) {
      pokemonCard.value = full._raw || full
    }
  }
  if (!pokemonCard.value) {
    tcgCard.value = { game: c.game, name: c.name, set: c.set, number: c.number, image: c.image, price: c.price ?? null }
  }
  stage.value = 'add'
}
</script>

<style scoped>
.scan-add-list { display: flex; flex-direction: column; gap: 8px; }
.scan-add-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 56px;
  padding: 8px 10px;
  background: var(--bg-card);
  border: var(--bw) solid var(--ink);
  border-radius: var(--radius);
  box-shadow: var(--shadow-xs);
  cursor: pointer;
  text-align: left;
}
.scan-add-row:active { box-shadow: var(--shadow-pressed); transform: translate(1px, 1px); }
.scan-add-thumb {
  width: 38px;
  height: 53px;
  object-fit: contain;
  background: var(--bg-card);
  border: var(--bw) solid var(--ink);
  border-radius: 4px;
  flex-shrink: 0;
}
.scan-add-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
.scan-add-name { font-weight: 800; font-size: 14px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.scan-add-set { font-size: 12px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.scan-add-price { font-family: var(--font-mono, monospace); font-weight: 700; font-size: 13px; flex-shrink: 0; }
</style>
