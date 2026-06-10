import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'Dashboard', component: () => import('../views/DashboardView.vue'), meta: { title: 'Dashboard', description: 'Track your TCG collection — Pokémon, Magic, Yu-Gi-Oh!, Lorcana, One Piece, and Riftbound. Live prices, shelf charts, and gain/loss.' } },
  { path: '/search', name: 'Search', component: () => import('../views/SearchView.vue'), meta: { title: 'Search Cards', description: 'Search any card across Pokémon, Magic, Yu-Gi-Oh!, Lorcana, One Piece, and Riftbound. Live market prices and price history charts.' } },
  { path: '/sets', name: 'Browse', component: () => import('../views/BrowseView.vue'), meta: { title: 'Browse Sets', description: 'Browse trading card games — Pokémon, Magic, Yu-Gi-Oh!, One Piece, Lorcana and more. Explore sets, cards and live prices.' } },
  { path: '/sets/pokemon', name: 'Sets', component: () => import('../views/SetsView.vue'), meta: { title: 'Pokémon Sets', description: 'Browse every Pokémon TCG set. View cards, release dates, and card counts.' } },
  { path: '/sets/:game', name: 'TcgSets', component: () => import('../views/TcgSetsView.vue'), meta: { title: 'Browse Sets', description: 'Browse sets and cards with live prices.' } },  // ⚠ must be AFTER /sets/pokemon
  { path: '/portfolio/:id', name: 'Portfolio', component: () => import('../views/PortfolioView.vue'), meta: { title: 'Shelf', description: 'View shelf items, value charts, gain/loss, and manage your collection.' } },
  { path: '/decks', name: 'Decks', component: () => import('../views/DeckListView.vue'), meta: { title: 'Decks', description: 'Build and track Pokémon TCG decks. Compare against your collection and see what you still need.' } },
  { path: '/decks/meta', name: 'MetaDecks', component: () => import('../views/MetaDecksView.vue'), meta: { title: 'Meta Decks', description: 'Browse popular competitive Pokémon TCG decks. Import with one click.' } },
  { path: '/decks/:id', name: 'DeckBuilder', component: () => import('../views/DeckBuilderView.vue'), meta: { title: 'Deck Builder', description: 'Build your deck, track card ownership, and calculate costs.' } },
  { path: '/settings', name: 'Settings', component: () => import('../views/SettingsView.vue'), meta: { title: 'Settings', description: 'Export data, manage backups, transfer to device, and configure alerts.' } },
  { path: '/trade', name: 'TradeLanding', component: () => import('../views/TradeLanding.vue'), meta: { title: 'Trade Analyzer', description: 'Compare card values and analyze trades side-by-side. Add cards by searching or scanning.' } },
  { path: '/trade/analyzer', name: 'TradeAnalyzer', component: () => import('../views/TradeAnalyzerView.vue'), meta: { title: 'Trade Analyzer', description: 'Compare cards side-by-side. Scan or add cards to each side and see the price difference instantly.' } },
  { path: '/terms', name: 'Terms', component: () => import('../views/TermsView.vue'), meta: { title: 'Terms & Conditions', description: 'Terms & Conditions and Privacy Policy for Rarebox.' } },
  // ── Design prototypes (branch: Design) — standalone, no app chrome ──
  { path: '/designs', name: 'Designs', component: () => import('../views/designs/DesignsIndexView.vue'), meta: { bare: true, title: 'Design Lab' } },
  { path: '/designs/mono', name: 'DesignMono', component: () => import('../views/designs/DesignMonoView.vue'), meta: { bare: true, title: 'Design — Mono' } },
  { path: '/designs/aurora', name: 'DesignAurora', component: () => import('../views/designs/DesignAuroraView.vue'), meta: { bare: true, title: 'Design — Aurora' } },
  { path: '/designs/tactile', name: 'DesignTactile', component: () => import('../views/designs/DesignTactileView.vue'), meta: { bare: true, title: 'Design — Tactile' } },
  { path: '/designs/atelier', name: 'DesignAtelier', component: () => import('../views/designs/DesignAtelierView.vue'), meta: { bare: true, title: 'Design — Atelier' } },
  { path: '/designs/pulse', name: 'DesignPulse', component: () => import('../views/designs/DesignPulseView.vue'), meta: { bare: true, title: 'Design — Pulse' } },
  // Shelf alias — friendly URL for portfolio pages
  { path: '/shelf/:id', redirect: to => ({ path: '/portfolio/' + to.params.id }) },
  // 404 catch-all — redirect to dashboard
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (to) => to.hash
    ? { el: to.hash, top: 76, behavior: 'smooth' }
    : { top: 0 }
})

// Catch navigation errors so transitions don't silently hang
router.onError((err) => {
  console.error('Navigation error:', err)
})

// Log store state on each navigation for diagnostics
router.beforeEach((to, from) => {
  if (from.path !== to.path) {
    console.log(`[nav] ${from.path} → ${to.path}`)
  }
})

// Update document title and meta description on navigation
router.afterEach((to) => {
  console.log(`[nav] arrived at ${to.path}`)
  const title = to.meta.title || 'Dashboard'
  document.title = `${title} — Rarebox`

  // Update meta description
  let desc = document.querySelector('meta[name="description"]')
  if (!desc) {
    desc = document.createElement('meta')
    desc.setAttribute('name', 'description')
    document.head.appendChild(desc)
  }
  desc.setAttribute('content', to.meta.description || 'Track your TCG collection — Pokémon, Magic, Yu-Gi-Oh!, Lorcana, One Piece, and Riftbound. Live prices and shelf charts.')

  // Update OG tags
  let ogTitle = document.querySelector('meta[property="og:title"]')
  if (ogTitle) ogTitle.setAttribute('content', `${title} — Rarebox`)
  let ogDesc = document.querySelector('meta[property="og:description"]')
  if (ogDesc) ogDesc.setAttribute('content', to.meta.description || 'Track your TCG collection — Pokémon, Magic, Yu-Gi-Oh!, Lorcana, One Piece, and Riftbound. Live prices and shelf charts.')
})

export default router
