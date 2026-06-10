<template>
  <transition name="pill">
    <div v-if="visible && !dismissed" class="load-pill" :class="{ done: isDone, 'can-dismiss': isDone || expanded }" @click="handlePillClick">
      <!-- Dismiss Button (Mobile UX priority) -->
      <button 
        v-if="!isDone" 
        class="pill-dismiss-btn" 
        @click.stop="dismissed = true" 
        aria-label="Dismiss loader"
        title="Dismiss loader"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>

      <div v-if="!expanded && !isDone" class="pill-collapsed">
        <div class="pill-spinner" />
        <span class="pill-time">{{ timeLeft }}</span>
      </div>

      <template v-else>
        <div class="pill-header">
          <span class="pill-icon" v-if="isDone">✓</span>
          <span class="pill-icon spinning" v-else>⟳</span>
          <span class="pill-title">{{ isDone ? 'Cards ready' : currentLabel }}</span>
          <span class="pill-pct">{{ overallPct }}%</span>
        </div>

        <div class="pill-bar-wrap" v-if="!isDone">
          <div class="pill-bar" :style="{ width: overallPct + '%' }" />
        </div>

        <div class="pill-speed" v-if="!isDone && speed > 0">
          {{ speedLabel }} · {{ timeLeft }}
        </div>

        <div class="pill-games" v-if="expanded">
          <div v-for="g in gameList" :key="g.id" class="pill-game" :class="{ active: currentGame === g.id && !isDone, done: g.done, failed: g.failed }">
            <span class="pill-game-name">{{ g.name }}</span>
            <span class="pill-game-status">
              <template v-if="g.done && !g.failed">✓</template>
              <template v-else-if="g.failed">✗</template>
              <template v-else-if="currentGame === g.id">{{ status }}</template>
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
const dismissed = ref(false)
const currentGame = ref('')
const status = ref('')
const isDone = ref(false)
const gameProgress = ref({})
const startTime = ref(0)
const activeGames = ref([])

const GAME_NAMES = {
  pokemon: 'Pokémon',
  mtg: 'MTG',
  lorcana: 'Lorcana',
  'one-piece': 'One Piece',
  yugioh: 'Yu-Gi-Oh',
  riftbound: 'Riftbound',
}

const totalGames = computed(() => activeGames.value.length)

const gameList = computed(() =>
  activeGames.value.map(id => ({
    id,
    name: GAME_NAMES[id] || id,
    done: gameProgress.value[id]?.done || false,
    failed: gameProgress.value[id]?.failed || false,
  }))
)

const overallPct = computed(() => {
  if (isDone.value) return 100
  if (totalGames.value === 0) return 0
  let pctSum = 0
  for (const id of activeGames.value) {
    const g = gameProgress.value[id]
    if (!g) continue
    if (g.done) {
      pctSum += 100
    } else if (g.total && g.total > 0) {
      pctSum += Math.min((g.loaded / g.total) * 100, 99)
    }
  }
  return Math.round(pctSum / totalGames.value)
})

const currentLabel = computed(() => {
  const name = GAME_NAMES[currentGame.value]
  return name ? `Loading ${name}…` : 'Loading cards…'
})

const speed = computed(() => {
  if (!startTime.value || overallPct.value <= 0) return 0
  const elapsed = (Date.now() - startTime.value) / 1000
  return overallPct.value / elapsed
})

const speedLabel = computed(() => {
  if (speed.value <= 0) return ''
  const remaining = (100 - overallPct.value) / speed.value
  if (remaining <= 0) return ''
  if (remaining < 1) return '< 1s left'
  if (remaining < 60) return `${Math.round(remaining)}s left`
  return `${Math.round(remaining / 60)}m left`
})

const timeLeft = computed(() => {
  if (isDone.value) return 'Done'
  if (overallPct.value >= 95) return 'Almost done'
  if (!startTime.value || overallPct.value <= 0) return 'Starting…'
  const elapsed = (Date.now() - startTime.value) / 1000
  const pctPerSec = overallPct.value / elapsed
  if (pctPerSec <= 0) return 'Starting…'
  const remaining = (100 - overallPct.value) / pctPerSec
  if (remaining <= 1) return 'Almost done'
  if (remaining < 60) return `~${Math.round(remaining)}s`
  return `~${Math.round(remaining / 60)}m`
})

function handlePillClick() {
  expanded.value = !expanded.value
}

// The Settings toggle ("hide loading progress") is the law — when set,
// the pill never appears, including background refreshes and price passes.
function hiddenByPref() {
  try { return localStorage.getItem('hide_load_indicator') === 'true' } catch { return false }
}

function start(games) {
  if (hiddenByPref()) { visible.value = false; return }
  visible.value = true
  dismissed.value = false
  expanded.value = true
  isDone.value = false
  gameProgress.value = {}
  activeGames.value = games || []
  currentGame.value = ''
  status.value = ''
  startTime.value = Date.now()
}

function onProgress({ game, phase, loaded, total }) {
  currentGame.value = game
  status.value = phase
  if (!gameProgress.value[game]) {
    gameProgress.value[game] = { done: false, failed: false, loaded: 0, total: 0 }
  }
  if (typeof loaded === 'number') gameProgress.value[game].loaded = loaded
  if (typeof total === 'number') gameProgress.value[game].total = total
  if (phase === 'Done' || phase === 'Already cached') {
    gameProgress.value[game].done = true
    gameProgress.value[game].loaded = gameProgress.value[game].total || 1
  } else if (phase && phase.startsWith('Failed')) {
    gameProgress.value[game].done = true
    gameProgress.value[game].failed = true
    gameProgress.value[game].loaded = gameProgress.value[game].total || 1
  }
}

function finish() {
  if (hiddenByPref() || !visible.value) { visible.value = false; return }
  isDone.value = true
  expanded.value = true
  // Reset dismissed state on finish so they see the final checkmark
  dismissed.value = false
  setTimeout(() => {
    visible.value = false
  }, 4000)
}

defineExpose({ start, onProgress, finish })
</script>

<style scoped>
.load-pill {
  position: fixed;
  /* clear the bottom tab bar on small screens */
  bottom: calc(var(--tabbar-height, 64px) + env(safe-area-inset-bottom, 0px) + 12px);
  right: 20px;
  background: var(--bg-primary);
  border: var(--bw) solid var(--ink);
  border-radius: 12px;
  padding: 10px 14px;
  min-width: 180px;
  max-width: 260px;
  z-index: 1000;
  box-shadow: var(--shadow-sm);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 12px;
  color: var(--text-primary);
}

.load-pill:hover { background: var(--bg-hover); }
.load-pill.done { background: var(--success-dim); }

/* Dismiss button styles */
.pill-dismiss-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--bg-card);
  border: 1.5px solid var(--ink);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
  z-index: 10;
  box-shadow: var(--shadow-pressed);
}

.pill-dismiss-btn:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
  transform: scale(1.1);
}

.pill-collapsed {
  display: flex;
  align-items: center;
  gap: 8px;
}

.pill-spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--border-subtle);
  border-top-color: var(--ink);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.pill-time {
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.pill-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.pill-icon { font-size: 14px; }
.pill-icon.spinning { animation: spin 1s linear infinite; }

.pill-title {
  flex: 1;
  font-weight: 600;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pill-pct {
  font-weight: 800;
  font-size: 13px;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.done .pill-pct { color: var(--success-text); }

.pill-bar-wrap {
  height: 8px;
  background: var(--bg-card);
  border: 1.5px solid var(--ink);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 4px;
}

.pill-bar {
  height: 100%;
  background: var(--accent);
  transition: width 0.3s ease;
}

.pill-speed {
  font-size: 10px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.pill-games {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.pill-game {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2px 0;
  color: var(--text-secondary);
  font-size: 11px;
}

.pill-game.active { color: var(--text-primary); font-weight: 700; }
.pill-game.done { color: var(--success-text); }
.pill-game.failed { color: var(--danger); }

.pill-game-status {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
}

.pill-enter-active { transition: all 0.3s ease; }
.pill-leave-active { transition: all 0.3s ease; }
.pill-enter-from { opacity: 0; transform: translateY(20px); }

@media (min-width: 1024px) {
  .load-pill { bottom: 20px; }
}
.pill-leave-to { opacity: 0; transform: translateY(20px); }

@media (max-width: 768px) {
  .load-pill {
    right: 16px;
    max-width: 220px;
  }
  /* Ensure dismiss button is easy to hit on mobile */
  .pill-dismiss-btn {
    width: 28px;
    height: 28px;
    top: -12px;
    right: -12px;
  }
}
</style>
