/**
 * Rarebox — Pokémon TCG Portfolio Tracker
 * Built by Nova — GitHub: @novaoc
 * https://rarebox.io
 */
import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { loadTradeState, saveTradeState } from '../db'

const DEBOUNCE_MS = 3000
let debounceTimer = null
let flushRegistered = false

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
    if (typeof window !== 'undefined' && window.__rareboxImporting) return
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(async () => {
      if (typeof window !== 'undefined' && window.__rareboxImporting) return
      try {
        await saveTradeState(getState())
      } catch (e) {
        console.error('IDB trade persist failed:', e)
      }
    }, DEBOUNCE_MS)
  }

  async function init() {
    const tradeState = await loadTradeState()
    if (tradeState) {
      applyState(tradeState)
    }
    // Flush the debounce when the page goes away — edits made <3s before
    // closing/backgrounding were silently dropped (portfolio store had
    // this safety net; trade didn't)
    if (typeof window !== 'undefined' && !flushRegistered) {
      flushRegistered = true
      const flush = () => {
        if (window.__rareboxImporting) return
        if (debounceTimer) { clearTimeout(debounceTimer); debounceTimer = null }
        saveTradeState(getState()).catch(() => {})
      }
      window.addEventListener('pagehide', flush)
      document.addEventListener('visibilitychange', () => { if (document.hidden) flush() })
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

  // ── Grade multipliers ──────────────────────────────────────────────────────

  function gradeMultiplier(company, grade) {
    const mults = {
      'PSA': { '10': 2.0, '9': 1.5, '8': 1.2, '7': 1.0, '6': 0.8, '5': 0.7, '4': 0.5, '3': 0.4, '2': 0.3, '1': 0.2 },
      'BGS': { '10': 2.0, '9.5': 1.7, '9': 1.4, '8.5': 1.2, '8': 1.1, '7': 1.0, '6': 0.8, '5': 0.7, '4': 0.5, '3': 0.4, '2': 0.3, '1': 0.2 },
      'CGC': { '10': 2.0, '9.5': 1.5, '9': 1.3, '8.5': 1.1, '8': 1.0, '7': 0.8, '6': 0.7, '5': 0.6, '4': 0.5, '3': 0.4, '2': 0.3, '1': 0.2 },
      'SGC': { '10': 1.8, '9.5': 1.4, '9': 1.2, '8': 1.0, '7': 0.8, '6': 0.7, '5': 0.6, '4': 0.5, '3': 0.4, '2': 0.3, '1': 0.2 },
    }
    return mults[company]?.[grade] || 1.0
  }

  function calculateTotal(items) {
    return items.reduce((sum, item) => {
      const qty = item.quantity || 1
      const base = item.currentMarketPrice ?? item.marketPrice ?? item.purchasePrice ?? 0
      const mult = item.graded ? gradeMultiplier(item.gradeCompany, item.grade) : 1.0
      return sum + base * mult * qty
    }, 0)
  }

  function addToSide(side, card) {
    const target = side === 'A' ? sideA : sideB
    const newItem = {
      ...card,
      tradeId: crypto.randomUUID(),
      graded: card.graded || false,
      gradeCompany: card.gradeCompany || '',
      grade: card.grade || '',
    }
    target.value.items.push(newItem)
    target.value.totalValue = calculateTotal(target.value.items)
    persist()
  }

  function updateCardGrade(side, tradeId, { graded, gradeCompany, grade }) {
    const target = side === 'A' ? sideA : sideB
    const item = target.value.items.find(i => i.tradeId === tradeId)
    if (!item) return
    item.graded = graded
    item.gradeCompany = graded ? (gradeCompany || 'PSA') : ''
    item.grade = graded ? (grade || '9') : ''
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
    updateCardGrade,
    removeFromSide,
    clearSide,
    resetTrade
  }
})
