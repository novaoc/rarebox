<!--
  CardDatabaseLoader — Brief loading screen for first-time setup.
  Preloads fast TCGs (One Piece, Lorcana, Riftbound) in ~5 seconds.
  Slow TCGs (Pokemon, MTG, Yu-Gi-Oh) preload in the background after app loads.
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
      <p class="loader-subtitle" v-if="!done">Loading card databases…</p>
      <p class="loader-subtitle" v-else-if="totalCards > 0">Loaded {{ totalCards.toLocaleString() }} cards</p>
      <p class="loader-subtitle" v-else>Starting…</p>

      <!-- Per-game status -->
      <div class="loader-games">
        <div v-for="g in games" :key="g.id" class="loader-game" :class="{ done: g.done }">
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
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { preloadFast } from '../services/tcg/cardPreloader.js'
import { saveCardDatabaseReady, buildSearchIndex } from '../services/tcg/cardCache.js'

const emit = defineEmits(['ready'])

const done = ref(false)
const totalCards = ref(0)

const games = reactive([
  { id: 'one-piece', name: 'One Piece', icon: '🏴‍☠️', done: false, status: 'Queued' },
  { id: 'lorcana', name: 'Disney Lorcana', icon: '✨', done: false, status: 'Queued' },
  { id: 'riftbound', name: 'Riftbound', icon: '⚔️', done: false, status: 'Queued' },
])

onMounted(async () => {
  const counts = await preloadFast(({ game, phase }) => {
    const g = games.find(x => x.id === game)
    if (g) {
      g.status = phase
      if (phase === 'Done') g.done = true
    }
  })

  totalCards.value = Object.values(counts).reduce((a, b) => a + b, 0)
  done.value = true

  // Build search index from what we have
  await buildSearchIndex()
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
  max-width: 380px;
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

.loader-games {
  display: flex;
  flex-direction: column;
  gap: 6px;
  text-align: left;
  margin-bottom: 20px;
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
