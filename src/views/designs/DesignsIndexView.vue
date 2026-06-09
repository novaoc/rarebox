<template>
  <div class="lab">
    <header class="lab-head">
      <div class="lab-brand">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
        <span>Rarebox · Design Lab</span>
      </div>
      <p class="lab-sub">
        Five complete brand + landing-page directions, each UX-first and tuned for phones,
        foldables (open one on a 280–720px window), tablets and desktop.
        Open each route, resize freely, pick a winner.
      </p>
    </header>

    <main class="lab-grid">
      <RouterLink v-for="d in designs" :key="d.slug" :to="`/designs/${d.slug}`" class="lab-card">
        <div class="lab-card-top" :style="{ background: d.bg }">
          <span class="lab-num">{{ d.num }}</span>
          <span class="lab-swatches">
            <i v-for="c in d.swatches" :key="c" :style="{ background: c }" />
          </span>
        </div>
        <div class="lab-card-body">
          <h2 :style="{ fontFamily: d.serif ? 'Georgia, serif' : undefined }">{{ d.name }}</h2>
          <p>{{ d.blurb }}</p>
          <span class="lab-route">/designs/{{ d.slug }} →</span>
        </div>
      </RouterLink>
    </main>

    <footer class="lab-foot">
      <span>Branch <code>Design</code> · built by Nova · {{ designs.length }} prototypes</span>
      <RouterLink to="/" class="lab-back">← Back to current app</RouterLink>
    </footer>
  </div>
</template>

<script setup>
import { RouterLink } from 'vue-router'

const designs = [
  {
    num: '01', slug: 'mono', name: 'Mono',
    blurb: 'Swiss typographic minimalism. White space, hairlines, one electric indigo. The quietest, most confident take.',
    bg: '#ffffff', swatches: ['#0a0a0a', '#4f46e5', '#e5e5e5'],
  },
  {
    num: '02', slug: 'aurora', name: 'Aurora',
    blurb: 'Premium dark glassmorphism — frosted panels over violet→cyan light. Fintech-grade, feels like a pro product.',
    bg: 'linear-gradient(135deg,#0a0c14 40%,#241a4a 75%,#0a3540)', swatches: ['#7c3aed', '#22d3ee', '#e7e9ee'],
  },
  {
    num: '03', slug: 'tactile', name: 'Tactile',
    blurb: 'Joyful neo-brutalism: bold borders, sticker badges, hard shadows. The fun of collecting, kept clean.',
    bg: '#faf6ef', swatches: ['#ffd23f', '#ff6ba9', '#2fbf71', '#141414'],
  },
  {
    num: '04', slug: 'atelier', name: 'Atelier', serif: true,
    blurb: 'Collection-as-gallery. Bone white, serif headlines, museum labels, terracotta + sage. Cards treated as artworks.',
    bg: '#f7f4ee', swatches: ['#c4552e', '#7a8b6f', '#1c1a17'],
  },
  {
    num: '05', slug: 'pulse', name: 'Pulse',
    blurb: 'Market terminal for serious collectors. Mono numerals, dense holdings tables, tickers, amber on near-black.',
    bg: '#0b0d10', swatches: ['#f0b90b', '#16c784', '#ea3943'],
  },
]
</script>

<style scoped>
.lab {
  min-height: 100vh;
  background: #101114;
  color: #e8e9ec;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  display: flex;
  flex-direction: column;
  padding: clamp(20px, 4vw, 48px);
}
.lab-head { max-width: 760px; margin: 0 auto 36px; text-align: center; }
.lab-brand {
  display: inline-flex; align-items: center; gap: 10px;
  font-size: clamp(20px, 3.5vw, 26px); font-weight: 700; letter-spacing: -0.02em;
}
.lab-sub { margin-top: 12px; color: #9a9ca6; font-size: clamp(14px, 2vw, 16px); line-height: 1.6; }

.lab-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: 18px;
  max-width: 1180px;
  margin: 0 auto;
  width: 100%;
}
.lab-card {
  display: flex; flex-direction: column;
  background: #17181c;
  border: 1px solid #26272d;
  border-radius: 14px;
  overflow: hidden;
  text-decoration: none;
  color: inherit;
  transition: transform 0.15s ease, border-color 0.15s ease;
  min-height: 44px;
}
.lab-card:hover { transform: translateY(-3px); border-color: #4a4c55; }
.lab-card:focus-visible { outline: 2px solid #7c8cf8; outline-offset: 2px; }
.lab-card-top {
  height: 96px;
  display: flex; align-items: flex-start; justify-content: space-between;
  padding: 12px 14px;
}
.lab-num { font-size: 13px; font-weight: 700; color: rgba(127,127,127,0.85); letter-spacing: 0.1em; }
.lab-swatches { display: flex; gap: 6px; }
.lab-swatches i { width: 16px; height: 16px; border-radius: 50%; border: 1px solid rgba(127,127,127,0.4); }
.lab-card-body { padding: 18px; display: flex; flex-direction: column; gap: 8px; flex: 1; }
.lab-card-body h2 { font-size: 22px; letter-spacing: -0.01em; }
.lab-card-body p { color: #9a9ca6; font-size: 14px; line-height: 1.55; flex: 1; }
.lab-route { color: #7c8cf8; font-size: 13px; font-weight: 600; }

.lab-foot {
  margin-top: 40px;
  display: flex; flex-wrap: wrap; gap: 12px;
  align-items: center; justify-content: space-between;
  color: #6f7178; font-size: 13px;
  max-width: 1180px; margin-left: auto; margin-right: auto; width: 100%;
}
.lab-foot code { background: #1d1e23; padding: 2px 6px; border-radius: 5px; }
.lab-back { color: #9a9ca6; text-decoration: none; padding: 10px 0; }
.lab-back:hover { color: #e8e9ec; }

@media (prefers-reduced-motion: reduce) {
  .lab-card { transition: none; }
}
</style>
