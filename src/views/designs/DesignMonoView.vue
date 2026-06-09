<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'

// ——— Mock data ————————————————————————————————————————————————

const navLinks = [
  { label: 'Features', href: '#features' },
  { label: 'Live Prices', href: '#prices' },
  { label: 'Trade', href: '#why' },
  { label: 'Import', href: '#features' },
]

const portfolioRows = [
  {
    name: 'Charizard',
    set: 'Base Set · 4/102',
    qty: 1,
    price: '$412.50',
    change: '+2.4%',
    up: true,
    img: 'https://images.pokemontcg.io/base1/4.png',
  },
  {
    name: 'Pikachu',
    set: 'Base Set · 58/102',
    qty: 4,
    price: '$9.80',
    change: '+0.7%',
    up: true,
    img: 'https://images.pokemontcg.io/base1/58.png',
  },
  {
    name: 'Mew ex',
    set: '151 · 151/165',
    qty: 1,
    price: '$38.12',
    change: '−1.2%',
    up: false,
    img: 'https://images.pokemontcg.io/sv3pt5/151.png',
  },
  {
    name: 'Mega Lucario ex',
    set: 'Mega Evolution · 13',
    qty: 2,
    price: '$21.45',
    change: '+5.1%',
    up: true,
    img: 'https://images.pokemontcg.io/me2/13.png',
  },
  {
    name: 'Sol Ring',
    set: 'Commander Masters',
    qty: 3,
    price: '$1.95',
    change: '−0.3%',
    up: false,
    img: null,
    mark: 'MTG',
  },
]

const stats = [
  { value: '120k+', label: 'cards indexed' },
  { value: '6', label: 'TCGs supported' },
  { value: 'Live', label: 'market prices' },
  { value: '$0', label: 'free, forever' },
]

const features = [
  {
    num: '01',
    title: 'Portfolio & P/L tracking',
    copy: 'Every card you own, priced daily. Cost basis in, market value out — profit and loss without a spreadsheet.',
  },
  {
    num: '02',
    title: 'Live prices across 6 TCGs',
    copy: 'Pokémon, Magic, Yu-Gi-Oh!, Lorcana, One Piece and Riftbound in one ledger. One number for the whole shelf.',
  },
  {
    num: '03',
    title: 'Trade analyzer with scanner',
    copy: 'Point your camera at both sides of a trade. Rarebox totals each stack and tells you who is up — before you shake on it.',
  },
  {
    num: '04',
    title: 'One-click Collectr import',
    copy: 'Switching takes one CSV. Export from Collectr, drop it here, and your whole collection arrives priced and sorted.',
  },
]

const dashCards = [
  { name: 'Charizard', price: '$412.50', img: 'https://images.pokemontcg.io/base1/4.png' },
  { name: 'Pikachu', price: '$9.80', img: 'https://images.pokemontcg.io/base1/58.png' },
  { name: 'Mew ex', price: '$38.12', img: 'https://images.pokemontcg.io/sv3pt5/151.png' },
  { name: 'Mega Lucario ex', price: '$21.45', img: 'https://images.pokemontcg.io/me2/13.png' },
]

const compareRows = [
  {
    feature: 'Instant offline search',
    rarebox: 'Whole index on-device. Results as you type, even in a dead zone at a card show.',
    collectr: 'Online lookups only.',
  },
  {
    feature: 'Trade analyzer + scanner',
    rarebox: 'Built in, free. Scan both stacks, get a verdict.',
    collectr: 'Not offered.',
  },
  {
    feature: 'No account needed',
    rarebox: 'Local-first. Your collection lives on your device, not on our servers.',
    collectr: 'Sign-up required.',
  },
]

// Sparkline: 30 points of a gently rising series, mapped to a 220×48 viewBox.
const sparkSeries = [
  31, 30, 32, 33, 31, 34, 35, 34, 36, 38, 37, 39, 38, 40, 42, 41, 43, 42, 44,
  46, 45, 47, 49, 48, 50, 52, 51, 54, 53, 56,
]
const sparkPoints = sparkSeries
  .map((v, i) => {
    const x = (i / (sparkSeries.length - 1)) * 220
    const y = 48 - ((v - 28) / 30) * 44
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  .join(' ')

const year = new Date().getFullYear()
const noop = () => {}
const hideImg = (e) => {
  e.target.style.display = 'none'
}
const scrolled = ref(false)
if (typeof window !== 'undefined') {
  window.addEventListener(
    'scroll',
    () => {
      scrolled.value = window.scrollY > 8
    },
    { passive: true }
  )
}
</script>

<template>
  <div class="mono">
    <!-- ——— 00 / NAV ——————————————————————————————————————— -->
    <header class="nav" :class="{ 'nav--scrolled': scrolled }">
      <div class="container nav__inner">
        <a href="#top" class="brand" @click.prevent="noop">
          <svg
            class="brand__mark"
            viewBox="0 0 32 32"
            width="28"
            height="28"
            aria-hidden="true"
          >
            <rect width="32" height="32" fill="#0a0a0a" />
            <text
              x="16"
              y="23"
              text-anchor="middle"
              fill="#ffffff"
              font-size="19"
              font-weight="700"
              font-family="inherit"
            >
              R
            </text>
          </svg>
          <span class="brand__word">RAREBOX</span>
        </a>

        <nav class="nav__links" aria-label="Primary">
          <a v-for="l in navLinks" :key="l.label" :href="l.href" class="nav__link">
            {{ l.label }}
          </a>
        </nav>

        <button type="button" class="btn btn--accent nav__cta">Open App</button>
      </div>
    </header>

    <main id="top">
      <!-- ——— 01 / HERO ————————————————————————————————————— -->
      <section class="hero">
        <div class="container hero__grid">
          <div class="hero__copy">
            <p class="eyebrow">
              <span class="eyebrow__num">01</span>
              PORTFOLIO TRACKER FOR SIX TCGS
            </p>
            <h1 class="hero__title">
              Know what your collection is&nbsp;<em>worth.</em>
            </h1>
            <p class="hero__sub">
              One ledger for Pokémon, Magic, Yu-Gi-Oh!, Lorcana, One Piece and
              Riftbound — priced live, tracked daily.
            </p>
            <div class="hero__ctas">
              <button type="button" class="btn btn--accent btn--lg">
                Start tracking — free
              </button>
              <button type="button" class="btn btn--ghost btn--lg">
                Browse 137,000 cards
              </button>
            </div>
          </div>

          <!-- Hero visual: minimal portfolio table -->
          <div class="hero__visual" aria-label="Sample portfolio table">
            <div class="ptable">
              <div class="ptable__head">
                <span class="ptable__label">HOLDING</span>
                <span class="ptable__label ptable__label--right">PRICE / 24H</span>
              </div>
              <div v-for="row in portfolioRows" :key="row.name" class="ptable__row">
                <div class="ptable__thumb">
                  <img
                    v-if="row.img"
                    :src="row.img"
                    :alt="row.name"
                    loading="lazy"
                    @error="hideImg"
                  />
                  <span v-else class="ptable__mark">{{ row.mark }}</span>
                </div>
                <div class="ptable__id">
                  <span class="ptable__name">{{ row.name }}</span>
                  <span class="ptable__set">{{ row.set }} · ×{{ row.qty }}</span>
                </div>
                <div class="ptable__num">
                  <span class="ptable__price">{{ row.price }}</span>
                  <span
                    class="ptable__change"
                    :class="row.up ? 'is-up' : 'is-down'"
                  >
                    {{ row.change }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ——— 02 / STATS STRIP ——————————————————————————————— -->
      <section id="prices" class="stats">
        <div class="container">
          <div class="stats__grid">
            <div v-for="s in stats" :key="s.label" class="stats__cell">
              <span class="stats__value">{{ s.value }}</span>
              <span class="stats__label">{{ s.label }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ——— 03 / FEATURES ————————————————————————————————— -->
      <section id="features" class="section">
        <div class="container">
          <p class="eyebrow">
            <span class="eyebrow__num">02</span>
            WHAT IT DOES
          </p>
          <h2 class="section__title">Four tools. Zero clutter.</h2>

          <div class="features">
            <article v-for="f in features" :key="f.num" class="feature">
              <span class="feature__num">{{ f.num }}</span>
              <h3 class="feature__title">{{ f.title }}</h3>
              <p class="feature__copy">{{ f.copy }}</p>
            </article>
          </div>
        </div>
      </section>

      <!-- ——— 04 / DASHBOARD PREVIEW ————————————————————————— -->
      <section class="section section--ruled">
        <div class="container">
          <p class="eyebrow">
            <span class="eyebrow__num">03</span>
            THE DASHBOARD
          </p>
          <h2 class="section__title">Your shelf, as a number.</h2>

          <div class="dash">
            <div class="dash__top">
              <div class="dash__value">
                <span class="dash__label">TOTAL VALUE</span>
                <span class="dash__figure">$4,318<span class="dash__cents">.27</span></span>
                <span class="dash__delta">+ $96.40 today</span>
              </div>
              <div class="dash__spark">
                <span class="dash__label">LAST 30 DAYS</span>
                <svg viewBox="0 0 220 48" class="spark" role="img" aria-label="Portfolio value trend, rising">
                  <polyline
                    :points="sparkPoints"
                    fill="none"
                    stroke="#4f46e5"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                  />
                </svg>
              </div>
            </div>

            <div class="dash__cards">
              <figure v-for="c in dashCards" :key="c.name" class="dcard">
                <div class="dcard__img">
                  <img :src="c.img" :alt="c.name" loading="lazy" @error="hideImg" />
                </div>
                <figcaption class="dcard__meta">
                  <span class="dcard__name">{{ c.name }}</span>
                  <span class="dcard__price">{{ c.price }}</span>
                </figcaption>
              </figure>
            </div>
          </div>
        </div>
      </section>

      <!-- ——— 05 / WHY NOT COLLECTR ————————————————————————— -->
      <section id="why" class="section">
        <div class="container">
          <p class="eyebrow">
            <span class="eyebrow__num">04</span>
            THE SWITCH
          </p>
          <h2 class="section__title">Why not Collectr?</h2>
          <p class="section__sub">
            We like Collectr fine. We just think a tracker should work offline,
            analyze trades, and never ask for your email.
          </p>

          <div class="compare" role="table" aria-label="Rarebox versus Collectr">
            <div class="compare__head" role="row">
              <span class="compare__h compare__h--feature" role="columnheader">FEATURE</span>
              <span class="compare__h" role="columnheader">RAREBOX</span>
              <span class="compare__h" role="columnheader">COLLECTR</span>
            </div>
            <div v-for="row in compareRows" :key="row.feature" class="compare__row" role="row">
              <span class="compare__feature" role="cell">{{ row.feature }}</span>
              <span class="compare__cell compare__cell--us" role="cell">
                <span class="compare__tick" aria-hidden="true">✓</span>
                {{ row.rarebox }}
              </span>
              <span class="compare__cell" role="cell">
                <span class="compare__cross" aria-hidden="true">—</span>
                {{ row.collectr }}
              </span>
            </div>
          </div>

          <div class="switch-cta">
            <p class="switch-cta__line">Switching takes one CSV.</p>
            <button type="button" class="btn btn--accent btn--lg">
              Import from Collectr
            </button>
          </div>
        </div>
      </section>
    </main>

    <!-- ——— 06 / FOOTER ——————————————————————————————————— -->
    <footer class="footer">
      <div class="container footer__inner">
        <a href="#top" class="brand brand--footer" @click.prevent="noop">
          <svg class="brand__mark" viewBox="0 0 32 32" width="22" height="22" aria-hidden="true">
            <rect width="32" height="32" fill="#0a0a0a" />
            <text
              x="16"
              y="23"
              text-anchor="middle"
              fill="#ffffff"
              font-size="19"
              font-weight="700"
              font-family="inherit"
            >
              R
            </text>
          </svg>
          <span class="brand__word">RAREBOX</span>
        </a>

        <nav class="footer__links" aria-label="Footer">
          <a v-for="l in navLinks" :key="l.label" :href="l.href" class="nav__link">
            {{ l.label }}
          </a>
        </nav>

        <p class="footer__proto">Prototype 01 — Mono · © {{ year }} rarebox.io</p>
      </div>
    </footer>

    <!-- Floating back link -->
    <RouterLink to="/designs" class="lab-pill">← Design Lab</RouterLink>
  </div>
</template>

<style scoped>
/* ——— Tokens & base ———————————————————————————————————————— */

.mono {
  --ink: #0a0a0a;
  --paper: #ffffff;
  --accent: #4f46e5;
  --hairline: #e5e5e5;
  --muted: #6b6b6b;
  --mono-font: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;

  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial,
    sans-serif;
  background: var(--paper);
  color: var(--ink);
  min-height: 100vh;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}

.mono *,
.mono *::before,
.mono *::after {
  box-sizing: border-box;
  margin: 0;
}

.container {
  width: 100%;
  padding-inline: 1rem;
  margin-inline: auto;
  min-width: 0;
}

a {
  color: inherit;
}

img {
  max-width: 100%;
  display: block;
}

:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}

/* ——— Type helpers ————————————————————————————————————————— */

.eyebrow {
  font-family: var(--mono-font);
  font-size: 0.6875rem;
  letter-spacing: 0.18em;
  color: var(--muted);
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
  word-break: break-word;
}

.eyebrow__num {
  color: var(--accent);
  border-bottom: 1px solid var(--accent);
  padding-bottom: 1px;
}

.section__title {
  font-size: clamp(1.7rem, 5.5vw, 3rem);
  letter-spacing: -0.03em;
  line-height: 1.05;
  font-weight: 700;
  margin-bottom: 1rem;
  word-break: break-word;
}

.section__sub {
  color: var(--muted);
  max-width: 34rem;
  margin-bottom: 2rem;
}

/* ——— Buttons ——————————————————————————————————————————————— */

.btn {
  font: inherit;
  font-weight: 600;
  font-size: 0.9375rem;
  letter-spacing: -0.01em;
  min-height: 44px;
  padding: 0.6rem 1.1rem;
  border: 1px solid var(--ink);
  background: var(--paper);
  color: var(--ink);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease, border-color 0.15s ease;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
}

.btn--accent {
  background: var(--ink);
  color: var(--paper);
  border-color: var(--ink);
}

.btn--accent:hover {
  background: var(--accent);
  border-color: var(--accent);
}

.btn--ghost:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.btn--lg {
  min-height: 48px;
  padding: 0.7rem 1.4rem;
}

/* ——— Brand ————————————————————————————————————————————————— */

.brand {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  text-decoration: none;
  min-height: 44px;
}

.brand__mark {
  flex: none;
}

.brand__word {
  font-weight: 700;
  letter-spacing: 0.14em;
  font-size: 0.9375rem;
}

/* ——— Nav ——————————————————————————————————————————————————— */

.nav {
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--paper);
  border-bottom: 1px solid transparent;
  transition: border-color 0.15s ease;
}

.nav--scrolled {
  border-bottom-color: var(--hairline);
}

.nav__inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding-block: 0.6rem;
}

.nav__links {
  display: none;
}

.nav__link {
  text-decoration: none;
  font-size: 0.9rem;
  color: var(--ink);
  padding: 0.6rem 0.2rem;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  border-bottom: 1px solid transparent;
}

.nav__link:hover {
  border-bottom-color: var(--ink);
}

.nav__cta {
  flex: none;
}

/* ——— Hero —————————————————————————————————————————————————— */

.hero {
  padding-block: 3rem 3.5rem;
  border-bottom: 1px solid var(--hairline);
}

.hero__grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 2.5rem;
}

.hero__title {
  font-size: clamp(2.4rem, 8vw, 6.5rem);
  letter-spacing: -0.04em;
  line-height: 0.98;
  font-weight: 700;
  margin-bottom: 1.25rem;
  word-break: break-word;
}

.hero__title em {
  font-style: normal;
  color: var(--accent);
}

.hero__sub {
  color: var(--muted);
  font-size: 1.0625rem;
  max-width: 30rem;
  margin-bottom: 1.75rem;
}

.hero__ctas {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.hero__ctas .btn {
  flex: 1 1 auto;
}

/* Portfolio table mock */

.hero__visual {
  min-width: 0;
}

.ptable {
  border: 1px solid var(--ink);
}

.ptable__head {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--ink);
}

.ptable__label {
  font-family: var(--mono-font);
  font-size: 0.625rem;
  letter-spacing: 0.16em;
  color: var(--muted);
}

.ptable__label--right {
  text-align: right;
}

.ptable__row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.75rem;
  padding: 0.55rem 0.75rem;
  border-bottom: 1px solid var(--hairline);
  transition: transform 0.15s ease;
}

.ptable__row:last-child {
  border-bottom: none;
}

.ptable__row:hover {
  transform: translateY(-2px);
}

.ptable__thumb {
  width: 30px;
  aspect-ratio: 63 / 88;
  border: 1px solid var(--hairline);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex: none;
}

.ptable__thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.ptable__mark {
  font-family: var(--mono-font);
  font-size: 0.5rem;
  letter-spacing: 0.08em;
  color: var(--muted);
}

.ptable__id {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.ptable__name {
  font-weight: 600;
  font-size: 0.9rem;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ptable__set {
  font-size: 0.75rem;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ptable__num {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex: none;
}

.ptable__price {
  font-weight: 600;
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
}

.ptable__change {
  font-family: var(--mono-font);
  font-size: 0.6875rem;
}

.is-up {
  color: var(--accent);
}

.is-down {
  color: var(--muted);
}

/* ——— Stats strip ——————————————————————————————————————————— */

.stats {
  border-bottom: 1px solid var(--hairline);
}

.stats__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.stats__cell {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 1.25rem 0.75rem;
  border-right: 1px solid var(--hairline);
  min-width: 0;
}

.stats__cell:nth-child(2n) {
  border-right: none;
}

.stats__cell:nth-child(-n + 2) {
  border-bottom: 1px solid var(--hairline);
}

.stats__value {
  font-size: clamp(1.5rem, 5vw, 2.25rem);
  font-weight: 700;
  letter-spacing: -0.03em;
}

.stats__label {
  font-family: var(--mono-font);
  font-size: 0.6875rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
  word-break: break-word;
}

/* ——— Sections ————————————————————————————————————————————— */

.section {
  padding-block: 3.5rem;
}

.section--ruled {
  border-top: 1px solid var(--hairline);
  border-bottom: 1px solid var(--hairline);
}

/* ——— Features ————————————————————————————————————————————— */

.features {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  border-top: 1px solid var(--hairline);
  border-left: 1px solid var(--hairline);
  margin-top: 2rem;
}

.feature {
  border-right: 1px solid var(--hairline);
  border-bottom: 1px solid var(--hairline);
  padding: 1.5rem 1.25rem;
  transition: transform 0.15s ease;
  min-width: 0;
}

.feature:hover {
  transform: translateY(-2px);
}

.feature__num {
  font-family: var(--mono-font);
  font-size: 0.6875rem;
  letter-spacing: 0.16em;
  color: var(--accent);
  display: block;
  margin-bottom: 0.85rem;
}

.feature__title {
  font-size: 1.2rem;
  letter-spacing: -0.02em;
  font-weight: 700;
  margin-bottom: 0.5rem;
  word-break: break-word;
}

.feature__copy {
  color: var(--muted);
  font-size: 0.9375rem;
}

/* ——— Dashboard preview ————————————————————————————————————— */

.dash {
  border: 1px solid var(--ink);
  margin-top: 2rem;
}

.dash__top {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 1.5rem;
  padding: 1.5rem 1.25rem;
  border-bottom: 1px solid var(--hairline);
}

.dash__label {
  font-family: var(--mono-font);
  font-size: 0.625rem;
  letter-spacing: 0.16em;
  color: var(--muted);
  display: block;
  margin-bottom: 0.5rem;
}

.dash__figure {
  font-size: clamp(2.4rem, 9vw, 4.5rem);
  font-weight: 700;
  letter-spacing: -0.04em;
  line-height: 1;
  display: block;
  font-variant-numeric: tabular-nums;
  word-break: break-word;
}

.dash__cents {
  color: var(--muted);
  font-size: 0.5em;
  font-weight: 600;
}

.dash__delta {
  font-family: var(--mono-font);
  font-size: 0.75rem;
  color: var(--accent);
  display: block;
  margin-top: 0.5rem;
}

.dash__spark {
  min-width: 0;
}

.spark {
  width: 100%;
  max-width: 320px;
  height: auto;
  display: block;
}

.dash__cards {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.dcard {
  border-right: 1px solid var(--hairline);
  border-bottom: 1px solid var(--hairline);
  padding: 1rem;
  transition: transform 0.15s ease;
  min-width: 0;
}

.dcard:nth-child(2n) {
  border-right: none;
}

.dcard:nth-last-child(-n + 2) {
  border-bottom: none;
}

.dcard:hover {
  transform: translateY(-2px);
}

.dcard__img {
  aspect-ratio: 63 / 88;
  border: 1px solid var(--hairline);
  overflow: hidden;
  margin-bottom: 0.6rem;
  background: #fafafa;
}

.dcard__img img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.dcard__meta {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.dcard__name {
  font-weight: 600;
  font-size: 0.85rem;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dcard__price {
  font-family: var(--mono-font);
  font-size: 0.75rem;
  color: var(--muted);
}

/* ——— Comparison ———————————————————————————————————————————— */

.compare {
  border: 1px solid var(--ink);
}

.compare__head {
  display: none;
}

.compare__row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  border-bottom: 1px solid var(--hairline);
}

.compare__row:last-child {
  border-bottom: none;
}

.compare__feature {
  grid-column: 1 / -1;
  font-weight: 700;
  font-size: 0.95rem;
  letter-spacing: -0.01em;
  padding: 0.85rem 1rem 0.25rem;
  word-break: break-word;
}

.compare__cell {
  padding: 0.5rem 1rem 1rem;
  font-size: 0.85rem;
  color: var(--muted);
  min-width: 0;
  word-break: break-word;
}

.compare__cell--us {
  color: var(--ink);
  border-right: 1px solid var(--hairline);
}

.compare__tick {
  font-family: var(--mono-font);
  color: var(--accent);
  margin-right: 0.35rem;
}

.compare__cross {
  font-family: var(--mono-font);
  margin-right: 0.35rem;
}

.compare__h {
  font-family: var(--mono-font);
  font-size: 0.625rem;
  letter-spacing: 0.16em;
  color: var(--muted);
  padding: 0.6rem 1rem;
}

.switch-cta {
  margin-top: 2.5rem;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1rem;
}

.switch-cta__line {
  font-size: clamp(1.3rem, 4.5vw, 2rem);
  font-weight: 700;
  letter-spacing: -0.03em;
}

/* ——— Footer ———————————————————————————————————————————————— */

.footer {
  border-top: 1px solid var(--ink);
  padding-block: 2.5rem 5rem;
}

.footer__inner {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  align-items: flex-start;
}

.footer__links {
  display: flex;
  flex-wrap: wrap;
  gap: 0 1.25rem;
}

.footer__proto {
  font-family: var(--mono-font);
  font-size: 0.6875rem;
  letter-spacing: 0.14em;
  color: var(--muted);
  word-break: break-word;
}

/* ——— Design Lab pill ——————————————————————————————————————— */

.lab-pill {
  position: fixed;
  left: 1rem;
  bottom: 1rem;
  z-index: 30;
  background: var(--ink);
  color: var(--paper);
  text-decoration: none;
  font-family: var(--mono-font);
  font-size: 0.75rem;
  letter-spacing: 0.06em;
  padding: 0.75rem 1rem;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  border: 1px solid var(--ink);
  transition: background 0.15s ease, border-color 0.15s ease;
}

.lab-pill:hover {
  background: var(--accent);
  border-color: var(--accent);
}

/* ——— Breakpoints ——————————————————————————————————————————— */

@media (min-width: 640px) {
  .container {
    padding-inline: 1.5rem;
  }

  .hero__ctas .btn {
    flex: 0 0 auto;
  }

  .stats__grid {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .stats__cell:nth-child(2n) {
    border-right: 1px solid var(--hairline);
  }

  .stats__cell:last-child {
    border-right: none;
  }

  .stats__cell:nth-child(-n + 2) {
    border-bottom: none;
  }

  .features {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dash__cards {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }

  .dcard:nth-child(2n) {
    border-right: 1px solid var(--hairline);
  }

  .dcard:last-child {
    border-right: none;
  }

  .dcard {
    border-bottom: none;
  }
}

@media (min-width: 720px) {
  .nav__links {
    display: flex;
    gap: 1.5rem;
  }

  .hero {
    padding-block: 4.5rem 5rem;
  }

  .hero__grid {
    grid-template-columns: minmax(0, 7fr) minmax(0, 5fr);
    align-items: center;
    gap: 3rem;
  }

  .compare__head {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr) minmax(0, 1fr);
    border-bottom: 1px solid var(--ink);
  }

  .compare__h--feature {
    border-right: 1px solid var(--hairline);
  }

  .compare__h:nth-child(2) {
    border-right: 1px solid var(--hairline);
    color: var(--accent);
  }

  .compare__row {
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr) minmax(0, 1fr);
  }

  .compare__feature {
    grid-column: auto;
    padding: 1rem;
    border-right: 1px solid var(--hairline);
  }

  .compare__cell {
    padding: 1rem;
  }

  .switch-cta {
    flex-direction: row;
    align-items: center;
    gap: 1.5rem;
  }
}

@media (min-width: 1024px) {
  .container {
    max-width: 1180px;
    padding-inline: 2rem;
  }

  .section {
    padding-block: 5rem;
  }

  .dash__top {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    align-items: end;
    padding: 2rem;
  }

  .dash__spark {
    justify-self: end;
    width: 100%;
    max-width: 360px;
  }

  .feature {
    padding: 2rem 1.75rem;
  }
}

/* ——— Reduced motion ———————————————————————————————————————— */

@media (prefers-reduced-motion: reduce) {
  .mono *,
  .mono *::before,
  .mono *::after {
    transition: none !important;
    animation: none !important;
  }

  .ptable__row:hover,
  .feature:hover,
  .dcard:hover {
    transform: none;
  }
}
</style>
