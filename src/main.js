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
