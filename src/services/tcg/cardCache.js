/**
 * Card Cache — IndexedDB + in-memory index for instant search.
 *
 * Architecture:
 * - IndexedDB (Dexie) for persistent storage across page reloads
 * - In-memory Map index built on startup for O(1) search
 * - searchCache() filters the in-memory index (no IDB queries per search)
 */
import db from '../../db.js'
import { tokenMatch } from '../../utils/search.js'
import { TCGS } from './providers.js'

// ── Schema ──────────────────────────────────────────────────────────────────
db.version(3).stores({
  cards: '++cid, game, name, [game+name], [game+set]',
})

// ── In-memory search index ──────────────────────────────────────────────────
// Built once from IndexedDB on app startup. All searches hit this, not IDB.
let _index = null       // Map<lowercaseName, card[]>
let _allCards = null    // card[] — all cards for iteration
let _indexReady = false

/**
 * Build the in-memory search index from IndexedDB.
 * Call once on app startup. Takes <100ms for 50k cards.
 */
export async function buildSearchIndex() {
  const cards = await db.cards.toArray()
  _allCards = cards
  _index = new Map()
  for (const card of cards) {
    const key = (card.name || '').toLowerCase()
    if (!_index.has(key)) _index.set(key, [])
    _index.get(key).push(card)
  }
  _indexReady = true
  _byId = null
  return cards.length
}

/** Check if the search index is built and populated. */
export function isSearchReady() {
  return _indexReady && _allCards && _allCards.length > 0
}

/** Check if a specific game is in the in-memory index. */
export function isGameCached(game) {
  return _allCards ? _allCards.some(c => c.game === game) : false
}

let _byId = null

/** O(1) lookup of a cached card by game+id (used by the card scanner). */
export function getCachedCardById(game, id) {
  if (!_allCards) return null
  if (!_byId) {
    _byId = new Map()
    for (const c of _allCards) _byId.set(c.game + ':' + c.id, c)
  }
  return _byId.get(game + ':' + id) || null
}

/** Raw cached cards for one game (for background price merges). */
export async function getGameCards(game) {
  return db.cards.where('game').equals(game).toArray()
}

/** Total cards in the index. */
export function getCardCount() {
  return _allCards ? _allCards.length : 0
}

// ── Persistence helpers ─────────────────────────────────────────────────────

export function isCardDatabaseReady() {
  return localStorage.getItem('rarebox_card_db_ready') === '1'
}

export function saveCardDatabaseReady() {
  localStorage.setItem('rarebox_card_db_ready', '1')
}

export function clearCardDatabaseReady() {
  localStorage.removeItem('rarebox_card_db_ready')
}

// ── TCG Preferences ─────────────────────────────────────────────────────────

const PREFS_KEY = 'rarebox_tcg_prefs'

/** Get user's selected TCGs. Returns null if never set (first visit). */
export function getTcgPrefs() {
  const raw = localStorage.getItem(PREFS_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

/** Save user's selected TCG list. */
export function saveTcgPrefs(games) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(games))
}

// ── Card storage ────────────────────────────────────────────────────────────

/** Check if a specific game has cards cached in IDB. */
export async function hasGameCards(game) {
  return await db.cards.where('game').equals(game).count() > 0
}

/** Check if a game's cached cards are fresh (< 24h old). */
export async function isCacheFresh(game) {
  // Check if we have any cards for this game
  const count = await db.cards.where('game').equals(game).count()
  if (count === 0) return false
  
  // Check the first card's cachedAt timestamp
  const card = await db.cards.where('game').equals(game).first()
  if (!card) return false
  
  const age = Date.now() - (card.cachedAt || 0)
  // Cache is fresh if less than 24h old AND we have at least some cards
  // (partial cache from interrupted preload is better than nothing)
  return age < 86_400_000 && count > 0
}

/** Get card counts per game from IDB. */
export async function getCardCounts() {
  const games = TCGS.map(t => t.id)
  const counts = {}
  for (const g of games) {
    counts[g] = await db.cards.where('game').equals(g).count()
  }
  counts.total = Object.values(counts).reduce((a, b) => a + b, 0)
  return counts
}

/**
 * Bulk-insert cards for a game. Replaces all existing cards for that game.
 * After saving, rebuilds the in-memory index so searches are immediately updated.
 */
export async function saveGameCards(game, cards) {
  const now = Date.now()
  await db.transaction('rw', db.cards, async () => {
    await db.cards.where('game').equals(game).delete()
    await db.cards.bulkAdd(cards.map(c => ({
      ...c,
      game,
      cachedAt: now,
    })))
  })
  // Keep the in-memory index in sync so freshly saved cards are searchable
  // immediately (the preloader saves per game, possibly in multiple phases —
  // e.g. Pokémon card data lands seconds in, prices minutes later).
  await buildSearchIndex()
}

/** Clear all cached cards. */
export async function clearCardCache() {
  await db.cards.clear()
  _index = null
  _allCards = null
  _indexReady = false
}

// ── Search ──────────────────────────────────────────────────────────────────

/**
 * Search the in-memory card index. Returns results matching multiSearch shape.
 * Pure in-memory — no IndexedDB queries, no network requests.
 */
export function searchCache(query, { page = 1, pageSize = 20, providers } = {}) {
  const q = query.toLowerCase().trim()
  if (!q || !_allCards) return { cards: [], totalCount: 0 }

  // Filter to selected TCGs only
  const active = providers && providers.length > 0 ? new Set(providers) : null

  const matches = []
  for (const card of _allCards) {
    if (active && !active.has(card.game)) continue
    if (tokenMatch(q, card.name, card.set, card.number)) {
      matches.push(card)
    }
  }

  // Sort by relevance: exact > starts-with > includes
  matches.sort((a, b) => {
    const an = a.name.toLowerCase()
    const bn = b.name.toLowerCase()
    const aExact = an === q ? 0 : 1
    const bExact = bn === q ? 0 : 1
    if (aExact !== bExact) return aExact - bExact
    const aStarts = an.startsWith(q) ? 0 : 1
    const bStarts = bn.startsWith(q) ? 0 : 1
    if (aStarts !== bStarts) return aStarts - bStarts
    return an.localeCompare(bn)
  })

  const totalCount = matches.length
  const start = (page - 1) * pageSize
  const paged = matches.slice(start, start + pageSize)

  return {
    cards: paged.map(({ cachedAt, ...card }) => card),
    totalCount,
  }
}
