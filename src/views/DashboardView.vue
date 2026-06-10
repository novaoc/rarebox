<template>
  <div class="dashboard">
    <!-- Landing page for new users -->
    <div v-if="isNewUser" class="landing">
      <!-- ── Hero ──────────────────────────────────────────────────── -->
      <section class="ld-hero">
        <div class="ld-hero-copy">
          <div class="ld-sticker-row">
            <span class="sticker">Free</span>
            <span class="sticker sticker-blue">6 TCGs</span>
            <span class="sticker sticker-pink">No account</span>
          </div>
          <h1 class="ld-title">Collect. Track.<br /><span class="marker">Trade.</span> Win.</h1>
          <p class="ld-sub">
            Rarebox is the home for your whole binder — Pokémon, Magic, Yu-Gi-Oh!, Lorcana,
            One Piece and Riftbound. Live market prices, portfolio analytics, deck building
            and a trade analyzer, all in your browser.
          </p>
          <div class="ld-ctas">
            <router-link to="/search" class="btn btn-primary btn-lg">Get started — it's free</router-link>
            <button class="btn btn-secondary btn-lg" @click="scrollToFeatures">See what's inside</button>
          </div>
        </div>
        <div class="ld-hero-visual" aria-hidden="true">
          <div class="ld-card ld-card-1">
            <img src="https://images.pokemontcg.io/base1/4.png" alt="" loading="lazy" @error="$event.target.style.display='none'" />
            <span class="ld-price-tag">$412.00</span>
          </div>
          <div class="ld-card ld-card-2">
            <img src="https://images.pokemontcg.io/me2/13.png" alt="" loading="lazy" @error="$event.target.style.display='none'" />
            <span class="ld-price-tag ld-tag-green">$96.40</span>
          </div>
          <div class="ld-card ld-card-3">
            <img src="https://images.pokemontcg.io/sv3pt5/151.png" alt="" loading="lazy" @error="$event.target.style.display='none'" />
            <span class="ld-price-tag ld-tag-pink">$38.25</span>
          </div>
        </div>
      </section>

      <!-- ── Marquee ───────────────────────────────────────────────── -->
      <div class="ld-marquee" aria-hidden="true">
        <div class="ld-marquee-track">
          <span v-for="i in 2" :key="i" class="ld-marquee-seg">
            POKÉMON&nbsp;&nbsp;★&nbsp;&nbsp;MAGIC&nbsp;&nbsp;★&nbsp;&nbsp;YU-GI-OH!&nbsp;&nbsp;★&nbsp;&nbsp;LORCANA&nbsp;&nbsp;★&nbsp;&nbsp;ONE&nbsp;PIECE&nbsp;&nbsp;★&nbsp;&nbsp;RIFTBOUND&nbsp;&nbsp;★&nbsp;&nbsp;
          </span>
        </div>
      </div>

      <!-- ── Features ──────────────────────────────────────────────── -->
      <section class="ld-features" ref="featuresRef">
        <h2 class="ld-h2">Built for the <span class="marker">pull</span></h2>
        <div class="ld-feature-grid">
          <div class="ld-feature ld-tint-yellow">
            <div class="ld-feature-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
            </div>
            <h3>Live prices, six games</h3>
            <p>Market prices for over 137,000 cards — singles, graded slabs and sealed product — refreshed continually. Search works offline once your games are loaded.</p>
          </div>
          <div class="ld-feature ld-tint-green">
            <div class="ld-feature-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
            </div>
            <h3>Know your gains</h3>
            <p>Portfolios with cost basis, profit and loss per card, value history charts and price alerts. Your shelf, as a number that updates itself.</p>
          </div>
          <div class="ld-feature ld-tint-pink">
            <div class="ld-feature-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></svg>
            </div>
            <h3>Trade with receipts</h3>
            <p>Put both sides of a trade on the table and see who wins before you shake on it. Point your camera at a card and the scanner identifies it.</p>
          </div>
          <div class="ld-feature ld-tint-blue">
            <div class="ld-feature-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 2h10"/><path d="M5 6h14"/><rect width="18" height="12" x="3" y="10" rx="2"/></svg>
            </div>
            <h3>Decks that price themselves</h3>
            <p>Build decks, import the current meta with one click, and see exactly what the missing cards cost against what you already own.</p>
          </div>
        </div>
      </section>

      <!-- ── Shelf preview ─────────────────────────────────────────── -->
      <section class="ld-shelf">
        <div class="ld-shelf-panel">
          <div class="ld-shelf-head">
            <div>
              <div class="ld-shelf-label">Your shelf, as a number</div>
              <span class="sticker sticker-green ld-shelf-value">$12,847.32</span>
            </div>
            <svg class="ld-spark" viewBox="0 0 220 56" fill="none" aria-hidden="true">
              <polyline points="0,46 22,42 44,44 66,36 88,38 110,28 132,30 154,20 176,24 198,12 220,8" stroke="#141414" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="ld-shelf-grid">
            <div class="ld-shelf-card" v-for="c in shelfCards" :key="c.name">
              <div class="ld-shelf-img"><img :src="c.img" :alt="c.name" loading="lazy" @error="$event.target.style.display='none'" /></div>
              <div class="ld-shelf-name">{{ c.name }}</div>
              <span class="ld-shelf-price">{{ c.price }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ── Import ────────────────────────────────────────────────── -->
      <section class="ld-import">
        <h2 class="ld-h2">Already collecting somewhere else?</h2>
        <p class="ld-import-sub">Bring everything with you in minutes — no retyping your binder.</p>
        <div class="ld-import-chips">
          <div class="ld-import-chip"><strong>Collectr import</strong><span>drop your CSV or Excel export, done</span></div>
          <div class="ld-import-chip"><strong>Bulk paste</strong><span>"4 Charizard ex SVP 125" — one card per line</span></div>
          <div class="ld-import-chip"><strong>Device transfer</strong><span>move to a new phone with a QR code</span></div>
        </div>
      </section>

      <!-- ── Privacy ───────────────────────────────────────────────── -->
      <section class="ld-privacy">
        <div class="ld-privacy-item"><span class="ld-check">✓</span><div><strong>Local-first</strong><p>Your collection lives on your device, not on someone's server.</p></div></div>
        <div class="ld-privacy-item"><span class="ld-check">✓</span><div><strong>No login, no tracking</strong><p>No email, no password, no analytics following you around.</p></div></div>
        <div class="ld-privacy-item"><span class="ld-check">✓</span><div><strong>Open source</strong><p>The whole app is on GitHub. Inspect it, fork it, keep it.</p></div></div>
      </section>

      <!-- ── Final CTA ─────────────────────────────────────────────── -->
      <section class="ld-cta">
        <span class="sticker ld-cta-sticker">100% free</span>
        <h2>Your binder deserves better.</h2>
        <p>Start with one card or import a thousand — it's your shelf either way.</p>
        <router-link to="/search" class="btn btn-primary btn-lg">Get started — it's free</router-link>
      </section>
    </div>

    <div v-else>
      <!-- Top stats -->
      <div class="stats-row mb-4">
        <div class="stat-tile">
          <div class="label">Total Portfolio Value</div>
          <div class="value"><span class="sticker sticker-green total-value-sticker">${{ store.totalPortfolioValue.toFixed(2) }}</span></div>
          <div class="sub">Across all portfolios</div>
        </div>
        <div class="stat-tile">
          <div class="label">Total Cost Basis</div>
          <div class="value">${{ store.totalCostBasis.toFixed(2) }}</div>
          <div class="sub">Amount invested</div>
        </div>
        <div class="stat-tile">
          <div class="label">Total Gain/Loss</div>
          <div class="value" :class="totalGain >= 0 ? 'text-success' : 'text-danger'">
            {{ totalGain >= 0 ? '+' : '' }}${{ Math.abs(totalGain).toFixed(2) }}
          </div>
          <div class="sub" :class="totalGainPct >= 0 ? 'text-success' : 'text-danger'">
            {{ totalGainPct >= 0 ? '+' : '' }}{{ totalGainPct.toFixed(1) }}%
          </div>
        </div>
        <div class="stat-tile">
          <div class="label">Total Items</div>
          <div class="value">{{ totalItems }}</div>
          <div class="sub">{{ store.portfolios.length }} portfolios</div>
        </div>
      </div>

      <!-- Combined portfolio chart -->
      <div class="card mb-4">
        <div class="section-header">
          <div>
            <div class="section-title">Combined Portfolio</div>
            <div class="section-subtitle">All portfolios combined</div>
          </div>
        </div>
        <PortfolioChart :portfolios="store.portfolios" :height="300" label="All Portfolios" />
      </div>

      <!-- Individual portfolio cards -->
      <div class="section-header">
        <div class="section-title">Portfolios</div>
        <button class="btn btn-secondary btn-sm" @click="$emit('create-portfolio')">+ New Portfolio</button>
      </div>

      <div class="portfolios-grid">
        <router-link
          v-for="portfolio in store.portfolios"
          :key="portfolio.id"
          :to="`/portfolio/${portfolio.id}`"
          class="portfolio-card"
          :style="{ '--p-color': portfolio.color }"
        >
          <div class="portfolio-card-accent"></div>
          <div class="portfolio-card-body">
            <div class="portfolio-card-header">
              <span class="portfolio-dot" :style="{ background: portfolio.color }"></span>
              <span class="portfolio-card-name">{{ portfolio.name }}</span>
            </div>

            <div class="portfolio-card-stats">
              <div class="p-stat">
                <span class="p-stat-label">Value</span>
                <span class="p-stat-val text-accent">${{ getPortfolioValue(portfolio).toFixed(2) }}</span>
              </div>
              <div class="p-stat">
                <span class="p-stat-label">Items</span>
                <span class="p-stat-val">{{ portfolio.items.length }}</span>
              </div>
              <div class="p-stat">
                <span class="p-stat-label">Gain</span>
                <span class="p-stat-val" :class="getPortfolioGain(portfolio) >= 0 ? 'text-success' : 'text-danger'">
                  {{ getPortfolioGain(portfolio) >= 0 ? '+' : '' }}{{ getPortfolioGainPct(portfolio).toFixed(1) }}%
                </span>
              </div>
            </div>

            <div class="portfolio-mini-items" v-if="portfolio.items.length > 0">
              <img
                v-for="item in portfolio.items.filter(i => i.cardData?.images?.small).slice(0, 4)"
                :key="item.id"
                :src="item.cardData.images.small"
                class="mini-card-img"
                draggable="false"
              />
              <span v-if="portfolio.items.length > 4" class="mini-more">+{{ portfolio.items.length - 4 }}</span>
            </div>
            <div v-else class="portfolio-empty-items text-muted">No items yet</div>
          </div>
        </router-link>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onActivated, ref } from 'vue'
import { usePortfolioStore } from '../stores/portfolio'
import { getCard, getMarketPrice } from '../services/pokemonApi'
import { getPrice as getTcgPrice } from '../services/priceFeedService'
import { checkAlerts, notifyTriggered } from '../utils/alerts'
import PortfolioChart from '../components/PortfolioChart.vue'

const store = usePortfolioStore()
const featuresRef = ref(null)

// New user = every portfolio has 0 items (store auto-creates one empty portfolio on init)
const isNewUser = computed(() => {
  return store.portfolios.every(p => p.items.length === 0)
})

const shelfCards = [
  { name: 'Charizard', img: 'https://images.pokemontcg.io/base1/4.png', price: '$412.00' },
  { name: 'Pikachu', img: 'https://images.pokemontcg.io/base1/58.png', price: '$8.40' },
  { name: 'Mega Charizard X ex', img: 'https://images.pokemontcg.io/me2/13.png', price: '$96.40' },
  { name: 'Mew ex', img: 'https://images.pokemontcg.io/sv3pt5/151.png', price: '$38.25' },
]

function scrollToFeatures() {
  featuresRef.value?.scrollIntoView({ behavior: 'smooth' })
}

const totalGain = computed(() => store.totalPortfolioValue - store.totalCostBasis)
const totalGainPct = computed(() => store.totalCostBasis > 0 ? (totalGain.value / store.totalCostBasis) * 100 : 0)
const totalItems = computed(() => store.portfolios.reduce((s, p) => s + p.items.length, 0))

function getPortfolioValue(portfolio) {
  return portfolio.items.reduce((s, item) => {
    const qty = item.quantity || 1
    const val = item.type === 'card' ? (item.currentMarketPrice || item.purchasePrice || 0) : (item.currentValue || item.purchasePrice || 0)
    return s + val * qty
  }, 0)
}

function getPortfolioCost(portfolio) {
  return portfolio.items.reduce((s, item) => s + (item.purchasePrice || 0) * (item.quantity || 1), 0)
}

function getPortfolioGain(portfolio) {
  return getPortfolioValue(portfolio) - getPortfolioCost(portfolio)
}

function getPortfolioGainPct(portfolio) {
  const cost = getPortfolioCost(portfolio)
  if (cost === 0) return 0
  return (getPortfolioGain(portfolio) / cost) * 100
}

// Silently refresh prices for all card items on mount (background, no blocking)
onMounted(async () => {

  const allCardItems = store.portfolios.flatMap(p =>
    p.items.filter(i => i.type === 'card' && i.cardId).map(i => ({ ...i, portfolioId: p.id }))
  )

  // Split into Pokemon and non-Pokemon cards
  const pokemonCards = allCardItems.filter(i => !i.game || i.game === 'pokemon')
  const otherTcgCards = allCardItems.filter(i => i.game && i.game !== 'pokemon')

  // Pokemon EN cards — refresh all (pokemontcg.io is fast and bulk-friendly)
  const enCards = pokemonCards.filter(i => !store.isJPCard(i))
  const jpCards = pokemonCards.filter(i => store.isJPCard(i))

  for (const item of enCards) {
    try {
      const card = await getCard(item.cardId, item._lang)
      const result = getMarketPrice(card, item.priceVariant)
      const price = result?.price || result
      if (price) store.updateItem(item.portfolioId, item.id, { currentMarketPrice: price, lastPriceUpdate: new Date().toISOString() })
    } catch (e) {
      console.warn(`Failed to refresh EN card ${item.cardId}:`, e.message)
    }
    await new Promise(r => setTimeout(r, 100))
  }

  // Pokemon JP cards — only refresh stale ones (tcgdex needs one request per card)
  for (const item of jpCards) {
    if (!store.isPriceStale(item)) continue
    try {
      const card = await getCard(item.cardId, item._lang)
      const result = getMarketPrice(card, item.priceVariant)
      const price = result?.price || result
      if (price) store.updateItem(item.portfolioId, item.id, { currentMarketPrice: price, lastPriceUpdate: new Date().toISOString() })
    } catch (e) {
      console.warn(`Failed to refresh JP card ${item.cardId}:`, e.message)
    }
    await new Promise(r => setTimeout(r, 500)) // 500ms between tcgdex requests
  }

  // Non-Pokemon TCG cards — PriceCharting by product name
  for (const item of otherTcgCards) {
    try {
      const query = item.cardData?.name || item.name
      if (!query) continue
      const price = await getTcgPrice(query, item.game)
      if (price) store.updateItem(item.portfolioId, item.id, { currentMarketPrice: price, lastPriceUpdate: new Date().toISOString() })
    } catch (e) {
      console.warn(`Failed to refresh ${item.game} card "${item.cardData?.name}":`, e.message)
    }
    await new Promise(r => setTimeout(r, 100))
  }

  // Check price alerts after refresh
  const priceMap = new Map()
  for (const portfolio of store.portfolios) {
    for (const item of portfolio.items) {
      if (item.type === 'card' && item.cardId) {
        priceMap.set(item.cardId, item.currentMarketPrice || item.purchasePrice || 0)
      }
    }
  }
  const triggered = checkAlerts(priceMap)
  if (triggered.length > 0) notifyTriggered(triggered)

  // Record a snapshot for each portfolio with the newly refreshed prices
  for (const portfolio of store.portfolios) {
    if (portfolio.items.length > 0) store.recordSnapshot(portfolio.id)
  }
})
</script>

<style scoped>
.dashboard { max-width: 1200px; margin: 0 auto; }

/* ── Landing Page ── */
.landing {
  max-width: 900px;
  margin: 0 auto;
  padding: 0 20px;
}

/* Hero */
.hero {
  position: relative;
  text-align: center;
  padding: 80px 0 60px;
  overflow: hidden;
}
.hero-content { position: relative; z-index: 1; }
.hero-icon {
  font-size: 56px;
  margin-bottom: 16px;
  display: inline-block;
  animation: float 3s ease-in-out infinite;
}
@keyframes float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-8px); }
}
.hero-title {
  font-size: 48px;
  font-weight: 800;
  letter-spacing: -1px;
  margin-bottom: 16px;
  color: var(--text-primary);
}
.hero-sub {
  font-size: 17px;
  color: var(--text-secondary);
  max-width: 540px;
  margin: 0 auto 28px;
  line-height: 1.7;
}
.hero-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  flex-wrap: wrap;
  margin-bottom: 20px;
}
.hero-cta {
  font-size: 15px;
  padding: 12px 28px;
  font-weight: 600;
}
.hero-badges {
  display: flex;
  gap: 8px;
  justify-content: center;
  flex-wrap: wrap;
  margin-top: 8px;
}

/* Feature sections */
.features {
  padding: 40px 0;
}
.feature-section {
  margin-bottom: 56px;
}
.feature-header {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  margin-bottom: 24px;
}
.feature-icon {
  font-size: 32px;
  flex-shrink: 0;
  margin-top: 2px;
}
.feature-header h2 {
  font-size: 24px;
  font-weight: 700;
  margin-bottom: 4px;
}
.feature-sub {
  font-size: 14px;
  color: var(--text-secondary);
}

/* Feature grid — 2x2 cards */
.feature-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.feature-card {
  background: var(--bg-card);
  border: var(--bw) solid var(--ink);
  border-radius: var(--radius-lg);
  padding: 20px;
  box-shadow: var(--shadow-sm);
  transition: transform 0.15s, box-shadow 0.15s;
}
.feature-card:hover {
  transform: translate(-2px, -2px);
  box-shadow: var(--shadow);
}
.feature-card-icon {
  font-size: 28px;
  margin-bottom: 12px;
}
.feature-card h3 {
  font-size: 15px;
  font-weight: 700;
  margin-bottom: 6px;
}
.feature-card p {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
}

/* Bulk import demo */
.feature-single { max-width: 100%; }
.feature-card-wide { max-width: 100%; }
.bulk-demo {
  display: flex;
  align-items: center;
  gap: 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  padding: 16px;
}
.bulk-code {
  flex: 1;
  font-family: 'SF Mono', 'Fira Code', monospace;
  font-size: 13px;
  line-height: 1.8;
}
.bulk-line { color: var(--text-primary); }
.bulk-arrow {
  font-size: 20px;
  color: var(--accent);
  flex-shrink: 0;
}
.bulk-result {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  font-size: 14px;
  flex-shrink: 0;
}

/* Privacy section */
.privacy-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.privacy-item {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  background: var(--bg-card);
  border: var(--bw) solid var(--ink);
  border-radius: var(--radius-lg);
  padding: 18px;
  box-shadow: var(--shadow-sm);
}
.privacy-check {
  color: #1e9e5a;
  font-size: 18px;
  font-weight: 700;
  flex-shrink: 0;
  margin-top: 1px;
}
.privacy-item strong {
  font-size: 14px;
  display: block;
  margin-bottom: 4px;
}
.privacy-item p {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

/* Final CTA */
.final-cta {
  text-align: center;
  padding: 60px 0 80px;
  border-top: var(--bw) solid var(--ink);
}
.final-cta h2 {
  font-size: 28px;
  font-weight: 700;
  margin-bottom: 8px;
}
.final-cta p {
  font-size: 15px;
  color: var(--text-secondary);
  margin-bottom: 24px;
}

/* Landing mobile */
@media (max-width: 768px) {
  .landing { padding: 0 16px; }
  .hero { padding: 60px 0 40px; }
  .hero-title { font-size: 36px; }
  .hero-sub { font-size: 15px; }
  .hero-icon { font-size: 44px; }
  .feature-header h2 { font-size: 20px; }
  .final-cta h2 { font-size: 22px; }
}

@media (max-width: 640px) {
  .hero { padding: 48px 0 32px; }
  .hero-title { font-size: 30px; }
  .hero-sub { font-size: 14px; }
  .hero-icon { font-size: 40px; }
  .hero-cta { width: 100%; justify-content: center; }
  .feature-grid { grid-template-columns: 1fr; }
  .privacy-grid { grid-template-columns: 1fr; }
  .feature-section { margin-bottom: 40px; }
  .bulk-demo { flex-direction: column; text-align: center; }
  .bulk-arrow { transform: rotate(90deg); }
  .feature-header { flex-direction: column; gap: 8px; }
  .final-cta { padding: 40px 0 60px; }
}

/* ── Existing Dashboard ── */
.stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }

/* Hero value sticker — the one Tactile moment on the dashboard */
.total-value-sticker {
  font-size: 20px;
  padding: 2px 12px;
  text-transform: none;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  transform: rotate(-2deg);
}

.portfolios-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.portfolio-card {
  background: var(--bg-card);
  border: var(--bw) solid var(--ink);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  transition: transform 0.15s, box-shadow 0.15s;
  text-decoration: none;
  color: inherit;
  display: block;
  position: relative;
}
.portfolio-card:hover {
  transform: translate(-2px, -2px);
  box-shadow: var(--shadow);
  text-decoration: none;
}
.portfolio-card-accent {
  height: 4px;
  background: var(--p-color, var(--accent));
  border-bottom: var(--bw) solid var(--ink);
}
.portfolio-card-body { padding: 16px; }

.portfolio-card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}
.portfolio-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.portfolio-card-name { font-size: 15px; font-weight: 700; }

.portfolio-card-stats { display: flex; gap: 16px; margin-bottom: 14px; }
.p-stat { display: flex; flex-direction: column; gap: 2px; }
.p-stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); }
.p-stat-val { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; }

.portfolio-mini-items {
  display: flex;
  align-items: center;
  gap: 4px;
}
.mini-card-img { width: 30px; height: 42px; object-fit: contain; border-radius: 2px; pointer-events: none; -webkit-user-drag: none; user-drag: none; }
.mini-more { font-size: 11px; color: var(--text-muted); margin-left: 4px; }
.portfolio-empty-items { font-size: 12px; height: 42px; display: flex; align-items: center; }

@media (max-width: 640px) {
  .dashboard { padding: 0; }
  .stats-row { grid-template-columns: 1fr 1fr; gap: 8px; }
  .portfolios-grid { grid-template-columns: 1fr; gap: 12px; }
  .portfolio-card-stats { gap: 12px; }
  .portfolio-card-body { padding: 12px; }
}

/* ── Tactile landing ─────────────────────────────────────────────── */
.ld-hero {
  display: grid;
  grid-template-columns: 1fr;
  gap: 28px;
  align-items: center;
  padding: clamp(18px, 4vw, 48px) 0 clamp(20px, 4vw, 44px);
}
.ld-sticker-row { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 18px; }
.ld-title { font-size: clamp(2.3rem, 7.5vw, 4.4rem); font-weight: 900; letter-spacing: -0.03em; line-height: 1.04; }
.ld-sub { margin-top: 16px; font-size: clamp(14px, 2vw, 16.5px); line-height: 1.65; color: var(--text-secondary); max-width: 540px; }
.ld-ctas { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 24px; }

.ld-hero-visual { position: relative; height: clamp(240px, 38vw, 340px); overflow: visible; }
.ld-card {
  position: absolute; top: 12%;
  width: clamp(120px, 16vw, 170px); aspect-ratio: 63/88;
  background: #fff; border: var(--bw) solid var(--ink); border-radius: 12px;
  box-shadow: var(--shadow); padding: 6px;
}
.ld-card img { width: 100%; height: 100%; object-fit: contain; }
.ld-card-1 { left: 4%; transform: rotate(-7deg); z-index: 1; }
.ld-card-2 { left: 32%; top: 4%; transform: rotate(2deg); z-index: 3; }
.ld-card-3 { left: 60%; transform: rotate(8deg); z-index: 2; }
.ld-price-tag {
  position: absolute; bottom: -12px; left: 50%; transform: translateX(-50%) rotate(-3deg);
  background: var(--accent); border: var(--bw) solid var(--ink); border-radius: 8px;
  padding: 2px 10px; font-weight: 800; font-size: 12.5px; white-space: nowrap; box-shadow: var(--shadow-pressed);
}
.ld-tag-green { background: var(--success); }
.ld-tag-pink { background: var(--pink); }

.ld-marquee { border-top: var(--bw) solid var(--ink); border-bottom: var(--bw) solid var(--ink); background: var(--accent); overflow: hidden; margin: 0 calc(-1 * clamp(14px, 2.5vw, 28px)); }
.ld-marquee-track { display: flex; white-space: nowrap; animation: ld-scroll 28s linear infinite; padding: 10px 0; }
.ld-marquee-seg { font-weight: 900; font-size: 13.5px; letter-spacing: 0.06em; }
@keyframes ld-scroll { to { transform: translateX(-50%); } }

.ld-h2 { font-size: clamp(1.6rem, 4.5vw, 2.4rem); font-weight: 900; letter-spacing: -0.02em; text-align: center; }
.ld-features { padding: clamp(30px, 6vw, 64px) 0 0; }
.ld-feature-grid { display: grid; grid-template-columns: 1fr; gap: 16px; margin-top: 28px; }
.ld-feature { border: var(--bw) solid var(--ink); border-radius: var(--radius-lg); padding: 22px; box-shadow: var(--shadow-sm); }
.ld-tint-yellow { background: var(--accent-dim); }
.ld-tint-green { background: var(--success-dim); }
.ld-tint-pink { background: var(--pink-dim); }
.ld-tint-blue { background: var(--info-dim); }
.ld-feature-icon { display: inline-flex; padding: 9px; background: #fff; border: var(--bw) solid var(--ink); border-radius: 10px; box-shadow: var(--shadow-pressed); margin-bottom: 14px; }
.ld-feature h3 { font-size: 17px; font-weight: 800; margin-bottom: 6px; }
.ld-feature p { font-size: 13.5px; line-height: 1.6; color: var(--text-secondary); }

.ld-shelf { padding: clamp(30px, 6vw, 60px) 0 0; }
.ld-shelf-panel { background: #fff; border: var(--bw) solid var(--ink); border-radius: var(--radius-lg); box-shadow: var(--shadow); padding: clamp(16px, 3vw, 28px); }
.ld-shelf-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.ld-shelf-label { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-secondary); margin-bottom: 10px; }
.ld-shelf-value { font-size: clamp(1.4rem, 4vw, 2rem); padding: 6px 16px; }
.ld-spark { width: min(220px, 40vw); height: 56px; flex-shrink: 0; }
.ld-shelf-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-top: 22px; }
.ld-shelf-img { background: var(--bg-secondary); border: var(--bw) solid var(--ink); border-radius: 10px; aspect-ratio: 63/88; padding: 5px; }
.ld-shelf-img img { width: 100%; height: 100%; object-fit: contain; }
.ld-shelf-name { font-size: 12.5px; font-weight: 800; margin-top: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ld-shelf-price { display: inline-block; margin-top: 4px; background: var(--accent); border: 1.5px solid var(--ink); border-radius: 7px; padding: 1px 8px; font-size: 11.5px; font-weight: 800; }

.ld-import { padding: clamp(34px, 6vw, 64px) 0 0; text-align: center; }
.ld-import-sub { color: var(--text-secondary); margin-top: 8px; }
.ld-import-chips { display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 22px; }
.ld-import-chip { background: #fff; border: var(--bw) solid var(--ink); border-radius: var(--radius); box-shadow: var(--shadow-pressed); padding: 14px 16px; display: flex; flex-direction: column; gap: 3px; text-align: left; }
.ld-import-chip strong { font-size: 14px; font-weight: 800; }
.ld-import-chip span { font-size: 12.5px; color: var(--text-secondary); }

.ld-privacy { display: grid; grid-template-columns: 1fr; gap: 14px; padding: clamp(30px, 5vw, 54px) 0 0; }
.ld-privacy-item { display: flex; gap: 12px; align-items: flex-start; }
.ld-check { width: 26px; height: 26px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; background: var(--success); border: var(--bw) solid var(--ink); border-radius: 8px; font-weight: 900; font-size: 13px; }
.ld-privacy-item strong { font-size: 14.5px; font-weight: 800; }
.ld-privacy-item p { font-size: 13px; color: var(--text-secondary); margin-top: 2px; }

.ld-cta { margin-top: clamp(36px, 6vw, 64px); background: var(--pink-dim); border: var(--bw) solid var(--ink); border-radius: var(--radius-lg); box-shadow: var(--shadow); padding: clamp(28px, 5vw, 52px) 20px; text-align: center; position: relative; }
.ld-cta-sticker { position: absolute; top: -14px; right: 18px; transform: rotate(3deg); }
.ld-cta h2 { font-size: clamp(1.5rem, 4.5vw, 2.3rem); font-weight: 900; letter-spacing: -0.02em; }
.ld-cta p { color: var(--text-secondary); margin: 10px 0 20px; }

@media (min-width: 720px) {
  .ld-hero { grid-template-columns: 1.1fr 1fr; }
  .ld-feature-grid { grid-template-columns: 1fr 1fr; }
  .ld-shelf-grid { grid-template-columns: repeat(4, 1fr); }
  .ld-import-chips { grid-template-columns: repeat(3, 1fr); }
  .ld-privacy { grid-template-columns: repeat(3, 1fr); }
}
@media (prefers-reduced-motion: reduce) {
  .ld-marquee-track { animation: none; }
}

</style>
