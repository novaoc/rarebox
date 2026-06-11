import { loadState, saveState, loadTradeState, saveTradeState } from '../db'

const STORAGE_KEYS = {
  portfolios: 'rarebox_portfolios',
  settings: 'rarebox_settings',
  snapshots: 'rarebox_snapshots',
}
const DECKS_KEY = 'rarebox_decks'
const BOOTHS_KEY = 'rarebox_booths'
const SAVED_SHOPS_KEY = 'rarebox_saved_shops'
const WANTLIST_KEY = 'rarebox_wantlist'
const JOURNAL_KEY = 'rarebox_booth_journal'

/**
 * Build the full backup payload from the REAL stores (IndexedDB for
 * shelves + trade, localStorage for decks). Shared by file export and
 * device-to-device sync — anything reading legacy localStorage keys
 * directly gets stale/empty data, since the store migration deletes them.
 */
export async function buildBackupPayload({ includePriceCache = true } = {}) {
  const state = await loadState()

  const backup = {
    version: 2,
    exportedAt: new Date().toISOString(),
    app: 'rarebox',
    data: {
      portfolios: state || { portfolios: [], activePortfolioId: null, settings: { currency: 'USD' } },
    },
  }

  if (state?.snapshots) {
    backup.data.snapshots = state.snapshots
  }

  try {
    const rawDecks = localStorage.getItem(DECKS_KEY)
    if (rawDecks) backup.data.decks = JSON.parse(rawDecks)
  } catch { /* unreadable decks — skip */ }

  for (const [field, key] of [['booths', BOOTHS_KEY], ['savedShops', SAVED_SHOPS_KEY], ['wantlist', WANTLIST_KEY], ['journal', JOURNAL_KEY]]) {
    try {
      const raw = localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length) backup.data[field] = parsed
      }
    } catch { /* skip */ }
  }

  try {
    const trade = await loadTradeState()
    // Trade sides are { items: [], totalValue: 0 }, not arrays
    if (trade && (trade.sideA?.items?.length || trade.sideB?.items?.length)) backup.data.trade = trade
  } catch { /* no trade state */ }

  if (includePriceCache) {
    const cacheKeys = Object.keys(localStorage).filter(k => k.startsWith('ph_cache_'))
    if (cacheKeys.length > 0) {
      backup.data.priceCache = {}
      for (const k of cacheKeys) {
        const raw = localStorage.getItem(k)
        if (raw) {
          try { backup.data.priceCache[k] = JSON.parse(raw) }
          catch { backup.data.priceCache[k] = raw }
        }
      }
    }
  }

  return backup
}

export async function exportBackup() {
  const backup = await buildBackupPayload()

  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  const date = new Date().toISOString().split('T')[0]
  a.href = url
  a.download = `rarebox-backup-${date}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export function validateBackup(data) {
  if (!data || typeof data !== 'object') return 'Invalid backup file'
  if (data.app !== 'rarebox') return 'Not a Rarebox backup file'
  if (!data.data || typeof data.data !== 'object') return 'Backup has no data'

  const hasPortfolios = data.data.portfolios
  if (!hasPortfolios) return 'Backup missing shelf data'

  // Quick shape check
  if (hasPortfolios.portfolios && !Array.isArray(hasPortfolios.portfolios)) {
    return 'Shelf data is corrupted'
  }

  return null // valid
}

/**
 * Restore a backup and reload the page.
 *
 * Rarebox now stores state in IndexedDB (Dexie), with localStorage as a
 * fallback migration path.  This function writes to both, then clears IDB
 * so that on reload the store's `init()` falls through to the localStorage
 * data and migrates it back into IDB.
 */
export async function importBackup(data) {
  // Freeze store persistence for the rest of this page's life. Without
  // this, the stores' beforeunload flush fires during the reload below
  // and re-persists the OLD in-memory state over the imported one —
  // silently discarding every import.
  window.__rareboxImporting = true

  // Deep-plain the payload: callers may hand us a Vue reactive proxy,
  // which IndexedDB's structured clone refuses to serialize. The reviver
  // drops prototype-pollution keys — imports are attacker-suppliable.
  data = JSON.parse(JSON.stringify(data), (key, value) =>
    key === '__proto__' || key === 'constructor' || key === 'prototype' ? undefined : value
  )

  try {
    return await importBackupInner(data)
  } catch (e) {
    // Import failed before the reload — unfreeze persistence, or every
    // edit for the rest of the session silently never saves.
    window.__rareboxImporting = false
    throw e
  }
}

async function importBackupInner(data) {
  const result = { portfolios: 0, snapshots: 0, caches: 0, decks: 0 }

  // 1. Clear legacy localStorage mirrors + stale price cache
  for (const key of Object.values(STORAGE_KEYS)) {
    localStorage.removeItem(key)
  }
  Object.keys(localStorage)
    .filter(k => k.startsWith('ph_cache_'))
    .forEach(k => localStorage.removeItem(k))

  // 2. Write the imported state DIRECTLY to IndexedDB — the
  // clear-IDB-and-remigrate-from-localStorage dance was racy
  const state = data.data.portfolios || { portfolios: [], activePortfolioId: null, settings: { currency: 'USD' } }
  if (data.data.settings) state.settings = { ...(state.settings || {}), ...data.data.settings }
  if (data.data.snapshots) {
    state.snapshots = data.data.snapshots
    result.snapshots = Object.values(data.data.snapshots).reduce((s, arr) => s + (arr?.length || 0), 0)
  }
  result.portfolios = state.portfolios?.length || 0
  await saveState(state)

  // Trade: replace with the imported one, or clear so the old device's
  // half-finished trade doesn't haunt the new collection
  await saveTradeState(data.data.trade || { sideA: { items: [], totalValue: 0 }, sideB: { items: [], totalValue: 0 } })

  if (data.data.decks) {
    try {
      localStorage.setItem(DECKS_KEY, JSON.stringify(data.data.decks))
      result.decks = Array.isArray(data.data.decks) ? data.data.decks.length : 0
    } catch { /* quota */ }
  }

  if (data.data.priceCache) {
    for (const [key, val] of Object.entries(data.data.priceCache)) {
      // Keys come from the imported file — only restore the price-cache
      // namespace, never arbitrary localStorage keys (a crafted backup
      // could otherwise overwrite settings/decks/booths).
      if (!key.startsWith('ph_cache_')) continue
      localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val))
      result.caches++
    }
  }

  if (data.data.booths) {
    try { localStorage.setItem(BOOTHS_KEY, JSON.stringify(data.data.booths)) } catch { /* quota */ }
  }
  if (data.data.savedShops) {
    try { localStorage.setItem(SAVED_SHOPS_KEY, JSON.stringify(data.data.savedShops)) } catch { /* quota */ }
  }
  if (data.data.wantlist) {
    try { localStorage.setItem(WANTLIST_KEY, JSON.stringify(data.data.wantlist)) } catch { /* quota */ }
  }
  if (data.data.journal) {
    try { localStorage.setItem(JOURNAL_KEY, JSON.stringify(data.data.journal)) } catch { /* quota */ }
  }

  // 3. Reload — stores re-init from the imported IDB state
  window.location.replace(window.location.pathname)

  return result
}
