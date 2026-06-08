<!--
  CardLoadIndicator — Floating pill showing background card loading progress.
  Appears in bottom-right when preload starts, collapses when done.
-->
<template>
  <transition name="pill">
    <div v-if="visible" class="load-pill" :class="{ done: isDone }" @click="expanded = !expanded">
      <!-- Collapsed state: just the icon -->
      <div v-if="!expanded && !isDone" class="pill-collapsed">
        <div class="pill-spinner" />
        <span class="pill-pct">{{ overallPct }}%</span>
      </div>

      <!-- Expanded state: full details -->
      <template v-else>
        <div class="pill-header">
          <span class="pill-icon" v-if="isDone">✓</span>
          <span class="pill-icon spinning" v-else>⟳</span>
          <span class="pill-title">{{ isDone ? 'Cards ready' : 'Loading cards…' }}</span>
          <span class="pill-pct-lg">{{ overallPct }}%</span>
        </div>

        <div class="pill-bar-wrap" v-if="!isDone">
          <div class="pill-bar" :style="{ width: overallPct + '%' }" />
        </div>

        <div class="pill-games" v-if="expanded">
          <div v-for="g in gameList" :key="g.id" class="pill-game" :class="{ active: currentGame === g.id && !isDone, done: g.done }">
            <span class="pill-game-name">{{ g.name }}</span>
            <span class="pill-game-status">
              <template v-if="g.done">✓</template>
              <template v-else-if="currentGame === g.id && !isDone">{{ status }}</template>
              <template v-else>…</template>
            </span>
          </div>
        </div>
      </template>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed } from 'vue'

const visible = ref(false)
const expanded = ref(true)
const currentGame = ref('')
const status = ref('')
const isDone = ref(false)
const gameProgress = ref({})

const GAMES = [
  { id: 'pokemon', name: 'Pokémon' },
  { id: 'mtg', name: 'MTG' },
  { id: 'lorcana', name: 'Lorcana' },
  { id: 'one-piece', name: 'One Piece' },
  { id: 'yugioh', name: 'Yu-Gi-Oh' },
  { id: 'riftbound', name: 'Riftbound' },
]

const gameList = computed(() =>
  GAMES.map(g => ({
    ...g,
    done: gameProgress.value[g.id]?.done || false,
  }))
)

const overallPct = computed(() => {
  if (isDone.value) return 100
  const done = Object.values(gameProgress.value).filter(g => g.done).length
  return Math.round((done / GAMES.length) * 100)
})

/** Call this to start showing the indicator. */
function start() {
  visible.value = true
  expanded.value = true
  isDone.value = false
  gameProgress.value = {}
  currentGame.value = ''
  status.value = ''
}

/** Call this for each progress update from the preloader. */
function onProgress({ game, phase }) {
  currentGame.value = game
  status.value = phase
  if (!gameProgress.value[game]) {
    gameProgress.value[game] = { done: false }
  }
  if (phase === 'Done') {
    gameProgress.value[game].done = true
  }
}

/** Call this when everything is done. Shows checkmark briefly, then hides. */
function finish() {
  isDone.value = true
  expanded.value = true
  setTimeout(() => {
    visible.value = false
  }, 3000)
}

defineExpose({ start, onProgress, finish })
</script>

<style scoped>
.load-pill {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: var(--bg-secondary, #161b22);
  border: 1px solid var(--border, #30363d);
  border-radius: 12px;
  padding: 10px 14px;
  min-width: 200px;
  max-width: 280px;
  z-index: 1000;
  box-shadow: 0 4px 24px rgba(0,0,0,0.3);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 12px;
  color: var(--text-primary, #e6edf3);
}

.load-pill:hover {
  border-color: var(--accent, #f5a623);
}

.load-pill.done {
  border-color: var(--success, #3fb950);
}

/* Collapsed view */
.pill-collapsed {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pill-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border, #30363d);
  border-top-color: var(--accent, #f5a623);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.pill-pct {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--accent, #f5a623);
}

/* Expanded view */
.pill-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.pill-icon {
  font-size: 14px;
}

.pill-icon.spinning {
  animation: spin 1s linear infinite;
}

.pill-title {
  flex: 1;
  font-weight: 600;
  font-size: 12px;
}

.pill-pct-lg {
  font-weight: 700;
  font-size: 13px;
  color: var(--accent, #f5a623);
  font-variant-numeric: tabular-nums;
}

.done .pill-pct-lg {
  color: var(--success, #3fb950);
}

.pill-bar-wrap {
  height: 3px;
  background: var(--bg-hover, #21262d);
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 8px;
}

.pill-bar {
  height: 100%;
  background: var(--accent, #f5a623);
  border-radius: 2px;
  transition: width 0.3s ease;
}

.pill-games {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.pill-game {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 0;
  color: var(--text-muted, #8b949e);
  font-size: 11px;
}

.pill-game.active {
  color: var(--text-primary, #e6edf3);
}

.pill-game.done {
  color: var(--success, #3fb950);
}

.pill-game-status {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
}

/* Transitions */
.pill-enter-active { transition: all 0.3s ease; }
.pill-leave-active { transition: all 0.3s ease; }
.pill-enter-from { opacity: 0; transform: translateY(20px); }
.pill-leave-to { opacity: 0; transform: translateY(20px); }
</style>
