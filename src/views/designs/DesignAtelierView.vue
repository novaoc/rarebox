<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'

/* ── Mock data ─────────────────────────────────────────────── */

const navLinks = [
  { label: 'The Collection', href: '#collection' },
  { label: 'The Rooms', href: '#rooms' },
  { label: 'The Ledger', href: '#ledger' },
]

const heroCards = ref([
  {
    id: 'base1-4',
    img: 'https://images.pokemontcg.io/base1/4.png',
    name: 'Charizard',
    set: 'Base Set · 4/102',
    value: '$420.00',
    offset: 'low',
  },
  {
    id: 'sv3pt5-151',
    img: 'https://images.pokemontcg.io/sv3pt5/151.png',
    name: 'Mew ex',
    set: '151 · 151/165',
    value: '$38.50',
    offset: 'high',
  },
  {
    id: 'me2-13',
    img: 'https://images.pokemontcg.io/me2/13.png',
    name: 'Volcanion',
    set: 'Mega Evolution · 13',
    value: '$12.75',
    offset: 'mid',
  },
])

const provenance = [
  '120,000+ cards catalogued',
  'six games',
  'prices refreshed continually',
  'yours, locally',
]

const rooms = [
  {
    numeral: 'I',
    title: 'The Ledger',
    sub: 'Portfolio, profit & loss',
    body:
      'Every card you own, appraised daily. Cost basis against market value, gains drawn in a thin terracotta line. A balance sheet that reads like a catalogue raisonné.',
    points: ['Acquisitions & cost basis', 'Daily mark-to-market', 'Per-game and per-set views'],
  },
  {
    numeral: 'II',
    title: 'The Ticker',
    sub: 'Live prices, quietly',
    body:
      'Market prices for Pokémon, Magic, Yu-Gi-Oh!, Lorcana, One Piece and Riftbound — gathered continually, displayed without alarm. Movement noted in the margins, never shouted.',
    points: ['Six games, one feed', 'Price history sparklines', 'Watchlist with gentle alerts'],
  },
  {
    numeral: 'III',
    title: 'The Exchange',
    sub: 'Trade analyzer & scanner',
    body:
      'Lay both sides of a trade on the table and let the numbers speak. Point your camera at a card and the scanner names it, dates it, and prices it — provenance in a second.',
    points: ['Side-by-side trade fairness', 'Camera card recognition', 'Condition-aware valuations'],
  },
  {
    numeral: 'IV',
    title: 'The Intake',
    sub: 'Collectr import',
    body:
      'Bring your collection in one CSV. Export from Collectr, drop the file here, and your entire archive — quantities, conditions, variants — is rehung on these walls within minutes.',
    points: ['One-file Collectr import', 'Duplicate reconciliation', 'Nothing leaves your device'],
  },
]

const ledger = ref({
  total: '$12,847.32',
  change: '+ $214.18 this week',
  spark: '0,30 8,27 16,28 24,24 32,25 40,21 48,22 56,17 64,19 72,14 80,15 88,10 96,11 104,7 112,8 120,4',
})

const exhibition = ref([
  {
    id: 'ex-1',
    img: 'https://images.pokemontcg.io/base1/4.png',
    name: 'Charizard',
    set: 'Base Set, 1999',
    value: '$420.00',
  },
  {
    id: 'ex-2',
    img: 'https://images.pokemontcg.io/sv3pt5/151.png',
    name: 'Mew ex',
    set: 'Scarlet & Violet 151, 2023',
    value: '$38.50',
  },
  {
    id: 'ex-3',
    img: 'https://images.pokemontcg.io/me2/13.png',
    name: 'Volcanion',
    set: 'Mega Evolution, 2025',
    value: '$12.75',
  },
  {
    id: 'ex-4',
    img: 'https://images.pokemontcg.io/base1/2.png',
    name: 'Blastoise',
    set: 'Base Set, 1999',
    value: '$185.00',
  },
])

const quotes = [
  {
    line: 'No subscription standing between you and your own inventory.',
    note: 'The ledger is free. It stays free.',
  },
  {
    line: 'Your collection lives on your device, not on someone else’s server.',
    note: 'Local-first. Export anytime, to anywhere.',
  },
  {
    line: 'Six games in one quiet room, instead of six noisy apps.',
    note: 'Pokémon to Riftbound, one catalogue.',
  },
]

const footerLinks = ['The Collection', 'The Rooms', 'The Ledger', 'Privacy', 'Terms']

function hideImage(e) {
  const wrap = e.target.closest('.frame-art')
  if (wrap) wrap.classList.add('art-missing')
  e.target.style.display = 'none'
}
</script>

<template>
  <div class="atelier">
    <!-- ── 1 · Top nav ─────────────────────────────────────── -->
    <header class="nav">
      <div class="nav-inner">
        <a href="#top" class="brand" aria-label="Rarebox home">
          <svg class="monogram" viewBox="0 0 44 44" aria-hidden="true">
            <rect x="2" y="2" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1" />
            <rect x="6" y="6" width="32" height="32" fill="none" stroke="currentColor" stroke-width="0.75" />
            <text x="22" y="29" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="19" fill="currentColor">R</text>
          </svg>
          <span class="brand-words">
            <span class="wordmark">Rarebox</span>
            <span class="tagline">est. 2026 · the collector's ledger</span>
          </span>
        </a>
        <nav class="nav-links" aria-label="Primary">
          <a v-for="l in navLinks" :key="l.href" :href="l.href" class="nav-link">{{ l.label }}</a>
        </nav>
        <a href="#ledger" class="nav-cta">Enter the atelier →</a>
      </div>
    </header>

    <main id="top">
      <!-- ── 2 · Hero ─────────────────────────────────────── -->
      <section class="hero" id="collection">
        <div class="hero-copy">
          <p class="eyebrow">The Collection</p>
          <h1 class="hero-title">A quiet place to keep loud cards.</h1>
          <p class="hero-sub">
            Rarebox is a private gallery for everything you collect — Pokémon, Magic,
            Yu-Gi-Oh!, Lorcana, One Piece, Riftbound — catalogued, appraised, and hung
            with care. No feeds. No noise. Just your collection, properly kept.
          </p>
          <div class="hero-actions">
            <a href="#ledger" class="btn-primary">Begin your catalogue</a>
            <a href="#rooms" class="text-link">Walk the rooms →</a>
          </div>
        </div>

        <div class="hero-wall" role="img" aria-label="Three framed trading cards displayed like artworks">
          <figure
            v-for="card in heroCards"
            :key="card.id"
            class="framed"
            :class="`framed-${card.offset}`"
          >
            <div class="frame">
              <div class="frame-art">
                <img :src="card.img" :alt="card.name" loading="lazy" @error="hideImage" />
              </div>
            </div>
            <figcaption class="museum-label">
              <span class="label-name">{{ card.name }}</span>
              <span class="label-meta">
                <em>{{ card.set }}</em>
                <span class="label-value">{{ card.value }}</span>
              </span>
            </figcaption>
          </figure>
        </div>
      </section>

      <!-- ── 3 · Provenance strip ─────────────────────────── -->
      <section class="provenance" aria-label="Provenance">
        <p class="prov-line">
          <template v-for="(fact, i) in provenance" :key="fact">
            <span class="prov-fact">{{ fact }}</span>
            <span v-if="i < provenance.length - 1" class="prov-dot" aria-hidden="true">·</span>
          </template>
        </p>
      </section>

      <!-- ── 4 · The rooms ────────────────────────────────── -->
      <section class="rooms" id="rooms">
        <div class="section-head">
          <p class="eyebrow">The Rooms</p>
          <h2 class="section-title">Four rooms, one collection.</h2>
        </div>

        <article
          v-for="(room, i) in rooms"
          :key="room.numeral"
          class="room"
          :class="{ 'room-flip': i % 2 === 1 }"
        >
          <div class="room-numeral" aria-hidden="true">{{ room.numeral }}</div>
          <div class="room-text">
            <p class="room-sub">{{ room.sub }}</p>
            <h3 class="room-title">{{ room.title }}</h3>
            <p class="room-body">{{ room.body }}</p>
            <ul class="room-points">
              <li v-for="p in room.points" :key="p">
                <svg class="tick" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
                <span>{{ p }}</span>
              </li>
            </ul>
          </div>
        </article>
      </section>

      <!-- ── 5 · The Ledger preview ───────────────────────── -->
      <section class="ledger" id="ledger">
        <div class="section-head">
          <p class="eyebrow">The Ledger</p>
          <h2 class="section-title">Your collection, on the books.</h2>
        </div>

        <div class="ledger-panel">
          <div class="ledger-top">
            <div class="ledger-figures">
              <p class="ledger-caption">Total appraised value</p>
              <p class="ledger-total">{{ ledger.total }}</p>
              <p class="ledger-change">{{ ledger.change }}</p>
            </div>
            <svg class="sparkline" viewBox="0 0 120 34" preserveAspectRatio="none" aria-label="Value trend, rising">
              <polyline
                :points="ledger.spark"
                fill="none"
                stroke="#c4552e"
                stroke-width="1.25"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>

          <hr class="hairline" />

          <p class="exhibit-caption">From the current exhibition</p>
          <div class="exhibition">
            <figure v-for="piece in exhibition" :key="piece.id" class="framed framed-grid">
              <div class="frame">
                <div class="frame-art">
                  <img :src="piece.img" :alt="piece.name" loading="lazy" @error="hideImage" />
                </div>
              </div>
              <figcaption class="museum-label">
                <span class="label-name">{{ piece.name }}</span>
                <span class="label-meta">
                  <em>{{ piece.set }}</em>
                  <span class="label-value">{{ piece.value }}</span>
                </span>
              </figcaption>
            </figure>
          </div>
        </div>
      </section>

      <!-- ── 6 · A quiet comparison ───────────────────────── -->
      <section class="comparison">
        <div class="section-head">
          <p class="eyebrow">A Quiet Comparison</p>
          <h2 class="section-title">Why collectors leave Collectr.</h2>
        </div>
        <ul class="quotes">
          <li v-for="q in quotes" :key="q.line" class="quote">
            <svg class="tick tick-lg" viewBox="0 0 16 16" aria-hidden="true">
              <path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
            <div>
              <p class="quote-line">{{ q.line }}</p>
              <p class="quote-note">{{ q.note }}</p>
            </div>
          </li>
        </ul>
        <div class="comparison-cta">
          <a href="#ledger" class="btn-primary">Bring your collection home</a>
        </div>
      </section>
    </main>

    <!-- ── 7 · Footer ───────────────────────────────────────── -->
    <footer class="footer">
      <svg class="monogram monogram-footer" viewBox="0 0 44 44" aria-hidden="true">
        <rect x="2" y="2" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1" />
        <rect x="6" y="6" width="32" height="32" fill="none" stroke="currentColor" stroke-width="0.75" />
        <text x="22" y="29" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-size="19" fill="currentColor">R</text>
      </svg>
      <nav class="footer-links" aria-label="Footer">
        <a v-for="l in footerLinks" :key="l" href="#top" class="footer-link">{{ l }}</a>
      </nav>
      <p class="footer-note">Prototype 04 — Atelier</p>
    </footer>

    <!-- Fixed design-lab return pill -->
    <RouterLink to="/designs" class="lab-pill">← Design Lab</RouterLink>
  </div>
</template>

<style scoped>
/* ════════════════ Foundation ════════════════ */
.atelier {
  --bone: #f7f4ee;
  --ink: #1c1a17;
  --muted: #6f6a61;
  --terracotta: #c4552e;
  --sage: #7a8b6f;
  --frame: #d8d2c6;
  --serif: Georgia, 'Times New Roman', serif;
  --sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  --shadow: 0 20px 40px rgba(28, 26, 23, 0.08);

  background: var(--bone);
  color: var(--ink);
  font-family: var(--sans);
  font-size: 16px;
  line-height: 1.6;
  min-height: 100vh;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
}

.atelier *,
.atelier *::before,
.atelier *::after {
  box-sizing: border-box;
}

.atelier img {
  max-width: 100%;
  display: block;
}

.atelier a {
  color: inherit;
  text-decoration: none;
}

.atelier :focus-visible {
  outline: 2px solid var(--terracotta);
  outline-offset: 3px;
  border-radius: 2px;
}

/* Shared text styles */
.eyebrow {
  font-family: var(--sans);
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.22em;
  text-transform: uppercase;
  color: var(--terracotta);
  margin: 0 0 0.75rem;
}

.section-title {
  font-family: var(--serif);
  font-weight: 400;
  font-size: clamp(1.7rem, 4.5vw, 2.5rem);
  line-height: 1.15;
  margin: 0;
  letter-spacing: -0.01em;
}

.section-head {
  max-width: 640px;
  margin: 0 auto 2.5rem;
  text-align: center;
  padding: 0 1.25rem;
}

.hairline {
  border: none;
  border-top: 1px solid var(--frame);
  margin: 1.75rem 0;
}

/* ════════════════ Nav ════════════════ */
.nav {
  border-bottom: 1px solid var(--frame);
  background: var(--bone);
}

.nav-inner {
  max-width: 1180px;
  margin: 0 auto;
  padding: 0.9rem 1.25rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
}

.brand {
  display: flex;
  align-items: center;
  gap: 0.7rem;
  min-height: 44px;
}

.monogram {
  width: 38px;
  height: 38px;
  color: var(--ink);
  flex: none;
}

.brand-words {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
}

.wordmark {
  font-family: var(--serif);
  font-size: 1.25rem;
  letter-spacing: 0.01em;
}

.tagline {
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
}

.nav-links {
  display: none;
  gap: 1.75rem;
}

.nav-link {
  font-size: 0.82rem;
  letter-spacing: 0.06em;
  color: var(--muted);
  padding: 0.75rem 0;
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  transition: color 0.2s ease;
}

.nav-link:hover {
  color: var(--ink);
}

.nav-cta {
  font-family: var(--serif);
  font-size: 0.95rem;
  color: var(--terracotta);
  padding: 0.6rem 0.25rem;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  border-bottom: 1px solid transparent;
  transition: border-color 0.2s ease;
}

.nav-cta:hover {
  border-bottom-color: var(--terracotta);
}

/* ════════════════ Hero ════════════════ */
.hero {
  max-width: 1180px;
  margin: 0 auto;
  padding: 3rem 1.25rem 4rem;
  display: grid;
  gap: 3rem;
}

.hero-copy {
  max-width: 560px;
}

.hero-title {
  font-family: var(--serif);
  font-weight: 400;
  font-size: clamp(2.4rem, 7vw, 5rem);
  line-height: 1.05;
  letter-spacing: -0.015em;
  margin: 0 0 1.25rem;
}

.hero-sub {
  color: var(--muted);
  font-size: 1.02rem;
  max-width: 46ch;
  margin: 0 0 2rem;
}

.hero-actions {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  flex-wrap: wrap;
}

.atelier .btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 0.8rem 1.8rem;
  background: var(--ink);
  color: var(--bone);
  font-family: var(--serif);
  font-size: 1rem;
  letter-spacing: 0.02em;
  border: 1px solid var(--ink);
  transition: background 0.2s ease, color 0.2s ease;
}

.atelier .btn-primary:hover {
  background: var(--terracotta);
  border-color: var(--terracotta);
  color: #fff;
}

.text-link {
  font-family: var(--serif);
  font-style: italic;
  color: var(--terracotta);
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  border-bottom: 1px solid rgba(196, 85, 46, 0.35);
  transition: border-color 0.2s ease;
}

.text-link:hover {
  border-bottom-color: var(--terracotta);
}

/* Hero wall of framed cards */
.hero-wall {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  gap: clamp(0.75rem, 3vw, 2rem);
  flex-wrap: wrap;
}

.framed {
  margin: 0;
  width: clamp(110px, 26vw, 200px);
}

.framed-low {
  margin-top: 2.25rem;
}

.framed-mid {
  margin-top: 1rem;
}

.framed-high {
  margin-top: 0;
}

.frame {
  background: #fff;
  border: 1px solid var(--frame);
  padding: clamp(0.5rem, 2vw, 1.1rem);
  box-shadow: var(--shadow);
}

.frame-art {
  background: #fdfcfa;
  min-height: 60px;
}

.frame-art.art-missing {
  aspect-ratio: 63 / 88;
  background:
    linear-gradient(135deg, transparent 49.5%, var(--frame) 49.5%, var(--frame) 50.5%, transparent 50.5%),
    #f3efe7;
}

.museum-label {
  margin-top: 0.8rem;
  padding: 0 0.1rem;
  border-top: 1px solid var(--frame);
  padding-top: 0.55rem;
}

.label-name {
  display: block;
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.label-meta {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 0.5rem;
  margin-top: 0.15rem;
}

.label-meta em {
  font-family: var(--serif);
  font-size: 0.78rem;
  color: var(--muted);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.label-value {
  font-size: 0.74rem;
  color: var(--terracotta);
  white-space: nowrap;
}

/* ════════════════ Provenance strip ════════════════ */
.provenance {
  border-top: 1px solid var(--frame);
  border-bottom: 1px solid var(--frame);
  padding: 1.4rem 1.25rem;
}

.prov-line {
  max-width: 1180px;
  margin: 0 auto;
  text-align: center;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--muted);
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.4rem 0.9rem;
}

.prov-dot {
  color: var(--terracotta);
}

/* ════════════════ Rooms ════════════════ */
.rooms {
  max-width: 980px;
  margin: 0 auto;
  padding: 4.5rem 1.25rem 2rem;
}

.room {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 1.25rem 1.5rem;
  align-items: start;
  padding: 2.25rem 0;
  border-top: 1px solid var(--frame);
}

.room:last-of-type {
  border-bottom: 1px solid var(--frame);
}

.room-numeral {
  font-family: var(--serif);
  font-size: clamp(2.6rem, 7vw, 4rem);
  line-height: 1;
  color: var(--frame);
  min-width: 2ch;
  text-align: center;
  user-select: none;
}

.room-sub {
  font-family: var(--serif);
  font-style: italic;
  color: var(--sage);
  font-size: 0.95rem;
  margin: 0 0 0.25rem;
}

.room-title {
  font-family: var(--serif);
  font-weight: 400;
  font-size: clamp(1.45rem, 4vw, 1.9rem);
  line-height: 1.15;
  margin: 0 0 0.75rem;
}

.room-body {
  color: var(--muted);
  max-width: 56ch;
  margin: 0 0 1rem;
}

.room-points {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.45rem;
}

.room-points li {
  display: flex;
  align-items: baseline;
  gap: 0.55rem;
  font-size: 0.9rem;
}

.tick {
  width: 14px;
  height: 14px;
  flex: none;
  color: var(--sage);
  transform: translateY(2px);
}

.tick-lg {
  width: 18px;
  height: 18px;
}

/* ════════════════ Ledger preview ════════════════ */
.ledger {
  max-width: 1180px;
  margin: 0 auto;
  padding: 4.5rem 1.25rem;
}

.ledger-panel {
  background: #fff;
  border: 1px solid var(--frame);
  box-shadow: var(--shadow);
  padding: clamp(1.25rem, 4vw, 2.5rem);
  max-width: 920px;
  margin: 0 auto;
}

.ledger-top {
  display: grid;
  gap: 1.5rem;
  align-items: end;
}

.ledger-caption {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--muted);
  margin: 0 0 0.4rem;
}

.ledger-total {
  font-family: var(--serif);
  font-size: clamp(2.2rem, 7vw, 3.4rem);
  line-height: 1;
  letter-spacing: -0.01em;
  margin: 0;
}

.ledger-change {
  font-family: var(--serif);
  font-style: italic;
  color: var(--sage);
  margin: 0.5rem 0 0;
  font-size: 0.95rem;
}

.sparkline {
  width: 100%;
  max-width: 360px;
  height: 64px;
  display: block;
}

.exhibit-caption {
  font-family: var(--serif);
  font-style: italic;
  color: var(--muted);
  margin: 0 0 1.25rem;
  font-size: 0.95rem;
}

.exhibition {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.25rem;
}

.framed-grid {
  width: auto;
  margin-top: 0;
}

/* ════════════════ Comparison ════════════════ */
.comparison {
  max-width: 760px;
  margin: 0 auto;
  padding: 4rem 1.25rem 5rem;
}

.quotes {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0;
}

.quote {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.5rem 0;
  border-top: 1px solid var(--frame);
}

.quote:last-child {
  border-bottom: 1px solid var(--frame);
}

.quote .tick-lg {
  transform: translateY(6px);
}

.quote-line {
  font-family: var(--serif);
  font-size: clamp(1.1rem, 3vw, 1.35rem);
  line-height: 1.35;
  margin: 0 0 0.3rem;
}

.quote-note {
  font-size: 0.85rem;
  color: var(--muted);
  margin: 0;
}

.comparison-cta {
  text-align: center;
  margin-top: 2.5rem;
}

/* ════════════════ Footer ════════════════ */
.footer {
  border-top: 1px solid var(--frame);
  padding: 3rem 1.25rem 5.5rem;
  text-align: center;
}

.monogram-footer {
  margin: 0 auto 1.25rem;
  color: var(--muted);
}

.footer-links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.25rem 1.5rem;
  margin-bottom: 1.25rem;
}

.footer-link {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--muted);
  padding: 0.7rem 0.2rem;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  transition: color 0.2s ease;
}

.footer-link:hover {
  color: var(--terracotta);
}

.footer-note {
  font-family: var(--serif);
  font-style: italic;
  font-size: 0.85rem;
  color: var(--muted);
  margin: 0;
}

/* ════════════════ Design-lab pill ════════════════ */
.atelier .lab-pill {
  position: fixed;
  bottom: 1rem;
  left: 1rem;
  z-index: 50;
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0.6rem 1.1rem;
  background: var(--ink);
  color: var(--bone);
  font-family: var(--serif);
  font-size: 0.85rem;
  border-radius: 999px;
  box-shadow: var(--shadow);
  transition: background 0.2s ease;
}

.atelier .lab-pill:hover {
  background: var(--terracotta);
}

/* ════════════════ Breakpoints ════════════════ */

/* ≤480 — single column, tighter */
@media (max-width: 480px) {
  .nav-inner {
    justify-content: center;
    text-align: center;
  }

  .hero {
    padding-top: 2.25rem;
  }

  .room {
    grid-template-columns: 1fr;
    gap: 0.5rem;
  }

  .room-numeral {
    text-align: left;
  }

  .exhibition {
    grid-template-columns: 1fr;
  }

  .framed-grid {
    max-width: 260px;
    margin-left: auto;
    margin-right: auto;
  }
}

/* ≥640 — breathing room */
@media (min-width: 640px) {
  .nav-links {
    display: flex;
  }

  .hero {
    padding-top: 4rem;
  }

  .ledger-top {
    grid-template-columns: 1fr auto;
  }
}

/* ≥720 — foldables / small tablets: 2-col layouts */
@media (min-width: 720px) {
  .exhibition {
    grid-template-columns: repeat(4, 1fr);
  }

  .room {
    grid-template-columns: 90px 1fr;
  }

  .room-flip {
    grid-template-columns: 1fr 90px;
  }

  .room-flip .room-numeral {
    order: 2;
  }

  .room-flip .room-text {
    order: 1;
  }
}

/* ≥1024 — full gallery layout */
@media (min-width: 1024px) {
  .hero {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
    align-items: center;
    gap: 4rem;
    padding-top: 5.5rem;
    padding-bottom: 5.5rem;
  }

  .hero-wall {
    justify-content: flex-end;
    flex-wrap: nowrap;
  }

  .framed {
    width: 178px;
  }

  .framed-low {
    margin-top: 3.5rem;
  }

  .framed-mid {
    margin-top: 1.75rem;
  }
}

/* ════════════════ Reduced motion ════════════════ */
@media (prefers-reduced-motion: reduce) {
  .atelier *,
  .atelier *::before,
  .atelier *::after {
    transition: none !important;
    animation: none !important;
  }
}
</style>
