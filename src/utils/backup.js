import { loadState, saveState, loadTradeState, saveTradeState } from '../db.js'

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

  // Shape check — accept the canonical { portfolios: [...] } state object or
  // the legacy bare-array form. Anything else would restore to an empty app
  // after wiping the device, so it must be rejected here, before the wipe.
  if (!Array.isArray(hasPortfolios) && !Array.isArray(hasPortfolios.portfolios)) {
    return 'Shelf data is corrupted'
  }

  return null // valid
}

export function sanitizeBackupData(data) {
  return JSON.parse(JSON.stringify(data), (key, value) =>
    key === '__proto__' || key === 'constructor' || key === 'prototype' ? undefined : value
  )
}

function localStorageKeys(storage) {
  if (typeof storage.length === 'number' && typeof storage.key === 'function') {
    return Array.from({ length: storage.length }, (_, i) => storage.key(i)).filter(Boolean)
  }
  return Object.keys(storage)
}

export async function restoreBackupData(data, {
  storage = localStorage,
  saveAppState = saveState,
  saveImportedTradeState = saveTradeState,
  reload = () => window.location.replace(window.location.pathname),
} = {}) {
  const result = { portfolios: 0, snapshots: 0, caches: 0, decks: 0 }

  for (const key of Object.values(STORAGE_KEYS)) storage.removeItem(key)
  localStorageKeys(storage)
    .filter(k => k.startsWith('ph_cache_'))
    .forEach(k => storage.removeItem(k))

  // Normalize the legacy bare-array shape into the canonical state object —
  // saving the array as-is would leave init() unable to find any shelves.
  const raw = data.data.portfolios
  const state = Array.isArray(raw)
    ? { portfolios: raw, activePortfolioId: raw[0]?.id || null, settings: { currency: 'USD' } }
    : (raw || { portfolios: [], activePortfolioId: null, settings: { currency: 'USD' } })
  if (data.data.settings) state.settings = { ...(state.settings || {}), ...data.data.settings }
  if (data.data.snapshots) {
    state.snapshots = data.data.snapshots
    result.snapshots = Object.values(data.data.snapshots).reduce((s, arr) => s + (arr?.length || 0), 0)
  } else if (state.snapshots) {
    result.snapshots = Object.values(state.snapshots).reduce((s, arr) => s + (arr?.length || 0), 0)
  }
  result.portfolios = state.portfolios?.length || 0
  await saveAppState(state)

  await saveImportedTradeState(data.data.trade || { sideA: { items: [], totalValue: 0 }, sideB: { items: [], totalValue: 0 } })

  if (data.data.decks) {
    try {
      storage.setItem(DECKS_KEY, JSON.stringify(data.data.decks))
      result.decks = Array.isArray(data.data.decks) ? data.data.decks.length : 0
    } catch { /* quota */ }
  }

  if (data.data.priceCache) {
    for (const [key, val] of Object.entries(data.data.priceCache)) {
      if (!key.startsWith('ph_cache_')) continue
      storage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val))
      result.caches++
    }
  }

  if (data.data.booths) {
    try { storage.setItem(BOOTHS_KEY, JSON.stringify(data.data.booths)) } catch { /* quota */ }
  }
  if (data.data.savedShops) {
    try { storage.setItem(SAVED_SHOPS_KEY, JSON.stringify(data.data.savedShops)) } catch { /* quota */ }
  }
  if (data.data.wantlist) {
    try { storage.setItem(WANTLIST_KEY, JSON.stringify(data.data.wantlist)) } catch { /* quota */ }
  }
  if (data.data.journal) {
    try { storage.setItem(JOURNAL_KEY, JSON.stringify(data.data.journal)) } catch { /* quota */ }
  }

  reload()
  return result
}

/**
 * Restore a backup and reload the page.
 *
 * Rarebox now stores shelf state in IndexedDB (Dexie). This function writes
 * imported shelf/trade state directly to IndexedDB, restores compatible
 * localStorage-only side data (decks, booths, namespaced price cache), then
 * reloads so stores re-init from the imported state.
 */
export async function importBackup(data) {
  // Freeze store persistence for the rest of this page's life. Without
  // this, the stores' beforeunload flush fires during the reload below
  // and re-persists the OLD in-memory state over the imported one —
  // silently discarding every import.
  window.__rareboxImporting = true

  data = sanitizeBackupData(data)

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
  return restoreBackupData(data)
}
