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
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr));
  gap: 14px;
}

.tcg-tile {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  border-radius: var(--radius-lg);
  background: var(--bg-card);
  border: var(--bw) solid var(--ink);
  box-shadow: var(--shadow-xs);
  text-decoration: none;
  color: var(--text-primary);
  overflow: hidden;
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}
.tcg-tile:hover { transform: translate(-1px, -1px); box-shadow: var(--shadow-sm); }
.tcg-disabled { opacity: 0.55; cursor: not-allowed; box-shadow: none; }
.tcg-disabled:hover { transform: none; box-shadow: none; }

.tcg-logo {
  /* the brand SVGs are 200x80 — give them a wide stage, not a square */
  width: 150px;
  min-width: 150px;
  height: 68px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  border: var(--bw) solid var(--ink);
  border-radius: var(--radius);
  box-shadow: var(--shadow-pressed);
  padding: 6px 8px;
}
.tcg-logo :deep(svg) { width: 100%; height: 100%; }
/* dark: the white stage glares on coal — logos sit on a card surface */
:root[data-theme='dark'] .tcg-logo { background: var(--bg-card); }

.tcg-body { flex: 1; min-width: 0; }
.tcg-name { font-size: 15px; font-weight: 700; }
.tcg-tagline { font-size: 12px; color: var(--text-muted); margin-top: 3px; }

.tcg-arrow { color: var(--text-muted); font-size: 18px; flex-shrink: 0; transition: transform 0.12s ease, color 0.12s ease; }
.tcg-tile:hover .tcg-arrow { color: var(--ink); transform: translateX(2px); }
.tcg-soon { flex-shrink: 0; background: var(--bg-secondary); color: var(--text-secondary); }

@media (prefers-reduced-motion: reduce) {
  .tcg-tile { transition: none; }
  .tcg-tile:hover { transform: none; }
}
@media (max-width: 480px) {
  .tcg-logo { width: 118px; min-width: 118px; height: 54px; }
}
</style>
