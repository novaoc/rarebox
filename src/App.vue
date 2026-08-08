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
      <CardDatabaseLoader v-if="showLoader && !isBoothRoute" @ready="onLoaderReady" />
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
        <router-link to="/booth" class="topnav-link" :class="{ active: isTab('booth') }">Booth</router-link>
      </nav>

      <div class="topbar-page">
        {{ currentPageTitle }}
        <button v-if="currentTour" class="tour-info-btn" @click="replayTour" title="Watch tour video" aria-label="Watch tour video">i</button>
      </div>

      <div class="topbar-actions">
        <button v-if="currentTour" class="tour-info-btn tour-info-desktop" @click="replayTour" title="Watch tour video" aria-label="Watch tour video">i</button>
        <button class="btn btn-ghost btn-icon theme-btn" @click="toggleTheme" :aria-label="theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'">
          <svg v-if="theme === 'dark'" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
          <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>
        </button>
        <!-- Desktop "+ Add": same three actions as the phone disc's fan.
             Scan works here too — the viewfinder falls back to file upload
             when there's no webcam. -->
        <div class="add-menu-wrap add-card-btn">
          <button class="btn btn-primary btn-sm" :aria-expanded="addMenuOpen" aria-haspopup="menu" @click="addMenuOpen = !addMenuOpen">+ Add</button>
          <transition name="fade">
            <div v-if="addMenuOpen" class="add-menu" role="menu" aria-label="Add to your shelf">
              <button class="add-menu-item" role="menuitem" @click="fanScan">
                <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
                Scan card
              </button>
              <button class="add-menu-item" role="menuitem" @click="fanGo('/search')">
                <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                Search
              </button>
              <button class="add-menu-item" role="menuitem" @click="fanSealed">
                <svg xmlns="http://www.w3.org/2000/svg" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
                Sealed
              </button>
            </div>
          </transition>
        </div>
        <router-link to="/settings" class="btn btn-ghost btn-icon settings-btn" aria-label="Settings">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
        </router-link>
      </div>
    </header>

    <!-- ── Main content ─────────────────────────────────────────────── -->
    <main class="main-content">
      <router-view v-slot="{ Component, route }">
        <transition name="fade" :duration="300">
          <component :is="Component" :key="route?.fullPath" @create-portfolio="showNewPortfolioModal = true" />
        </transition>
      </router-view>
      <div class="app-footer">
        <router-link to="/terms" class="app-footer-link">Terms &amp; Conditions</router-link>
        <span class="app-footer-dot">·</span>
        <a href="https://docs.rarebox.io" target="_blank" rel="noopener" class="app-footer-link">Docs</a>
        <span class="app-footer-dot">·</span>
        <a href="https://github.com/novaoc/rarebox" target="_blank" rel="noopener" class="app-footer-link">GitHub</a>
        <p class="app-footer-ip">
          Card images © their respective owners (The Pokémon Company, Wizards of the
          Coast, Konami, Disney, Bandai, Riot Games) — used for identification and
          personal collection tracking only. Rarebox is unaffiliated fan software.
        </p>
      </div>
    </main>

    <!-- ── Bottom tab bar (phones / foldables / small tablets) ──────── -->
    <!-- Home · Shelf · Add(disc) · Sets · Trade — the disc is the app's
         most reachable control, so it carries the most frequent action:
         adding. Trade is a standard tab; "More" is gone (its contents
         live in the top bar, Home, and the Sets hub). -->
    <nav class="tabbar" aria-label="Primary">
      <router-link to="/" class="tab" :class="{ active: isTab('home') }">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="7" height="7" x="3" y="3" rx="1.5"/><rect width="7" height="7" x="14" y="3" rx="1.5"/><rect width="7" height="7" x="14" y="14" rx="1.5"/><rect width="7" height="7" x="3" y="14" rx="1.5"/></svg>
        <span>Home</span>
      </router-link>
      <component :is="shelfTabTo ? 'router-link' : 'button'" :to="shelfTabTo || undefined" class="tab" :class="{ active: isTab('shelf') }" @click="!shelfTabTo && (showNewPortfolioModal = true)">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16v4H4z"/><path d="M4 12h16v4H4z"/><path d="M7 8v4"/><path d="M17 8v4"/><path d="M4 20h16"/></svg>
        <span>Shelf</span>
      </component>
      <button class="tab tab-hero" :aria-expanded="fanOpen" aria-label="Add to your shelf" @click="toggleFan">
        <span class="tab-hero-disc" :class="{ open: fanOpen }">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
        </span>
        <span>Add</span>
        <!-- One-time retrain callout (R2): Trade lived here for three releases -->
        <span v-if="showDiscCallout" class="sticker sticker-pink disc-callout" aria-hidden="true">Add lives here now</span>
      </button>
      <router-link to="/sets" class="tab" :class="{ active: isTab('browse') }">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m12.83 2.18a2 2 0 0 0-1.66 0L2.1 6.27a2 2 0 0 0 0 3.46l9.07 4.09a2 2 0 0 0 1.66 0l9.07-4.09a2 2 0 0 0 0-3.46z"/><path d="m2.1 14.74 9.07 4.09a2 2 0 0 0 1.66 0l9.07-4.09"/></svg>
        <span>Sets</span>
      </router-link>
      <router-link to="/trade" class="tab" :class="{ active: isTab('trade') }">
        <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3 4 7l4 4"/><path d="M4 7h16"/><path d="m16 21 4-4-4-4"/><path d="M20 17H4"/></svg>
        <span>Trade</span>
      </router-link>
    </nav>

    <!-- Add fan: scrim + three sticker-buttons springing from the disc.
         Search is the universal path; Sealed jumps straight to the sealed
         add flow; Scan identifies a card from the camera. -->
    <transition name="fade">
      <div v-if="fanOpen" class="fan-overlay" @click.self="fanOpen = false">
        <div class="fan" role="menu" aria-label="Add to your shelf">
          <button class="fan-btn" role="menuitem" style="--fan-i: 0" @click="fanScan">
            <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
            Scan card
          </button>
          <button class="fan-btn" role="menuitem" style="--fan-i: 1" @click="fanGo('/search')">
            <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            Search
          </button>
          <button class="fan-btn" role="menuitem" style="--fan-i: 2" @click="fanSealed">
            <svg xmlns="http://www.w3.org/2000/svg" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>
            Sealed
          </button>
        </div>
      </div>
    </transition>

    <!-- Scan-to-add: camera → identify → prefilled add modal -->
    <ScanAddModal v-if="scanOpen" @close="scanOpen = false" />

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
    <XFollowPrompt v-if="!isBoothRoute" />

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
    <TourModal v-if="showBoothTour" :key="tourKey + theme" :src="`/videos/booth-tour-${theme}.mp4`" storage-key="rarebox_booth_tour_seen" />

    <!-- Background card loading indicator -->
    <CardLoadIndicator v-show="!isBoothRoute" ref="cardLoadIndicator" />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onErrorCaptured } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePortfolioStore } from './stores/portfolio'
import { useDeckStore } from './stores/decks'
import InstallPrompt from './components/InstallPrompt.vue'
import XFollowPrompt from './components/XFollowPrompt.vue'
import TourModal from './components/TourModal.vue'
import CardDatabaseLoader from './components/CardDatabaseLoader.vue'
import CardLoadIndicator from './components/CardLoadIndicator.vue'
import ScanAddModal from './components/ScanAddModal.vue'
import { isCardDatabaseReady, buildSearchIndex, saveCardDatabaseReady, getTcgPrefs, saveTcgPrefs } from './services/tcg/cardCache.js'
import { preloadGames } from './services/tcg/cardPreloader.js'
import { applyTheme, setThemePref, getThemePref, resolvedTheme } from './utils/theme.js'

const store = usePortfolioStore()
const deckStore = useDeckStore()
const route = useRoute()
const router = useRouter()

const fanOpen = ref(false)
const addMenuOpen = ref(false)
const scanOpen = ref(false)
const theme = ref(resolvedTheme())

// Desktop add-menu closes on any click outside its wrapper
document.addEventListener('click', (e) => {
  if (addMenuOpen.value && !e.target.closest?.('.add-menu-wrap')) addMenuOpen.value = false
})

// Shelf tab: the active shelf (or the first one). With no shelves the tab
// offers to create one instead of leading nowhere.
const shelfTabTo = computed(() => {
  const id = store.activePortfolioId || store.portfolios[0]?.id
  return id ? `/shelf/${id}` : null
})

// One-time muscle-memory callout: the disc was Trade for three releases.
// Shows for the first three sessions after the switch, then never again.
const DISC_CALLOUT_KEY = 'rarebox_add_disc_callout'
const showDiscCallout = ref(false)
try {
  const seen = Number(localStorage.getItem(DISC_CALLOUT_KEY) || 0)
  if (seen < 3) {
    showDiscCallout.value = true
    localStorage.setItem(DISC_CALLOUT_KEY, String(seen + 1))
  }
} catch { /* private mode */ }

function toggleFan() {
  fanOpen.value = !fanOpen.value
  if (fanOpen.value) showDiscCallout.value = false
}
function fanGo(path) {
  fanOpen.value = false
  addMenuOpen.value = false
  router.push(path)
}
function fanScan() {
  fanOpen.value = false
  addMenuOpen.value = false
  scanOpen.value = true
}
function fanSealed() {
  fanOpen.value = false
  addMenuOpen.value = false
  const id = store.activePortfolioId || store.portfolios[0]?.id
  // The sealed add flow lives on a shelf; without one, search still works
  router.push(id ? `/shelf/${id}?add=sealed` : '/search')
}

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
// Arriving through a booth share (#b=/#d=) means the visitor came for the
// listings, not for setup decisions: select every game silently so the card
// database downloads in the background — they'll need all of it to browse
// booths anyway, and the picker would just be in the way.
const isBoothShareArrival = window.location.pathname.startsWith('/booth') && /[#&][bd]=/.test(window.location.hash)
if (isBoothShareArrival && !getTcgPrefs()) {
  saveTcgPrefs(['pokemon', 'mtg', 'lorcana', 'one-piece', 'yugioh', 'riftbound'])
}

const showLoader = ref(!isCardDatabaseReady() && !getTcgPrefs())
// Booth pages stay popup-free: someone opening a shared booth (or hopping
// between scanned booths) shouldn't be asked to download card databases
const isBoothRoute = computed(() => route.path.startsWith('/booth'))
const showNewPortfolioModal = ref(false)
const newPortfolioName = ref('')
const newPortfolioColor = ref('#ffd23f')
const showSetsTour = ref(false)
const showDecksTour = ref(false)
const showTradeTour = ref(false)
const showBoothTour = ref(false)
const tourKey = ref(0)

// Close the fan + add menu on navigation
watch(() => route.fullPath, () => { fanOpen.value = false; addMenuOpen.value = false })

// Which tab is lit for the current route
const TAB_FOR_ROUTE = {
  Dashboard: 'home', Portfolio: 'shelf',
  Search: 'search',
  Browse: 'browse', Sets: 'browse', TcgSets: 'browse',
  Decks: 'decks', MetaDecks: 'decks', DeckBuilder: 'decks',
  TradeLanding: 'trade', TradeAnalyzer: 'trade',
  Booth: 'booth', BoothEdit: 'booth', BoothDisplay: 'booth', BoothTable: 'booth',
  Settings: 'settings', Terms: 'terms', ShelfGuide: 'home',
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
  Booth: { storageKey: 'rarebox_booth_tour_seen', showRef: showBoothTour },
}

// First visit to a tour page auto-plays its tour once (TourModal marks the
// storage key seen). The ⓘ next to the page title replays it any time.
watch(() => route.name, (name) => {
  const tour = tourPages[name]
  if (!tour) return
  // Booth tour belongs to the hub ("Your table, in their pocket") only —
  // someone opening a shared booth or directory came to see the listings,
  // not a tutorial about a feature they don't use yet
  if (name === 'Booth' && /[#&][bd]=/.test(window.location.hash)) return
  if (!localStorage.getItem(tour.storageKey)) {
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
  if (route.name === 'Portfolio') {
    const p = store.portfolios.find(p => p.id === route.params.id)
    return p?.name || 'Shelf'
  }
  if (route.name === 'DeckBuilder') {
    const d = deckStore.decks.find(d => d.id === route.params.id)
    return d?.name || 'Deck Builder'
  }
  return route.meta?.title || 'Rarebox'
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

/* ── Desktop add menu — the fan's three actions, dropdown posture ───── */
.add-menu-wrap { position: relative; }
.add-menu {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  z-index: 80;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 170px;
  padding: 8px;
  background: var(--bg-card);
  border: var(--bw) solid var(--ink);
  border-radius: var(--radius);
  box-shadow: var(--shadow-sm);
}
.add-menu-item {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  min-height: 44px;
  padding: 10px 12px;
  background: transparent;
  border: none;
  border-radius: 10px;
  font-size: 13.5px;
  font-weight: 800;
  color: var(--ink);
  text-align: left;
  cursor: pointer;
}
.add-menu-item:hover { background: var(--bg-hover); }
.add-menu-item:active { background: var(--accent-dim); }
/* With the More sheet gone, Settings lives in the top bar on every size */
.settings-btn { display: inline-flex; }
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
  flex-wrap: wrap;
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
.app-footer-ip {
  flex-basis: 100%;
  margin: 6px auto 0;
  max-width: 560px;
  padding: 0 16px;
  text-align: center;
  font-size: 10.5px;
  line-height: 1.5;
  opacity: 0.75;
}

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

/* Center hero tab — the Add disc pops above the bar */
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
  transition: transform 0.18s;
}
.tab-hero-disc.open { transform: rotate(45deg); } /* + becomes × */
.tab-hero:active .tab-hero-disc { box-shadow: var(--shadow-pressed); transform: translate(1px, 1px); }
.tab-hero:active .tab-hero-disc.open { transform: rotate(45deg) translate(1px, 1px); }

.disc-callout {
  position: absolute;
  bottom: calc(100% + 10px);
  left: 50%;
  transform: translateX(-50%) rotate(-2deg);
  white-space: nowrap;
  font-size: 11px;
  pointer-events: none;
}

/* ── Add fan ────────────────────────────────────────────────────────── */
.fan-overlay {
  position: fixed;
  inset: 0;
  z-index: 65;
  background: rgba(20, 20, 20, 0.35);
}
.fan {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(var(--tabbar-height) + env(safe-area-inset-bottom, 0px) + 22px);
  display: flex;
  gap: 10px;
}
.fan-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 12px 15px;
  min-height: 46px;
  background: var(--bg-card);
  border: var(--bw) solid var(--ink);
  border-radius: 999px;
  box-shadow: var(--shadow-sm);
  font-size: 13.5px;
  font-weight: 800;
  color: var(--ink);
  cursor: pointer;
  animation: fan-spring 0.22s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  animation-delay: calc(var(--fan-i) * 50ms);
}
.fan-btn:active { box-shadow: var(--shadow-pressed); transform: translate(1px, 1px); }
@keyframes fan-spring {
  from { opacity: 0; transform: translateY(14px) scale(0.9); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .fan-btn { animation: none; }
  .tab-hero-disc { transition: none; }
}

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
  .fan-overlay { display: none; }
  .main-content { padding-bottom: 28px; }
}

/* Compact phones */
@media (max-width: 360px) {
  .brand-word { display: none; }
}
</style>
