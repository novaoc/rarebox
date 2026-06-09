<!--
  CardDatabaseLoader — First-visit setup: pick TCGs, then load in parallel.
-->
<template>
  <div class="loader-overlay">
    <div class="loader-card">
      <!-- Step 1: TCG Selection -->
      <template v-if="step === 'pick'">
        <div class="loader-logo">
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          </svg>
        </div>
        <h2 class="loader-title">Welcome to Rarebox</h2>
        <p class="loader-subtitle">Which TCGs do you collect?</p>

        <div class="tcg-grid">
          <button
            v-for="g in allGames"
            :key="g.id"
            class="tcg-option"
            :class="{ selected: selected.has(g.id) }"
            @click="toggle(g.id)"
          >
            <span class="tcg-icon">{{ g.icon }}</span>
            <span class="tcg-name">{{ g.name }}</span>
            <span class="tcg-check" v-if="selected.has(g.id)">✓</span>
          </button>
        </div>

        <p class="loader-hint">You can change this later in Settings.</p>

        <button
          class="btn btn-primary loader-start"
          :disabled="selected.size === 0"
          @click="startLoading"
        >
          Load {{ selected.size }} TCG{{ selected.size !== 1 ? 's' : '' }}
        </button>
      </template>

      <!-- Step 2: Loading -->
      <template v-else>
        <div class="loader-logo spinning">
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
          </svg>
        </div>
        <h2 class="loader-title">Loading cards…</h2>
        <p class="loader-subtitle" v-if="!done">All TCGs loading in parallel</p>
        <p class="loader-subtitle" v-else>{{ totalCards.toLocaleString() }} cards ready</p>

        <div class="loader-progress-wrap" v-if="!done">
          <div class="loader-progress-bar">
            <div class="loader-progress-fill" :style="{ width: overallPct + '%' }" />
          </div>
          <div class="loader-progress-text">{{ overallPct }}%</div>
        </div>

        <div class="loader-games">
          <div v-for="g in loadingGames" :key="g.id" class="loader-game" :class="{ done: g.done }">
            <span class="loader-game-icon">{{ g.icon }}</span>
            <span class="loader-game-name">{{ g.name }}</span>
            <span class="loader-game-status">
              <template v-if="g.done">✓</template>
              <template v-else>{{ g.status || 'Queued' }}</template>
            </span>
          </div>
        </div>

        <button v-if="done" class="btn btn-primary loader-start" @click="$emit('ready')">
          Start Browsing
        </button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { preloadGames } from '../services/tcg/cardPreloader.js'
import { saveCardDatabaseReady, saveTcgPrefs, buildSearchIndex } from '../services/tcg/cardCache.js'

const emit = defineEmits(['ready'])

const step = ref('pick') // 'pick' | 'loading'
const done = ref(false)
const totalCards = ref(0)

const allGames = [
  { id: 'pokemon', name: 'Pokémon', icon: '⚡' },
  { id: 'mtg', name: 'Magic: The Gathering', icon: '🔮' },
  { id: 'lorcana', name: 'Disney Lorcana', icon: '✨' },
  { id: 'one-piece', name: 'One Piece', icon: '🏴‍☠️' },
  { id: 'yugioh', name: 'Yu-Gi-Oh!', icon: '🃏' },
  { id: 'riftbound', name: 'Riftbound', icon: '⚔️' },
]

const selected = ref(new Set(['pokemon', 'mtg'])) // sensible defaults

const loadingGames = reactive(
  allGames.map(g => ({ ...g, done: false, status: 'Queued' }))
)

const overallPct = computed(() => {
  if (done.value) return 100
  const sel = loadingGames.filter(g => selected.value.has(g.id))
  const finished = sel.filter(g => g.done).length
  return Math.round((finished / sel.length) * 100)
})

function toggle(id) {
  if (selected.value.has(id)) {
    selected.value.delete(id)
  } else {
    selected.value.add(id)
  }
  // Trigger reactivity
  selected.value = new Set(selected.value)
}

async function startLoading() {
  const games = [...selected.value]
  saveTcgPrefs(games)
  step.value = 'loading'

  const counts = await preloadGames(games, ({ game, phase }) => {
    const g = loadingGames.find(x => x.id === game)
    if (g) {
      g.status = phase
      if (phase === 'Done') g.done = true
    }
  })

  totalCards.value = counts.total || 0
  done.value = true
  await buildSearchIndex()
  saveCardDatabaseReady()
}
</script>

<style scoped>
.loader-overlay {
  position: fixed;
  inset: 0;
  background: var(--bg-primary, #0d1117);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 24px;
}

.loader-card {
  background: var(--bg-secondary, #161b22);
  border: 1px solid var(--border, #30363d);
  border-radius: 16px;
  padding: 36px 28px;
  max-width: 420px;
  width: 100%;
  text-align: center;
}

.loader-logo {
  color: var(--accent, #f5a623);
  margin-bottom: 12px;
}
.loader-logo.spinning {
  animation: spin 3s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

.loader-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary, #e6edf3);
  margin: 0 0 4px;
}

.loader-subtitle {
  font-size: 13px;
  color: var(--text-muted, #8b949e);
  margin: 0 0 20px;
}

.loader-hint {
  font-size: 11px;
  color: var(--text-muted, #8b949e);
  margin: 0 0 16px;
}

/* TCG Selection Grid */
.tcg-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 16px;
}

.tcg-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1.5px solid var(--border, #30363d);
  background: var(--bg-primary, #0d1117);
  color: var(--text-secondary, #8b949e);
  cursor: pointer;
  transition: all 0.15s;
  font-size: 12px;
  font-weight: 500;
  text-align: left;
}

.tcg-option:hover {
  border-color: var(--accent, #f5a623);
}

.tcg-option.selected {
  border-color: var(--accent, #f5a623);
  background: var(--accent-dim, rgba(245, 166, 35, 0.1));
  color: var(--text-primary, #e6edf3);
}

.tcg-icon { font-size: 16px; }
.tcg-name { flex: 1; }
.tcg-check {
  font-size: 12px;
  font-weight: 700;
  color: var(--accent, #f5a623);
}

/* Loading Progress */
.loader-progress-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 16px;
}

.loader-progress-bar {
  flex: 1;
  height: 4px;
  background: var(--bg-hover, #21262d);
  border-radius: 2px;
  overflow: hidden;
}

.loader-progress-fill {
  height: 100%;
  background: var(--accent, #f5a623);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.loader-progress-text {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted, #8b949e);
  min-width: 36px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.loader-games {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: left;
  margin-bottom: 16px;
}

.loader-game {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--text-muted, #8b949e);
}

.loader-game.done { color: var(--success, #3fb950); }
.loader-game-icon { width: 18px; text-align: center; font-size: 13px; }
.loader-game-name { flex: 1; font-weight: 500; }
.loader-game-status {
  font-size: 11px;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.loader-start {
  width: 100%;
  padding: 10px 20px;
  font-size: 14px;
}
</style>
