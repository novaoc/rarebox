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
        <template v-else>
          <!-- Binder completion, visible at the hub level -->
          <span v-if="completion[t.id]" class="badge badge-accent tcg-completion">{{ completion[t.id].pct }}%</span>
          <span class="tcg-arrow" aria-hidden="true">→</span>
        </template>
      </component>
    </div>

    <!-- Browse-adjacent destinations (relocated from the old More tab) -->
    <div class="hub-links mt-4">
      <router-link to="/decks" class="card hub-link">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 2h10"/><path d="M5 6h14"/><rect width="18" height="12" x="3" y="10" rx="2"/></svg>
        <span class="hub-link-body">
          <span class="hub-link-name">Decks</span>
          <span class="hub-link-sub">Build, price, and import the current meta</span>
        </span>
        <span class="tcg-arrow" aria-hidden="true">→</span>
      </router-link>
      <router-link to="/booth" class="card hub-link">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l1.5-5h15L21 9"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 11.5V21h14v-9.5"/><path d="M9 21v-6h6v6"/></svg>
        <span class="hub-link-body">
          <span class="hub-link-name">Card Booth</span>
          <span class="hub-link-sub">Sell IRL — QR booth, table mode, wantlist matching</span>
        </span>
        <span class="tcg-arrow" aria-hidden="true">→</span>
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { TCGS } from '../services/tcg/providers'
import { usePortfolioStore } from '../stores/portfolio'
import { gameCompletion } from '../utils/binderProgress'

const tcgs = TCGS
const store = usePortfolioStore()
const completion = computed(() => gameCompletion(store.portfolios))
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

.tcg-completion { font-family: var(--font-mono, monospace); flex-shrink: 0; }

.hub-links { display: grid; gap: 12px; grid-template-columns: repeat(auto-fill, minmax(min(100%, 280px), 1fr)); }
.hub-link { display: flex; align-items: center; gap: 14px; padding: 16px 18px; text-decoration: none; color: var(--ink); min-height: 64px; }
.hub-link:hover { text-decoration: none; transform: translate(-1px, -1px); box-shadow: var(--shadow-sm); }
.hub-link-body { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
.hub-link-name { font-weight: 800; font-size: 15px; }
.hub-link-sub { font-size: 12.5px; color: var(--text-secondary); }

</style>
