<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'

// ── Mock data ────────────────────────────────────────────────────────────

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Shelf', href: '#shelf' },
  { label: 'Compare', href: '#compare' },
]

const heroCards = [
  {
    id: 'h1',
    name: 'Charizard',
    img: 'https://images.pokemontcg.io/base1/4.png',
    price: '$412.00',
    rot: -6,
    accent: '#ffd23f',
  },
  {
    id: 'h2',
    name: 'Pikachu',
    img: 'https://images.pokemontcg.io/base1/58.png',
    price: '$8.40',
    rot: 2,
    accent: '#ff6ba9',
  },
  {
    id: 'h3',
    name: 'Umbreon ☆',
    img: 'https://images.pokemontcg.io/me2/13.png',
    price: '$96.50',
    rot: 8,
    accent: '#2fbf71',
  },
]

const marqueeText =
  'POKÉMON ★ MAGIC ★ YU-GI-OH! ★ LORCANA ★ ONE PIECE ★ RIFTBOUND ★ '

const features = [
  {
    id: 'pl',
    title: 'Portfolio P/L',
    lines: ['See gain & loss on every card you own.', 'Daily snapshots chart your whole shelf.'],
    fill: '#fff3c4',
    icon: 'chart',
  },
  {
    id: 'prices',
    title: 'Live prices',
    lines: ['Market prices across six TCGs, refreshed.', 'Raw, graded, and foil variants tracked.'],
    fill: '#ffd9ea',
    icon: 'bolt',
  },
  {
    id: 'trade',
    title: 'Trade analyzer + scanner',
    lines: ['Stack two sides, scan cards with camera.', 'Instant verdict: who wins the trade.'],
    fill: '#d4f5e4',
    icon: 'swap',
  },
  {
    id: 'import',
    title: 'Collectr import',
    lines: ['Bring your whole Collectr export in.', 'One file, every card, zero retyping.'],
    fill: '#dbe7fe',
    icon: 'box',
  },
]

const shelf = {
  total: '$2,847.16',
  change: '+$31.20 today',
  cards: [
    { id: 's1', name: 'Charizard', set: 'Base Set', price: '$412.00', img: 'https://images.pokemontcg.io/base1/4.png' },
    { id: 's2', name: 'Pikachu', set: 'Base Set', price: '$8.40', img: 'https://images.pokemontcg.io/base1/58.png' },
    { id: 's3', name: 'Umbreon ☆', set: 'Eevee Heroes', price: '$96.50', img: 'https://images.pokemontcg.io/me2/13.png' },
    { id: 's4', name: 'Blastoise', set: 'Base Set', price: '$186.00', img: 'https://images.pokemontcg.io/base1/2.png' },
  ],
}

const scoreboard = [
  { id: 'r1', label: 'Six TCGs in one tracker', them: false, us: true },
  { id: 'r2', label: 'Trade analyzer with card scanner', them: false, us: true },
  { id: 'r3', label: 'Free — no paywall on your own binder', them: false, us: true },
]

// hide broken images gracefully
const hidden = ref({})
function onImgError(id) {
  hidden.value = { ...hidden.value, [id]: true }
}
</script>

<template>
  <div class="tact">
    <!-- ── Sticky nav ─────────────────────────────────────────────── -->
    <header class="nav">
      <a class="brand" href="#top" aria-label="rarebox home">
        <svg class="logomark" viewBox="0 0 44 44" aria-hidden="true">
          <rect x="2" y="2" width="40" height="40" rx="10" fill="#ffd23f" stroke="#141414" stroke-width="3" />
          <text x="22" y="29" text-anchor="middle" font-size="17" font-weight="900" fill="#141414" font-family="inherit">RB</text>
        </svg>
        <span class="wordmark">rarebox</span>
      </a>
      <nav class="nav-links" aria-label="Page sections">
        <a v-for="l in navLinks" :key="l.href" class="nav-link" :href="l.href">{{ l.label }}</a>
      </nav>
      <a class="btn btn-yellow nav-cta" href="https://rarebox.io" rel="noopener">Open the app</a>
    </header>

    <main id="top">
      <!-- ── Hero ─────────────────────────────────────────────────── -->
      <section class="hero">
        <div class="hero-copy">
          <span class="sticker sticker-pink hero-sticker">FREE</span>
          <h1 class="hero-title">
            Collect. Track.<br />
            <span class="marker">Trade.</span> Win.
          </h1>
          <p class="hero-sub">
            One joyful tracker for your whole binder — Pokémon, Magic, Yu-Gi-Oh!,
            Lorcana, One Piece, and Riftbound. Live prices, portfolio P/L, and a
            trade analyzer that tells it straight.
          </p>
          <div class="hero-ctas">
            <a class="btn btn-yellow btn-big" href="https://rarebox.io" rel="noopener">Start tracking — free</a>
            <a class="btn btn-cream btn-big" href="#features">See what's inside</a>
          </div>
        </div>

        <div class="hero-visual" aria-label="Sample cards with live prices">
          <span class="sticker sticker-green hero-badge">6 TCGS</span>
          <div
            v-for="(c, i) in heroCards"
            :key="c.id"
            class="hero-card"
            :class="'hero-card-' + (i + 1)"
            :style="{ '--rot': c.rot + 'deg' }"
          >
            <img
              v-if="!hidden[c.id]"
              :src="c.img"
              :alt="c.name + ' card'"
              loading="lazy"
              @error="onImgError(c.id)"
            />
            <div v-else class="img-fallback" aria-hidden="true">{{ c.name }}</div>
            <span class="price-tag" :style="{ background: c.accent }">{{ c.price }}</span>
          </div>
        </div>
      </section>

      <!-- ── Marquee strip ────────────────────────────────────────── -->
      <section class="marquee" aria-label="Supported games">
        <div class="marquee-track" aria-hidden="true">
          <span class="marquee-chunk">{{ marqueeText }}</span>
          <span class="marquee-chunk">{{ marqueeText }}</span>
        </div>
        <p class="sr-only">
          Pokémon, Magic, Yu-Gi-Oh!, Lorcana, One Piece, and Riftbound.
        </p>
      </section>

      <!-- ── Feature cards ────────────────────────────────────────── -->
      <section id="features" class="features">
        <h2 class="section-title">Built for the <span class="marker marker-pink">pull</span></h2>
        <div class="feature-grid">
          <article
            v-for="f in features"
            :key="f.id"
            class="feature-card"
            :style="{ background: f.fill }"
          >
            <span class="feature-icon" aria-hidden="true">
              <!-- chart -->
              <svg v-if="f.icon === 'chart'" viewBox="0 0 48 48" fill="none">
                <rect x="6" y="26" width="8" height="14" rx="2" fill="#ffd23f" stroke="#141414" stroke-width="2.5" />
                <rect x="20" y="16" width="8" height="24" rx="2" fill="#ff6ba9" stroke="#141414" stroke-width="2.5" />
                <rect x="34" y="8" width="8" height="32" rx="2" fill="#2fbf71" stroke="#141414" stroke-width="2.5" />
              </svg>
              <!-- bolt -->
              <svg v-else-if="f.icon === 'bolt'" viewBox="0 0 48 48" fill="none">
                <path d="M27 4 10 28h11l-2 16 19-26H26l1-14Z" fill="#ffd23f" stroke="#141414" stroke-width="2.5" stroke-linejoin="round" />
              </svg>
              <!-- swap -->
              <svg v-else-if="f.icon === 'swap'" viewBox="0 0 48 48" fill="none">
                <path d="M8 16h26m0 0-7-7m7 7-7 7" stroke="#141414" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M40 32H14m0 0 7-7m-7 7 7 7" stroke="#141414" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <!-- box -->
              <svg v-else viewBox="0 0 48 48" fill="none">
                <path d="M6 16 24 6l18 10v16L24 42 6 32V16Z" fill="#4f86f7" stroke="#141414" stroke-width="2.5" stroke-linejoin="round" />
                <path d="M6 16l18 10 18-10M24 26v16" stroke="#141414" stroke-width="2.5" stroke-linejoin="round" />
              </svg>
            </span>
            <h3 class="feature-title">{{ f.title }}</h3>
            <p v-for="(line, li) in f.lines" :key="li" class="feature-line">{{ line }}</p>
          </article>
        </div>
      </section>

      <!-- ── Dashboard preview ────────────────────────────────────── -->
      <section id="shelf" class="shelf-section">
        <div class="shelf-panel">
          <div class="shelf-head">
            <h2 class="shelf-title">Your shelf</h2>
            <div class="total-sticker">
              <span class="total-label">TOTAL VALUE</span>
              <span class="total-value">{{ shelf.total }}</span>
              <span class="total-change">{{ shelf.change }}</span>
            </div>
          </div>
          <div class="shelf-grid">
            <article v-for="c in shelf.cards" :key="c.id" class="shelf-card">
              <div class="shelf-img-wrap">
                <img
                  v-if="!hidden[c.id]"
                  :src="c.img"
                  :alt="c.name + ' — ' + c.set"
                  loading="lazy"
                  @error="onImgError(c.id)"
                />
                <div v-else class="img-fallback" aria-hidden="true">{{ c.name }}</div>
              </div>
              <h3 class="shelf-name">{{ c.name }}</h3>
              <p class="shelf-set">{{ c.set }}</p>
              <span class="price-chip">{{ c.price }}</span>
            </article>
          </div>
        </div>
      </section>

      <!-- ── Scoreboard ───────────────────────────────────────────── -->
      <section id="compare" class="compare">
        <h2 class="section-title">Collectr <span class="vs">vs</span> <span class="marker">rarebox</span></h2>
        <div class="score-table" role="table" aria-label="Collectr versus rarebox comparison">
          <div class="score-head" role="row">
            <span class="score-feature" role="columnheader">Round</span>
            <span class="score-col" role="columnheader">Collectr</span>
            <span class="score-col" role="columnheader">rarebox</span>
          </div>
          <div v-for="row in scoreboard" :key="row.id" class="score-row" role="row">
            <span class="score-feature" role="cell">{{ row.label }}</span>
            <span class="score-col" role="cell">
              <span class="chip chip-x" :aria-label="row.them ? 'yes' : 'no'">✕</span>
            </span>
            <span class="score-col" role="cell">
              <span class="chip chip-check" :aria-label="row.us ? 'yes' : 'no'">✓</span>
            </span>
          </div>
        </div>
      </section>

      <!-- ── Big CTA banner ───────────────────────────────────────── -->
      <section class="banner-section">
        <div class="banner">
          <span class="sticker sticker-yellow banner-sticker">NEW</span>
          <h2 class="banner-title">Your binder deserves better.</h2>
          <p class="banner-sub">Free forever for your own collection. Import from Collectr in one click.</p>
          <a class="btn btn-ink btn-big" href="https://rarebox.io" rel="noopener">Open the app</a>
        </div>
      </section>
    </main>

    <!-- ── Footer ─────────────────────────────────────────────────── -->
    <footer class="footer">
      <div class="footer-brand">
        <svg class="logomark logomark-sm" viewBox="0 0 44 44" aria-hidden="true">
          <rect x="2" y="2" width="40" height="40" rx="10" fill="#ffd23f" stroke="#141414" stroke-width="3" />
          <text x="22" y="29" text-anchor="middle" font-size="17" font-weight="900" fill="#141414" font-family="inherit">RB</text>
        </svg>
        <span class="wordmark">rarebox</span>
      </div>
      <p class="footer-note">Prototype 03 — Tactile</p>
    </footer>

    <!-- ── Back to Design Lab ─────────────────────────────────────── -->
    <RouterLink class="lab-pill" to="/designs">← Design Lab</RouterLink>
  </div>
</template>

<style scoped>
/* ── Base ─────────────────────────────────────────────────────────── */
.tact {
  --cream: #faf6ef;
  --ink: #141414;
  --yellow: #ffd23f;
  --pink: #ff6ba9;
  --green: #2fbf71;
  --blue: #4f86f7;
  background: var(--cream);
  color: var(--ink);
  min-height: 100vh;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  font-size: 1rem;
  line-height: 1.55;
  overflow-x: hidden;
}

.tact *,
.tact *::before,
.tact *::after {
  box-sizing: border-box;
}

.tact h1,
.tact h2,
.tact h3,
.tact p {
  margin: 0;
}

.tact a {
  color: inherit;
  text-decoration: none;
}

.tact :focus-visible {
  outline: 3px solid var(--blue);
  outline-offset: 3px;
  border-radius: 6px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

/* ── Buttons ──────────────────────────────────────────────────────── */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0.55rem 1.25rem;
  border: 2px solid var(--ink);
  border-radius: 14px;
  font-weight: 800;
  font-size: 1rem;
  background: var(--cream);
  color: var(--ink);
  box-shadow: 4px 4px 0 var(--ink);
  cursor: pointer;
  transition: box-shadow 0.12s ease, transform 0.12s ease;
}

.btn:hover {
  transform: translate(-1px, -1px);
  box-shadow: 5px 5px 0 var(--ink);
}

.btn:active {
  transform: translate(3px, 3px);
  box-shadow: 1px 1px 0 var(--ink);
}

.btn-yellow {
  background: var(--yellow);
}

.btn-cream {
  background: #fff;
}

.tact .btn-ink {
  background: var(--ink);
  color: var(--cream);
}

.btn-big {
  padding: 0.8rem 1.6rem;
  font-size: 1.05rem;
  border-radius: 16px;
}

/* ── Stickers ─────────────────────────────────────────────────────── */
.sticker {
  display: inline-block;
  padding: 0.3rem 0.85rem;
  border: 2px solid var(--ink);
  border-radius: 999px;
  font-weight: 900;
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  transform: rotate(-3deg);
  box-shadow: 3px 3px 0 var(--ink);
}

.sticker-pink {
  background: var(--pink);
  color: #fff;
}

.sticker-green {
  background: var(--green);
  color: #fff;
}

.sticker-yellow {
  background: var(--yellow);
}

/* ── Nav ──────────────────────────────────────────────────────────── */
.nav {
  position: sticky;
  top: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 1rem;
  background: var(--cream);
  border-bottom: 2px solid var(--ink);
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 44px;
}

.logomark {
  width: 38px;
  height: 38px;
  flex: none;
  transform: rotate(-4deg);
}

.logomark-sm {
  width: 30px;
  height: 30px;
}

.wordmark {
  font-weight: 900;
  font-size: 1.3rem;
  letter-spacing: -0.02em;
}

.nav-links {
  display: none;
  margin-left: auto;
  gap: 0.25rem;
}

.nav-link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 0.85rem;
  font-weight: 700;
  border-radius: 12px;
}

.nav-link:hover {
  background: var(--yellow);
  box-shadow: inset 0 0 0 2px var(--ink);
}

.nav-cta {
  margin-left: auto;
  font-size: 0.92rem;
  padding: 0.45rem 1rem;
}

/* ── Hero ─────────────────────────────────────────────────────────── */
.hero {
  display: grid;
  gap: 2.5rem;
  max-width: 1180px;
  margin: 0 auto;
  padding: 2.5rem 1rem 3rem;
  overflow: hidden;
}

.hero-sticker {
  margin-bottom: 1rem;
}

.hero-title {
  font-size: clamp(2.4rem, 8vw, 5.5rem);
  font-weight: 900;
  line-height: 1.02;
  letter-spacing: -0.03em;
}

.marker {
  background: linear-gradient(transparent 18%, var(--yellow) 18%, var(--yellow) 88%, transparent 88%);
  padding: 0 0.15em;
  border-radius: 4px;
}

.marker-pink {
  background: linear-gradient(transparent 18%, var(--pink) 18%, var(--pink) 88%, transparent 88%);
}

.hero-sub {
  margin-top: 1.2rem;
  max-width: 34rem;
  font-size: 1.08rem;
  font-weight: 500;
}

.hero-ctas {
  display: flex;
  flex-wrap: wrap;
  gap: 0.9rem;
  margin-top: 1.6rem;
}

/* hero visual — rotated cards contained inside overflow-hidden hero */
.hero-visual {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 2.2rem 0.5rem 1.5rem;
  min-height: 240px;
}

.hero-badge {
  position: absolute;
  top: 0.25rem;
  right: 8%;
  z-index: 5;
  transform: rotate(6deg);
}

.hero-card {
  position: relative;
  width: clamp(96px, 26vw, 190px);
  background: #fff;
  border: 2px solid var(--ink);
  border-radius: 14px;
  padding: 7px;
  box-shadow: 5px 5px 0 var(--ink);
  transform: rotate(var(--rot));
}

.hero-card-1 {
  z-index: 1;
}

.hero-card-2 {
  z-index: 2;
  margin: 0 clamp(-1.6rem, -4vw, -0.8rem);
  translate: 0 -14px;
}

.hero-card-3 {
  z-index: 3;
  translate: 0 10px;
}

.hero-card img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: 8px;
}

.img-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 5 / 7;
  width: 100%;
  border-radius: 8px;
  background: repeating-linear-gradient(-45deg, #eee, #eee 8px, #f7f7f7 8px, #f7f7f7 16px);
  font-weight: 800;
  font-size: 0.75rem;
  text-align: center;
  padding: 0.4rem;
}

.price-tag {
  position: absolute;
  bottom: -12px;
  left: 50%;
  transform: translateX(-50%) rotate(-3deg);
  padding: 0.18rem 0.6rem;
  border: 2px solid var(--ink);
  border-radius: 999px;
  font-weight: 900;
  font-size: 0.78rem;
  white-space: nowrap;
  box-shadow: 2px 2px 0 var(--ink);
}

/* ── Marquee ──────────────────────────────────────────────────────── */
.marquee {
  border-top: 2px solid var(--ink);
  border-bottom: 2px solid var(--ink);
  background: var(--yellow);
  overflow: hidden;
  padding: 0.7rem 0;
}

.marquee-track {
  display: flex;
  width: max-content;
  animation: tact-marquee 28s linear infinite;
}

.marquee-chunk {
  flex: none;
  white-space: nowrap;
  font-weight: 900;
  font-size: 1.05rem;
  letter-spacing: 0.12em;
  padding-right: 1rem;
}

@keyframes tact-marquee {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}

/* ── Section titles ───────────────────────────────────────────────── */
.section-title {
  font-size: clamp(1.7rem, 5vw, 2.6rem);
  font-weight: 900;
  letter-spacing: -0.02em;
  margin-bottom: 1.6rem;
}

.vs {
  font-style: italic;
  font-weight: 700;
  font-size: 0.7em;
  opacity: 0.65;
  padding: 0 0.15em;
}

/* ── Features ─────────────────────────────────────────────────────── */
.features {
  max-width: 1180px;
  margin: 0 auto;
  padding: 3rem 1rem 1.5rem;
}

.feature-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.1rem;
}

.feature-card {
  border: 2px solid var(--ink);
  border-radius: 16px;
  padding: 1.4rem 1.3rem;
  box-shadow: 4px 4px 0 var(--ink);
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.feature-card:hover {
  transform: translate(-2px, -2px);
  box-shadow: 6px 6px 0 var(--ink);
}

.feature-icon {
  display: inline-flex;
  width: 56px;
  height: 56px;
  padding: 8px;
  background: #fff;
  border: 2px solid var(--ink);
  border-radius: 14px;
  box-shadow: 3px 3px 0 var(--ink);
  margin-bottom: 0.9rem;
}

.feature-icon svg {
  width: 100%;
  height: 100%;
}

.feature-title {
  font-size: 1.2rem;
  font-weight: 900;
  margin-bottom: 0.45rem;
  letter-spacing: -0.01em;
}

.feature-line {
  font-size: 0.95rem;
  font-weight: 500;
}

/* ── Shelf / dashboard preview ────────────────────────────────────── */
.shelf-section {
  max-width: 1180px;
  margin: 0 auto;
  padding: 2rem 1rem;
  overflow: hidden;
}

.shelf-panel {
  background: #fff;
  border: 2px solid var(--ink);
  border-radius: 16px;
  box-shadow: 6px 6px 0 var(--ink);
  padding: 1.4rem 1.2rem 1.6rem;
}

.shelf-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.4rem;
}

.shelf-title {
  font-size: clamp(1.5rem, 4.5vw, 2.2rem);
  font-weight: 900;
  letter-spacing: -0.02em;
}

.total-sticker {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.1rem;
  background: var(--green);
  color: #fff;
  border: 2px solid var(--ink);
  border-radius: 14px;
  padding: 0.6rem 1.1rem;
  box-shadow: 4px 4px 0 var(--ink);
  transform: rotate(-2deg);
}

.total-label {
  font-size: 0.66rem;
  font-weight: 900;
  letter-spacing: 0.14em;
}

.total-value {
  font-size: clamp(1.6rem, 6vw, 2.4rem);
  font-weight: 900;
  line-height: 1.05;
  letter-spacing: -0.02em;
}

.total-change {
  font-size: 0.8rem;
  font-weight: 800;
}

.shelf-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.9rem;
}

.shelf-card {
  border: 2px solid var(--ink);
  border-radius: 14px;
  background: var(--cream);
  padding: 0.7rem;
  box-shadow: 3px 3px 0 var(--ink);
}

.shelf-img-wrap {
  border: 2px solid var(--ink);
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
  margin-bottom: 0.55rem;
}

.shelf-img-wrap img {
  display: block;
  width: 100%;
  height: auto;
}

.shelf-name {
  font-size: 0.95rem;
  font-weight: 900;
  letter-spacing: -0.01em;
}

.shelf-set {
  font-size: 0.78rem;
  font-weight: 600;
  opacity: 0.7;
  margin-bottom: 0.45rem;
}

.price-chip {
  display: inline-block;
  background: var(--yellow);
  border: 2px solid var(--ink);
  border-radius: 999px;
  padding: 0.12rem 0.6rem;
  font-weight: 900;
  font-size: 0.82rem;
  box-shadow: 2px 2px 0 var(--ink);
}

/* ── Scoreboard ───────────────────────────────────────────────────── */
.compare {
  max-width: 1180px;
  margin: 0 auto;
  padding: 2.5rem 1rem;
}

.score-table {
  border: 2px solid var(--ink);
  border-radius: 16px;
  background: #fff;
  box-shadow: 5px 5px 0 var(--ink);
  overflow: hidden;
}

.score-head,
.score-row {
  display: grid;
  grid-template-columns: 1fr 64px 64px;
  align-items: center;
  gap: 0.5rem;
  padding: 0.85rem 1rem;
}

.score-head {
  background: var(--ink);
  color: var(--cream);
  font-weight: 900;
  font-size: 0.78rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.score-row + .score-row {
  border-top: 2px solid var(--ink);
}

.score-feature {
  font-weight: 700;
  font-size: 0.95rem;
}

.score-col {
  display: flex;
  justify-content: center;
}

.chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border: 2px solid var(--ink);
  border-radius: 12px;
  font-weight: 900;
  font-size: 1.05rem;
  box-shadow: 2px 2px 0 var(--ink);
}

.chip-x {
  background: #f1ece2;
  color: #8c8678;
}

.chip-check {
  background: var(--green);
  color: #fff;
  transform: rotate(-3deg);
}

/* ── Banner ───────────────────────────────────────────────────────── */
.banner-section {
  max-width: 1180px;
  margin: 0 auto;
  padding: 1rem 1rem 3rem;
  overflow: hidden;
}

.banner {
  position: relative;
  background: #ffd9ea;
  border: 2px solid var(--ink);
  border-radius: 16px;
  box-shadow: 6px 6px 0 var(--ink);
  padding: 2.5rem 1.4rem 2.6rem;
  text-align: center;
}

.banner-sticker {
  position: absolute;
  top: -14px;
  right: 8%;
  transform: rotate(5deg);
}

.banner-title {
  font-size: clamp(1.8rem, 6vw, 3.2rem);
  font-weight: 900;
  letter-spacing: -0.03em;
  margin-bottom: 0.7rem;
}

.banner-sub {
  font-size: 1.02rem;
  font-weight: 600;
  max-width: 32rem;
  margin: 0 auto 1.5rem;
}

/* ── Footer ───────────────────────────────────────────────────────── */
.footer {
  border-top: 2px solid var(--ink);
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.8rem;
  max-width: 1180px;
  margin: 0 auto;
  padding: 1.4rem 1rem 5.5rem;
}

.footer-brand {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}

.footer-note {
  font-weight: 700;
  font-size: 0.85rem;
  opacity: 0.7;
}

/* ── Design Lab pill ──────────────────────────────────────────────── */
.tact .lab-pill {
  position: fixed;
  left: 1rem;
  bottom: 1rem;
  z-index: 60;
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0.5rem 1.05rem;
  background: var(--ink);
  color: var(--cream);
  border: 2px solid var(--ink);
  border-radius: 999px;
  font-weight: 800;
  font-size: 0.92rem;
  box-shadow: 4px 4px 0 rgba(20, 20, 20, 0.25);
  transition: transform 0.12s ease, box-shadow 0.12s ease;
}

.tact .lab-pill:hover {
  transform: translate(-1px, -1px);
}

.lab-pill:active {
  transform: translate(3px, 3px);
  box-shadow: 1px 1px 0 rgba(20, 20, 20, 0.25);
}

/* ── Breakpoints ──────────────────────────────────────────────────── */

/* ≤480: single column everywhere (defaults already 1-col); tighten hero */
@media (max-width: 480px) {
  .hero {
    padding-top: 2rem;
  }

  .hero-ctas .btn {
    flex: 1 1 100%;
  }

  .score-head,
  .score-row {
    grid-template-columns: 1fr 52px 52px;
    padding: 0.75rem 0.7rem;
  }
}

/* ≥640 */
@media (min-width: 640px) {
  .feature-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .shelf-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .nav {
    padding: 0.65rem 1.5rem;
  }
}

/* ≥720: foldables / small tablets */
@media (min-width: 720px) {
  .nav-links {
    display: flex;
  }

  .nav-cta {
    margin-left: 0.5rem;
  }

  .hero {
    grid-template-columns: 1.15fr 0.85fr;
    align-items: center;
    padding-top: 3.5rem;
    padding-bottom: 4rem;
  }

  .hero-visual {
    padding-top: 1.5rem;
  }
}

/* ≥1024: desktop */
@media (min-width: 1024px) {
  .hero,
  .features,
  .shelf-section,
  .compare,
  .banner-section,
  .footer {
    padding-left: 2rem;
    padding-right: 2rem;
  }

  .feature-grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .shelf-panel {
    padding: 2rem 2rem 2.2rem;
  }

  .banner {
    padding: 3.4rem 2rem 3.6rem;
  }
}

/* ── Reduced motion ───────────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .marquee-track {
    animation: none;
  }

  .btn,
  .feature-card,
  .lab-pill {
    transition: none;
  }

  .btn:hover,
  .feature-card:hover,
  .lab-pill:hover {
    transform: none;
  }
}
</style>
