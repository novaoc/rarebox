<template>
  <div class="pokedex-view">
    <div v-if="!selectedSet">
      <div class="pokedex-header mb-4">
        <div class="lang-tabs">
          <button class="lang-tab" :class="{ active: lang === 'en' }" @click="switchLang('en')">English</button>
          <button class="lang-tab" :class="{ active: lang === 'ja' }" @click="switchLang('ja')">Japanese</button>
        </div>
        <div class="search-input-wrap">
          <span class="search-icon">⌕</span>
          <input
            v-model="setFilter"
            class="input search-input"
            placeholder="Filter sets..."
          />
        </div>
      </div>

      <div v-if="loadingSets" class="flex-center" style="padding:80px">
        <div class="spinner spinner-lg"></div>
      </div>

      <div v-else-if="setsError" class="empty-state">
        <div class="icon">⚠</div>
        <h3>Failed to load sets</h3>
        <p>{{ setsError }}</p>
        <button class="btn btn-primary mt-3" @click="loadSets">Retry</button>
      </div>

      <div v-else>
        <div class="sets-grid">
          <div
            v-for="set in filteredSets"
            :key="set.id"
            class="set-progress-card"
            @click="openSet(set)"
          >
            <div class="set-logo-wrap">
              <img
                v-if="set.images?.logo"
                :src="set.images.logo"
                :alt="set.name"
                class="set-logo"
                loading="lazy"
              />
              <span v-else class="set-logo-placeholder">{{ set._lang === 'ja' ? 'ポケ' : '⬡' }}</span>
            </div>
            <div class="set-progress-info">
              <div class="set-name">{{ set.name }}</div>
              <div class="progress-container mt-2">
                <div class="progress-bar">
                  <div 
                    class="progress-fill" 
                    :style="{ width: getCompletionPercentage(set.id, set.total) + '%', background: getCompletionColor(getCompletionPercentage(set.id, set.total)) }"
                  ></div>
                </div>
                <div class="progress-text">
                  {{ ownedCounts[set.id] || 0 }} / {{ set.total }} ({{ getCompletionPercentage(set.id, set.total) }}%)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Card Grid for Set Completion -->
    <div v-else>
      <div class="set-browse-header mb-4">
        <button class="btn btn-secondary btn-sm" @click="selectedSet = null">← Back</button>
        <div class="set-browse-title">
          <span>{{ selectedSet.name }}</span>
          <span class="badge badge-accent ml-2">{{ ownedCounts[selectedSet.id] || 0 }}/{{ selectedSet.total }}</span>
        </div>
      </div>

      <div v-if="loadingCards" class="flex-center" style="padding:60px">
        <div class="spinner spinner-lg"></div>
      </div>

      <div v-else class="pokedex-grid">
        <div
          v-for="card in cards"
          :key="card.id"
          class="pokedex-card"
          :class="{ owned: isOwned(card.id), 'not-owned': !isOwned(card.id) }"
        >
          <div class="card-img-wrap">
            <img
              v-if="card.images?.small"
              :src="card.images.small"
              :alt="card.name"
              loading="lazy"
              class="card-img"
              :style="{ opacity: isOwned(card.id) ? 1 : 0.3, filter: isOwned(card.id) ? 'none' : 'grayscale(100%)' }"
            />
            <div v-if="isOwned(card.id)" class="owned-badge">✓</div>
          </div>
          <div class="card-meta">
            <div class="card-num">#{{ card.number }}</div>
            <div class="card-name">{{ card.name }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { getSets, getCardsBySet, getJapaneseSets, getJapaneseCardsBySet } from '../services/pokemonApi'
import { usePortfolioStore } from '../stores/portfolio'

const store = usePortfolioStore()
const sets = ref([])
const loadingSets = ref(false)
const setsError = ref(null)
const setFilter = ref('')
const lang = ref('en')
const selectedSet = ref(null)
const cards = ref([])
const loadingCards = ref(false)

const ownedCounts = computed(() => {
  const map = {}
  for (const p of store.portfolios) {
    for (const item of p.items) {
      if (item.type !== 'card' || !item.cardData?.set?.id) continue
      const setId = item.cardData.set.id
      if (!map[setId]) map[setId] = new Set()
      map[setId].add(item.cardId)
    }
  }
  const result = {}
  for (const [setId, ids] of Object.entries(map)) result[setId] = ids.size
  return result
})

const ownedCardIds = computed(() => {
  const ids = new Set()
  for (const p of store.portfolios) {
    for (const item of p.items) {
      if (item.type === 'card') ids.add(item.cardId)
    }
  }
  return ids
})

const filteredSets = computed(() => {
  const q = setFilter.value.toLowerCase()
  return sets.value.filter(s => s.name.toLowerCase().includes(q))
})

async function loadSets() {
  loadingSets.value = true
  try {
    sets.value = lang.value === 'ja' ? await getJapaneseSets() : await getSets()
  } catch (e) {
    setsError.value = e.message
  } finally {
    loadingSets.value = false
  }
}

async function switchLang(newLang) {
  lang.value = newLang
  await loadSets()
}

async function openSet(set) {
  selectedSet.value = set
  loadingCards.value = true
  try {
    const data = set._lang === 'ja' 
      ? await getJapaneseCardsBySet(set.id, 1, 500)
      : await getCardsBySet(set.id, 1, 500)
    cards.value = data.data.sort((a, b) => parseInt(a.number) - parseInt(b.number))
  } catch (e) {
    console.error(e)
  } finally {
    loadingCards.value = false
  }
}

function getCompletionPercentage(setId, total) {
  if (!total) return 0
  const owned = ownedCounts.value[setId] || 0
  return Math.round((owned / total) * 100)
}

function getCompletionColor(pct) {
  if (pct === 100) return '#3fb950'
  if (pct > 50) return '#f5a623'
  return '#58a6ff'
}

function isOwned(cardId) {
  return ownedCardIds.value.has(cardId)
}

onMounted(loadSets)
</script>

<style scoped>
.pokedex-view { max-width: 1200px; margin: 0 auto; }
.pokedex-header { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.sets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}
.set-progress-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 16px;
  cursor: pointer;
  transition: transform 0.2s;
}
.set-progress-card:hover { transform: translateY(-2px); border-color: var(--accent); }
.set-logo-wrap { width: 80px; height: 40px; display: flex; align-items: center; justify-content: center; }
.set-logo { max-width: 100%; max-height: 100%; object-fit: contain; }
.set-progress-info { flex: 1; min-width: 0; }
.set-name { font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.progress-bar {
  height: 8px;
  background: var(--bg-tertiary);
  border-radius: 4px;
  overflow: hidden;
}
.progress-fill { height: 100%; transition: width 0.3s ease; }
.progress-text { font-size: 11px; color: var(--text-muted); margin-top: 4px; }

.pokedex-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 12px;
}
.pokedex-card {
  background: var(--bg-secondary);
  border-radius: var(--radius);
  padding: 8px;
  text-align: center;
}
.card-img-wrap { position: relative; margin-bottom: 8px; }
.card-img { width: 100%; border-radius: 4px; }
.owned-badge {
  position: absolute;
  top: -5px;
  right: -5px;
  background: #3fb950;
  color: white;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  font-size: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--bg-secondary);
}
.card-num { font-size: 10px; color: var(--text-muted); }
.card-name { font-size: 11px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

@media (max-width: 600px) {
  .pokedex-header { flex-direction: column; align-items: stretch; }
  .pokedex-grid { grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); }
}
</style>
