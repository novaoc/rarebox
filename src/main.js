/**
 * Rarebox — Pokémon TCG Portfolio Tracker
 * Built by Nova — GitHub: @novaoc
 * https://rarebox.io
 */
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import VueApexCharts from 'vue3-apexcharts'
import router from './router'
import App from './App.vue'
import './assets/main.css'
import { installOfflineArtFallback } from './utils/offlineArt'

// Offline = no card pictures: cross-origin images swap to generated sleeves
installOfflineArtFallback()

// A deploy deletes the previous build's hashed chunks from the precache;
// an already-open tab then fails to lazy-load not-yet-visited routes.
// Vite signals this precise case — one reload gets the fresh shell.
window.addEventListener('vite:preloadError', (e) => {
  e.preventDefault()
  if (!sessionStorage.getItem('rbx_chunk_reload')) {
    sessionStorage.setItem('rbx_chunk_reload', '1')
    location.reload()
  }
})

// Global error handler — catches Vue render errors
const app = createApp(App)
app.config.errorHandler = (err, instance, info) => {
  console.error('[vue error]', err, info)
}
app.config.warnHandler = (msg, instance, trace) => {
  console.warn('[vue warn]', msg, trace)
}
app.use(createPinia())
app.use(router)
app.use(VueApexCharts)
app.mount('#app')

// Also catch unhandled promise rejections
window.addEventListener('unhandledrejection', (e) => {
  console.error('[unhandled rejection]', e.reason)
})

// Offline support: the service worker precaches the app shell so the site
// opens without a connection (collection data already lives in IndexedDB).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[sw] registration failed', err)
    })
  })
}
