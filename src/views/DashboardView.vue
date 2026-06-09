<template>
  <div class="dashboard">
    <!-- Landing page for new users -->
    <div v-if="isNewUser" class="landing">
      <!-- Hero -->
      <section class="hero">
        <div class="hero-glow"></div>
        <div class="hero-content">
          <div class="hero-icon">⬡</div>
          <h1 class="hero-title">Rarebox</h1>
          <p class="hero-sub">Track your TCG collection — Pokémon, Magic, Yu-Gi-Oh!, Lorcana, One Piece, and Riftbound — with live prices, portfolio charts, and deck building tools. Free. Private. Runs in your browser.</p>
          <div class="hero-actions">
            <router-link to="/search" class="btn btn-primary btn-lg hero-cta">Get Started</router-link>
            <button class="btn btn-secondary btn-lg" @click="scrollToFeatures">See Features</button>
            <a href="https://docs.rarebox.io" target="_blank" rel="noopener" class="btn btn-secondary btn-lg">📖 Docs</a>
          </div>
          <div class="hero-badges">
            <span class="badge badge-accent">No Account</span>
            <span class="badge badge-success">No Tracking</span>
            <span class="badge badge-info">100% Free</span>
          </div>
        </div>
      </section>

      <!-- Feature sections -->
      <section class="features" ref="featuresRef">
        <!-- Collection Management -->
        <div class="feature-section">
          <div class="feature-header">
            <span class="feature-icon">🃏</span>
            <div>
              <h2>Collection Management</h2>
              <p class="feature-sub">Add cards, sealed products, and graded slabs to organized portfolios. Supports Pokémon, Magic, Yu-Gi-Oh!, Lorcana, One Piece, and Riftbound.</p>
            </div>
          </div>
          <div class="feature-grid">
            <div class="feature-card">
              <div class="feature-card-icon">🔍</div>
              <h3>Search Any Card</h3>
              <p>Search across every set for Pokémon, Magic, Yu-Gi-Oh!, Lorcana, One Piece, and Riftbound. Live results with card images and market prices.</p>
            </div>
            <div class="feature-card">
              <div class="feature-card-icon">📦</div>
              <h3>Sealed Products</h3>
              <p>Track booster boxes, ETBs, tins, and collection boxes. Prices fetched live from PriceCharting — no account needed.</p>
            </div>
            <div class="feature-card">
              <div class="feature-card-icon">🏆</div>
              <h3>Graded Slabs</h3>
              <p>PSA, BGS, CGC, and ACE graded cards with grade-specific pricing. Update values manually or fetch from PriceCharting.</p>
            </div>
            <div class="feature-card">
              <div class="feature-card-icon">📁</div>
              <h3>Multiple Portfolios</h3>
              <p>Organize your collection into named portfolios with custom colors. Separate investments from personal collection.</p>
            </div>
          </div>
        </div>

        <!-- Browse & Pricing -->
        <div class="feature-section">
          <div class="feature-header">
            <span class="feature-icon">📊</span>
            <div>
              <h2>Browse & Pricing</h2>
              <p class="feature-sub">Every TCG set. Live market prices. Historical charts back to 2022.</p>
            </div>
          </div>
          <div class="feature-grid">
            <div class="feature-card">
              <div class="feature-card-icon">📚</div>
              <h3>Browse All Sets</h3>
              <p>Browse every set across 5 TCGs with logos, card counts, and release dates. Click into any set to see the full card list and add cards with one tap.</p>
            </div>
            <div class="feature-card">
              <div class="feature-card-icon">📈</div>
              <h3>Price History Charts</h3>
              <p>Interactive charts with 7D / 1M / 6M / 1Y / 3Y ranges. Card history goes back to November 2022 via TCGDex data.</p>
            </div>
            <div class="feature-card">
              <div class="feature-card-icon">💰</div>
              <h3>Portfolio Value Tracking</h3>
              <p>See your total collection value, cost basis, and gain/loss across all portfolios. Charts update as prices change.</p>
            </div>
            <div class="feature-card">
              <div class="feature-card-icon">🔔</div>
              <h3>Price Alerts</h3>
              <p>Set above or below thresholds on any card. Get browser notifications when prices cross your targets.</p>
            </div>
          </div>
        </div>

        <!-- Deck Building -->
        <div class="feature-section">
          <div class="feature-header">
            <span class="feature-icon">⚔️</span>
            <div>
              <h2>Deck Building</h2>
              <p class="feature-sub">Build competitive decks, see what you own, and track the cost to finish each one.</p>
            </div>
          </div>
          <div class="feature-grid">
            <div class="feature-card">
              <div class="feature-card-icon">🆕</div>
              <h3>Build Custom Decks</h3>
              <p>Search any card and add it to a deck. Create as many decks as you want. Rename, reorder, and manage them like a collection of builds.</p>
            </div>
            <div class="feature-card">
              <div class="feature-card-icon">🃏</div>
              <h3>Meta Decks</h3>
              <p>Import popular Standard Pokémon decks with one click — Charizard ex, Gardevoir, Lost Zone, Chien-Pao, and more. Each card's market price is fetched automatically on import.</p>
            </div>
            <div class="feature-card">
              <div class="feature-card-icon">✅</div>
              <h3>Collection Sync</h3>
              <p>Every deck checks against your portfolios automatically. Green badges = you own it, red = you need it. See exactly which cards to buy at a glance.</p>
            </div>
            <div class="feature-card">
              <div class="feature-card-icon">💰</div>
              <h3>Cost Tracking</h3>
              <p>Each deck shows the total cost to finish it based on current market prices — only counting the cards you're missing. Know the real price before you buy.</p>
            </div>
          </div>
        </div>

        <!-- Bulk Import -->
        <div class="feature-section">
          <div class="feature-header">
            <span class="feature-icon">⚡</span>
            <div>
              <h2>Bulk Import</h2>
              <p class="feature-sub">Import entire decks, sets, or collections in seconds.</p>
            </div>
          </div>
          <div class="feature-single">
            <div class="feature-card feature-card-wide">
              <div class="bulk-demo">
                <div class="bulk-code">
                  <div class="bulk-line">4 Charizard ex OBF 125</div>
                  <div class="bulk-line">3 Pidgeot ex OBF 164</div>
                  <div class="bulk-line">4 Arven SVI 166</div>
                  <div class="bulk-line text-muted">...</div>
                </div>
                <div class="bulk-arrow">→</div>
                <div class="bulk-result">
                  <span class="text-accent font-bold">11 cards</span>
                  <span class="text-muted">added instantly</span>
                </div>
              </div>
              <p class="mt-3">Paste a PTCGL or PTCGO deck list, or add entire sets with one click. Each card is looked up automatically with current market prices. Preview before importing.</p>
            </div>
          </div>
        </div>

        <!-- Backup & Transfer -->
        <div class="feature-section">
          <div class="feature-header">
            <span class="feature-icon">📱</span>
            <div>
              <h2>Backup & Transfer</h2>
              <p class="feature-sub">Import from Collectr. Export to Excel. Move between devices. Your data, your control.</p>
            </div>
          </div>
          <div class="feature-grid">
            <div class="feature-card">
              <div class="feature-card-icon">💾</div>
              <h3>JSON Backup</h3>
              <p>Download your entire collection as a single JSON file. Portfolios, items, snapshots, price cache — everything included.</p>
            </div>
            <div class="feature-card">
              <div class="feature-card-icon">📲</div>
              <h3>QR Code Transfer</h3>
              <p>Transfer your collection to another device via QR code. Data is gzip-compressed to fit even large collections in a single code.</p>
            </div>
            <div class="feature-card">
              <div class="feature-card-icon">📋</div>
              <h3>Clipboard Transfer</h3>
              <p>Copy your collection to clipboard and paste it on any device. Compressed base64 — works across browsers and operating systems.</p>
            </div>
            <div class="feature-card">
              <div class="feature-card-icon">📊</div>
              <h3>Excel Export</h3>
              <p>Export individual portfolios or all portfolios to Excel. Summary sheet plus full item details with prices and gain/loss.</p>
            </div>
            <div class="feature-card">
              <div class="feature-card-icon">📥</div>
              <h3>Import from Collectr</h3>
              <p>Switching from Collectr? Import your CSV or Excel export and all your portfolios, cards, sealed products, and graded slabs are converted automatically.</p>
            </div>
          </div>
        </div>

        <!-- Privacy -->
        <div class="feature-section">
          <div class="feature-header">
            <span class="feature-icon">🔒</span>
            <div>
              <h2>Private by Design</h2>
              <p class="feature-sub">No accounts. No tracking. No servers. Everything runs in your browser.</p>
            </div>
          </div>
          <div class="privacy-grid">
            <div class="privacy-item">
              <span class="privacy-check">✓</span>
              <div>
                <strong>Local Storage Only</strong>
                <p>All data stays in your browser's IndexedDB (via Dexie.js). Crash-safe writes, auto-backup on every change. Nothing is sent to any server.</p>
              </div>
            </div>
            <div class="privacy-item">
              <span class="privacy-check">✓</span>
              <div>
                <strong>Direct API Fetches</strong>
                <p>Price data comes directly from public APIs (pokemontcg.io, TCGDex, PriceCharting) — your browser is the client.</p>
              </div>
            </div>
            <div class="privacy-item">
              <span class="privacy-check">✓</span>
              <div>
                <strong>No Login Required</strong>
                <p>Open the app and start tracking. No email, no password, no account creation.</p>
              </div>
            </div>
            <div class="privacy-item">
              <span class="privacy-check">✓</span>
              <div>
                <strong>Open Source</strong>
                <p>MIT licensed. Inspect the code, fork it, run it yourself.<br><a href="https://github.com/novaoc/rarebox" target="_blank" rel="noopener">GitHub</a> · <a href="https://docs.rarebox.io" target="_blank" rel="noopener">Documentation</a></p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Final CTA -->
      <section class="final-cta">
        <h2>Ready to track your collection?</h2>
        <p>No signup. No download. Start adding cards right now.</p>
        <router-link to="/search" class="btn btn-primary btn-lg hero-cta">Get Started — It's Free</router-link>
      </section>
    </div>

    <div v-else>
      <!-- Top stats -->
      <div class="stats-row mb-4">
        <div class="stat-tile">
          <div class="label">Total Portfolio Value</div>
          <div class="value text-accent">${{ store.totalPortfolioValue.toFixed(2) }}</div>
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
import { getCard, getJapaneseCardDetail, getMarketPrice } from '../services/pokemonApi'
import PortfolioChart from '../components/PortfolioChart.vue'

const store = usePortfolioStore()
const featuresRef = ref(null)

// New user = every portfolio has 0 items (store auto-creates one empty portfolio on init)
const isNewUser = computed(() => {
  return store.portfolios.every(p => p.items.length === 0)
})

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
  console.log('[Dashboard] onMounted fired, portfolios:', store.portfolios.length, 'items:', store.portfolios.reduce((s, p) => s + p.items.length, 0))

  const allCardItems = store.portfolios.flatMap(p =>
    p.items.filter(i => i.type === 'card' && i.cardId).map(i => ({ ...i, portfolioId: p.id }))
  )

  // Split into EN and JP cards
  const enCards = allCardItems.filter(i => !store.isJPCard(i))
  const jpCards = allCardItems.filter(i => store.isJPCard(i))

  // EN cards — refresh all (pokemontcg.io is fast and bulk-friendly)
  for (const item of enCards) {
    try {
      const card = await getCard(item.cardId, item._lang)
      const result = getMarketPrice(card, item.priceVariant)
      const price = result?.price || result
      if (price) store.updateItem(item.portfolioId, item.id, { currentMarketPrice: price, lastPriceUpdate: new Date().toISOString() })
    } catch {}
    await new Promise(r => setTimeout(r, 100))
  }

  // JP cards — only refresh stale ones (tcgdex needs one request per card)
  for (const item of jpCards) {
    if (!store.isPriceStale(item)) continue
    try {
      const card = await getCard(item.cardId, item._lang)
      const result = getMarketPrice(card, item.priceVariant)
      const price = result?.price || result
      if (price) store.updateItem(item.portfolioId, item.id, { currentMarketPrice: price, lastPriceUpdate: new Date().toISOString() })
    } catch {}
    await new Promise(r => setTimeout(r, 500)) // 500ms between tcgdex requests
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
.hero-glow {
  position: absolute;
  top: -100px;
  left: 50%;
  transform: translateX(-50%);
  width: 500px;
  height: 500px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(245, 166, 35, 0.12) 0%, transparent 70%);
  pointer-events: none;
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
  background: linear-gradient(135deg, var(--accent), #ffcc70);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
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
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 20px;
  transition: border-color 0.2s;
}
.feature-card:hover {
  border-color: var(--accent);
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
  background: var(--bg-primary);
  border: 1px solid var(--border);
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
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 18px;
}
.privacy-check {
  color: var(--success);
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
  border-top: 1px solid var(--border);
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

.portfolios-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
  margin-top: 16px;
}

.portfolio-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: all 0.2s;
  text-decoration: none;
  color: inherit;
  display: block;
  position: relative;
}
.portfolio-card:hover {
  border-color: var(--p-color, var(--accent));
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
  text-decoration: none;
}
.portfolio-card-accent {
  height: 3px;
  background: var(--p-color, var(--accent));
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
</style>
