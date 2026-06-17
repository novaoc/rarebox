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
    if (typeof window !== 'undefined' && window.__rareboxImporting) return
    if (debounceTimer) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(async () => {
      if (typeof window !== 'undefined' && window.__rareboxImporting) return
      try {
        await saveState(getState())
      } catch (e) {
        console.error('IDB persist failed:', e)
      }
    }, DEBOUNCE_MS)
  }

  // Immediate save (for beforeunload, reset, critical paths)
  async function persistNow() {
    if (typeof window !== 'undefined' && window.__rareboxImporting) return
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

    // Safety: flush pending saves when the page goes away. pagehide is
    // the one that actually fires on iOS Safari (beforeunload often
    // doesn't), and visibilitychange:hidden covers app-switch on mobile —
    // the 3s debounce otherwise loses edits made just before backgrounding.
    if (typeof window !== 'undefined' && !beforeunloadRegistered) {
      beforeunloadRegistered = true
      window.addEventListener('beforeunload', () => { persistNow() })
      window.addEventListener('pagehide', () => { persistNow() })
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) persistNow()
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

  // ── Master sets ─────────────────────────────────────────────────────
  // A master set is a showcased grouping of every card item from one set:
  // the shelf collapses those singles into a single binder-stack card with
  // combined value and completion. Pure view-layer grouping — items are
  // untouched, so un-showcasing restores the individual rows.
  // Keys: `${game}:${setId}` (game defaults to 'pokemon').

  function showcaseMasterSet(portfolioId, key, meta) {
    const portfolio = portfolios.value.find(p => p.id === portfolioId)
    if (!portfolio) return
    if (!portfolio.masterSets) portfolio.masterSets = {}
    portfolio.masterSets[key] = { name: '', game: 'pokemon', total: null, ...meta }
    persist()
  }

  function unshowcaseMasterSet(portfolioId, key) {
    const portfolio = portfolios.value.find(p => p.id === portfolioId)
    if (!portfolio?.masterSets) return
    delete portfolio.masterSets[key]
    persist()
  }

  function dismissMasterSetSuggestion(portfolioId, key) {
    const portfolio = portfolios.value.find(p => p.id === portfolioId)
    if (!portfolio) return
    if (!portfolio.masterSetsDismissed) portfolio.masterSetsDismissed = []
    if (!portfolio.masterSetsDismissed.includes(key)) portfolio.masterSetsDismissed.push(key)
    persist()
  }

  // Hunt marks: "GOT IT" ticks on missing cards while out card hunting —
  // a tally of the day's finds before they're promoted to shelf items.
  // Stored per master set as { [cardId]: timestamp }.
  function toggleHuntMark(portfolioId, key, cardId) {
    const portfolio = portfolios.value.find(p => p.id === portfolioId)
    const ms = portfolio?.masterSets?.[key]
    if (!ms) return
    if (!ms.hunt) ms.hunt = {}
    if (ms.hunt[cardId]) delete ms.hunt[cardId]
    else ms.hunt[cardId] = Date.now()
    persist()
  }

  function clearHuntMarks(portfolioId, key, cardIds = null) {
    const portfolio = portfolios.value.find(p => p.id === portfolioId)
    const ms = portfolio?.masterSets?.[key]
    if (!ms?.hunt) return
    if (cardIds) for (const id of cardIds) delete ms.hunt[id]
    else ms.hunt = {}
    persist()
  }

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

  function moveItem(fromId, itemId, toId) {
    if (fromId === toId) return false
    const src = portfolios.value.find(p => p.id === fromId)
    const dst = portfolios.value.find(p => p.id === toId)
    if (!src || !dst) return false
    const at = src.items.findIndex(i => i.id === itemId)
    if (at === -1) return false
    const [item] = src.items.splice(at, 1)
    dst.items.push(item)
    persist()
    return true
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

  /**
   * Buy/Sell/Hold Indicator
   * SELL: +20% gain
   * BUY: -15% loss
   * HOLD: otherwise
   */
  function getItemIndicator(item) {
    const purchase = item.purchasePrice || 0
    if (!purchase) return 'HOLD'
    const current = item.type === 'card'
      ? (item.currentMarketPrice || purchase)
      : (item.currentValue || purchase)
    
    if (!current) return 'HOLD'

    const pct = ((current - purchase) / purchase) * 100
    if (pct >= 20) return 'SELL'
    if (pct <= -15) return 'BUY'
    return 'HOLD'
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

    // Backfill: if fewer than 2 distinct timestamps, extend current price backward
    // so the portfolio chart always has daily data points between purchase and now
    if (points.length < 2 && item.purchaseDate) {
      const currentPrice = item.type === 'card'
        ? (item.currentMarketPrice || item.purchasePrice || 0)
        : (item.currentValue || item.purchasePrice || 0)
      const purchaseTs = new Date(item.purchaseDate).getTime()
      const now = Date.now()
      if (currentPrice > 0 && now - purchaseTs > 86400000) {
        const DAY = 86400000
        // ~weekly intervals so we don't generate thousands of points per card
        const INTERVAL = 7 * DAY
        const generated = []
        const startDay = Math.max(purchaseTs, now - 365 * DAY)
        for (let t = startDay; t <= now; t += INTERVAL) {
          generated.push({ x: t, y: currentPrice })
        }
        // Ensure now is included
        if (generated.length === 0 || generated[generated.length - 1].x < now) {
          generated.push({ x: now, y: currentPrice })
        }
        if (generated.length > 1) {
          if (item.purchasePrice > 0) {
            const existing = new Set(points.map(p => p.x))
            if (!existing.has(purchaseTs)) {
              points.unshift({ x: purchaseTs, y: item.purchasePrice })
            }
          }
          points.push(...generated)
        }
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

    // ── Reverse mapping: JP English set name → tcgdex set IDs ────────
    // One English name can map to several tcgdex sets (e.g. paired sets),
    // so keep ALL ids and let resolution try each until the card exists.
    const { JP_EN_NAMES, jpSetToSeries } = await import('../services/pokemonApi.js')
    const normalizeSetKey = s => s
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // pokémon → pokemon
      .replace(/\s*\(.*\)/, '')
      .trim()
    const JP_NAME_TO_IDS = {}
    for (const [id, enName] of Object.entries(JP_EN_NAMES)) {
      const key = normalizeSetKey(enName)
      if (!JP_NAME_TO_IDS[key]) JP_NAME_TO_IDS[key] = []
      JP_NAME_TO_IDS[key].push(id)
    }
    // Collectr sometimes uses slightly different community names
    const JP_SET_ALIASES = {
      'pokemon 151': 'pokemon card 151',
      '151': 'pokemon card 151',
      'shiny treasure': 'shiny treasure ex',
      'terastal festival': 'terastal festival ex',
      'rebel clash': 'rebellion crash',
    }
    // Cached JP set metadata for validating card numbers before CDN fallback
    const jpSetCache = new Map()
    async function getJpSetInfo(setId) {
      if (!jpSetCache.has(setId)) {
        try {
          const res = await fetch(`https://api.tcgdex.net/v2/ja/sets/${setId}`)
          jpSetCache.set(setId, res.ok ? await res.json() : null)
        } catch {
          jpSetCache.set(setId, null)
        }
      }
      return jpSetCache.get(setId)
    }

    function padId(n) {
      return String(n).padStart(3, '0')
    }

    // Hoist dynamic import to avoid redundant module loading inside the loop
    const { multiSearch } = await import('../services/tcg/multiSearch.js')

    // Process all cards with concurrent workers (pokemontcg.io is the bottleneck,
    // averaging ~2s per request — sequential would be unusably slow)
    const CONCURRENCY = 5
    let completed = 0
    const taskQueue = [...tasks]

    async function resolveOne(task) {
      const { portfolioId, item } = task
      const idx = completed++
      if (onProgress) onProgress(idx + 1, tasks.length, resolved)

      const game = item.game || 'pokemon'
      const isJP = item._lang === 'ja' || (item.cardData?.name || '').includes('(JP)')

      try {
        if (game === 'pokemon' && !isJP) {
          // ── Pokemon EN via pokemontcg.io ──────────────────────────
          const name = item.cardData.name.trim()
          // "015/165" → "15" (pokemontcg.io numbers are unpadded);
          // keep letter prefixes ("TG15", "SWSH284") — they're real numbers there
          const rawNum = item.cardData.number.replace(/\/.*/, '').trim()
          const number = /^\d+$/.test(rawNum) ? String(parseInt(rawNum, 10)) : rawNum

          async function pkmSearch(q) {
            if (!pkmCache.has(q)) {
              const res = await fetch(`${PKM_BASE}?q=${encodeURIComponent(q)}&pageSize=5`)
              pkmCache.set(q, res.ok ? (await res.json()).data || [] : [])
            }
            return pkmCache.get(q) || []
          }

          let candidates = await pkmSearch(`name:"${name}" number:${number}`)
          // Letter-prefixed numbers that didn't match: retry with digits only
          if (candidates.length === 0 && /^[A-Z]+\d+$/i.test(number)) {
            const digits = String(parseInt(number.replace(/^[A-Z]+/i, ''), 10))
            candidates = await pkmSearch(`name:"${name}" number:${digits}`)
          }
          // Last resort: name only (e.g. promo numbering schemes)
          if (candidates.length === 0) {
            candidates = await pkmSearch(`name:"${name}"`)
          }
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
          // ── Pokemon JP via tcgdex API (prices + images) ──────────────
          let lookupName = normalizeSetKey(
            (item.cardData.set?.name || '').replace(/\s*\(jp\)/i, '')
          )
          lookupName = JP_SET_ALIASES[lookupName] || lookupName
          const candidateIds = JP_NAME_TO_IDS[lookupName] || []
          const localId = padId(item.cardData.number.replace(/\/.*/, '').trim())

          if (!lookupName || candidateIds.length === 0) {
            console.warn(`JP set "${item.cardData.set?.name}" not found in JP_EN_NAMES — add it in pokemonApi.js`)
          }

          if (candidateIds.length > 0 && localId) {
            const { getJapaneseCardDetail } = await import('../services/pokemonApi.js')

            // Try every set that shares this English name — the card number
            // tells us which one actually contains the card.
            let cardData = null
            let matchedId = null
            for (const tcgdexId of candidateIds) {
              try {
                cardData = await getJapaneseCardDetail(`${tcgdexId}-${localId}`)
                if (cardData) { matchedId = tcgdexId; break }
              } catch { /* try next candidate set */ }
            }

            if (cardData && matchedId) {
              const cm = cardData.tcgplayer?.prices?.normal
              const marketPrice = cm?.market || cm?.mid || null
              const updates = {
                cardId: `${matchedId}-${localId}`,
                _lang: 'ja',
                cardData: {
                  ...item.cardData,
                  name: cardData.name,
                  number: cardData.number,
                  images: cardData.images || { small: '', large: '' },
                  set: { id: matchedId, name: item.cardData.set?.name },
                  rarity: cardData.rarity || item.cardData.rarity,
                },
                currentMarketPrice: marketPrice,
                lastPriceUpdate: new Date().toISOString(),
              }
              updateItem(portfolioId, item.id, updates)
              resolved++
            } else {
              // Card detail not in tcgdex — fall back to a CDN image, but only
              // for a set that exists and can plausibly contain this number.
              let fallbackId = null
              for (const tcgdexId of candidateIds) {
                const info = await getJpSetInfo(tcgdexId)
                if (info && parseInt(localId, 10) <= (info.cardCount?.total || 0)) {
                  fallbackId = tcgdexId
                  break
                }
              }
              if (fallbackId) {
                const series = jpSetToSeries(fallbackId)
                const imgBase = `https://assets.tcgdex.net/ja/${series}/${fallbackId}/${localId}`
                updateItem(portfolioId, item.id, {
                  cardId: `${fallbackId}-${localId}`,
                  _lang: 'ja',
                  cardData: {
                    ...item.cardData,
                    images: { small: imgBase + '/low.webp', large: imgBase + '/high.webp' },
                    set: { id: fallbackId, name: item.cardData.set?.name },
                  },
                  lastPriceUpdate: new Date().toISOString(),
                })
                resolved++
              } else {
                console.warn(`JP card ${item.cardData.name} #${localId} not found in any candidate set (${candidateIds.join(', ')})`)
              }
            }
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
              const setLower = (item.cardData.set?.name || '').toLowerCase()
              const numStr = (item.cardData.number || '').toLowerCase()
              const numDigits = numStr.replace(/\D/g, '').replace(/^0+/, '')

              // Score candidates: an exact card-number match beats a set-name
              // match, which beats result order. Picking the first OR-match
              // used to grab the wrong printing for cards with many reprints.
              let match = null
              let bestScore = 0
              for (const c of candidates) {
                const cSet = (c.set || '').toLowerCase()
                const cNum = (c.number || '').toLowerCase()
                const cDigits = cNum.replace(/\D/g, '').replace(/^0+/, '')
                let score = 0
                if (numStr && cNum === numStr) score += 4
                else if (numDigits && cDigits === numDigits) score += 2
                if (setLower && cSet && (cSet.includes(setLower) || setLower.includes(cSet))) score += 1
                if (score > bestScore) { bestScore = score; match = c }
              }
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
    }

    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, taskQueue.length) }, () =>
        (async () => {
          while (taskQueue.length > 0) {
            await resolveOne(taskQueue.shift())
          }
        })()
      )
    )

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
    showcaseMasterSet,
    unshowcaseMasterSet,
    dismissMasterSetSuggestion,
    toggleHuntMark,
    clearHuntMarks,
    updateItem,
    moveItem,
    removeItem,
    removeItems,
    updateCardPrice,
    getPortfolioStats,
    recordSnapshot,
    getItemHistory,
    getItemIndicator,
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
