<template>
  <transition name="fade">
    <div v-if="st.running" class="oi-pill" role="status" :title="`Downloading ${gameName} card images`">
      <span class="oi-spinner" aria-hidden="true"></span>
      🖼 {{ pct }}% · {{ st.done.toLocaleString() }}/{{ st.total.toLocaleString() }}<template v-if="st.paused"> · paused</template><template v-else-if="eta"> · {{ eta }}</template>
    </div>
  </transition>
</template>

<script setup>
import { computed } from 'vue'
import { offlineImagesState as st, GAME_NAMES } from '../utils/offlineImages'

const pct = computed(() => (st.total ? Math.floor((st.done / st.total) * 100) : 0))
const eta = computed(() => {
  if (!st.etaSec) return ''
  if (st.etaSec < 90) return `${st.etaSec}s left`
  return `${Math.round(st.etaSec / 60)}m left`
})
const gameName = computed(() => GAME_NAMES[st.game] || st.game)
</script>

<style scoped>
/* Deliberately tiny and out of the way — a status whisper, not a popup */
.oi-pill {
  position: fixed;
  left: 12px;
  bottom: calc(var(--tabbar-height) + env(safe-area-inset-bottom) + 12px);
  z-index: 250;
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 5px 11px;
  background: var(--bg-card);
  border: 1.5px solid var(--ink);
  border-radius: 999px;
  box-shadow: var(--shadow-pressed);
  font-size: 11.5px;
  font-weight: 700;
  color: var(--text-secondary);
}
@media (min-width: 1024px) {
  .oi-pill { bottom: 14px; }
}
.oi-spinner {
  width: 10px; height: 10px;
  border: 2px solid var(--border-subtle);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: oi-spin 0.9s linear infinite;
}
@keyframes oi-spin { to { transform: rotate(360deg); } }
</style>
