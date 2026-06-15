/**
 * Rarebox — Pokémon TCG Portfolio Tracker
 * Built by Nova — GitHub: @novaoc
 * https://rarebox.io
 */
import Dexie from 'dexie'

const db = new Dexie('Rarebox')
db.version(1).stores({
  state: 'key'
})

db.version(2).stores({
  prices_cache: 'key, game, timestamp'
})

export default db

// ── Persistence layer ──────────────────────────────────────────────────
// Single blob approach: entire app state stored as one JSON row.

export async function loadState() {
  try {
    const row = await db.state.get('app_state')
    return row?.value || null
  } catch (e) {
    console.error('IDB load failed:', e)
    return null
  }
}

export async function saveState(state) {
  try {
    await db.state.put({ key: 'app_state', value: state })
    return true
  } catch (e) {
    console.error('IDB save failed:', e)
    return false
  }
}

// ── Trade state (separate key to avoid conflicts with portfolio) ────────

export async function loadTradeState() {
  try {
    const row = await db.state.get('trade_state')
    return row?.value || null
  } catch (e) {
    console.error('IDB trade load failed:', e)
    return null
  }
}

export async function saveTradeState(state) {
  try {
    await db.state.put({ key: 'trade_state', value: state })
    return true
  } catch (e) {
    console.error('IDB trade save failed:', e)
    return false
  }
}

// ── Staleness helpers ──────────────────────────────────────────────────

const STALE_THRESHOLDS = {
  card: 24 * 60 * 60 * 1000,    // 24h — cards move slowly
  sealed: 12 * 60 * 60 * 1000,   // 12h — hype cycles on new releases
  graded: 12 * 60 * 60 * 1000,   // 12h — same as sealed
}

export function isStale(item) {
  if (!item.lastPriceUpdate) return true
  const age = Date.now() - new Date(item.lastPriceUpdate).getTime()
  const threshold = STALE_THRESHOLDS[item.type] || STALE_THRESHOLDS.card
  return age > threshold
}

export function hasNeverPriced(item) {
  return !item.lastPriceUpdate && !(item.currentMarketPrice || item.currentValue)
}
