import db from '../db'
import { loadState } from '../db'

const STORAGE_KEYS = {
  portfolios: 'rarebox_portfolios',
  settings: 'rarebox_settings',
  snapshots: 'rarebox_snapshots',
}

export async function exportBackup() {
  const state = await loadState()

  const backup = {
    version: 1,
    exportedAt: new Date().toISOString(),
    app: 'rarebox',
    data: {
      portfolios: state || { portfolios: [], activePortfolioId: null, settings: { currency: 'USD' } },
    },
  }

  if (state?.snapshots) {
    backup.data.snapshots = state.snapshots
  }

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
  const result = { portfolios: 0, snapshots: 0, caches: 0 }

  // 1. Clear localStorage
  for (const key of Object.values(STORAGE_KEYS)) {
    localStorage.removeItem(key)
  }
  const oldCacheKeys = Object.keys(localStorage).filter(k => k.startsWith('ph_cache_'))
  oldCacheKeys.forEach(k => localStorage.removeItem(k))

  // 2. Write to localStorage (migration path for init())
  if (data.data.portfolios) {
    localStorage.setItem(STORAGE_KEYS.portfolios, JSON.stringify(data.data.portfolios))
    result.portfolios = data.data.portfolios.portfolios?.length || 0
  }

  if (data.data.settings) {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(data.data.settings))
  }

  if (data.data.snapshots) {
    localStorage.setItem(STORAGE_KEYS.snapshots, JSON.stringify(data.data.snapshots))
    const portfolioIds = Object.keys(data.data.snapshots)
    result.snapshots = portfolioIds.reduce((s, id) => s + (data.data.snapshots[id]?.length || 0), 0)
  }

  if (data.data.priceCache) {
    for (const [key, val] of Object.entries(data.data.priceCache)) {
      localStorage.setItem(key, typeof val === 'string' ? val : JSON.stringify(val))
      result.caches++
    }
  }

  // 3. Clear IDB app_state so init() picks up localStorage on reload
  try {
    await db.state.clear()
  } catch (e) {
    console.error('Failed to clear IDB:', e)
  }

  // 4. Reload
  window.location.replace(window.location.pathname)

  return result
}
