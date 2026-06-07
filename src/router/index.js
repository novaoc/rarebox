import { createRouter, createWebHashHistory } from 'vue-router'

const routes = [
  { path: '/', name: 'Dashboard', component: () => import('../views/DashboardView.vue'), meta: { title: 'Dashboard', description: 'Track your Pokémon TCG collection — live prices, portfolio charts, and gain/loss across all your portfolios.' } },
  { path: '/mockup', name: 'Mockup', component: () => import('../views/MockDashboard.vue'), meta: { title: 'New Dashboard Mockup', description: 'Prototype of the new dark-themed dashboard interface.' } },
  { path: '/search', name: 'Search', component: () => import('../views/SearchView.vue'), meta: { title: 'Search Cards', description: 'Search any Pokémon card across all sets. Live TCGPlayer prices and price history charts.' } },
  { path: '/sets', name: 'Sets', component: () => import('../views/SetsView.vue'), meta: { title: 'Browse Sets', description: 'Browse every Pokémon TCG set. View cards, release dates, and card counts.' } },
  { path: '/portfolio/:id', name: 'Portfolio', component: () => import('../views/PortfolioView.vue'), meta: { title: 'Portfolio', description: 'View portfolio items, value charts, gain/loss, and manage your collection.' } },
  { path: '/decks', name: 'Decks', component: () => import('../views/DeckListView.vue'), meta: { title: 'Decks', description: 'Build and track Pokémon TCG decks. Compare against your collection and see what you still need.' } },
  { path: '/decks/meta', name: 'MetaDecks', component: () => import('../views/MetaDecksView.vue'), meta: { title: 'Meta Decks', description: 'Browse popular competitive Pokémon TCG decks. Import with one click.' } },
  { path: '/decks/:id', name: 'DeckBuilder', component: () => import('../views/DeckBuilderView.vue'), meta: { title: 'Deck Builder', description: 'Build your deck, track card ownership, and calculate costs.' } },
  { path: '/settings', name: 'Settings', component: () => import('../views/SettingsView.vue'), meta: { title: 'Settings', description: 'Export data, manage backups, transfer to device, and configure alerts.' } },
  { path: '/terms', name: 'Terms', component: () => import('../views/TermsView.vue'), meta: { title: 'Terms & Conditions', description: 'Terms & Conditions and Privacy Policy for Rarebox.' } },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

// Update document title and meta description on navigation
router.afterEach((to) => {
  const title = to.meta.title || 'Dashboard'
  document.title = `${title} — Rarebox`

  // Update meta description
  let desc = document.querySelector('meta[name="description"]')
  if (!desc) {
    desc = document.createElement('meta')
    desc.setAttribute('name', 'description')
    document.head.appendChild(desc)
  }
  desc.setAttribute('content', to.meta.description || 'Track your Pokémon TCG collection with live prices and portfolio charts.')

  // Update OG tags
  let ogTitle = document.querySelector('meta[property="og:title"]')
  if (ogTitle) ogTitle.setAttribute('content', `${title} — Rarebox`)
  let ogDesc = document.querySelector('meta[property="og:description"]')
  if (ogDesc) ogDesc.setAttribute('content', to.meta.description || 'Track your Pokémon TCG collection with live prices and portfolio charts.')
})

export default router
