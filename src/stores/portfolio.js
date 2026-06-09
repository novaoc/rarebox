/**
 * Rarebox — Pokémon TCG Portfolio Tracker
 * Built by Nova — GitHub: @novaoc
 * https://rarebox.io
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { loadState, saveState, isStale as _isStale, hasNeverPriced as _hasNeverPriced } from '../db'

// Legacy localStorage keys (for migration)
const LEGACY_PORTFOLIOS_KEY = 'rarebox_portfolios'
const LEGACY_SETTINGS_KEY = 'rarebox_settings'
const LEGACY_SNAPSHOTS_KEY = 'rarebox_snapshots'

const MAX_SNAPSHOTS = 1095 // 3 years of daily snapshots
const DEBOUNCE_MS = 3000

let debounceTimer = null
let beforeunloadRegistered = false

function generateId() {
  return crypto.randomUUID()
}

export const usePortfolioStore = defineStore('portfolio', () => {
  // State
  const portfolios = ref([])
  const activePortfolioId = ref(null)
  const settings = ref({ currency: 'USD', defaultPortfolioId: null })
  const snapshots = ref({})
  const initialized = ref(false)

  // ── Persistence ──────────────────────────────────────────────────────

  function getState() {
    return JSON.parse(JSON.stringify({
      portfolios: portfolios.value,
      activePortfolioId: activePortfolioId.value,
      settings: settings.value,
      snapshots: snapshots.value,
    }))
  }

  function applyState(state) {
    if (state.portfolios) portfolios.value = state.portfolios
    if (state.activePortfolioId) activePortfolioId.value = state.activePortfolioId
    if (state.settings) settings.value = { ...settings.value, ...state.settings }
    if (state.snapshots) snapshots.value = state.snapshots
  }

  // Debounced save to IDB
  function persist() {
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(async () => {
      try {
        await saveState(getState())
      } catch (e) {
        console.error('IDB persist failed:', e)
      }
    }, DEBOUNCE_MS)
  }

  // Immediate save (for beforeunload, reset, critical paths)
  async function persistNow() {
    if (debounceTimer) {
      clearTimeout(debounceTimer)
      debounceTimer = null
    }
    await saveState(getState())
  }

  // ── Init (async — loads from IDB, migrates from localStorage) ────────

  async function init() {
    // 1. Try IDB first
    const idbState = await loadState()

    if (idbState && idbState.portfolios) {
      // IDB has data — use it
      applyState(idbState)
      // Clean up legacy localStorage if it still exists (migration leftover)
      try { localStorage.removeItem(LEGACY_PORTFOLIOS_KEY) } catch {}
      try { localStorage.removeItem(LEGACY_SETTINGS_KEY) } catch {}
      try { localStorage.removeItem(LEGACY_SNAPSHOTS_KEY) } catch {}
    } else {
      // 2. IDB empty — try migrating from localStorage
      const migrated = migrateFromLocalStorage()
      if (migrated) {
        await persistNow()
        // Clear legacy keys after successful migration
        try { localStorage.removeItem(LEGACY_PORTFOLIOS_KEY) } catch {}
        try { localStorage.removeItem(LEGACY_SETTINGS_KEY) } catch {}
        try { localStorage.removeItem(LEGACY_SNAPSHOTS_KEY) } catch {}
      } else {
        // 3. Fresh start — create default portfolio
        const defaultPortfolio = {
          id: generateId(),
          name: 'My Collection',
          color: '#f5a623',
          createdAt: new Date().toISOString(),
          items: []
        }
        portfolios.value = [defaultPortfolio]
        activePortfolioId.value = defaultPortfolio.id
        await persistNow()
      }
    }

    // Safety: register beforeunload flush (only once)
    if (typeof window !== 'undefined' && !beforeunloadRegistered) {
      beforeunloadRegistered = true
      window.addEventListener('beforeunload', () => {
        persistNow()
      })
    }

    initialized.value = true
    cleanupSnapshots()
  }

  function migrateFromLocalStorage() {
    try {
      const raw = localStorage.getItem(LEGACY_PORTFOLIOS_KEY)
      if (!raw) return false
      const saved = JSON.parse(raw)
      if (!saved.portfolios || saved.portfolios.length === 0) return false

      portfolios.value = saved.portfolios
      activePortfolioId.value = saved.activePortfolioId || (saved.portfolios[0]?.id ?? null)

      try {
        const savedSettings = localStorage.getItem(LEGACY_SETTINGS_KEY)
        if (savedSettings) settings.value = { ...settings.value, ...JSON.parse(savedSettings) }
      } catch {}

      try {
        const rawSnapshots = localStorage.getItem(LEGACY_SNAPSHOTS_KEY)
        if (rawSnapshots) snapshots.value = JSON.parse(rawSnapshots)
      } catch {}

      return true
    } catch {
      return false
    }
  }

  // ── Getters ──────────────────────────────────────────────────────────

  const activePortfolio = computed(() =>
    portfolios.value.find(p => p.id === activePortfolioId.value) || portfolios.value[0]
  )

  const totalPortfolioValue = computed(() => {
    return portfolios.value.reduce((total, p) => {
      return total + p.items.reduce((sum, item) => {
        const qty = item.quantity || 1
        const value = item.type === 'card'
          ? (item.currentMarketPrice || item.purchasePrice || 0)
          : (item.currentValue || item.purchasePrice || 0)
        return sum + value * qty
      }, 0)
    }, 0)
  })

  const totalCostBasis = computed(() => {
    return portfolios.value.reduce((total, p) => {
      return total + p.items.reduce((sum, item) => {
        return sum + (item.purchasePrice || 0) * (item.quantity || 1)
      }, 0)
    }, 0)
  })

  // ── Portfolio CRUD ───────────────────────────────────────────────────

  function createPortfolio(name, color = '#58a6ff') {
    const portfolio = {
      id: generateId(),
      name,
      color,
      createdAt: new Date().toISOString(),
      items: []
    }
    portfolios.value.push(portfolio)
    persist()
    return portfolio
  }

  function updatePortfolio(id, updates) {
    const idx = portfolios.value.findIndex(p => p.id === id)
    if (idx === -1) return
    portfolios.value[idx] = { ...portfolios.value[idx], ...updates }
    persist()
  }

  function deletePortfolio(id) {
    portfolios.value = portfolios.value.filter(p => p.id !== id)
    if (activePortfolioId.value === id) {
      activePortfolioId.value = portfolios.value[0]?.id || null
    }
    persist()
    cleanupSnapshots()
  }

  function setActivePortfolio(id) {
    activePortfolioId.value = id
    persist()
  }

  // ── Item CRUD ────────────────────────────────────────────────────────

  function addItem(portfolioId, item) {
    const portfolio = portfolios.value.find(p => p.id === portfolioId)
    if (!portfolio) return null
    const newItem = {
      ...item,
      id: generateId(),
      addedAt: new Date().toISOString(),
      lastPriceUpdate: new Date().toISOString()
    }
    portfolio.items.push(newItem)
    persist()
    return newItem
  }

  function updateItem(portfolioId, itemId, updates) {
    const portfolio = portfolios.value.find(p => p.id === portfolioId)
    if (!portfolio) return
    const idx = portfolio.items.findIndex(i => i.id === itemId)
    if (idx === -1) return
    portfolio.items[idx] = { ...portfolio.items[idx], ...updates }
    persist()
  }

  function removeItem(portfolioId, itemId) {
    const portfolio = portfolios.value.find(p => p.id === portfolioId)
    if (!portfolio) return
    portfolio.items = portfolio.items.filter(i => i.id !== itemId)
    persist()
    cleanupSnapshots()
  }

  function removeItems(portfolioId, itemIds) {
    const portfolio = portfolios.value.find(p => p.id === portfolioId)
    if (!portfolio) return
    const idSet = new Set(itemIds)
    portfolio.items = portfolio.items.filter(i => !idSet.has(i.id))
    persist()
    cleanupSnapshots()
  }

  // Update market prices for items (cards + sealed/graded)
  function updateCardPrice(portfolioId, itemId, price) {
    updateItem(portfolioId, itemId, {
      currentMarketPrice: price,
      lastPriceUpdate: new Date().toISOString()
    })
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  function isJPCard(item) {
    if (item.type !== 'card') return false
    if (item._lang === 'ja') return true
    if (item.cardData?._lang === 'ja') return true
    return false
  }

  // Staleness check (per-type thresholds from db.js)
  function isPriceStale(item) {
    return _isStale(item)
  }

  function hasNeverPriced(item) {
    return _hasNeverPriced(item)
  }

  // ── Portfolio stats ──────────────────────────────────────────────────

  function getPortfolioStats(portfolioId) {
    const portfolio = portfolios.value.find(p => p.id === portfolioId)
    if (!portfolio) return null

    const items = portfolio.items
    const totalCost = items.reduce((s, i) => s + (i.purchasePrice || 0) * (i.quantity || 1), 0)
    const totalValue = items.reduce((s, i) => {
      const qty = i.quantity || 1
      const val = i.type === 'card'
        ? (i.currentMarketPrice || i.purchasePrice || 0)
        : (i.currentValue || i.purchasePrice || 0)
      return s + val * qty
    }, 0)
    const gain = totalValue - totalCost
    const gainPct = totalCost > 0 ? (gain / totalCost) * 100 : 0
    const topGainer = items.reduce((best, item) => {
      const cost = (item.purchasePrice || 0)
      const val = item.type === 'card' ? (item.currentMarketPrice || cost) : (item.currentValue || cost)
      const g = cost > 0 ? (val - cost) / cost * 100 : 0
      return g > (best?.gain || -Infinity) ? { item, gain: g } : best
    }, null)

    return { totalCost, totalValue, gain, gainPct, itemCount: items.length, topGainer }
  }

  // ── Snapshot system ──────────────────────────────────────────────────

  function recordSnapshot(portfolioId) {
    const portfolio = portfolios.value.find(p => p.id === portfolioId)
    if (!portfolio) return

    const today = new Date().toISOString().split('T')[0]
    const ts = Date.now()

    const values = {}
    for (const item of portfolio.items) {
      const price = item.type === 'card'
        ? (item.currentMarketPrice || item.purchasePrice || 0)
        : (item.currentValue || item.purchasePrice || 0)
      if (price > 0) values[item.id] = price
    }

    if (Object.keys(values).length === 0) return

    const list = snapshots.value[portfolioId] || []
    const todayIdx = list.findIndex(s => s.date === today)
    if (todayIdx >= 0) {
      list[todayIdx] = { date: today, ts, values }
    } else {
      list.push({ date: today, ts, values })
    }

    if (list.length > MAX_SNAPSHOTS) list.splice(0, list.length - MAX_SNAPSHOTS)
    snapshots.value[portfolioId] = list
    persist()
  }

  function autoSnapshot() {
    const today = new Date().toISOString().split('T')[0]
    for (const portfolio of portfolios.value) {
      if (portfolio.items.length === 0) continue
      const list = snapshots.value[portfolio.id] || []
      const lastSnap = list[list.length - 1]
      if (lastSnap?.date === today) continue
      recordSnapshot(portfolio.id)
    }
  }

  function getItemHistory(portfolioId, itemId) {
    const portfolio = portfolios.value.find(p => p.id === portfolioId)
    const item = portfolio?.items.find(i => i.id === itemId)
    if (!item) return []

    const list = snapshots.value[portfolioId] || []
    const points = []

    if (item.purchaseDate && item.purchasePrice > 0) {
      const purchaseTs = new Date(item.purchaseDate).getTime()
      const firstSnap = list[0]
      if (!firstSnap || purchaseTs < firstSnap.ts) {
        points.push({ x: purchaseTs, y: item.purchasePrice })
      }
    }

    for (const snap of list) {
      if (snap.values[itemId] != null) {
        points.push({ x: snap.ts, y: snap.values[itemId] })
      }
    }

    return points
  }

  // ── Bulk import (Collectr etc.) ─────────────────────────────────────

  async function importAll(newPortfolios) {
    portfolios.value = newPortfolios
    activePortfolioId.value = newPortfolios[0]?.id || null
    await persistNow()
  }

  /**
   * Resolve imported items that have no cardId — look up each card by
   * name + number via the appropriate TCG API, update with images + price.
   * Runs silently in the background after a Collectr import.
   */
  async function resolveImportedItems(onProgress) {
    let resolved = 0

    // Collect all items that need resolving (no cardId, have cardData)
    const tasks = []
    for (const portfolio of portfolios.value) {
      for (const item of portfolio.items) {
        if (item.cardId) continue
        if (!item.cardData?.name || !item.cardData?.number) continue
        tasks.push({ portfolioId: portfolio.id, item })
      }
    }

    if (tasks.length === 0) return 0

    // ── Pokemon EN: pokemontcg.io ────────────────────────────────────
    const PKM_BASE = 'https://api.pokemontcg.io/v2/cards'
    const pkmCache = new Map()

    // ── MTG: Scryfall ────────────────────────────────────────────────
    const SCRY_BASE = 'https://api.scryfall.com/cards/named'
    const mtgCache = new Map()

    // ── Reverse mapping: JP English set name → tcgdex set ID ─────────
    const JP_NAME_TO_ID = {}
    const JP_EN = {
      PMCG1:'Base Set',PMCG2:'Jungle',PMCG3:'Fossil',
      neo1:'Neo Genesis',neo2:'Neo Discovery',neo3:'Neo Revelation',neo4:'Neo Destiny',
      S1:'Sword & Shield',S2:'Rebel Clash',S3:'Darkness Ablaze',
      S4:'Vivid Voltage',S4a:'Shiny Star V',S5a:'Battle Region',
      S5I:'Evolving Skies (JP)',S5R:'Fusion Arts',
      S6:'Silver Tempest (JP)',S6a:'Eevee Heroes',S6H:'Lost Origin (JP)',
      S7:'Brilliant Stars (JP)',S7R:'Dark Phantasma',S7D:'Paradigm Trigger (JP)',
      S8:'Fusion Arts',S8a:'25th Anniversary',S8b:'VMAX Climax',
      S9:'Star Birth',S9a:'Battle Region',
      S10:'Space Juggler',S10a:'Dark Fantasma',S10b:'Pokémon GO',
      S10D:'Time Gazer',S10P:'Space Juggler',
      S11:'Triplet Beat',S11a:'Heat Red Arcana',S12:'Paradigm Trigger',
      S12a:'VSTAR Universe',
      SV1:'Scarlet & Violet',SV1a:'Triplet Beat',SV1S:'Scarlet ex',
      SV1V:'Violet ex',SV2:'Snow Hazard',SV2a:'Clay Burst',
      SV2D:'Snow Hazard',SV2P:'Clay Burst',
      SV3:'Ruler of the Black Flame',SV3a:'Raging Surf',
      SV4:'Ancient Roar',SV4a:'Raging Surf',
      SV4K:'Ancient Roar',SV4M:'Future Flash',
      SV5:'Cyber Judge',SV5a:'Wild Force',
      SV5K:'Wild Force',SV6:'Stellar Miracle',
      SV7:'Super Electric Breaker',SV7a:'Paradise Dragona',
      SV8:'Terastal Festival',SV8a:'Terastal Festival ex',
      SV9:'Battle Partners',SV9a:'Glory of Team Rocket',
      SV10:'Heat Wave Arena',SV10a:'Glory of Team Rocket',
      SVK:'Shiny Treasure',SVLN:'Legendary Heartbeat',
      SVLS:'Stellar Type Starter Set',SV11:'Destined Rivals',
      SV11B:'Destined Rivals (Leaf)',SV11W:'Destined Rivals (Wind)',
      M1S:'Mega Symphonia',M3:'Munice Zero',
    }
    // Build reverse: lowercase English name → tcgdex ID
    for (const [id, enName] of Object.entries(JP_EN)) {
      const key = enName.toLowerCase().replace(/\s*\(.*\)/, '').trim()
      if (!JP_NAME_TO_ID[key]) JP_NAME_TO_ID[key] = id
    }

    // tcgdex series prefix from set ID
    function jpSetToSeries(setId) {
      if (!setId) return null
      if (setId.startsWith('SV')) return 'sv'
      if (setId.startsWith('S') && !setId.startsWith('SV')) return 'swsh'
      if (setId.startsWith('SM')) return 'sm'
      if (setId.startsWith('XY')) return 'xy'
      if (setId.startsWith('B')) return 'bw'
      if (setId.startsWith('DP')) return 'dp'
      if (setId.startsWith('EX') || setId.startsWith('e')) return 'ex'
      if (setId.startsWith('neo')) return 'neo'
      if (setId.startsWith('PM')) return 'base'
      return 'sv' // default
    }

    // Hoist dynamic import to avoid redundant module loading inside the loop
    const { multiSearch } = await import('../services/tcg/multiSearch.js')

    for (let i = 0; i < tasks.length; i++) {
      const { portfolioId, item } = tasks[i]
      if (onProgress) onProgress(i + 1, tasks.length, resolved)

      const game = item.game || 'pokemon'
      const isJP = item._lang === 'ja' || (item.cardData?.name || '').includes('(JP)')

      try {
        if (game === 'pokemon' && !isJP) {
          // ── Pokemon EN via pokemontcg.io ──────────────────────────
          const name = item.cardData.name.trim()
          const number = item.cardData.number.replace(/\/.*/, '').replace(/^[A-Z]+/i, '').trim()
          const q = `name:"${name}" number:${number}`

          if (!pkmCache.has(q)) {
            const res = await fetch(`${PKM_BASE}?q=${encodeURIComponent(q)}&pageSize=5`)
            pkmCache.set(q, res.ok ? (await res.json()).data || [] : [])
          }

          const candidates = pkmCache.get(q) || []
          const setName = (item.cardData.set?.name || '').toLowerCase()
          let match = candidates.find(c =>
            c.set?.name?.toLowerCase() === setName ||
            c.set?.id?.toLowerCase() === setName.replace(/\s+/g, '')
          )
          if (!match && candidates.length > 0) match = candidates[0]

          if (match) {
            const updates = {
              cardId: match.id,
              _lang: null,
              cardData: {
                name: match.name,
                number: match.number,
                images: match.images || { small: '', large: '' },
                set: { id: match.set?.id, name: match.set?.name },
                rarity: match.rarity || item.cardData.rarity,
              },
              lastPriceUpdate: new Date().toISOString(),
            }
            if (match.tcgplayer?.prices) {
              const variant = item.priceVariant || 'holofoil'
              const prices = match.tcgplayer.prices[variant] ||
                             match.tcgplayer.prices.normal ||
                             match.tcgplayer.prices['reverse holofoil'] ||
                             Object.values(match.tcgplayer.prices)[0]
              if (prices?.market) updates.currentMarketPrice = prices.market
              else if (prices?.mid) updates.currentMarketPrice = prices.mid
            }
            updateItem(portfolioId, item.id, updates)
            resolved++
          }
        } else if (game === 'pokemon' && isJP) {
          // ── Pokemon JP via tcgdex CDN (no API call — construct URL) ──
          const setName = (item.cardData.set?.name || '').toLowerCase().replace(/\s*\(jp\)/i, '').trim()
          const tcgdexId = JP_NAME_TO_ID[setName]
          const localId = item.cardData.number.replace(/\/.*/, '').trim()

          if (tcgdexId && localId) {
            const series = jpSetToSeries(tcgdexId)
            const imgBase = `https://assets.tcgdex.net/ja/${series}/${tcgdexId}/${localId}`
            const updates = {
              _lang: 'ja',
              cardData: {
                ...item.cardData,
                images: { small: imgBase + '/low.webp', large: imgBase + '/high.webp' },
                set: { id: tcgdexId, name: item.cardData.set?.name },
              },
              lastPriceUpdate: new Date().toISOString(),
            }
            updateItem(portfolioId, item.id, updates)
            resolved++
          }
        } else if (game === 'magic') {
          // ── MTG via Scryfall ─────────────────────────────────────
          const name = item.cardData.name.replace(/\s*\(.*\)/i, '').trim()
          if (!mtgCache.has(name.toLowerCase())) {
            try {
              const res = await fetch(`${SCRY_BASE}?exact=${encodeURIComponent(name)}`)
              mtgCache.set(name.toLowerCase(), res.ok ? await res.json() : null)
            } catch {
              mtgCache.set(name.toLowerCase(), null)
            }
          }

          const card = mtgCache.get(name.toLowerCase())
          if (card) {
            const updates = {
              cardId: card.id,
              cardData: {
                name: card.name,
                number: card.collector_number || item.cardData.number,
                images: { small: card.image_uris?.small || '', large: card.image_uris?.large || '' },
                set: { id: card.set, name: card.set_name },
                rarity: card.rarity || item.cardData.rarity,
              },
              lastPriceUpdate: new Date().toISOString(),
            }
            const price = card.prices?.usd || card.prices?.eur || null
            if (price) updates.currentMarketPrice = parseFloat(price)
            updateItem(portfolioId, item.id, updates)
            resolved++
          }
        } else if (['yugioh', 'lorcana', 'one-piece', 'riftbound'].includes(game)) {
          // ── Other TCGs via multiSearch ─────────────────────────────
          try {
            const name = item.cardData.name.trim()
            const result = await multiSearch(name, { page: 1, pageSize: 10, providers: [game] })
            const candidates = result?.cards || []
            
            if (candidates.length > 0) {
              // Try to match by set name or number
              const setLower = (item.cardData.set?.name || '').toLowerCase()
              const numStr = (item.cardData.number || '').toLowerCase()
              
              let match = candidates.find(c => {
                const cSet = (c.set || '').toLowerCase()
                const cNum = (c.number || '').toLowerCase()
                return cSet.includes(setLower) || setLower.includes(cSet) || cNum === numStr
              })
              if (!match) match = candidates[0]
              
              const updates = {
                cardId: match.id,
                cardData: {
                  name: match.name,
                  number: match.number || item.cardData.number,
                  images: { small: match.image || '', large: '' },
                  set: { id: match.set || '', name: match.set || item.cardData.set?.name },
                  rarity: match.rarity || item.cardData.rarity,
                },
                lastPriceUpdate: new Date().toISOString(),
              }
              if (match.price != null) updates.currentMarketPrice = match.price
              updateItem(portfolioId, item.id, updates)
              resolved++
            }
          } catch (e) {
            console.warn(`Failed to resolve ${game} card "${item.cardData.name}":`, e.message)
          }
        }
      } catch {}

      // 80ms delay between requests
      await new Promise(r => setTimeout(r, 80))
    }

    if (resolved > 0) persistNow()
    return resolved
  }

  // ── Reset ────────────────────────────────────────────────────────────

  async function resetAll() {
    portfolios.value = []
    activePortfolioId.value = null
    snapshots.value = {}
    settings.value = { currency: 'USD', defaultPortfolioId: null }
    // Clear both IDB and any leftover localStorage
    await saveState(null)
    try { localStorage.clear() } catch {}
    await init()
  }

  function cleanupSnapshots() {
    const validItemIds = new Set()
    for (const p of portfolios.value) {
      for (const item of p.items) {
        validItemIds.add(item.id)
      }
    }

    let changed = false
    for (const [portfolioId, list] of Object.entries(snapshots.value)) {
      for (const snap of list) {
        for (const itemId of Object.keys(snap.values)) {
          if (!validItemIds.has(itemId)) {
            delete snap.values[itemId]
            changed = true
          }
        }
      }
      const nonEmpty = list.filter(s => Object.keys(s.values).length > 0)
      if (nonEmpty.length !== list.length) {
        snapshots.value[portfolioId] = nonEmpty
        changed = true
      }
    }

    if (changed) persist()
  }

  return {
    portfolios,
    activePortfolioId,
    activePortfolio,
    settings,
    snapshots,
    initialized,
    totalPortfolioValue,
    totalCostBasis,
    init,
    persist,
    persistNow,
    createPortfolio,
    updatePortfolio,
    deletePortfolio,
    setActivePortfolio,
    addItem,
    updateItem,
    removeItem,
    removeItems,
    updateCardPrice,
    getPortfolioStats,
    recordSnapshot,
    getItemHistory,
    isJPCard,
    isPriceStale,
    hasNeverPriced,
    resetAll,
    importAll,
    resolveImportedItems,
    cleanupSnapshots,
    autoSnapshot,
  }
})
