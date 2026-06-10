<!--
  Rarebox — TCG Portfolio Tracker · Tactile shell
  Built by Nova — GitHub: @novaoc
  https://rarebox.io
-->
<template>
  <!-- Design prototypes render without app chrome -->
  <router-view v-if="$route.meta.bare" />
  <div v-else class="app-layout">
    <!-- TCG selection modal (first visit only, app renders behind it) -->
    <transition name="fade">
      <CardDatabaseLoader v-if="showLoader" @ready="onLoaderReady" />
    </transition>

    <!-- ── Top bar ──────────────────────────────────────────────────── -->
    <header class="topbar">
      <a href="/" class="brand" @click.prevent="hardRefresh" aria-label="Rarebox home">
        <span class="brand-mark" aria-hidden="true">
          <svg width="32" height="32" viewBox="0 0 34 34"><rect x="5" y="5" width="27" height="27" rx="8" fill="var(--on-accent)"/><rect x="2.5" y="2.5" width="27" height="27" rx="8" fill="var(--accent)" stroke="var(--on-accent)" stroke-width="2.5"/><text x="16" y="21.5" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, sans-serif" font-size="12" font-weight="900" fill="var(--on-accent)">RB</text></svg>
        </span>
        <span class="brand-word">rarebox</span>
      </a>

      <nav class="topnav" aria-label="Primary">
        <router-link to="/" class="topnav-link" :class="{ active: isTab('home') }">Dashboard</router-link>
        <router-link to="/search" class="topnav-link" :class="{ active: isTab('search') }">Search</router-link>
        <router-link to="/sets" class="topnav-link" :class="{ active: isTab('browse') }">Browse</router-link>
        <router-link to="/decks" class="topnav-link" :class="{ active: isTab('decks') }">Decks</router-link>
        <router-link to="/trade" class="topnav-link" :class="{ active: isTab('trade') }">Trade</router-link>
      </nav>

      <div class="topbar-page" aria-hidden="true">
        {{ currentPageTitle }}
        <button v-if="currentTour" class="tour-info-btn" @click="replayTour" title="Watch tour video" aria-label="Watch tour video">i</button>
      </div>

      <div class="topbar-actions">
        <button v-if="currentTour" class="tour-info-btn tour-info-desktop" @click="replayTour" title="Watch tour video" aria-label="Watch tour video">i</button>
        <button class="btn btn-ghost btn-icon theme-btn" @click="toggleTheme" :aria-label="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'">
          <svg v-if="theme === 'dark'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
        </button>
        <router-link to="/search" class="btn btn-primary btn-sm add-card-btn">+ Add Card</router-link>
        <router-link to="/settings" class="btn btn-ghost btn-icon settings-btn" aria-label="Settings">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        </router-link>
      </div>
    </header>

    <!-- ── Main content ─────────────────────────────────────────────── -->
    <main class="main-content">
      <router-view v-slot="{ Component, route }">
        <transition name="fade" :duration="300">
          <component :is="Component" :key="route?.fullPath" />
        </transition>
      </router-view>
      <div class="app-footer">
        <router-link to="/terms" class="app-footer-link">Terms &amp; Conditions</router-link>
        <span class="app-footer-dot">·</span>
        <a href="https://docs.rarebox.io" target="_blank" rel="noopener" class="app-footer-link">Docs</a>
        <span class="app-footer-dot">·</span>
        <a href="https://github.com/novaoc/rarebox" target="_blank" rel="noopener" class="app-footer-link">GitHub</a>
      </div>
    </main>

    <!-- ── Bottom tab bar (phones / foldables / small tablets) ──────── -->
    <nav class="tabbar" aria-label="Primary">
      <router-link to="/" class="tab" :class="{ active: isTab('home') }">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="7" height="7" x="3" y="3" rx="1.5"/><rect width="7" height="7" x="14" y="3" rx="1.5"/><rect width="7" height="7" x="14" y="14" rx="1.5"/><rect width="7" height="7" x="3" y="14" rx="1.5"/></svg>
        <span>Home</span>
      </router-link>
      <router-link to="/search" class="tab" :class="{ active: isTab('search') }">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
        <span>Search</span>
      </router-link>
      <router-link to="/trade" class="tab tab-hero" :class="{ active: isTab('trade') }" aria-label="Trade analyzer">
        <span class="tab-hero-disc">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></svg>
        </span>
        <span>Trade</span>
      </router-link>
      <router-link to="/sets" class="tab" :class="{ active: isTab('browse') }">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.1 6.27a2 2 0 0 0 0 3.46l9.07 4.09a2 2 0 0 0 1.66 0l9.07-4.09a2 2 0 0 0 0-3.46z"/><path d="m2.1 14.74 9.07 4.09a2 2 0 0 0 1.66 0l9.07-4.09"/></svg>
        <span>Browse</span>
      </router-link>
      <button class="tab" :class="{ active: moreOpen }" @click="moreOpen = !moreOpen" aria-label="More options" :aria-expanded="moreOpen">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="1"/><circle cx="5" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>
        <span>More</span>
      </button>
    </nav>

    <!-- More sheet -->
    <transition name="fade">
      <div v-if="moreOpen" class="more-overlay" @click.self="moreOpen = false">
        <div class="more-sheet" role="menu">
          <router-link to="/decks" class="more-item" role="menuitem" @click="moreOpen = false">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 2h10"/><path d="M5 6h14"/><rect width="18" height="12" x="3" y="10" rx="2"/></svg>
            Decks
          </router-link>
          <button class="more-item" role="menuitem" @click="toggleTheme">
            <svg v-if="theme === 'dark'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
            <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
            {{ theme === 'dark' ? 'Light mode' : 'Dark mode' }}
          </button>
          <button class="more-item" role="menuitem" @click="moreOpen = false; showNewPortfolioModal = true">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            New Shelf
          </button>
          <router-link to="/settings" class="more-item" role="menuitem" @click="moreOpen = false">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 1v4m0 14v4m11-11h-4M5 12H1m17.66-6.34-2.83 2.83M8.17 15.17l-2.83 2.83m12.49 0-2.83-2.83M8.17 8.83 5.34 6"/></svg>
            Settings
          </router-link>
        </div>
      </div>
    </transition>

    <!-- New Portfolio Modal -->
    <transition name="fade">
      <div v-if="showNewPortfolioModal" class="modal-overlay" @click.self="showNewPortfolioModal = false">
        <div class="modal slide-up-enter-active">
          <div class="modal-header">
            <h3>New Shelf</h3>
            <button class="btn btn-ghost btn-icon" @click="showNewPortfolioModal = false" aria-label="Close modal">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label class="form-label">Name</label>
              <input v-model="newPortfolioName" class="input" placeholder="e.g. Base Set Collection" @keyup.enter="createPortfolio" />
            </div>
            <div class="form-group">
              <label class="form-label">Color</label>
              <div class="color-picker-row">
                <button
                  v-for="c in portfolioColors"
                  :key="c"
                  class="color-swatch"
                  :class="{ active: newPortfolioColor === c }"
                  :style="{ background: c }"
                  @click="newPortfolioColor = c"
                  :aria-label="'Select color ' + c"
                ></button>
              </div>
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="showNewPortfolioModal = false">Cancel</button>
            <button class="btn btn-primary" :disabled="!newPortfolioName.trim()" @click="createPortfolio">Create</button>
          </div>
        </div>
      </div>
    </transition>

    <InstallPrompt />

    <!-- Tour videos (replayable via info icon; theme-matched) -->
    <transition name="fade">
      <div v-if="!online" class="offline-chip" role="status">
        <span class="offline-dot" aria-hidden="true"></span>
        Offline — your shelf still works. Live prices &amp; new searches need a connection.
      </div>
    </transition>

    <TourModal v-if="showSetsTour" :key="tourKey + theme" :src="`/videos/sets-tour-${theme}.mp4`" storage-key="rarebox_sets_tour_seen" />
    <TourModal v-if="showDecksTour" :key="tourKey + theme" :src="`/videos/decks-tour-${theme}.mp4`" storage-key="rarebox_deck_tour_seen" />
    <TourModal v-if="showTradeTour" :key="tourKey + theme" :src="`/videos/trade-tour-${theme}.mp4`" storage-key="rarebox_trade_tour_seen" />

    <!-- Background card loading indicator -->
    <CardLoadIndicator ref="cardLoadIndicator" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onErrorCaptured } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePortfolioStore } from './stores/portfolio'
import InstallPrompt from './components/InstallPrompt.vue'
import TourModal from './components/TourModal.vue'
import CardDatabaseLoader from './components/CardDatabaseLoader.vue'
import CardLoadIndicator from './components/CardLoadIndicator.vue'
import { isCardDatabaseReady, buildSearchIndex, saveCardDatabaseReady, getTcgPrefs } from './services/tcg/cardCache.js'
import { preloadGames } from './services/tcg/cardPreloader.js'
import { applyTheme, setThemePref, getThemePref, resolvedTheme } from './utils/theme.js'

const store = usePortfolioStore()
const route = useRoute()
const router = useRouter()

const moreOpen = ref(false)
const theme = ref(resolvedTheme())

function toggleTheme() {
  // explicit user toggle overrides 'system'
  const next = theme.value === 'dark' ? 'light' : 'dark'
  theme.value = setThemePref(next)
}
window.addEventListener('rarebox-theme', e => { theme.value = e.detail })
applyTheme()

// Offline awareness — shelf/decks work offline; live prices and new
// card searches don't, so say so instead of failing silently.
const online = ref(navigator.onLine)
window.addEventListener('online', () => { online.value = true })
window.addEventListener('offline', () => { online.value = false })
const cardLoadIndicator = ref(null)
const showLoader = ref(!isCardDatabaseReady() && !getTcgPrefs())
const showNewPortfolioModal = ref(false)
const newPortfolioName = ref('')
const newPortfolioColor = ref('#ffd23f')
const showSetsTour = ref(false)
const showDecksTour = ref(false)
const showTradeTour = ref(false)
const tourKey = ref(0)

// Close the More sheet on navigation
watch(() => route.fullPath, () => { moreOpen.value = false })

// Which tab is lit for the current route
const TAB_FOR_ROUTE = {
  Dashboard: 'home', Portfolio: 'home',
  Search: 'search',
  Browse: 'browse', Sets: 'browse', TcgSets: 'browse',
  Decks: 'decks', MetaDecks: 'decks', DeckBuilder: 'decks',
  TradeLanding: 'trade', TradeAnalyzer: 'trade',
}
function isTab(tab) {
  return TAB_FOR_ROUTE[route.name] === tab
}

// Pages that have tour videos
const tourPages = {
  Browse: { storageKey: 'rarebox_sets_tour_seen', showRef: showSetsTour },
  Decks: { storageKey: 'rarebox_deck_tour_seen',  showRef: showDecksTour },
  TradeLanding:  { storageKey: 'rarebox_trade_tour_seen', showRef: showTradeTour },
  TradeAnalyzer: { storageKey: 'rarebox_trade_tour_seen', showRef: showTradeTour },
}

// First visit to a tour page auto-plays its tour once (TourModal marks the
// storage key seen). The ⓘ next to the page title replays it any time.
watch(() => route.name, (name) => {
  const tour = tourPages[name]
  if (tour && !localStorage.getItem(tour.storageKey)) {
    tourKey.value++
    tour.showRef.value = true
  }
}, { immediate: true })

const currentTour = computed(() => tourPages[route.name] || null)

function replayTour() {
  const tour = currentTour.value
  if (!tour) return
  localStorage.removeItem(tour.storageKey)
  tourKey.value++
  tour.showRef.value = true
}

const portfolioColors = [
  '#ffd23f', '#ff6ba9', '#2fbf71', '#4f86f7',
  '#e4434f', '#9a6cf5', '#1ec8c8', '#f08a3c'
]

const currentPageTitle = computed(() => {
  if (route.name === 'Dashboard') return 'Dashboard'
  if (route.name === 'Search') return 'Search Cards'
  if (route.name === 'Browse') return 'Browse Sets'
  if (route.name === 'Sets') return 'Pokémon Sets'
  if (route.name === 'TcgSets') return 'Browse Sets'
  if (route.name === 'Settings') return 'Settings'
  if (route.name === 'Terms') return 'Terms & Conditions'
  if (route.name === 'TradeAnalyzer' || route.name === 'TradeLanding') return 'Trade Analyzer'
  if (route.name === 'Portfolio') {
    const p = store.portfolios.find(p => p.id === route.params.id)
    return p?.name || 'Shelf'
  }
  return 'Rarebox'
})

function hardRefresh() {
  window.location.href = '/'
}

function createPortfolio() {
  if (!newPortfolioName.value.trim()) return
  const p = store.createPortfolio(newPortfolioName.value.trim(), newPortfolioColor.value)
  newPortfolioName.value = ''
  showNewPortfolioModal.value = false
  router.push(`/portfolio/${p.id}`)
}

async function onLoaderReady() {
  showLoader.value = false
  startBackgroundPreload()
}

function startBackgroundPreload() {
  const indicator = cardLoadIndicator.value
  const games = getTcgPrefs()
  if (!indicator || !games || games.length === 0) return
  indicator.start(games)
  preloadGames(games, ({ game, phase }) => {
    indicator.onProgress({ game, phase })
  }).then(async () => {
    await buildSearchIndex()
    saveCardDatabaseReady()
    indicator.finish()
  }).catch(() => indicator.finish())
}

onMounted(async () => {
  await store.init()
  store.autoSnapshot()

  if (!isCardDatabaseReady()) {
    if (getTcgPrefs()) {
      // TCGs already selected but preload didn't finish — resume silently
      startBackgroundPreload()
    }
    // First visit: loader shows (controlled by showLoader ref), preload starts on pick
    return
  }

  // Returning visitor: build search index from cached IDB data
  await buildSearchIndex()

  // Background preload slow TCGs if not yet cached
  startBackgroundPreload()
})

// Catch any child component errors so the app doesn't silently break
onErrorCaptured((err, instance, info) => {
  console.error('[App] Error captured:', err, info)
  // Don't suppress — let the error propagate
  return false
})
</script>

<style scoped>
.app-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

/* ── Top bar ────────────────────────────────────────────────────────── */
.topbar {
  position: sticky;
  top: 0;
  z-index: 60;
  display: flex;
  align-items: center;
  gap: 16px;
  /* installed PWAs draw under the phone status bar (iOS black-translucent,
     Android edge-to-edge) — pad the top bar clear of clock/battery */
  height: calc(var(--header-height) + env(safe-area-inset-top, 0px));
  padding: env(safe-area-inset-top, 0px) clamp(12px, 3vw, 28px) 0;
  background: var(--bg-primary);
  border-bottom: var(--bw) solid var(--ink);
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  text-decoration: none;
  flex-shrink: 0;
}
.brand:hover { text-decoration: none; }
.brand-mark { display: inline-flex; transform: rotate(-4deg); transition: transform 0.15s; }
.brand:hover .brand-mark { transform: rotate(3deg); }
.brand-word {
  font-size: 19px;
  font-weight: 900;
  letter-spacing: -0.03em;
  color: var(--ink);
}

.topnav { display: none; align-items: center; gap: 4px; }
.topnav-link {
  padding: 8px 14px;
  border-radius: 10px;
  border: var(--bw) solid transparent;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text-secondary);
  text-decoration: none;
  min-height: 40px;
  display: inline-flex;
  align-items: center;
}
.topnav-link:hover { color: var(--ink); text-decoration: none; background: var(--bg-hover); }
.topnav-link.active {
  color: var(--ink);
  background: var(--accent);
  border-color: var(--ink);
  box-shadow: var(--shadow-pressed);
}

.topbar-page {
  flex: 1;
  text-align: center;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.tour-info-btn {
  width: 22px; height: 22px;
  border-radius: 50%;
  border: var(--bw) solid var(--ink);
  background: var(--info);
  color: var(--on-info);
  font-size: 12px;
  font-weight: 800;
  font-style: italic;
  cursor: pointer;
  flex-shrink: 0;
}

.topbar-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
.tour-info-desktop { display: none; } /* mobile uses the one in .topbar-page */

/* ── Offline chip ───────────────────────────────────────────────────── */
.offline-chip {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(var(--tabbar-height) + env(safe-area-inset-bottom) + 12px);
  z-index: 300;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: calc(100vw - 32px);
  padding: 9px 16px;
  background: var(--ink);
  color: var(--bg-primary);
  border-radius: 999px;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.3;
}
.offline-dot {
  width: 9px; height: 9px;
  border-radius: 50%;
  background: var(--danger);
  flex-shrink: 0;
}
.add-card-btn { display: none; }
.settings-btn { display: none; }
.theme-btn { display: inline-flex; }

/* ── Main content ───────────────────────────────────────────────────── */
.main-content {
  flex: 1;
  width: 100%;
  max-width: 1240px;
  margin: 0 auto;
  padding: clamp(14px, 2.5vw, 28px);
  /* room for the bottom tab bar + iOS safe area */
  padding-bottom: calc(var(--tabbar-height) + env(safe-area-inset-bottom, 0px) + 24px);
}

.app-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 28px 0 8px;
  font-size: 12px;
  color: var(--text-muted);
}
.app-footer-link { color: var(--text-muted); }
.app-footer-link:hover { color: var(--ink); }
.app-footer-dot { opacity: 0.5; }

/* ── Bottom tab bar ─────────────────────────────────────────────────── */
.tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 70;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  height: calc(var(--tabbar-height) + env(safe-area-inset-bottom, 0px));
  padding: 6px 6px calc(6px + env(safe-area-inset-bottom, 0px));
  background: var(--bg-primary);
  border-top: var(--bw) solid var(--ink);
}

.tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  border: none;
  background: transparent;
  border-radius: 12px;
  font-size: 10.5px;
  font-weight: 800;
  color: var(--text-secondary);
  text-decoration: none;
  cursor: pointer;
  min-height: 44px;
  -webkit-tap-highlight-color: transparent;
}
.tab:hover { text-decoration: none; }
.tab.active { color: var(--ink); }
.tab.active > svg { background: var(--accent); border: var(--bw) solid var(--ink); border-radius: 9px; padding: 3px; width: 30px; height: 30px; box-shadow: var(--shadow-pressed); }
.tab > svg { padding: 4px; width: 30px; height: 30px; }

/* Center hero tab — the trade disc pops above the bar */
.tab-hero { position: relative; }
.tab-hero-disc {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  margin-top: -22px;
  border-radius: 50%;
  background: var(--pink);
  border: var(--bw) solid var(--on-accent);
  box-shadow: var(--shadow-xs);
  color: var(--on-accent);
}
.tab-hero.active .tab-hero-disc { background: var(--accent); }
.tab-hero:active .tab-hero-disc { box-shadow: var(--shadow-pressed); transform: translate(1px, 1px); }

/* ── More sheet ─────────────────────────────────────────────────────── */
.more-overlay {
  position: fixed;
  inset: 0;
  z-index: 65;
  background: rgba(20, 20, 20, 0.35);
}
.more-sheet {
  position: absolute;
  right: 10px;
  bottom: calc(var(--tabbar-height) + env(safe-area-inset-bottom, 0px) + 10px);
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--bg-primary);
  border: var(--bw) solid var(--ink);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow);
  padding: 8px;
  min-width: 200px;
}
.more-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  min-height: 46px;
  border: none;
  background: transparent;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 700;
  color: var(--ink);
  text-decoration: none;
  cursor: pointer;
  text-align: left;
}
.more-item:hover { background: var(--accent-dim); text-decoration: none; }

/* ── Color swatches (new portfolio modal) ───────────────────────────── */
.color-picker-row { display: flex; gap: 10px; flex-wrap: wrap; }
.color-swatch {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  border: var(--bw) solid var(--ink);
  cursor: pointer;
  transition: transform 0.12s;
}
.color-swatch:hover { transform: scale(1.1); }
.color-swatch.active {
  box-shadow: var(--shadow-xs);
  transform: scale(1.12);
}

/* ── Desktop ≥1024px: top nav on, tab bar off ───────────────────────── */
@media (min-width: 1024px) {
  .topnav { display: flex; }
  .topbar-page { display: none; }
  .tour-info-desktop { display: inline-flex; align-items: center; justify-content: center; }
  .offline-chip { bottom: 20px; }
  .add-card-btn { display: inline-flex; }
  .settings-btn { display: inline-flex; }
  .tabbar { display: none; }
  .more-overlay { display: none; }
  .main-content { padding-bottom: 28px; }
}

/* Compact phones */
@media (max-width: 360px) {
  .brand-word { display: none; }
}
</style>
