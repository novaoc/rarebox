<!--
  CardDatabaseLoader — Shows during first-time card database setup.
  Fetches all TCG card data into IndexedDB for instant local search.
-->
<template>
  <div class="loader-overlay">
    <div class="loader-card">
      <div class="loader-logo">
        <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        </svg>
      </div>
      <h2 class="loader-title">Rarebox</h2>
      <p class="loader-subtitle" v-if="!done">Setting up your card database…</p>
      <p class="loader-subtitle" v-else>Ready to go!</p>

      <!-- Progress bar -->
      <div class="loader-progress-wrap">
        <div class="loader-progress-bar">
          <div class="loader-progress-fill" :style="{ width: overallPct + '%' }" />
        </div>
        <div class="loader-progress-text">{{ overallPct }}%</div>
      </div>

      <!-- Game status list -->
      <div class="loader-games">
        <div
          v-for="g in gameList"
          :key="g.id"
          class="loader-game"
          :class="{ active: currentGame === g.id && !done, done: g.done }"
        >
          <span class="loader-game-icon">{{ g.icon }}</span>
          <span class="loader-game-name">{{ g.name }}</span>
          <span class="loader-game-status">
            <template v-if="g.done">✓</template>
            <template v-else-if="currentGame === g.id && !done">{{ status }}</template>
            <template v-else>Queued</template>
          </span>
        </div>
      </div>

      <p v-if="totalCards > 0 && done" class="loader-total">
        {{ totalCards.toLocaleString() }} cards loaded across {{ gamesLoaded }} TCGs
      </p>

      <button v-if="done" class="btn btn-primary loader-start" @click="$emit('ready')">
        Start Browsing
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { preloadAll } from '../services/tcg/cardPreloader.js'
import { saveCardDatabaseReady } from '../services/tcg/cardCache.js'

const emit = defineEmits(['ready'])

const currentGame = ref('')
const status = ref('')
const gameProgress = ref({})
const done = ref(false)
const totalCards = ref(0)
const gamesLoaded = ref(0)

const GAMES = [
  { id: 'pokemon', name: 'Pokémon', icon: '⚡' },
  { id: 'mtg', name: 'Magic: The Gathering', icon: '🔮' },
  { id: 'lorcana', name: 'Disney Lorcana', icon: '✨' },
  { id: 'one-piece', name: 'One Piece', icon: '🏴‍☠️' },
  { id: 'yugioh', name: 'Yu-Gi-Oh!', icon: '🃏' },
  { id: 'riftbound', name: 'Riftbound', icon: '⚔️' },
]

const gameList = computed(() =>
  GAMES.map(g => ({
    ...g,
    done: gameProgress.value[g.id]?.done || false,
  }))
)

const overallPct = computed(() => {
  if (done.value) return 100
  const loaded = Object.keys(gameProgress.value).length
  return Math.round((loaded / GAMES.length) * 100)
})

onMounted(async () => {
  const counts = await preloadAll(({ game, phase, loaded, total }) => {
    currentGame.value = game
    status.value = phase

    if (!gameProgress.value[game]) {
      gameProgress.value[game] = { done: false }
    }

    // Mark game as done when phase is 'Done'
    if (phase === 'Done') {
      gameProgress.value[game] = { done: true }
      gamesLoaded.value++
      totalCards.value += loaded
    }
  })

  totalCards.value = counts.total || totalCards.value
  done.value = true
  saveCardDatabaseReady()
})
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
  padding: 40px 32px;
  max-width: 420px;
  width: 100%;
  text-align: center;
}

.loader-logo {
  color: var(--accent, #f5a623);
  margin-bottom: 12px;
  animation: pulse 2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.05); }
}

.loader-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary, #e6edf3);
  margin: 0 0 4px;
}

.loader-subtitle {
  font-size: 13px;
  color: var(--text-muted, #8b949e);
  margin: 0 0 20px;
}

.loader-progress-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 20px;
}

.loader-progress-bar {
  flex: 1;
  height: 6px;
  background: var(--bg-hover, #21262d);
  border-radius: 3px;
  overflow: hidden;
}

.loader-progress-fill {
  height: 100%;
  background: var(--accent, #f5a623);
  border-radius: 3px;
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
  gap: 6px;
  text-align: left;
  margin-bottom: 16px;
}

.loader-game {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-muted, #8b949e);
  transition: all 0.2s;
}

.loader-game.active {
  background: var(--accent-dim, rgba(245, 166, 35, 0.1));
  color: var(--text-primary, #e6edf3);
}

.loader-game.done {
  color: var(--success, #3fb950);
}

.loader-game-icon {
  width: 20px;
  text-align: center;
  font-size: 14px;
}

.loader-game-name {
  flex: 1;
  font-weight: 500;
}

.loader-game-status {
  font-size: 11px;
  color: var(--text-muted, #8b949e);
  max-width: 140px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.loader-total {
  font-size: 12px;
  color: var(--success, #3fb950);
  margin: 8px 0 16px;
}

.loader-start {
  width: 100%;
  padding: 10px 20px;
  font-size: 14px;
}
</style>
