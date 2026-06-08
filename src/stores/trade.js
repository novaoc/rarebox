/**
 * Rarebox — Pokémon TCG Portfolio Tracker
 * Built by Nova — GitHub: @novaoc
 * https://rarebox.io
 */
import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { loadState, saveState } from '../db'

const DEBOUNCE_MS = 3000
let debounceTimer = null

export const useTradeStore = defineStore('trade', () => {
  // State
  const sideA = ref({ items: [], totalValue: 0 }) // User's cards
  const sideB = ref({ items: [], totalValue: 0 }) // Offered cards
  const initialized = ref(false)

  // ── Persistence ──────────────────────────────────────────────────────

  function getState() {
    return JSON.parse(JSON.stringify({
      sideA: sideA.value,
      sideB: sideB.value
    }))
  }

  function applyState(state) {
    if (state.sideA) sideA.value = state.sideA
    if (state.sideB) sideB.value = state.sideB
  }

  function persist() {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(async () => {
      try {
        // Since Rarebox uses a single blob approach for the entire app state,
        // this store should ideally be integrated into the main persist loop.
        // For now, we'll store trade state in its own key or assume the main
        // store will handle it once integrated. 
        // We'll use 'trade_state' key to keep it simple and isolated for now.
        const row = await loadState('app_state') || {}
        row.trade = getState()
        await saveState(row)
      } catch (e) {
        console.error('IDB trade persist failed:', e)
      }
    }, DEBOUNCE_MS)
  }

  async function init() {
    const appState = await loadState()
    if (appState && appState.trade) {
      applyState(appState.trade)
    }
    initialized.value = true
  }

  // ── Getters ──────────────────────────────────────────────────────────

  const priceDelta = computed(() => sideB.value.totalValue - sideA.value.totalValue)
  
  const isFairTrade = computed(() => {
    if (sideA.value.totalValue === 0) return true
    const deltaPct = Math.abs(priceDelta.value) / sideA.value.totalValue
    return deltaPct <= 0.1 // Fair if within 10%
  })

  // ── Actions ──────────────────────────────────────────────────────────

  function calculateTotal(items) {
    return items.reduce((sum, item) => {
      const qty = item.quantity || 1
      const val = item.type === 'card'
        ? (item.currentMarketPrice || item.purchasePrice || 0)
        : (item.currentValue || item.purchasePrice || 0)
      return sum + val * qty
    }, 0)
  }

  function addToSide(side, card) {
    const target = side === 'A' ? sideA : sideB
    const newItem = {
      ...card,
      tradeId: crypto.randomUUID()
    }
    target.value.items.push(newItem)
    target.value.totalValue = calculateTotal(target.value.items)
    persist()
  }

  function removeFromSide(side, tradeId) {
    const target = side === 'A' ? sideA : sideB
    target.value.items = target.value.items.filter(i => i.tradeId !== tradeId)
    target.value.totalValue = calculateTotal(target.value.items)
    persist()
  }

  function clearSide(side) {
    if (side === 'A') sideA.value = { items: [], totalValue: 0 }
    else sideB.value = { items: [], totalValue: 0 }
    persist()
  }

  function resetTrade() {
    sideA.value = { items: [], totalValue: 0 }
    sideB.value = { items: [], totalValue: 0 }
    persist()
  }

  return {
    sideA,
    sideB,
    initialized,
    priceDelta,
    isFairTrade,
    init,
    addToSide,
    removeFromSide,
    clearSide,
    resetTrade
  }
})
