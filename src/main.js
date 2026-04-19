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

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.use(VueApexCharts)
app.mount('#app')
