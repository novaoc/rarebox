<template>
  <div class="browse-view">
    <div class="browse-intro mb-4">
      <h2 class="browse-title">Browse Sets</h2>
      <p class="browse-sub text-muted">Pick a trading card game to explore its sets, cards, and live prices.</p>
    </div>

    <div class="tcg-grid">
      <component
        v-for="t in tcgs"
        :key="t.id"
        :is="t.available ? 'router-link' : 'div'"
        :to="t.available ? t.route : undefined"
        class="tcg-tile"
        :class="{ 'tcg-disabled': !t.available }"
        :style="{ '--c1': t.c1, '--c2': t.c2 }"
      >
        <div class="tcg-logo" v-html="t.logoSvg"></div>
        <div class="tcg-body">
          <div class="tcg-name">{{ t.name }}</div>
          <div class="tcg-tagline">{{ t.tagline }}</div>
        </div>
        <span v-if="!t.available" class="badge tcg-soon">Soon</span>
        <span v-else class="tcg-arrow" aria-hidden="true">→</span>
      </component>
    </div>
  </div>
</template>

<script setup>
import { TCGS } from '../services/tcg/providers'
const tcgs = TCGS
</script>

<style scoped>
.browse-view { max-width: 1000px; margin: 0 auto; }
.browse-title { font-size: 22px; font-weight: 700; }
.browse-sub { font-size: 13px; margin-top: 2px; }

.tcg-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.tcg-tile {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 18px;
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  border: 1px solid var(--border);
  text-decoration: none;
  color: var(--text-primary);
  overflow: hidden;
  transition: transform 0.18s, border-color 0.18s, box-shadow 0.18s;
}
.tcg-tile:hover { transform: translateY(-2px); border-color: var(--accent); box-shadow: 0 8px 24px rgba(0,0,0,0.3); }
.tcg-disabled { opacity: 0.55; cursor: not-allowed; }
.tcg-disabled:hover { transform: none; border-color: var(--border); box-shadow: none; }

.tcg-logo {
  width: 64px;
  min-width: 64px;
  height: 64px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--c1), var(--c2));
  box-shadow: inset 0 0 0 1px rgba(255,255,255,0.12);
  overflow: hidden;
}
.tcg-logo :deep(svg) { width: 52px; height: 52px; }

.tcg-body { flex: 1; min-width: 0; }
.tcg-name { font-size: 15px; font-weight: 700; }
.tcg-tagline { font-size: 12px; color: var(--text-muted); margin-top: 3px; }

.tcg-arrow { color: var(--text-muted); font-size: 18px; flex-shrink: 0; }
.tcg-tile:hover .tcg-arrow { color: var(--accent); }
.tcg-soon { flex-shrink: 0; background: var(--bg-secondary); color: var(--text-muted); }

@media (prefers-reduced-motion: reduce) {
  .tcg-tile { transition: none; }
  .tcg-tile:hover { transform: none; }
}
</style>
