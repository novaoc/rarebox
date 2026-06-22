<!--
  Rarebox — Pokémon TCG Portfolio Tracker
  Built by Nova — GitHub: @novaoc
  https://rarebox.io
-->
<template>
  <div class="app-layout">
    <aside class="sidebar" :class="{ open: sidebarOpen }">
      <a href="/" class="sidebar-logo" @click.prevent="hardRefresh">
        <span class="logo-icon">⬡</span>
        <span class="logo-text">Rarebox</span>
      </a>
      <button class="btn btn-ghost btn-icon sidebar-close" @click="sidebarOpen = false" style="position:absolute;top:20px;right:12px;z-index:10">✕</button>

      <nav class="sidebar-nav">
        <router-link to="/" class="nav-item" @click="sidebarOpen = false">
          <span class="nav-icon">⊞</span> Dashboard
        </router-link>
        <router-link to="/search" class="nav-item" @click="sidebarOpen = false">
          <span class="nav-icon">⌕</span> Search Cards
        </router-link>
        <router-link to="/sets" class="nav-item" @click="sidebarOpen = false">
          <span class="nav-icon">◫</span> Browse Sets
        </router-link>
        <router-link to="/decks" class="nav-item" @click="sidebarOpen = false">
          <span class="nav-icon">🃏</span> Decks
        </router-link>
      </nav>

      <div class="sidebar-section-label">Portfolios</div>

      <nav class="sidebar-nav portfolios-nav">
        <router-link
          v-for="p in store.portfolios"
          :key="p.id"
          :to="`/portfolio/${p.id}`"
          class="nav-item portfolio-nav-item"
          @click="sidebarOpen = false"
        >
          <span class="portfolio-dot" :style="{ background: p.color }"></span>
          <span class="portfolio-nav-name">{{ p.name }}</span>
          <span class="portfolio-nav-count">{{ p.items.length }}</span>
        </router-link>

        <button class="nav-item add-portfolio-btn" @click="showNewPortfolioModal = true">
          <span class="nav-icon">＋</span> New Portfolio
        </button>
      </nav>

      <div class="sidebar-bottom">
        <router-link to="/settings" class="nav-item" @click="sidebarOpen = false">
          <span class="nav-icon">⚙</span> Settings
        </router-link>
      </div>
    </aside>

    <div class="main-wrapper">
      <header class="topbar">
        <button class="btn btn-ghost btn-icon hamburger" @click="sidebarOpen = !sidebarOpen">
          ☰
        </button>
        <div class="topbar-breadcrumb">
          {{ currentPageTitle }}
          <button v-if="currentTour" class="tour-info-btn" @click="replayTour" title="Watch tour video">i</button>
        </div>
        <router-link to="/search" class="btn btn-primary btn-sm">
          + Add Card
        </router-link>
      </header>

      <main class="main-content">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
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
    </div>

    <!-- New Portfolio Modal -->
    <transition name="fade">
      <div v-if="showNewPortfolioModal" class="modal-overlay" @click.self="showNewPortfolioModal = false">
        <div class="modal slide-up-enter-active">
          <div class="modal-header">
            <h3>New Portfolio</h3>
            <button class="btn btn-ghost btn-icon" @click="showNewPortfolioModal = false">✕</button>
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
    <QuickAddMenu />

    <!-- Tour videos (replayable via info icon) -->
    <TourModal v-if="showSetsTour" :key="tourKey" src="/videos/sets-tour.mp4" storage-key="rarebox_sets_tour_seen" />
    <TourModal v-if="showDecksTour" :key="tourKey" src="/videos/decks-tour.mp4" storage-key="rarebox_deck_tour_seen" />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePortfolioStore } from './stores/portfolio'
import InstallPrompt from './components/InstallPrompt.vue'
import TourModal from './components/TourModal.vue'
import QuickAddMenu from './components/QuickAddMenu.vue'

const store = usePortfolioStore()
const route = useRoute()
const router = useRouter()

const sidebarOpen = ref(false)
const showNewPortfolioModal = ref(false)
const newPortfolioName = ref('')
const newPortfolioColor = ref('#f5a623')
const showSetsTour = ref(false)
const showDecksTour = ref(false)
const tourKey = ref(0)

// Pages that have tour videos
const tourPages = {
  Sets:  { storageKey: 'rarebox_sets_tour_seen',  showRef: showSetsTour },
  Decks: { storageKey: 'rarebox_deck_tour_seen',  showRef: showDecksTour },
}

const currentTour = computed(() => tourPages[route.name] || null)

function replayTour() {
  const tour = currentTour.value
  if (!tour) return
  localStorage.removeItem(tour.storageKey)
  tourKey.value++
  tour.showRef.value = true
}

const portfolioColors = [
  '#f5a623', '#58a6ff', '#3fb950', '#f85149',
  '#bc8cff', '#ff7b72', '#79c0ff', '#56d364'
]

const currentPageTitle = computed(() => {
  if (route.name === 'Dashboard') return 'Dashboard'
  if (route.name === 'Search') return 'Search Cards'
  if (route.name === 'Sets') return 'Browse Sets'
  if (route.name === 'Settings') return 'Settings'
  if (route.name === 'Terms') return 'Terms & Conditions'
  if (route.name === 'Portfolio') {
    const p = store.portfolios.find(p => p.id === route.params.id)
    return p?.name || 'Portfolio'
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

onMounted(async () => {
  await store.init()
  store.autoSnapshot() // record daily price snapshot for chart history
})
</script>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

/* Sidebar */
.sidebar {
  width: var(--sidebar-width);
  min-width: var(--sidebar-width);
  background: var(--bg-secondary);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overflow-x: hidden;
  flex-shrink: 0;
  transition: transform 0.25s ease;
  position: relative;
}

.sidebar-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 20px 16px 16px;
  border-bottom: 1px solid var(--border);
  text-decoration: none;
  cursor: pointer;
  transition: opacity 0.15s;
}
.sidebar-logo:hover { opacity: 0.8; }
.logo-icon {
  font-size: 22px;
  color: var(--accent);
  display: inline-block;
  animation: logo-float 3s ease-in-out infinite;
}
@keyframes logo-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-4px); }
}
.logo-text { font-size: 18px; font-weight: 700; color: var(--text-primary); flex: 1; }
.sidebar-close { display: none; }

.sidebar-nav {
  display: flex;
  flex-direction: column;
  padding: 8px;
  gap: 2px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: var(--radius);
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 13px;
  font-weight: 500;
  border: none;
  background: none;
  cursor: pointer;
  transition: all 0.15s;
  width: 100%;
  text-align: left;
}
.nav-item:hover { background: var(--bg-hover); color: var(--text-primary); text-decoration: none; }
.nav-item.router-link-active {
  background: var(--accent-dim);
  color: var(--accent);
}
.nav-icon { font-size: 15px; width: 18px; text-align: center; flex-shrink: 0; }

.sidebar-section-label {
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text-muted);
  padding: 12px 18px 4px;
}

.portfolios-nav { max-height: none; flex: 1; }

.portfolio-nav-item { justify-content: flex-start; }
.portfolio-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.portfolio-nav-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.portfolio-nav-count {
  font-size: 11px;
  background: var(--bg-hover);
  padding: 1px 6px;
  border-radius: 10px;
  color: var(--text-muted);
  flex-shrink: 0;
}
.add-portfolio-btn { color: var(--text-muted); font-size: 12px; }
.add-portfolio-btn:hover { color: var(--accent); }

.sidebar-bottom {
  padding: 8px;
  border-top: 1px solid var(--border);
  margin-top: auto;
}

/* Main content */
.main-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-width: 0;
}

.topbar {
  height: var(--header-height);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 12px;
  flex-shrink: 0;
}

/* iOS PWA — pad below the status bar */
@supports (padding-top: env(safe-area-inset-top)) {
  .topbar {
    padding-top: env(safe-area-inset-top);
    min-height: calc(var(--header-height) + env(safe-area-inset-top));
  }
}
.topbar-breadcrumb {
  flex: 1;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.tour-info-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 1.5px solid var(--text-muted);
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
  line-height: 1;
}

.tour-info-btn:hover {
  background: var(--accent-dim);
  color: var(--accent);
  border-color: var(--accent);
}
.hamburger { display: none; }

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.app-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 0 8px;
  margin-top: 16px;
}
.app-footer-link {
  font-size: 11px;
  color: var(--text-muted);
  text-decoration: none;
}
.app-footer-link:hover { color: var(--text-secondary); text-decoration: none; }
.app-footer-dot { font-size: 11px; color: var(--text-muted); }

/* Color picker */
.color-picker-row { display: flex; gap: 8px; flex-wrap: wrap; }
.color-swatch {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 3px solid transparent;
  cursor: pointer;
  transition: transform 0.15s;
}
.color-swatch:hover { transform: scale(1.15); }
.color-swatch.active { border-color: white; transform: scale(1.1); }

/* Mobile */
@media (max-width: 768px) {
  .sidebar {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    z-index: 200;
    transform: translateX(-100%);
    width: 260px;
    min-width: 260px;
  }
  .sidebar.open { transform: translateX(0); }
  .sidebar-close { display: flex; }
  .hamburger { display: flex; }
  .main-content { padding: 16px; }
}

/* iOS PWA safe areas */
@supports (padding-top: env(safe-area-inset-top)) {
  .sidebar-logo {
    padding-top: env(safe-area-inset-top);
  }
  .main-content {
    padding-bottom: env(safe-area-inset-bottom, 0);
  }
}
</style>
