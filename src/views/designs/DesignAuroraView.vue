<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'

// ---------- Mock data ----------
const navLinks = ['Portfolio', 'Prices', 'Trade', 'Import']

const portfolio = {
  total: '$12,847.32',
  delta: '+4.2%',
  deltaAbs: '+$517.88',
  period: '24h',
}

// Sparkline points (normalized 0-100 viewBox)
const sparkPoints = '0,38 12,34 24,36 36,28 48,30 60,22 72,26 84,16 96,18 108,10 120,12'
const sparkArea = '0,38 12,34 24,36 36,28 48,30 60,22 72,26 84,16 96,18 108,10 120,12 120,48 0,48'

const heroCards = [
  { src: 'https://images.pokemontcg.io/base1/4.png', alt: 'Charizard — Base Set', rot: -14, z: 1, y: 10 },
  { src: 'https://images.pokemontcg.io/base1/58.png', alt: 'Pikachu — Base Set', rot: -5, z: 2, y: 2 },
  { src: 'https://images.pokemontcg.io/me2/13.png', alt: 'Mega Evolution promo', rot: 5, z: 3, y: 0 },
  { src: 'https://images.pokemontcg.io/sv3pt5/151.png', alt: 'Mew ex — 151', rot: 14, z: 4, y: 8 },
]

const stats = [
  { value: '120k+', label: 'cards tracked' },
  { value: '6', label: 'TCGs supported' },
  { value: 'Realtime', label: 'price feeds' },
  { value: 'Offline', label: 'first, always' },
]

const features = [
  {
    icon: 'chart',
    title: 'Portfolio P/L',
    body: 'Cost basis, unrealized gains and daily movement per card, per set, per game. Your binder, treated like a brokerage account.',
  },
  {
    icon: 'pulse',
    title: 'Live multi-TCG prices',
    body: 'Pokémon, Magic, Yu-Gi-Oh!, Lorcana, One Piece and Riftbound — one price layer, refreshed to the minute.',
  },
  {
    icon: 'scan',
    title: 'Trade analyzer + OCR scanner',
    body: 'Point your camera at a card or a whole trade stack. We read it, price both sides and tell you who wins the deal.',
  },
  {
    icon: 'import',
    title: 'Collectr import in one click',
    body: 'Export from Collectr, drop the file in, done. Quantities, conditions and variants map automatically.',
  },
]

const holdings = [
  { thumb: 'https://images.pokemontcg.io/base1/4.png', name: 'Charizard', set: 'Base Set · 4/102', qty: 1, price: '$412.50', delta: '+2.8%', up: true },
  { thumb: 'https://images.pokemontcg.io/base1/58.png', name: 'Pikachu', set: 'Base Set · 58/102', qty: 4, price: '$18.20', delta: '+0.6%', up: true },
  { thumb: 'https://images.pokemontcg.io/sv3pt5/151.png', name: 'Mew ex', set: '151 · 151/165', qty: 2, price: '$36.90', delta: '-1.4%', up: false },
  { thumb: 'https://images.pokemontcg.io/me2/13.png', name: 'Venusaur ex', set: 'Mega Evo · 13', qty: 1, price: '$24.75', delta: '+5.1%', up: true },
  { thumb: 'https://images.pokemontcg.io/base1/4.png', name: 'Charizard (LP)', set: 'Base Set · 4/102', qty: 1, price: '$289.00', delta: '-0.9%', up: false },
]

const versus = [
  { us: 'Six TCGs in one tracker', them: 'Collectr: Pokémon-centric coverage' },
  { us: 'Offline-first — works in a basement card shop', them: 'Collectr: needs a connection' },
  { us: 'Trade analyzer with OCR, built in', them: 'Collectr: manual entry only' },
]

function hideImg(e) {
  e.target.style.display = 'none'
}

const year = ref(new Date().getFullYear())
</script>

<template>
  <div class="aurora">
    <!-- Background orbs -->
    <div class="orb orb-a" aria-hidden="true"></div>
    <div class="orb orb-b" aria-hidden="true"></div>

    <!-- ============ NAV ============ -->
    <header class="nav glass">
      <div class="container nav-inner">
        <a href="#" class="brand" aria-label="Rarebox home">
          <svg class="logomark" viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
            <defs>
              <linearGradient id="au-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#7c3aed" />
                <stop offset="100%" stop-color="#22d3ee" />
              </linearGradient>
            </defs>
            <polygon
              points="16,2.5 27.7,9.25 27.7,22.75 16,29.5 4.3,22.75 4.3,9.25"
              fill="none" stroke="url(#au-grad)" stroke-width="2" stroke-linejoin="round" />
            <path d="M16 2.5 L16 16 M4.3 9.25 L16 16 M27.7 9.25 L16 16"
              fill="none" stroke="url(#au-grad)" stroke-width="1" opacity="0.6" />
            <path d="M16 16 L16 29.5" fill="none" stroke="url(#au-grad)" stroke-width="1" opacity="0.35" />
          </svg>
          <span class="wordmark">Rarebox</span>
        </a>

        <nav class="nav-links" aria-label="Primary">
          <a v-for="l in navLinks" :key="l" href="#" class="nav-link">{{ l }}</a>
        </nav>

        <a href="#" class="btn btn-grad btn-sm">Launch App</a>
      </div>
    </header>

    <main>
      <!-- ============ HERO ============ -->
      <section class="hero container">
        <div class="hero-copy">
          <span class="eyebrow">
            <span class="dot" aria-hidden="true"></span>
            LIVE PRICES · 6 TCGS
          </span>
          <h1 class="headline">
            Your collection,<br />
            <span class="grad-text">priced to the minute.</span>
          </h1>
          <p class="subcopy">
            Track Pokémon, Magic, Yu-Gi-Oh!, Lorcana, One Piece and Riftbound in one
            portfolio. Live market prices, P/L like a brokerage, and an OCR scanner
            that reads cards faster than you can sleeve them.
          </p>
          <div class="hero-ctas">
            <a href="#" class="btn btn-grad">Start tracking — free</a>
            <a href="#terminal" class="btn btn-ghost">See the terminal</a>
          </div>
        </div>

        <div class="hero-visual">
          <div class="dash glass-strong">
            <div class="dash-head">
              <span class="dash-label">Total portfolio value</span>
              <span class="dash-period">{{ portfolio.period }}</span>
            </div>
            <div class="dash-value-row">
              <span class="dash-value grad-text">{{ portfolio.total }}</span>
              <span class="pill-up">{{ portfolio.delta }} <span class="pill-sub">{{ portfolio.deltaAbs }}</span></span>
            </div>
            <svg class="spark" viewBox="0 0 120 48" preserveAspectRatio="none" aria-hidden="true">
              <defs>
                <linearGradient id="au-spark" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stop-color="#7c3aed" />
                  <stop offset="100%" stop-color="#22d3ee" />
                </linearGradient>
                <linearGradient id="au-spark-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stop-color="#22d3ee" stop-opacity="0.25" />
                  <stop offset="100%" stop-color="#22d3ee" stop-opacity="0" />
                </linearGradient>
              </defs>
              <polygon :points="sparkArea" fill="url(#au-spark-fill)" />
              <polyline :points="sparkPoints" fill="none" stroke="url(#au-spark)" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round" />
            </svg>

            <div class="fan" aria-label="Sample cards from a tracked collection">
              <img
                v-for="(c, i) in heroCards"
                :key="i"
                :src="c.src"
                :alt="c.alt"
                class="fan-card"
                :style="{
                  transform: `rotate(${c.rot}deg) translateY(${c.y}px)`,
                  zIndex: c.z,
                }"
                loading="lazy"
                @error="hideImg"
              />
            </div>
          </div>
        </div>
      </section>

      <!-- ============ STATS STRIP ============ -->
      <section class="strip container">
        <div class="strip-inner glass">
          <div v-for="s in stats" :key="s.label" class="stat">
            <span class="stat-value grad-text">{{ s.value }}</span>
            <span class="stat-label">{{ s.label }}</span>
          </div>
        </div>
      </section>

      <!-- ============ FEATURES ============ -->
      <section class="features container">
        <h2 class="section-title">Everything a collector's terminal needs</h2>
        <p class="section-sub">Fintech-grade tooling, pointed at cardboard.</p>

        <div class="feature-grid">
          <article v-for="f in features" :key="f.title" class="feature glass">
            <span class="feature-icon" aria-hidden="true">
              <!-- chart -->
              <svg v-if="f.icon === 'chart'" viewBox="0 0 24 24" width="22" height="22" fill="none"
                stroke="url(#au-grad)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 21h18" />
                <path d="M6 17v-6" />
                <path d="M11 17V7" />
                <path d="M16 17v-4" />
                <path d="M21 17V4" />
              </svg>
              <!-- pulse -->
              <svg v-else-if="f.icon === 'pulse'" viewBox="0 0 24 24" width="22" height="22" fill="none"
                stroke="url(#au-grad)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M2 12h4l3-8 4 16 3-8h6" />
              </svg>
              <!-- scan -->
              <svg v-else-if="f.icon === 'scan'" viewBox="0 0 24 24" width="22" height="22" fill="none"
                stroke="url(#au-grad)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                <path d="M4 12h16" />
              </svg>
              <!-- import -->
              <svg v-else viewBox="0 0 24 24" width="22" height="22" fill="none"
                stroke="url(#au-grad)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 3v12" />
                <path d="m7 10 5 5 5-5" />
                <path d="M4 21h16" />
              </svg>
            </span>
            <h3 class="feature-title">{{ f.title }}</h3>
            <p class="feature-body">{{ f.body }}</p>
          </article>
        </div>
      </section>

      <!-- ============ TERMINAL ============ -->
      <section id="terminal" class="terminal container">
        <div class="terminal-panel glass-strong">
          <div class="terminal-head">
            <div>
              <h2 class="section-title sm">Holdings</h2>
              <p class="section-sub sm">Live snapshot · prices refresh every 60s</p>
            </div>
            <span class="pill-up lg">{{ portfolio.delta }} today</span>
          </div>

          <div class="table" role="table" aria-label="Holdings table">
            <div class="trow thead" role="row">
              <span role="columnheader" class="tc-card">Card</span>
              <span role="columnheader" class="tc-qty">Qty</span>
              <span role="columnheader" class="tc-price">Price</span>
              <span role="columnheader" class="tc-delta">24h</span>
            </div>
            <div v-for="(h, i) in holdings" :key="i" class="trow" role="row">
              <span class="tc-card" role="cell">
                <img :src="h.thumb" :alt="''" class="thumb" loading="lazy" @error="hideImg" />
                <span class="tc-names">
                  <span class="tc-name">{{ h.name }}</span>
                  <span class="tc-set">{{ h.set }}</span>
                </span>
              </span>
              <span class="tc-qty" role="cell">×{{ h.qty }}</span>
              <span class="tc-price" role="cell">{{ h.price }}</span>
              <span class="tc-delta" role="cell" :class="h.up ? 'up' : 'down'">{{ h.delta }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- ============ VS COLLECTR ============ -->
      <section class="versus container">
        <h2 class="section-title">Why Rarebox over Collectr?</h2>
        <div class="versus-grid">
          <div v-for="(v, i) in versus" :key="i" class="versus-chip glass">
            <p class="versus-us"><span class="check" aria-hidden="true">✓</span> {{ v.us }}</p>
            <p class="versus-them">{{ v.them }}</p>
          </div>
        </div>
      </section>

      <!-- ============ FINAL CTA ============ -->
      <section class="final container">
        <div class="final-border">
          <div class="final-panel">
            <h2 class="final-title">Your binder deserves a <span class="grad-text">Bloomberg terminal.</span></h2>
            <p class="section-sub">Free to start. Import from Collectr in one click. Works offline at every LGS.</p>
            <div class="hero-ctas center">
              <a href="#" class="btn btn-grad">Launch Rarebox</a>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- ============ FOOTER ============ -->
    <footer class="footer container">
      <div class="footer-brand">
        <svg viewBox="0 0 32 32" width="20" height="20" aria-hidden="true">
          <polygon points="16,2.5 27.7,9.25 27.7,22.75 16,29.5 4.3,22.75 4.3,9.25"
            fill="none" stroke="url(#au-grad)" stroke-width="2" stroke-linejoin="round" />
        </svg>
        <span class="wordmark sm">Rarebox</span>
      </div>
      <span class="footer-note">Prototype 02 — Aurora · © {{ year }} rarebox.io</span>
    </footer>

    <!-- ============ DESIGN LAB PILL ============ -->
    <RouterLink to="/designs" class="lab-pill glass">← Design Lab</RouterLink>
  </div>
</template>

<style scoped>
/* =====================================================
   AURORA — premium dark glassmorphism
   Mobile-first. No horizontal overflow ≥280px.
   ===================================================== */

.aurora {
  position: relative;
  min-height: 100vh;
  background: #07090f;
  color: #e7e9ee;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
  line-height: 1.5;
}

.aurora *,
.aurora *::before,
.aurora *::after {
  box-sizing: border-box;
  min-width: 0;
}

/* ---------- background orbs ---------- */
.orb {
  position: fixed;
  border-radius: 50%;
  filter: blur(90px);
  opacity: 0.35;
  pointer-events: none;
  z-index: 0;
}
.orb-a {
  width: 60vw;
  height: 60vw;
  max-width: 640px;
  max-height: 640px;
  top: -15vh;
  left: -20vw;
  background: radial-gradient(circle at 30% 30%, #7c3aed 0%, #22d3ee 70%, transparent 100%);
}
.orb-b {
  width: 55vw;
  height: 55vw;
  max-width: 560px;
  max-height: 560px;
  bottom: -10vh;
  right: -18vw;
  background: radial-gradient(circle at 70% 70%, #22d3ee 0%, #7c3aed 70%, transparent 100%);
}

/* ---------- layout ---------- */
.container {
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding-left: 16px;
  padding-right: 16px;
}

main,
.footer {
  position: relative;
  z-index: 1;
}

/* ---------- glass primitives ---------- */
.glass {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
}
.glass-strong {
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
}
@supports (backdrop-filter: blur(14px)) or (-webkit-backdrop-filter: blur(14px)) {
  .glass,
  .glass-strong {
    -webkit-backdrop-filter: blur(14px);
    backdrop-filter: blur(14px);
  }
}

/* ---------- text helpers ---------- */
.grad-text {
  background: linear-gradient(100deg, #7c3aed, #22d3ee);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}

/* ---------- buttons ---------- */
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 48px;
  padding: 12px 24px;
  border-radius: 999px;
  font-size: 0.95rem;
  font-weight: 600;
  text-decoration: none;
  border: 1px solid transparent;
  cursor: pointer;
  transition: box-shadow 0.25s ease, transform 0.25s ease;
}
.btn-sm {
  min-height: 44px;
  padding: 10px 18px;
  font-size: 0.875rem;
}
.btn-grad {
  background: linear-gradient(100deg, #7c3aed, #22d3ee);
  color: #fff;
}
.btn-grad:hover {
  box-shadow: 0 0 28px rgba(124, 58, 237, 0.45);
  transform: translateY(-1px);
}
.btn-ghost {
  background: rgba(255, 255, 255, 0.04);
  border-color: rgba(255, 255, 255, 0.12);
  color: #e7e9ee;
}
.btn-ghost:hover {
  box-shadow: 0 0 20px rgba(124, 58, 237, 0.3);
}

/* ---------- focus ---------- */
.aurora a:focus-visible,
.aurora button:focus-visible {
  outline: 2px solid #22d3ee;
  outline-offset: 3px;
  border-radius: 8px;
}
.btn:focus-visible {
  border-radius: 999px;
}

/* ---------- nav ---------- */
.nav {
  position: sticky;
  top: 0;
  z-index: 50;
  border-radius: 0;
  border-left: none;
  border-right: none;
  border-top: none;
  background: rgba(7, 9, 15, 0.7);
}
@supports (backdrop-filter: blur(14px)) or (-webkit-backdrop-filter: blur(14px)) {
  .nav {
    background: rgba(7, 9, 15, 0.55);
  }
}
.nav-inner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 64px;
}
.brand {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  text-decoration: none;
  min-height: 44px;
}
.logomark {
  flex-shrink: 0;
}
.wordmark {
  font-size: 1.15rem;
  font-weight: 800;
  letter-spacing: -0.02em;
  background: linear-gradient(100deg, #7c3aed, #22d3ee);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
  color: transparent;
}
.wordmark.sm {
  font-size: 0.95rem;
}
.nav-links {
  display: none;
}
.nav-link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 0 12px;
  color: #8b91a0;
  text-decoration: none;
  font-size: 0.9rem;
  font-weight: 500;
  transition: color 0.2s ease;
}
.nav-link:hover {
  color: #e7e9ee;
}

/* ---------- hero ---------- */
.hero {
  display: grid;
  grid-template-columns: 1fr;
  gap: 40px;
  padding-top: 56px;
  padding-bottom: 56px;
}
.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: #8b91a0;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
}
.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #34d399;
  box-shadow: 0 0 8px rgba(52, 211, 153, 0.8);
  animation: au-pulse 2s ease-in-out infinite;
}
@keyframes au-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.headline {
  margin: 20px 0 16px;
  font-size: clamp(2.4rem, 7.5vw, 5.5rem);
  font-weight: 800;
  line-height: 1.05;
  letter-spacing: -0.03em;
}
.subcopy {
  margin: 0 0 28px;
  max-width: 540px;
  color: #8b91a0;
  font-size: 1.05rem;
}
.hero-ctas {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
.hero-ctas.center {
  justify-content: center;
}

/* hero dashboard card */
.hero-visual {
  min-width: 0;
}
.dash {
  padding: 22px 20px 26px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.45);
}
.dash-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 8px;
}
.dash-label {
  font-size: 0.78rem;
  color: #8b91a0;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.dash-period {
  font-size: 0.75rem;
  color: #8b91a0;
}
.dash-value-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 14px;
}
.dash-value {
  font-size: clamp(1.9rem, 6vw, 2.6rem);
  font-weight: 800;
  letter-spacing: -0.02em;
}
.pill-up {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 999px;
  font-size: 0.82rem;
  font-weight: 700;
  color: #34d399;
  background: rgba(52, 211, 153, 0.12);
  border: 1px solid rgba(52, 211, 153, 0.25);
}
.pill-up.lg {
  padding: 8px 16px;
  font-size: 0.9rem;
}
.pill-sub {
  font-weight: 500;
  color: rgba(52, 211, 153, 0.75);
}
.spark {
  display: block;
  width: 100%;
  height: 64px;
  margin-bottom: 20px;
}

/* fanned card row */
.fan {
  display: flex;
  justify-content: center;
  padding: 8px 0 4px;
}
.fan-card {
  width: 26%;
  max-width: 110px;
  border-radius: 8px;
  margin: 0 -3.5%;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.55), 0 0 24px rgba(124, 58, 237, 0.25);
  transition: transform 0.3s ease;
}
.fan-card:hover {
  transform: translateY(-8px) !important;
}

/* ---------- stats strip ---------- */
.strip {
  padding-bottom: 56px;
}
.strip-inner {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px 12px;
  padding: 24px 18px;
}
.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 2px;
}
.stat-value {
  font-size: 1.45rem;
  font-weight: 800;
  letter-spacing: -0.02em;
}
.stat-label {
  font-size: 0.8rem;
  color: #8b91a0;
}

/* ---------- features ---------- */
.features {
  padding-bottom: 64px;
}
.section-title {
  margin: 0 0 8px;
  font-size: clamp(1.5rem, 4.5vw, 2.2rem);
  font-weight: 800;
  letter-spacing: -0.02em;
}
.section-title.sm {
  font-size: 1.25rem;
  margin-bottom: 2px;
}
.section-sub {
  margin: 0 0 28px;
  color: #8b91a0;
  font-size: 0.98rem;
}
.section-sub.sm {
  margin: 0;
  font-size: 0.82rem;
}
.feature-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}
.feature {
  padding: 24px 20px;
  transition: box-shadow 0.25s ease, transform 0.25s ease, border-color 0.25s ease;
}
.feature:hover {
  box-shadow: 0 0 32px rgba(124, 58, 237, 0.22);
  border-color: rgba(124, 58, 237, 0.35);
  transform: translateY(-2px);
}
.feature-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: rgba(124, 58, 237, 0.12);
  border: 1px solid rgba(124, 58, 237, 0.25);
  margin-bottom: 14px;
}
.feature-title {
  margin: 0 0 8px;
  font-size: 1.05rem;
  font-weight: 700;
}
.feature-body {
  margin: 0;
  color: #8b91a0;
  font-size: 0.92rem;
}

/* ---------- terminal ---------- */
.terminal {
  padding-bottom: 64px;
}
.terminal-panel {
  padding: 22px 16px;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.4);
}
.terminal-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}
.table {
  width: 100%;
}
.trow {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: 10px;
  padding: 10px 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  min-height: 56px;
}
.trow:last-child {
  border-bottom: none;
}
.thead {
  min-height: 0;
  padding-top: 0;
  padding-bottom: 8px;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #8b91a0;
}
.tc-card {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.thumb {
  width: 28px;
  height: 39px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
}
.tc-names {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.tc-name {
  font-size: 0.9rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tc-set {
  font-size: 0.72rem;
  color: #8b91a0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tc-qty {
  font-size: 0.85rem;
  color: #8b91a0;
  text-align: right;
}
.tc-price {
  font-size: 0.9rem;
  font-weight: 600;
  text-align: right;
  font-variant-numeric: tabular-nums;
}
.tc-delta {
  font-size: 0.85rem;
  font-weight: 700;
  text-align: right;
  min-width: 52px;
  font-variant-numeric: tabular-nums;
}
.tc-delta.up {
  color: #34d399;
}
.tc-delta.down {
  color: #f87171;
}

/* ---------- versus ---------- */
.versus {
  padding-bottom: 64px;
}
.versus-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 14px;
}
.versus-chip {
  padding: 18px 18px;
}
.versus-us {
  margin: 0 0 6px;
  font-weight: 700;
  font-size: 0.95rem;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}
.check {
  color: #22d3ee;
  font-weight: 800;
  flex-shrink: 0;
}
.versus-them {
  margin: 0;
  padding-left: 22px;
  color: #8b91a0;
  font-size: 0.85rem;
}

/* ---------- final CTA ---------- */
.final {
  padding-bottom: 72px;
}
.final-border {
  border-radius: 22px;
  padding: 1.5px;
  background: linear-gradient(120deg, #7c3aed, #22d3ee, #7c3aed);
}
.final-panel {
  border-radius: 20.5px;
  background: #0a0d16;
  padding: 44px 22px;
  text-align: center;
}
@supports (backdrop-filter: blur(14px)) or (-webkit-backdrop-filter: blur(14px)) {
  .final-panel {
    background: rgba(10, 13, 22, 0.92);
    -webkit-backdrop-filter: blur(14px);
    backdrop-filter: blur(14px);
  }
}
.final-title {
  margin: 0 0 12px;
  font-size: clamp(1.6rem, 5vw, 2.6rem);
  font-weight: 800;
  letter-spacing: -0.02em;
}
.final-panel .section-sub {
  margin-bottom: 24px;
}

/* ---------- footer ---------- */
.footer {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding-top: 8px;
  padding-bottom: 96px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}
.footer-brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-height: 44px;
}
.footer-note {
  font-size: 0.78rem;
  color: #8b91a0;
}

/* ---------- design lab pill ---------- */
.lab-pill {
  position: fixed;
  left: 14px;
  bottom: 14px;
  z-index: 60;
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  padding: 10px 18px;
  border-radius: 999px;
  font-size: 0.85rem;
  font-weight: 600;
  color: #e7e9ee;
  text-decoration: none;
  background: rgba(15, 18, 28, 0.85);
  transition: box-shadow 0.25s ease;
}
.lab-pill:hover {
  box-shadow: 0 0 22px rgba(124, 58, 237, 0.4);
}

/* =====================================================
   BREAKPOINTS
   ===================================================== */

/* ≥640px */
@media (min-width: 640px) {
  .container {
    padding-left: 24px;
    padding-right: 24px;
  }
  .strip-inner {
    grid-template-columns: repeat(4, 1fr);
  }
  .feature-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .terminal-panel {
    padding: 28px 26px;
  }
  .trow {
    gap: 16px;
  }
}

/* ≥720px — foldable unfolded / small tablet */
@media (min-width: 720px) {
  .nav-links {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .hero {
    padding-top: 72px;
    padding-bottom: 72px;
  }
  .versus-grid {
    grid-template-columns: repeat(3, 1fr);
  }
  .dash {
    padding: 28px 28px 32px;
  }
}

/* ≥1024px */
@media (min-width: 1024px) {
  .hero {
    grid-template-columns: 1.05fr 1fr;
    align-items: center;
    gap: 56px;
    padding-top: 96px;
    padding-bottom: 96px;
  }
  .final-panel {
    padding: 64px 48px;
  }
  .feature {
    padding: 30px 28px;
  }
}

/* tiny screens (≤320px) — keep everything inside 280px */
@media (max-width: 360px) {
  .tc-qty {
    display: none;
  }
  .thead .tc-qty {
    display: none;
  }
  .fan-card {
    width: 27%;
    margin: 0 -4%;
  }
  .btn {
    width: 100%;
  }
}

/* ---------- reduced motion ---------- */
@media (prefers-reduced-motion: reduce) {
  .aurora *,
  .aurora *::before,
  .aurora *::after {
    animation: none !important;
    transition: none !important;
  }
}
</style>
