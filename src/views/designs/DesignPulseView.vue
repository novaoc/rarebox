<script setup>
// ── Rarebox Design Prototype 05 — "PULSE" ─────────────────────────────
// Market-terminal aesthetic for serious collectors. Standalone view,
// no app chrome. Mock data only — nothing here touches real services.
import { ref, computed } from 'vue'

const activeTab = ref('portfolio')

// ── Sparkline helpers ─────────────────────────────────────────────────
function sparkPoints (values, w = 60, h = 18, pad = 1.5) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  return values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * (w - pad * 2)
      const y = h - pad - ((v - min) / span) * (h - pad * 2)
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

function areaPath (values, w = 640, h = 160, pad = 4) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min || 1
  const pts = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2)
    const y = h - pad - ((v - min) / span) * (h - pad * 2)
    return [x, y]
  })
  const line = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${h} L${pts[0][0].toFixed(1)} ${h} Z`
  return { line, area }
}

// ── Mock holdings (hero terminal) ─────────────────────────────────────
const holdings = [
  { name: 'Charizard · Base Set', game: 'PKM', img: 'https://images.pokemontcg.io/base1/4.png', qty: 2, price: 412.50, change: 2.4, trend: [380, 388, 379, 395, 402, 398, 408, 412] },
  { name: 'Pikachu · Base Set', game: 'PKM', img: 'https://images.pokemontcg.io/base1/58.png', qty: 14, price: 8.92, change: 0.7, trend: [8.4, 8.5, 8.7, 8.6, 8.8, 8.7, 8.9, 8.92] },
  { name: 'M Charizard EX · Evolutions', game: 'PKM', img: 'https://images.pokemontcg.io/me2/13.png', qty: 1, price: 96.10, change: -1.1, trend: [101, 99, 100, 98, 97.4, 98.1, 96.8, 96.1] },
  { name: 'Mew · 151', game: 'PKM', img: 'https://images.pokemontcg.io/sv3pt5/151.png', qty: 3, price: 38.74, change: 5.8, trend: [33, 34, 33.6, 35, 36.2, 37, 38.1, 38.74] },
  { name: 'Charizard · Base (PL)', game: 'PKM', img: 'https://images.pokemontcg.io/base1/4.png', qty: 1, price: 188.00, change: -0.4, trend: [192, 190, 191, 189, 190, 188.5, 189, 188] },
]

const watchlist = [
  { name: 'Black Lotus · Unlimited', game: 'MTG', img: 'https://images.pokemontcg.io/base1/4.png', qty: 0, price: 18250.00, change: 1.2, trend: [17800, 17950, 17900, 18100, 18050, 18200, 18180, 18250] },
  { name: 'Blue-Eyes W. Dragon · LOB', game: 'YGO', img: 'https://images.pokemontcg.io/base1/58.png', qty: 0, price: 142.30, change: -2.3, trend: [150, 148, 149, 146, 147, 144, 143, 142.3] },
  { name: 'Elsa, Spirit of Winter', game: 'LOR', img: 'https://images.pokemontcg.io/me2/13.png', qty: 0, price: 61.05, change: 3.1, trend: [56, 57, 58.2, 57.8, 59, 60.1, 60.4, 61.05] },
  { name: 'Monkey D. Luffy · OP-01', game: 'OP', img: 'https://images.pokemontcg.io/sv3pt5/151.png', qty: 0, price: 24.88, change: 0.9, trend: [23.8, 24, 24.3, 24.1, 24.5, 24.6, 24.7, 24.88] },
  { name: 'Jinx, Loose Cannon', game: 'RFT', img: 'https://images.pokemontcg.io/base1/4.png', qty: 0, price: 12.40, change: -0.8, trend: [12.9, 12.8, 12.7, 12.75, 12.6, 12.5, 12.45, 12.4] },
]

const rows = computed(() => (activeTab.value === 'portfolio' ? holdings : watchlist))

// ── Ticker strip ──────────────────────────────────────────────────────
const ticker = [
  { label: 'CHARIZARD BASE', change: 2.4 },
  { label: 'MEGA CHARIZARD X EX', change: -1.1 },
  { label: 'MEW 151', change: 5.8 },
  { label: 'BLACK LOTUS', change: 1.2 },
  { label: 'BLUE-EYES LOB', change: -2.3 },
  { label: 'ELSA SPIRIT', change: 3.1 },
  { label: 'LUFFY OP-01', change: 0.9 },
  { label: 'JINX RFT', change: -0.8 },
  { label: 'PIKACHU BASE', change: 0.7 },
  { label: 'UMBREON VMAX ALT', change: 4.6 },
  { label: 'GENGAR MIST', change: -0.2 },
  { label: 'SOL RING CLB', change: 1.7 },
]

// ── Feature panels ────────────────────────────────────────────────────
const features = [
  {
    num: '01',
    title: 'P/L analytics',
    body: 'Cost basis per copy, realized and unrealized gain, daily change on every position. Your binder, finally readable as a book of trades.',
    icon: 'chart',
  },
  {
    num: '02',
    title: 'Live multi-market feeds',
    body: 'Pokémon, Magic, Yu-Gi-Oh!, Lorcana, One Piece and Riftbound on one tape. One terminal, six markets, zero tab-juggling.',
    icon: 'feed',
  },
  {
    num: '03',
    title: 'Trade analyzer + OCR scan',
    body: 'Point the camera at a card, get a quote. Stack both sides of a trade and see the spread before you shake hands.',
    icon: 'scan',
  },
  {
    num: '04',
    title: 'Collectr migration',
    body: 'One CSV export, one import, done. Every quantity, condition and cost basis lands intact — no manual re-entry.',
    icon: 'csv',
  },
]

// ── Depth section ─────────────────────────────────────────────────────
const portfolioTrend = [9800, 10120, 9950, 10400, 10880, 10620, 11050, 11480, 11210, 11760, 12100, 11940, 12380, 12610, 12847.32]
const bigChart = areaPath(portfolioTrend, 640, 160)

const statTiles = [
  { label: 'Best performer', value: 'MEW · 151', sub: '+5.8% / 24H', tone: 'up' },
  { label: 'Worst performer', value: 'BLUE-EYES · LOB', sub: '−2.3% / 24H', tone: 'down' },
  { label: 'Value added · 30D', value: '+$1,204.18', sub: '+10.3% PORTFOLIO', tone: 'up' },
]

// ── Comparison table ──────────────────────────────────────────────────
const comparison = [
  { metric: 'Markets tracked', collectr: 'Pokémon-centric', rarebox: '6 TCGs, one terminal' },
  { metric: 'Cost basis & P/L', collectr: 'Totals only', rarebox: 'Per-copy, per-day' },
  { metric: 'Migration effort', collectr: '—', rarebox: 'One CSV import' },
]

function fmtPrice (n) {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtChange (n) {
  return `${n > 0 ? '+' : ''}${n.toFixed(1)}%`
}
function hideImg (e) {
  e.target.style.display = 'none'
}
</script>

<template>
  <div class="pulse">
    <!-- ── 1 · Sticky nav ─────────────────────────────────────────── -->
    <header class="nav">
      <div class="nav-inner">
        <a href="#" class="brand" @click.prevent>
          <svg class="logomark" viewBox="0 0 28 28" width="26" height="26" aria-hidden="true">
            <!-- candlestick-R hybrid -->
            <rect x="3" y="9" width="4" height="11" rx="1" fill="#f0b90b" />
            <line x1="5" y1="4" x2="5" y2="9" stroke="#f0b90b" stroke-width="2" />
            <line x1="5" y1="20" x2="5" y2="25" stroke="#f0b90b" stroke-width="2" />
            <path d="M12 25V5h7a5 5 0 0 1 0 10h-7m7 0 6 10" fill="none" stroke="#f0b90b" stroke-width="2.6" stroke-linecap="square" />
          </svg>
          <span class="wordmark">RAREBOX</span>
          <span class="suffix-chip">TERMINAL</span>
        </a>
        <div class="nav-right">
          <span class="status-chip"><span class="dot" aria-hidden="true"></span> LIVE</span>
          <a href="#" class="btn btn-amber btn-nav" @click.prevent>Open terminal</a>
        </div>
      </div>
    </header>

    <main>
      <!-- ── 2 · Hero ─────────────────────────────────────────────── -->
      <section class="hero">
        <div class="container hero-grid">
          <div class="hero-copy">
            <p class="eyebrow">PORTFOLIO · PRICES · TRADES — 6 MARKETS</p>
            <h1 class="headline">
              Trade your cards like an asset class.<span class="cursor" aria-hidden="true"></span>
            </h1>
            <p class="subcopy">
              Rarebox is the market terminal for collectors who think in cost basis, not vibes.
              Live prices across Pokémon, Magic, Yu-Gi-Oh!, Lorcana, One Piece and Riftbound —
              with the P/L math done for you.
            </p>
            <div class="cta-row">
              <a href="#" class="btn btn-amber" @click.prevent>Open terminal</a>
              <a href="#" class="btn btn-ghost" @click.prevent>Import from Collectr</a>
            </div>
            <p class="micro">FREE TIER · NO CARD REQUIRED · LOCAL-FIRST DATA</p>
          </div>

          <!-- Terminal panel -->
          <div class="terminal" role="region" aria-label="Sample portfolio terminal">
            <div class="term-head">
              <div class="term-tabs" role="tablist" aria-label="Terminal tabs">
                <button
                  class="term-tab"
                  :class="{ active: activeTab === 'portfolio' }"
                  role="tab"
                  :aria-selected="activeTab === 'portfolio'"
                  @click="activeTab = 'portfolio'"
                >PORTFOLIO</button>
                <button
                  class="term-tab"
                  :class="{ active: activeTab === 'watchlist' }"
                  role="tab"
                  :aria-selected="activeTab === 'watchlist'"
                  @click="activeTab = 'watchlist'"
                >WATCHLIST</button>
              </div>
              <span class="term-feed">FEED · 0.4s</span>
            </div>

            <div class="holdings" role="table" aria-label="Holdings">
              <div class="h-row h-header" role="row">
                <span class="h-asset" role="columnheader">ASSET</span>
                <span class="h-qty" role="columnheader">QTY</span>
                <span class="h-price" role="columnheader">PRICE</span>
                <span class="h-chg" role="columnheader">24H</span>
                <span class="h-spark" role="columnheader">7D</span>
              </div>
              <div v-for="row in rows" :key="row.name" class="h-row" role="row">
                <span class="h-asset" role="cell">
                  <img :src="row.img" :alt="''" class="thumb" loading="lazy" @error="hideImg" />
                  <span class="h-name">
                    <span class="h-title">{{ row.name }}</span>
                    <span class="h-game">{{ row.game }}</span>
                  </span>
                </span>
                <span class="h-qty num" role="cell">{{ row.qty || '—' }}</span>
                <span class="h-price num" role="cell">${{ fmtPrice(row.price) }}</span>
                <span class="h-chg num" :class="row.change >= 0 ? 'up' : 'down'" role="cell">
                  {{ fmtChange(row.change) }}
                </span>
                <span class="h-spark" role="cell">
                  <svg width="60" height="18" viewBox="0 0 60 18" aria-hidden="true">
                    <polyline
                      :points="sparkPoints(row.trend)"
                      fill="none"
                      :stroke="row.change >= 0 ? '#16c784' : '#ea3943'"
                      stroke-width="1.5"
                      stroke-linejoin="round"
                      stroke-linecap="round"
                    />
                  </svg>
                </span>
              </div>
            </div>
            <div class="term-foot">
              <span class="num">5 POSITIONS</span>
              <span class="num up">▲ NET +$214.40 / 24H</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ── 3 · Ticker strip ─────────────────────────────────────── -->
      <section class="ticker-wrap" aria-label="Market ticker">
        <div class="ticker">
          <span v-for="t in ticker" :key="t.label" class="tick-chip num" :class="t.change >= 0 ? 'up' : 'down'">
            {{ t.label }}
            <strong>{{ t.change >= 0 ? '▲' : '▼' }} {{ fmtChange(t.change) }}</strong>
          </span>
        </div>
      </section>

      <!-- ── 4 · Feature panels ───────────────────────────────────── -->
      <section class="features">
        <div class="container">
          <p class="eyebrow">CAPABILITIES</p>
          <h2 class="section-title">Everything a desk needs.<br />Nothing a binder doesn't.</h2>
          <div class="feature-grid">
            <article v-for="f in features" :key="f.num" class="panel feature">
              <div class="feature-top">
                <span class="f-num num">{{ f.num }}</span>
                <svg v-if="f.icon === 'chart'" class="f-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                  <path d="M3 21h18M6 17V9m5 8V4m5 13v-6" fill="none" stroke="#f0b90b" stroke-width="2" stroke-linecap="square" />
                </svg>
                <svg v-else-if="f.icon === 'feed'" class="f-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                  <path d="M4 12h4l2-5 4 10 2-5h4" fill="none" stroke="#f0b90b" stroke-width="2" stroke-linecap="square" stroke-linejoin="bevel" />
                </svg>
                <svg v-else-if="f.icon === 'scan'" class="f-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                  <path d="M4 8V4h4m8 0h4v4m0 8v4h-4M8 20H4v-4M4 12h16" fill="none" stroke="#f0b90b" stroke-width="2" stroke-linecap="square" />
                </svg>
                <svg v-else class="f-icon" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                  <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v3h16v-3" fill="none" stroke="#f0b90b" stroke-width="2" stroke-linecap="square" />
                </svg>
              </div>
              <h3 class="f-title">{{ f.title }}</h3>
              <p class="f-body">{{ f.body }}</p>
            </article>
          </div>
        </div>
      </section>

      <!-- ── 5 · Depth section ────────────────────────────────────── -->
      <section class="depth">
        <div class="container">
          <div class="panel depth-panel">
            <div class="depth-head">
              <div>
                <p class="d-label">TOTAL PORTFOLIO VALUE</p>
                <p class="d-value num">$12,847.32 <span class="up d-chg">▲ +4.2%</span></p>
              </div>
              <span class="d-range num">30D</span>
            </div>
            <svg class="big-chart" viewBox="0 0 640 160" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="pulseFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#16c784" stop-opacity="0.28" />
                  <stop offset="100%" stop-color="#16c784" stop-opacity="0" />
                </linearGradient>
              </defs>
              <path :d="bigChart.area" fill="url(#pulseFill)" />
              <path :d="bigChart.line" fill="none" stroke="#16c784" stroke-width="2" stroke-linejoin="round" />
            </svg>
            <div class="stat-tiles">
              <div v-for="s in statTiles" :key="s.label" class="stat-tile">
                <p class="s-label">{{ s.label }}</p>
                <p class="s-value num">{{ s.value }}</p>
                <p class="s-sub num" :class="s.tone">{{ s.sub }}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ── 6 · Comparison ───────────────────────────────────────── -->
      <section class="compare">
        <div class="container">
          <p class="eyebrow">MIGRATION</p>
          <h2 class="section-title">COLLECTR → RAREBOX</h2>
          <p class="compare-sub">Export your Collectr CSV, drop it in, keep collecting. Nothing lost in transit.</p>
          <div class="panel compare-table" role="table" aria-label="Collectr versus Rarebox">
            <div class="c-row c-header" role="row">
              <span role="columnheader">METRIC</span>
              <span role="columnheader">COLLECTR</span>
              <span role="columnheader" class="c-rb">RAREBOX</span>
            </div>
            <div v-for="c in comparison" :key="c.metric" class="c-row" role="row">
              <span class="c-metric" role="cell">{{ c.metric }}</span>
              <span class="c-old num" role="cell">{{ c.collectr }}</span>
              <span class="c-rb num" role="cell">
                <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" class="check">
                  <path d="M2.5 8.5 6 12l7.5-8" fill="none" stroke="#16c784" stroke-width="2.2" stroke-linecap="square" />
                </svg>
                {{ c.rarebox }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- ── 7 · CTA + footer ─────────────────────────────────────── -->
      <section class="cta-panel-wrap">
        <div class="container">
          <div class="panel cta-panel">
            <p class="eyebrow">GO LIVE</p>
            <h2 class="cta-title">Your collection is already a portfolio.<br />Start treating it like one.</h2>
            <div class="cta-row cta-center">
              <a href="#" class="btn btn-amber" @click.prevent>Open terminal</a>
              <a href="#" class="btn btn-ghost" @click.prevent>See live prices</a>
            </div>
          </div>
        </div>
      </section>
    </main>

    <footer class="footer">
      <div class="container foot-inner">
        <div class="foot-brand">
          <svg class="logomark" viewBox="0 0 28 28" width="20" height="20" aria-hidden="true">
            <rect x="3" y="9" width="4" height="11" rx="1" fill="#f0b90b" />
            <line x1="5" y1="4" x2="5" y2="9" stroke="#f0b90b" stroke-width="2" />
            <line x1="5" y1="20" x2="5" y2="25" stroke="#f0b90b" stroke-width="2" />
            <path d="M12 25V5h7a5 5 0 0 1 0 10h-7m7 0 6 10" fill="none" stroke="#f0b90b" stroke-width="2.6" stroke-linecap="square" />
          </svg>
          <span class="wordmark">RAREBOX</span>
        </div>
        <nav class="foot-links" aria-label="Footer">
          <a href="#" @click.prevent>Markets</a>
          <a href="#" @click.prevent>Pricing</a>
          <a href="#" @click.prevent>Docs</a>
          <a href="#" @click.prevent>Terms</a>
        </nav>
        <p class="foot-proto num">Prototype 05 — Pulse</p>
      </div>
    </footer>

    <!-- Fixed back-to-lab pill -->
    <router-link to="/designs" class="lab-pill">← Design Lab</router-link>
  </div>
</template>

<style scoped>
/* ── PULSE design tokens ─────────────────────────────────────────── */
.pulse {
  --bg: #0b0d10;
  --panel: #111418;
  --line: #1d232b;
  --text: #d5dae2;
  --text-2: #707a88;
  --up: #16c784;
  --down: #ea3943;
  --amber: #f0b90b;
  --mono: ui-monospace, 'SF Mono', Menlo, monospace;
  --radius: 8px;
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 15px;
  line-height: 1.55;
  overflow-x: hidden;
}

.pulse *,
.pulse *::before,
.pulse *::after {
  box-sizing: border-box;
}

.container {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: 0 16px;
}

.num {
  font-family: var(--mono);
  font-variant-numeric: tabular-nums;
}

.up { color: var(--up); }
.down { color: var(--down); }

.pulse a {
  color: inherit;
  text-decoration: none;
}

.pulse :focus-visible {
  outline: 2px solid var(--amber);
  outline-offset: 2px;
  border-radius: 4px;
}

/* ── Panels ──────────────────────────────────────────────────────── */
.panel {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius);
}

/* ── Buttons ─────────────────────────────────────────────────────── */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 44px;
  padding: 0 20px;
  border-radius: var(--radius);
  font-family: var(--mono);
  font-size: 0.82rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  border: 1px solid transparent;
  cursor: pointer;
  transition: filter 0.15s ease, border-color 0.15s ease, background 0.15s ease;
}

.btn-amber {
  background: var(--amber);
  color: #0b0d10;
}
.btn-amber:hover { filter: brightness(1.1); }

.btn-ghost {
  background: transparent;
  color: var(--text);
  border-color: var(--line);
}
.btn-ghost:hover { border-color: var(--text-2); }

.btn-nav { min-height: 44px; padding: 0 14px; font-size: 0.74rem; }

/* ── 1 · Nav ─────────────────────────────────────────────────────── */
.nav {
  position: sticky;
  top: 0;
  z-index: 40;
  background: rgba(11, 13, 16, 0.92);
  backdrop-filter: blur(8px);
  border-bottom: 1px solid var(--line);
}

.nav-inner {
  max-width: 1180px;
  margin: 0 auto;
  padding: 0 16px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
}

.logomark { flex: none; }

.wordmark {
  font-family: var(--mono);
  font-weight: 800;
  letter-spacing: 0.12em;
  font-size: 0.95rem;
}

.suffix-chip {
  font-family: var(--mono);
  font-size: 0.58rem;
  letter-spacing: 0.14em;
  color: var(--amber);
  border: 1px solid rgba(240, 185, 11, 0.4);
  border-radius: 4px;
  padding: 2px 5px;
  line-height: 1;
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-family: var(--mono);
  font-size: 0.68rem;
  letter-spacing: 0.12em;
  color: var(--up);
  border: 1px solid rgba(22, 199, 132, 0.35);
  border-radius: 999px;
  padding: 5px 10px;
  white-space: nowrap;
}

.status-chip .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--up);
  animation: pulse-dot 1.6s ease-in-out infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

/* ── 2 · Hero ────────────────────────────────────────────────────── */
.hero { padding: 48px 0 32px; }

.hero-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 32px;
  align-items: center;
}

.eyebrow {
  font-family: var(--mono);
  font-size: 0.68rem;
  letter-spacing: 0.18em;
  color: var(--amber);
  margin: 0 0 14px;
}

.headline {
  font-size: clamp(2.2rem, 7vw, 4.6rem);
  line-height: 1.04;
  font-weight: 800;
  letter-spacing: -0.02em;
  margin: 0 0 18px;
  overflow-wrap: break-word;
}

.cursor {
  display: inline-block;
  width: 0.5em;
  height: 0.85em;
  margin-left: 0.08em;
  background: var(--amber);
  vertical-align: baseline;
  transform: translateY(0.08em);
  animation: blink 1.05s steps(1) infinite;
}

@keyframes blink {
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}

.subcopy {
  color: var(--text-2);
  max-width: 46ch;
  margin: 0 0 22px;
}

.cta-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
}

.micro {
  font-family: var(--mono);
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  color: var(--text-2);
  margin: 0;
}

/* Terminal panel */
.terminal {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
  min-width: 0;
}

.term-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border-bottom: 1px solid var(--line);
  padding: 0 12px 0 6px;
}

.term-tabs { display: flex; }

.term-tab {
  appearance: none;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-2);
  font-family: var(--mono);
  font-size: 0.7rem;
  letter-spacing: 0.12em;
  padding: 0 14px;
  min-height: 46px;
  cursor: pointer;
  transition: color 0.15s ease, border-color 0.15s ease;
}

.term-tab.active {
  color: var(--amber);
  border-bottom-color: var(--amber);
}

.term-feed {
  font-family: var(--mono);
  font-size: 0.6rem;
  letter-spacing: 0.12em;
  color: var(--text-2);
  white-space: nowrap;
}

/* Holdings table */
.holdings { width: 100%; }

.h-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 44px 92px 64px 68px;
  align-items: center;
  gap: 8px;
  min-height: 48px;
  padding: 0 12px;
  border-bottom: 1px solid var(--line);
}

.h-row:last-child { border-bottom: none; }

.h-header {
  min-height: 34px;
  font-family: var(--mono);
  font-size: 0.58rem;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-2);
}

.h-asset {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.thumb {
  width: 26px;
  height: 36px;
  object-fit: cover;
  border-radius: 3px;
  border: 1px solid var(--line);
  flex: none;
  background: #0e1014;
}

.h-name {
  display: flex;
  flex-direction: column;
  min-width: 0;
  line-height: 1.25;
}

.h-title {
  font-size: 0.8rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.h-game {
  font-family: var(--mono);
  font-size: 0.58rem;
  letter-spacing: 0.12em;
  color: var(--text-2);
}

.h-qty,
.h-price,
.h-chg {
  text-align: right;
  font-size: 0.8rem;
}

.h-spark { display: flex; justify-content: flex-end; }
.h-spark svg { display: block; }

.term-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-top: 1px solid var(--line);
  font-size: 0.66rem;
  letter-spacing: 0.1em;
  color: var(--text-2);
}

/* ── 3 · Ticker strip ────────────────────────────────────────────── */
.ticker-wrap {
  border-top: 1px solid var(--line);
  border-bottom: 1px solid var(--line);
  background: var(--panel);
  margin: 24px 0 0;
}

.ticker {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 10px 16px;
  max-width: 100%;
}

.tick-chip {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.66rem;
  letter-spacing: 0.08em;
  color: var(--text-2);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 7px 10px;
  white-space: nowrap;
  background: var(--bg);
}

.tick-chip strong { font-weight: 700; }
.tick-chip.up strong { color: var(--up); }
.tick-chip.down strong { color: var(--down); }

/* ── 4 · Features ────────────────────────────────────────────────── */
.features { padding: 64px 0 8px; }

.section-title {
  font-size: clamp(1.5rem, 4.5vw, 2.4rem);
  font-weight: 800;
  letter-spacing: -0.01em;
  line-height: 1.12;
  margin: 0 0 28px;
}

.feature-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}

.feature {
  padding: 22px 20px;
  transition: border-color 0.15s ease;
}

.feature:hover { border-color: rgba(240, 185, 11, 0.45); }

.feature-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.f-num {
  font-size: 0.72rem;
  letter-spacing: 0.16em;
  color: var(--text-2);
}

.f-icon { flex: none; }

.f-title {
  font-size: 1.02rem;
  font-weight: 700;
  margin: 0 0 8px;
}

.f-body {
  color: var(--text-2);
  font-size: 0.88rem;
  margin: 0;
}

/* ── 5 · Depth ───────────────────────────────────────────────────── */
.depth { padding: 56px 0 8px; }

.depth-panel { padding: 22px 18px; }

.depth-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.d-label {
  font-family: var(--mono);
  font-size: 0.62rem;
  letter-spacing: 0.16em;
  color: var(--text-2);
  margin: 0 0 6px;
}

.d-value {
  font-size: clamp(1.7rem, 6vw, 2.6rem);
  font-weight: 700;
  margin: 0;
  line-height: 1.1;
  overflow-wrap: break-word;
}

.d-chg { font-size: 0.5em; vertical-align: 0.35em; white-space: nowrap; }

.d-range {
  font-size: 0.64rem;
  letter-spacing: 0.12em;
  color: var(--text-2);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 5px 9px;
  flex: none;
}

.big-chart {
  width: 100%;
  height: 160px;
  display: block;
  margin-bottom: 18px;
}

.stat-tiles {
  display: grid;
  grid-template-columns: 1fr;
  gap: 10px;
}

.stat-tile {
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 14px 14px 12px;
  background: var(--bg);
}

.s-label {
  font-family: var(--mono);
  font-size: 0.58rem;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-2);
  margin: 0 0 8px;
}

.s-value {
  font-size: 0.98rem;
  font-weight: 700;
  margin: 0 0 4px;
}

.s-sub {
  font-size: 0.66rem;
  letter-spacing: 0.1em;
  margin: 0;
}

/* ── 6 · Comparison ──────────────────────────────────────────────── */
.compare { padding: 56px 0 8px; }

.compare-sub {
  color: var(--text-2);
  max-width: 52ch;
  margin: -12px 0 22px;
}

.compare-table { overflow: hidden; }

.c-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 8px;
  align-items: center;
  min-height: 48px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--line);
}

.c-row:last-child { border-bottom: none; }

.c-header {
  min-height: 36px;
  font-family: var(--mono);
  font-size: 0.58rem;
  letter-spacing: 0.16em;
  color: var(--text-2);
  padding-top: 0;
  padding-bottom: 0;
}

/* Hide the COLLECTR column on the narrowest screens; metric + Rarebox stay */
.c-row > :nth-child(2) { display: none; }

.c-metric { font-size: 0.84rem; }

.c-old {
  font-size: 0.74rem;
  color: var(--text-2);
  text-align: left;
}

.c-rb {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 0.74rem;
  color: var(--text);
}

.c-header .c-rb { color: var(--amber); }

.check { flex: none; }

/* ── 7 · CTA + footer ────────────────────────────────────────────── */
.cta-panel-wrap { padding: 64px 0; }

.cta-panel {
  padding: 44px 20px;
  text-align: center;
  background:
    radial-gradient(ellipse 70% 90% at 50% 0%, rgba(240, 185, 11, 0.07), transparent 70%),
    var(--panel);
}

.cta-panel .eyebrow { margin-bottom: 10px; }

.cta-title {
  font-size: clamp(1.4rem, 4.6vw, 2.3rem);
  font-weight: 800;
  line-height: 1.15;
  margin: 0 0 24px;
}

.cta-center { justify-content: center; margin-bottom: 0; }

.footer {
  border-top: 1px solid var(--line);
  padding: 26px 0 90px;
}

.foot-inner {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 16px;
}

.foot-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.foot-links {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 18px;
}

.foot-links a {
  font-family: var(--mono);
  font-size: 0.72rem;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-2);
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  transition: color 0.15s ease;
}

.foot-links a:hover { color: var(--text); }

.foot-proto {
  font-size: 0.62rem;
  letter-spacing: 0.14em;
  color: var(--text-2);
  margin: 0;
}

/* ── Lab pill ────────────────────────────────────────────────────── */
.lab-pill {
  position: fixed;
  left: 16px;
  bottom: 16px;
  z-index: 50;
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 18px;
  border-radius: 999px;
  background: var(--panel);
  border: 1px solid var(--line);
  color: var(--text);
  font-family: var(--mono);
  font-size: 0.74rem;
  letter-spacing: 0.06em;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.5);
  transition: border-color 0.15s ease;
}

.lab-pill:hover { border-color: var(--amber); }

/* ── Responsive: ≤480 (default narrow tweaks live in base styles) ── */
@media (max-width: 479.98px) {
  /* hide QTY column under 480px */
  .h-row { grid-template-columns: minmax(0, 1fr) 88px 58px; }
  .h-qty { display: none; }
  .h-spark { display: none; }
}

@media (min-width: 480px) and (max-width: 639.98px) {
  /* qty visible, sparkline still hidden under 640px */
  .h-row { grid-template-columns: minmax(0, 1fr) 40px 88px 60px; }
  .h-spark { display: none; }
}

/* ── ≥640 ────────────────────────────────────────────────────────── */
@media (min-width: 640px) {
  .feature-grid { grid-template-columns: 1fr 1fr; }
  .stat-tiles { grid-template-columns: repeat(3, 1fr); }
  .depth-panel { padding: 28px 26px; }
  .c-row { grid-template-columns: 0.9fr 1fr 1.1fr; }
  .c-row > :nth-child(2) { display: inline-flex; align-items: center; }
}

/* ── ≥720 (foldables / small tablets) ────────────────────────────── */
@media (min-width: 720px) {
  .hero { padding: 64px 0 40px; }
  .container { padding: 0 24px; }
  .nav-inner { padding: 0 24px; }
  .ticker { padding: 10px 24px; }
  .cta-panel { padding: 56px 32px; }
}

/* ── ≥1024 ───────────────────────────────────────────────────────── */
@media (min-width: 1024px) {
  .hero-grid {
    grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
    gap: 48px;
  }
  .hero { padding: 84px 0 56px; }
  .features { padding: 88px 0 8px; }
  .depth { padding: 72px 0 8px; }
  .compare { padding: 72px 0 8px; }
  .footer { padding-bottom: 32px; }
  .foot-inner {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

/* ── Reduced motion ──────────────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .cursor,
  .status-chip .dot {
    animation: none;
  }
  .pulse *,
  .pulse *::before,
  .pulse *::after {
    transition: none !important;
  }
}
</style>
