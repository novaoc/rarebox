<!--
  CardDatabaseLoader — Modal TCG selection with storage estimates.
  Does NOT block the app. Cards load in background after selection.
-->
<template>
  <div class="loader-overlay" @click.self="$emit('ready')">
    <div class="loader-card">
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
          <span class="tcg-info">
            <span class="tcg-name">{{ g.name }}</span>
            <span class="tcg-meta">{{ g.cards }} cards · {{ g.size }}</span>
          </span>
          <span class="tcg-check" v-if="selected.has(g.id)">✓</span>
        </button>
      </div>

      <div class="storage-summary" v-if="selected.size > 0">
        {{ selectedTotalCards.toLocaleString() }} cards · {{ selectedSize }} on your device
      </div>

      <p class="loader-hint">Search works instantly while data loads. Change later in Settings.</p>

      <button
        class="btn btn-primary loader-start"
        :disabled="selected.size === 0"
        @click="confirm"
      >
        {{ selected.size === 0 ? 'Select at least one' : `Load ${selected.size} TCG${selected.size !== 1 ? 's' : ''}` }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { saveTcgPrefs } from '../services/tcg/cardCache.js'

const emit = defineEmits(['ready'])

// Real measured numbers from API benchmarks
const allGames = [
  { id: 'pokemon', name: 'Pokémon', icon: '⚡', cards: 20359, size: '~2.0 MB', sizeBytes: 2_000_000 },
  { id: 'mtg', name: 'Magic: The Gathering', icon: '🔮', cards: 100000, size: '~8.0 MB', sizeBytes: 8_000_000 },
  { id: 'lorcana', name: 'Disney Lorcana', icon: '✨', cards: 2500, size: '~0.3 MB', sizeBytes: 300_000 },
  { id: 'one-piece', name: 'One Piece', icon: '🏴‍☠️', cards: 3330, size: '~0.4 MB', sizeBytes: 400_000 },
  { id: 'yugioh', name: 'Yu-Gi-Oh!', icon: '🃏', cards: 9372, size: '~1.2 MB', sizeBytes: 1_200_000 },
  { id: 'riftbound', name: 'Riftbound', icon: '⚔️', cards: 1064, size: '~0.1 MB', sizeBytes: 100_000 },
]

const selected = ref(new Set(['pokemon', 'mtg']))

const selectedTotalCards = computed(() => {
  return allGames.filter(g => selected.value.has(g.id)).reduce((s, g) => s + g.cards, 0)
})

const selectedSize = computed(() => {
  const bytes = allGames.filter(g => selected.value.has(g.id)).reduce((s, g) => s + g.sizeBytes, 0)
  if (bytes < 1_000_000) return `~${(bytes / 1000).toFixed(0)} KB`
  return `~${(bytes / 1_000_000).toFixed(1)} MB`
})

function toggle(id) {
  if (selected.value.has(id)) {
    selected.value.delete(id)
  } else {
    selected.value.add(id)
  }
  selected.value = new Set(selected.value)
}

function confirm() {
  saveTcgPrefs([...selected.value])
  emit('ready')
}
</script>

<style scoped>
.loader-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 24px;
  backdrop-filter: blur(4px);
}

.loader-card {
  background: var(--bg-secondary, #161b22);
  border: 1px solid var(--border, #30363d);
  border-radius: 16px;
  padding: 32px 24px;
  max-width: 440px;
  width: 100%;
  text-align: center;
  max-height: 90vh;
  overflow-y: auto;
}

.loader-logo {
  color: var(--accent, #f5a623);
  margin-bottom: 10px;
}

.loader-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary, #e6edf3);
  margin: 0 0 4px;
}

.loader-subtitle {
  font-size: 13px;
  color: var(--text-muted, #8b949e);
  margin: 0 0 16px;
}

.loader-hint {
  font-size: 11px;
  color: var(--text-muted, #8b949e);
  margin: 8px 0 14px;
}

.tcg-grid {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
}

.tcg-option {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1.5px solid var(--border, #30363d);
  background: var(--bg-primary, #0d1117);
  color: var(--text-secondary, #8b949e);
  cursor: pointer;
  transition: all 0.15s;
  font-size: 13px;
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

.tcg-icon { font-size: 18px; flex-shrink: 0; }

.tcg-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}

.tcg-name {
  font-weight: 600;
  font-size: 13px;
}

.tcg-meta {
  font-size: 11px;
  color: var(--text-muted, #8b949e);
}

.tcg-check {
  font-size: 13px;
  font-weight: 700;
  color: var(--accent, #f5a623);
  flex-shrink: 0;
}

.storage-summary {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent, #f5a623);
  padding: 8px 12px;
  background: var(--accent-dim, rgba(245, 166, 35, 0.08));
  border-radius: 8px;
  margin-bottom: 4px;
}

.loader-start {
  width: 100%;
  padding: 10px 20px;
  font-size: 14px;
}
</style>
