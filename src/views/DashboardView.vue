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
            One Piece and Riftbound. Live market prices, shelf analytics, deck building
            and a trade analyzer, all in your browser.
          </p>
          <div class="ld-ctas">
            <router-link to="/search" class="btn btn-primary btn-lg">Get started — it's free</router-link>
            <button class="btn btn-secondary btn-lg" @click="scrollToFeatures">See what's inside</button>
          </div>
        </div>
        <div class="ld-hero-visual" aria-hidden="true">
          <div v-for="(c, i) in heroCards" :key="c.key" class="ld-card" :class="'ld-card-' + (i + 1)">
            <img :src="c.img" :alt="c.name" loading="lazy" @error="hideIfOnline" />
            <span class="ld-price-tag" :class="['', 'ld-tag-green', 'ld-tag-pink'][i]">{{ fmtPrice(c.price) }}</span>
          </div>
        </div>
      </section>

      <!-- ── Marquee ───────────────────────────────────────────────── -->
      <div class="ld-marquee" aria-hidden="true">
        <div class="ld-marquee-track">
          <span v-for="i in 8" :key="i" class="ld-marquee-seg">
            POKÉMON&nbsp;&nbsp;★&nbsp;&nbsp;MAGIC&nbsp;&nbsp;★&nbsp;&nbsp;YU-GI-OH!&nbsp;&nbsp;★&nbsp;&nbsp;LORCANA&nbsp;&nbsp;★&nbsp;&nbsp;ONE&nbsp;PIECE&nbsp;&nbsp;★&nbsp;&nbsp;RIFTBOUND&nbsp;&nbsp;★&nbsp;&nbsp;
          </span>
        </div>
      </div>

      <!-- ── Product Hunt ──────────────────────────────────────────── -->
      <section class="ld-product-hunt" aria-labelledby="product-hunt-title">
        <a
          class="ld-ph-card"
          href="https://www.producthunt.com/products/rarebox?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-rarebox"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Find Rarebox on Product Hunt"
        >
          <span class="ld-ph-icon" aria-hidden="true">
            <RbIcon name="sparkle" size="28" />
            <span class="ld-ph-p">P</span>
          </span>
          <span class="ld-ph-copy">
            <span id="product-hunt-title" class="ld-ph-title">Find Rarebox on Product Hunt</span>
            <span class="ld-ph-sub">Back the free TCG tracker that keeps your data yours</span>
          </span>
          <span class="ld-ph-arrow" aria-hidden="true">→</span>
        </a>
      </section>

      <!-- ── Features ──────────────────────────────────────────────── -->
      <section class="ld-features" ref="featuresRef">
        <h2 class="ld-h2">Built for the <span class="marker">pull</span></h2>
        <div class="ld-feature-grid">
          <div class="ld-feature ld-tint-yellow">
            <div class="ld-feature-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/></svg>
            </div>
            <h3>Live prices, six games</h3>
            <p>Market prices for over 137,000 cards — singles, graded slabs and sealed product — refreshed continually across all six games.</p>
          </div>
          <div class="ld-feature ld-tint-green">
            <div class="ld-feature-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
            </div>
            <h3>Know your gains</h3>
            <p>Shelves with cost basis, profit and loss per card, value history charts and price alerts. Your shelf, as a number that updates itself.</p>
          </div>
          <div class="ld-feature ld-tint-pink">
            <div class="ld-feature-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></svg>
            </div>
            <h3>Trade with receipts</h3>
            <p>Put both sides of a trade on the table and see who wins before you shake on it. Side-by-side totals, the gap, and a verdict you can show them.</p>
          </div>
          <div class="ld-feature ld-tint-blue">
            <div class="ld-feature-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 2h10"/><path d="M5 6h14"/><rect width="18" height="12" x="3" y="10" rx="2"/></svg>
            </div>
            <h3>Decks that price themselves</h3>
            <p>Build decks, import the current meta with one click, and see exactly what the missing cards cost against what you already own.</p>
          </div>
          <div class="ld-feature ld-tint-yellow">
            <div class="ld-feature-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h.01"/><path d="M8.5 16.429a5 5 0 0 1 7 0"/><path d="M5 12.859a10 10 0 0 1 5.17-2.69"/><path d="M19 12.859a10 10 0 0 0-2.007-1.523"/><path d="M2 8.82a15 15 0 0 1 4.177-2.643"/><path d="M22 8.82a15 15 0 0 0-11.288-3.764"/><path d="m2 2 20 20"/></svg>
            </div>
            <h3>Works offline, like a binder</h3>
            <p>Your shelf lives on your device, and so does the app. Card shop basement, airplane seat, dead zone at a tournament — everything opens, everything works. It only reaches for the internet when you ask for fresh prices.</p>
          </div>
          <div class="ld-feature ld-tint-green">
            <div class="ld-feature-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
            </div>
            <h3>Point, scan, shelved</h3>
            <p>Aim your camera at a card and Rarebox recognizes it by its artwork in about a second — no typing, no squinting at set symbols. Mid-trade, mid-unboxing, wherever.</p>
          </div>
        </div>
      </section>

      <!-- ── Shelf preview ─────────────────────────────────────────── -->
      <section class="ld-shelf">
        <div class="ld-shelf-panel">
          <div class="ld-shelf-head">
            <div>
              <div class="ld-shelf-label">Your shelf, as a number</div>
              <span class="sticker sticker-green ld-shelf-value">{{ fmtPrice(shelfTotal) }}</span>
            </div>
            <svg class="ld-spark" viewBox="0 0 220 56" fill="none" aria-hidden="true">
              <polyline points="0,46 22,42 44,44 66,36 88,38 110,28 132,30 154,20 176,24 198,12 220,8" stroke="#141414" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="ld-shelf-grid">
            <div class="ld-shelf-card" v-for="c in shelfCards" :key="c.key">
              <div class="ld-shelf-img"><img :src="c.img" :alt="c.name" loading="lazy" @error="hideIfOnline" /></div>
              <div class="ld-shelf-name">{{ c.name }}</div>
              <div class="ld-shelf-sub">{{ c.sub }}</div>
              <span class="ld-shelf-price">{{ fmtPrice(c.price) }}</span>
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
        <div class="ld-cta-actions">
          <router-link to="/search" class="btn btn-primary btn-lg">Get started — it's free</router-link>
          <router-link to="/settings#import" class="btn btn-secondary btn-lg">Import your collection</router-link>
        </div>
      </section>
    </div>

    <div v-else>
      <!-- Top stats -->
      <div class="stats-row mb-4">
        <div class="stat-tile">
          <div class="label">Total Shelf Value</div>
          <div class="value"><span class="sticker sticker-green total-value-sticker">${{ store.totalPortfolioValue.toFixed(2) }}</span></div>
          <div class="sub">Across all shelves</div>
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
          <div class="sub">{{ store.portfolios.length }} shelves</div>
        </div>
      </div>

      <!-- New Releases (Pokémon sets — the only sets feed wired up so far) -->
      <div class="section-header">
        <div class="section-title">New Releases <span class="release-scope">Pokémon</span></div>
        <router-link to="/sets" class="btn btn-ghost btn-sm">View All Sets →</router-link>
      </div>
      <div class="new-releases-row mb-4">
        <div v-if="loadingReleases" class="releases-loading">
          <div class="spinner spinner-sm"></div>
          <span>Loading new releases…</span>
        </div>
        <div v-else class="releases-grid">
          <router-link
            v-for="set in latestSets"
            :key="set.id"
            :to="'/sets/pokemon?set=' + set.id"
            class="release-card"
          >
            <div class="release-logo-wrap">
              <img v-if="set.images?.logo" :src="set.images.logo" :alt="set.name" class="release-logo" />
              <span v-else class="release-placeholder">⬡</span>
            </div>
            <div class="release-info">
              <div class="release-name">{{ set.name }}</div>
              <div class="release-meta">
                <span>{{ set.total }} cards</span>
                <span class="release-dot">·</span>
                <span>{{ formatReleaseDate(set.releaseDate) }}</span>
              </div>
            </div>
          </router-link>
        </div>
      </div>

      <!-- Combined portfolio chart -->
      <div class="card mb-4">
        <div class="section-header">
          <div>
            <div class="section-title">All Shelves</div>
            <div class="section-subtitle">All shelves combined</div>
          </div>
        </div>
        <PortfolioChart :portfolios="store.portfolios" :height="300" label="All Shelves" />
      </div>

      <!-- Individual portfolio cards -->
      <div class="section-header">
        <div class="section-title">Shelves</div>
        <div style="display:flex;gap:8px">
          <router-link to="/guide/shelves" class="btn btn-ghost btn-sm">? How shelves work</router-link>
          <button class="btn btn-secondary btn-sm" @click="$emit('create-portfolio')">+ New Shelf</button>
        </div>
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
import { getCard, getMarketPrice, getSets } from '../services/pokemonApi'
import { getPrice as getTcgPrice } from '../services/priceFeedService'
import { checkAlerts, notifyTriggered } from '../utils/alerts'
// Online failures hide the card; offline failures are handled globally by
// the offlineArt sweep (which swaps the src to a sleeve — don't hide that)
function hideIfOnline(e) {
  if (navigator.onLine) e.target.style.display = 'none'
}
import PortfolioChart from '../components/PortfolioChart.vue'
import RbIcon from '../components/icons/RbIcon.vue'

const store = usePortfolioStore()
const featuresRef = ref(null)

// New Releases — latest Pokémon sets (getSets is newest-first and localStorage-cached)
const latestSets = ref([])
const loadingReleases = ref(false)

function formatReleaseDate(dateStr) {
  if (!dateStr) return ''
  const [y, m] = dateStr.split('/')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const label = months[parseInt(m, 10) - 1]
  return label ? `${label} ${y}` : dateStr
}

async function loadLatestReleases() {
  loadingReleases.value = true
  try {
    const sets = await getSets()
    latestSets.value = sets.slice(0, 4)
  } catch (e) {
    console.warn('Failed to load latest releases:', e.message)
  } finally {
    loadingReleases.value = false
  }
}

// New user = every portfolio has 0 items (store auto-creates one empty portfolio on init)
const isNewUser = computed(() => {
  return store.portfolios.every(p => p.items.length === 0)
})

// ── Landing showcase — a rotating, cross-TCG pool. Prices are seeded with
// values from rarebox's own feeds and refreshed live on every page view.
const SHOWCASE = [
  { key: 'charizard', name: 'Charizard', sub: 'Base Set · Pokémon', img: 'https://images.pokemontcg.io/base1/4.png', price: 614.49, live: { t: 'ptcg', id: 'base1-4' } },
  { key: 'lugia', name: 'Lugia (1st Edition)', sub: 'Neo Genesis · Pokémon', img: 'https://images.pokemontcg.io/neo1/9.png', price: 1599.98, live: { t: 'ptcg', id: 'neo1-9' } },
  { key: 'trmewtwo', name: "Team Rocket's Mewtwo ex", sub: 'Destined Rivals · Pokémon', img: 'https://images.pokemontcg.io/sv10/231.png', price: 569.18, live: { t: 'ptcg', id: 'sv10-231' } },
  { key: 'pikachu', name: 'Pikachu', sub: 'Base Set · Pokémon', img: 'https://images.pokemontcg.io/base1/58.png', price: 7.59, live: { t: 'ptcg', id: 'base1-58' } },
  { key: 'mewex', name: 'Mew ex', sub: '151 · Pokémon', img: 'https://images.pokemontcg.io/sv3pt5/151.png', price: 9.6, live: { t: 'ptcg', id: 'sv3pt5-151' } },
  { key: 'megachar', name: 'Mega Charizard X ex', sub: 'Phantasmal Flames · Pokémon', img: 'https://images.pokemontcg.io/me2/13.png', price: 4.38, live: { t: 'ptcg', id: 'me2-13' } },
  { key: 'luffy', name: 'Monkey.D.Luffy (Manga)', sub: 'OP-05 · One Piece', img: 'https://optcgapi.com/media/static/Card_Images/OP05-119_r2.jpg', price: 3975.0, live: { t: 'optcg', set: 'OP-05', id: 'OP05-119', match: 'Manga' } },
  { key: 'bewd', name: 'Blue-Eyes White Dragon', sub: 'Legend of Blue Eyes · Yu-Gi-Oh!', img: 'https://images.ygoprodeck.com/images/cards_small/89631139.jpg', price: 681.49, live: { t: 'ygo', name: 'Blue-Eyes White Dragon', set: 'LOB-E001' } },
  { key: 'ahrisig', name: 'Ahri Signature', sub: 'Origins · Riftbound', img: 'https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/e5fe571a8f09c0a9e76345ec32b446480f54617c-1488x2078.png', price: 2250.67, live: { t: 'pc', q: 'riftbound origins ahri', match: '[Signature] #303' } },
  { key: 'mfsig', name: 'Miss Fortune Signature', sub: 'Origins · Riftbound', img: 'https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/37153cce7f58b2fceb28ea9ff91deb0411f849e2-1488x2078.png', price: 968.75, live: { t: 'pc', q: 'riftbound origins miss fortune', match: '[Signature] #309' } },
  { key: 'jinx', name: 'Jinx - Loose Cannon', sub: 'Origins · Riftbound', img: 'https://cmsassets.rgpub.io/sanity/images/dsfx7636/game_data_live/8a7dbbed04133926e58843f1d586f51178ef2ebd-1488x2078.png', price: 65.0, live: { t: 'pc', q: 'riftbound origins jinx', match: 'Jinx - Loose Cannon #301' } },
  { key: 'mickey', name: 'Mickey Mouse - Brave Little Tailor', sub: 'First Chapter · Lorcana', img: 'https://cards.lorcast.io/card/digital/small/crd_e74ef94562b9440e8dd95ada098728d6.avif', price: 42.89, live: { t: 'lorcast', q: 'mickey brave little tailor', num: '115' } },
  { key: 'chocobo', name: 'Traveling Chocobo (foil)', sub: 'Final Fantasy · Magic', img: 'https://cards.scryfall.io/small/front/7/1/71b97e69-f198-41ec-9385-015ec2f0160f.jpg', price: 5950.0, live: { t: 'scry', id: '71b97e69-f198-41ec-9385-015ec2f0160f' } },
  { key: 'soulstone', name: 'The Soul Stone (foil)', sub: 'Spider-Man · Magic', img: 'https://cards.scryfall.io/small/front/f/9/f9d80efc-e829-4257-83e8-f37b0b68de57.jpg', price: 1224.49, live: { t: 'scry', id: 'f9d80efc-e829-4257-83e8-f37b0b68de57' } },
]

const heroCards = ref([])
const shelfCards = ref([])
const shelfTotal = computed(() => shelfCards.value.reduce((sum, c) => sum + (c.price || 0), 0))

function fmtPrice(p) {
  if (p == null) return '—'
  return '$' + p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function pickShowcase() {
  const pool = [...SHOWCASE].sort(() => Math.random() - 0.5)
  // hero: 3 cards from 3 different games for the multi-TCG story
  const hero = []
  const seenGames = new Set()
  const rest = []
  for (const c of pool) {
    const game = c.sub.split('·').pop().trim()
    if (hero.length < 3 && !seenGames.has(game)) { hero.push(c); seenGames.add(game) }
    else rest.push(c)
  }
  heroCards.value = hero.map(c => ({ ...c }))
  shelfCards.value = rest.slice(0, 4).map(c => ({ ...c }))
  for (const card of [...heroCards.value, ...shelfCards.value]) refreshShowcasePrice(card)
}

// Live price refresh through the same sources the app tracks prices with.
// Failures keep the seeded price — never a blank tag.
async function refreshShowcasePrice(card) {
  const l = card.live
  if (!l) return
  try {
    if (l.t === 'ptcg') {
      // Shared enriched getCard: me2pt5+ sets come back URL-only from the
      // live API and get filled from the static fallback inside getCard.
      const fetched = await getCard(l.id)
      const p = getMarketPrice(fetched)?.price
      if (typeof p === 'number' && Number.isFinite(p)) card.price = p
    } else if (l.t === 'scry') {
      const r = await fetch(`https://api.scryfall.com/cards/${l.id}`)
      const d = await r.json()
      const p = parseFloat(d?.prices?.usd || d?.prices?.usd_foil)
      if (p > 0) card.price = p
    } else if (l.t === 'ygo') {
      const r = await fetch(`https://db.ygoprodeck.com/api/v7/cardinfo.php?name=${encodeURIComponent(l.name)}`)
      const d = (await r.json())?.data?.[0]
      const set = (d?.card_sets || []).find(x => x.set_code === l.set)
      const p = parseFloat(set?.set_price || d?.card_prices?.[0]?.tcgplayer_price)
      if (p > 0) card.price = p
    } else if (l.t === 'pc') {
      const r = await fetch(`https://www.pricecharting.com/search-products?type=prices&q=${encodeURIComponent(l.q)}`, { headers: { Accept: 'application/json' } })
      const products = (await r.json())?.products || []
      const hit = products.find(x => (x.productName || '').includes(l.match))
      const p = hit && parseFloat(String(hit.price1).replace(/[$,]/g, ''))
      if (p > 0) card.price = p
    } else if (l.t === 'lorcast') {
      const r = await fetch(`https://api.lorcast.com/v0/cards/search?q=${encodeURIComponent(l.q)}`)
      const hit = ((await r.json())?.results || []).find(x => String(x.collector_number) === l.num)
      const p = hit && parseFloat(hit.prices?.usd_foil || hit.prices?.usd)
      if (p > 0) card.price = p
    } else if (l.t === 'optcg') {
      const r = await fetch(`https://optcgapi.com/api/sets/${l.set}/`)
      const arr = await r.json()
      const hit = (Array.isArray(arr) ? arr : []).find(x =>
        x.card_set_id === l.id && (x.card_name || '').includes(l.match) && !(x.card_name || '').includes('Alternate')
      )
      if (hit?.market_price > 0) card.price = hit.market_price
    }
  } catch { /* seeded price stays */ }
}

onMounted(pickShowcase)

function scrollToFeatures() {
  featuresRef.value?.scrollIntoView({ behavior: 'smooth' })
}

const totalGain = computed(() => store.totalPortfolioValue - store.totalCostBasis)
const totalGainPct = computed(() => store.totalCostBasis > 0 ? (totalGain.value / store.totalCostBasis) * 100 : 0)
const totalItems = computed(() => store.portfolios.reduce((s, p) => s + p.items.length, 0))

/** Finite shelf display value; $0 is valid (never collapse with ||). */
function finiteMoney(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function getPortfolioValue(portfolio) {
  return portfolio.items.reduce((s, item) => {
    const qty = item.quantity || 1
    // Explicit $0 market/current must not fall back to purchase; unknown may.
    const val = item.type === 'card'
      ? (finiteMoney(item.currentMarketPrice) ?? finiteMoney(item.purchasePrice) ?? 0)
      : (finiteMoney(item.currentValue) ?? finiteMoney(item.purchasePrice) ?? 0)
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

// Silently refresh prices for all card items on mount (background, no blocking).
// Module-level guard: rapid Home↔elsewhere navigation must not stack several
// of these loops (each is minutes of sequential fetches on a big shelf).
let _refreshRunning = false
onMounted(async () => {
  loadLatestReleases()
  if (_refreshRunning) return
  _refreshRunning = true
  try {
    await refreshAllPrices()
  } finally {
    _refreshRunning = false
  }
})

async function refreshAllPrices() {

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
    if (!store.isPriceStale(item)) continue // 24h staleness window — was refetching everything every visit
    try {
      const card = await getCard(item.cardId, item._lang)
      const result = getMarketPrice(card, item.priceVariant)
      const price = result?.price ?? result
      if (typeof price === 'number' && Number.isFinite(price)) store.updateItem(item.portfolioId, item.id, { currentMarketPrice: price, lastPriceUpdate: new Date().toISOString() })
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
      const price = result?.price ?? result
      if (typeof price === 'number' && Number.isFinite(price)) store.updateItem(item.portfolioId, item.id, { currentMarketPrice: price, lastPriceUpdate: new Date().toISOString() })
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
        priceMap.set(item.cardId, finiteMoney(item.currentMarketPrice) ?? finiteMoney(item.purchasePrice) ?? 0)
      }
    }
  }
  const triggered = checkAlerts(priceMap)
  if (triggered.length > 0) notifyTriggered(triggered)

  // Record a snapshot for each portfolio with the newly refreshed prices
  for (const portfolio of store.portfolios) {
    if (portfolio.items.length > 0) store.recordSnapshot(portfolio.id)
  }
}
</script>

<style scoped>
.dashboard { max-width: 1200px; margin: 0 auto; }

/* ── New Releases ── */
.new-releases-row {
  min-height: 80px;
}
.releases-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  height: 80px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  color: var(--text-muted);
  font-size: 13px;
}
.release-scope {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 1px 8px;
  margin-left: 8px;
  vertical-align: middle;
}
.releases-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
}
.release-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 14px;
  text-decoration: none;
  color: inherit;
  transition: all 0.2s;
}
.release-card:hover {
  border-color: var(--accent);
  transform: translateY(-1px);
  background: var(--bg-secondary);
}
.release-logo-wrap {
  width: 60px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.release-logo {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.release-placeholder {
  font-size: 20px;
  color: var(--text-muted);
}
.release-info {
  flex: 1;
  min-width: 0;
}
.release-name {
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.release-meta {
  font-size: 11px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 2px;
}
.release-dot {
  opacity: 0.5;
}

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
  color: var(--success-text);
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
:root[data-theme='dark'] .ld-card { background: var(--bg-card); }
.ld-card-1 { left: 4%; transform: rotate(-7deg); z-index: 1; }
.ld-card-2 { left: 32%; top: 4%; transform: rotate(2deg); z-index: 3; }
.ld-card-3 { left: 60%; transform: rotate(8deg); z-index: 2; }
.ld-price-tag {
  position: absolute; bottom: -12px; left: 50%; transform: translateX(-50%) rotate(-3deg);
  background: var(--accent); border: var(--bw) solid var(--on-accent); border-radius: 8px;
  padding: 2px 10px; font-weight: 800; font-size: 12.5px; white-space: nowrap; box-shadow: var(--shadow-pressed);
  color: var(--on-accent);
}
.ld-tag-green { background: var(--success); }
.ld-tag-pink { background: var(--pink); }

.ld-marquee {
  border-top: var(--bw) solid var(--ink);
  border-bottom: var(--bw) solid var(--ink);
  background: var(--accent);
  overflow: hidden;
  /* full viewport bleed out of the centered container */
  width: 100vw;
  margin-left: calc(50% - 50vw);
  margin-right: calc(50% - 50vw);
}
.ld-marquee-track { display: flex; white-space: nowrap; animation: ld-scroll 28s linear infinite; padding: 10px 0; }
.ld-marquee-seg { font-weight: 900; font-size: 13.5px; letter-spacing: 0.06em; color: var(--on-accent); }
@keyframes ld-scroll { to { transform: translateX(-50%); } }

.ld-product-hunt {
  display: flex;
  justify-content: center;
  padding: clamp(22px, 4vw, 36px) 0 0;
}
.ld-ph-card {
  width: min(100%, 520px);
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  color: var(--text-primary);
  text-decoration: none;
  background: var(--bg-card);
  border: var(--bw) solid var(--ink);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  transform: rotate(-1deg);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.ld-ph-card:hover,
.ld-ph-card:focus-visible {
  color: var(--text-primary);
  text-decoration: none;
  transform: translate(-2px, -2px) rotate(-1deg);
  box-shadow: var(--shadow);
  outline: none;
}
.ld-ph-icon {
  position: relative;
  width: 52px;
  height: 52px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--pink-dim);
  border: var(--bw) solid var(--ink);
  border-radius: 14px;
  box-shadow: var(--shadow-pressed);
  flex-shrink: 0;
}
.ld-ph-icon .rb-icon { position: absolute; left: -10px; top: -12px; transform: rotate(-12deg); }
.ld-ph-p {
  position: relative;
  z-index: 1;
  font-size: 30px;
  font-weight: 950;
  line-height: 1;
  color: var(--ink);
}
.ld-ph-copy { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.ld-ph-title { font-size: clamp(15px, 2.6vw, 18px); font-weight: 900; letter-spacing: -0.02em; }
.ld-ph-sub { font-size: 12.5px; line-height: 1.35; color: var(--text-secondary); }
.ld-ph-arrow {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--accent);
  border: var(--bw) solid var(--on-accent);
  border-radius: 10px;
  color: var(--on-accent);
  font-weight: 900;
  box-shadow: var(--shadow-pressed);
}

.ld-h2 { font-size: clamp(1.6rem, 4.5vw, 2.4rem); font-weight: 900; letter-spacing: -0.02em; text-align: center; }
.ld-features { padding: clamp(30px, 6vw, 64px) 0 0; }
.ld-feature-grid { display: grid; grid-template-columns: 1fr; gap: 16px; margin-top: 28px; }
.ld-feature { border: var(--bw) solid var(--ink); border-radius: var(--radius-lg); padding: 22px; box-shadow: var(--shadow-sm); }
.ld-tint-yellow { background: var(--accent-dim); }
.ld-tint-green { background: var(--success-dim); }
.ld-tint-pink { background: var(--pink-dim); }
.ld-tint-blue { background: var(--info-dim); }
.ld-feature-icon { display: inline-flex; padding: 9px; background: var(--bg-card); border: var(--bw) solid var(--ink); border-radius: 10px; box-shadow: var(--shadow-pressed); margin-bottom: 14px; }
.ld-feature h3 { font-size: 17px; font-weight: 800; margin-bottom: 6px; }
.ld-feature p { font-size: 13.5px; line-height: 1.6; color: var(--text-secondary); }

.ld-shelf { padding: clamp(30px, 6vw, 60px) 0 0; }
.ld-shelf-panel { background: var(--bg-card); border: var(--bw) solid var(--ink); border-radius: var(--radius-lg); box-shadow: var(--shadow); padding: clamp(16px, 3vw, 28px); }
.ld-shelf-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.ld-shelf-label { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-secondary); margin-bottom: 10px; }
.ld-shelf-value { font-size: clamp(1.4rem, 4vw, 2rem); padding: 6px 16px; }
.ld-spark { width: min(220px, 40vw); height: 56px; flex-shrink: 0; }
.ld-spark polyline { stroke: var(--ink); }
.ld-shelf-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; margin-top: 22px; }
.ld-shelf-img { background: var(--bg-secondary); border: var(--bw) solid var(--ink); border-radius: 10px; aspect-ratio: 63/88; padding: 5px; }
.ld-shelf-img img { width: 100%; height: 100%; object-fit: contain; }
.ld-shelf-name { font-size: 12.5px; font-weight: 800; margin-top: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ld-shelf-sub { font-size: 10.5px; color: var(--text-muted); font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ld-shelf-price { display: inline-block; margin-top: 4px; background: var(--accent); border: 1.5px solid var(--on-accent); border-radius: 7px; padding: 1px 8px; font-size: 11.5px; font-weight: 800; color: var(--on-accent); }

.ld-import { padding: clamp(34px, 6vw, 64px) 0 0; text-align: center; }
.ld-import-sub { color: var(--text-secondary); margin-top: 8px; }
.ld-import-chips { display: grid; grid-template-columns: 1fr; gap: 12px; margin-top: 22px; }
.ld-import-chip { background: var(--bg-card); border: var(--bw) solid var(--ink); border-radius: var(--radius); box-shadow: var(--shadow-pressed); padding: 14px 16px; display: flex; flex-direction: column; gap: 3px; text-align: left; }
.ld-import-chip strong { font-size: 14px; font-weight: 800; }
.ld-import-chip span { font-size: 12.5px; color: var(--text-secondary); }

.ld-privacy { display: grid; grid-template-columns: 1fr; gap: 14px; padding: clamp(30px, 5vw, 54px) 0 0; }
.ld-privacy-item { display: flex; gap: 12px; align-items: flex-start; }
.ld-check { width: 26px; height: 26px; flex-shrink: 0; display: inline-flex; align-items: center; justify-content: center; background: var(--success); border: var(--bw) solid var(--on-accent); border-radius: 8px; font-weight: 900; font-size: 13px; color: var(--on-accent); }
.ld-privacy-item strong { font-size: 14.5px; font-weight: 800; }
.ld-privacy-item p { font-size: 13px; color: var(--text-secondary); margin-top: 2px; }

.ld-cta { margin-top: clamp(36px, 6vw, 64px); background: var(--pink-dim); border: var(--bw) solid var(--ink); border-radius: var(--radius-lg); box-shadow: var(--shadow); padding: clamp(28px, 5vw, 52px) 20px; text-align: center; position: relative; }
.ld-cta-sticker { position: absolute; top: -14px; right: 18px; transform: rotate(3deg); }
.ld-cta h2 { font-size: clamp(1.5rem, 4.5vw, 2.3rem); font-weight: 900; letter-spacing: -0.02em; }
.ld-cta p { color: var(--text-secondary); margin: 10px 0 20px; }
.ld-cta-actions { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }

@media (min-width: 720px) {
  .ld-hero { grid-template-columns: 1.1fr 1fr; }
  .ld-feature-grid { grid-template-columns: 1fr 1fr; }
  .ld-shelf-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  .ld-import-chips { grid-template-columns: repeat(3, 1fr); }
  .ld-privacy { grid-template-columns: repeat(3, 1fr); }
}
@media (prefers-reduced-motion: reduce) {
  .ld-marquee-track { animation: none; }
}

</style>
