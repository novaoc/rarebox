/**
 * Card Cache — IndexedDB-backed card database for instant search.
 * Stores all TCG cards in a unified format so search never hits the network.
 */
import db from '../db.js'

// ── Schema ──────────────────────────────────────────────────────────────────
// Version 3 adds a 'cards' table indexed by game + name for fast text search.
db.version(3).stores({
  cards: '++cid, game, name, [game+name], [game+set]',
})

const TTL_24H = 24 * 60 * 60 * 1000

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Check if the card database is populated (at least one game cached). */
export async function isCardCacheReady() {
  const count = await db.cards.count()
  return count > 0
}

/** Get total cached card count per game. */
export async function getCardCounts() {
  const games = ['pokemon', 'mtg', 'lorcana', 'one-piece', 'riftbound', 'yugioh']
  const counts = {}
  for (const g of games) {
    counts[g] = await db.cards.where('game').equals(g).count()
  }
  counts.total = Object.values(counts).reduce((a, b) => a + b, 0)
  return counts
}

/** Check if cache is stale (older than 24h). */
export async function isCacheStale() {
  const sample = await db.cards.limit(1).first()
  if (!sample) return true
  return Date.now() - (sample.cachedAt || 0) > TTL_24H
}

/** Clear all cached cards (for full refresh). */
export async function clearCardCache() {
  await db.cards.clear()
}

/** Mark the card database as ready (stored in localStorage). */
export function saveCardDatabaseReady() {
  localStorage.setItem('rarebox_card_db_ready', '1')
}

/** Check if card database was previously set up. */
export function isCardDatabaseReady() {
  return localStorage.getItem('rarebox_card_db_ready') === '1'
}

/** Clear cards for a specific game. */
export async function clearGameCache(game) {
  await db.cards.where('game').equals(game).delete()
}

/**
 * Bulk-insert cards for a game. Replaces all existing cards for that game.
 * Each card: { game, id, name, set, number, image, price, rarity }
 */
export async function saveGameCards(game, cards) {
  const now = Date.now()
  const tx = db.transaction('rw', db.cards, async () => {
    // Remove old cards for this game
    await db.cards.where('game').equals(game).delete()
    // Insert new cards
    await db.cards.bulkAdd(cards.map(c => ({
      ...c,
      game,
      cachedAt: now,
    })))
  })
  await tx
}

/**
 * Update prices for a game without replacing card data.
 * prices: Map<cardId, number>
 */
export async function updatePrices(game, priceMap) {
  const tx = db.transaction('rw', db.cards, async () => {
    const cards = await db.cards.where('game').equals(game).toArray()
    for (const card of cards) {
      const newPrice = priceMap.get(String(card.id))
      if (newPrice != null) {
        card.price = newPrice
        card.cachedAt = Date.now()
        await db.cards.put(card)
      }
    }
  })
  await tx
}

// ── Search ──────────────────────────────────────────────────────────────────

/**
 * Search the local card cache. Returns normalized results matching multiSearch shape.
 * Uses IndexedDB range queries for efficient prefix matching.
 */
export async function searchCache(query, { page = 1, pageSize = 20, category = 'cards' } = {}) {
  if (category === 'sealed') return { cards: [], totalCount: 0 }

  const q = query.toLowerCase().trim()
  if (!q) return { cards: [], totalCount: 0 }

  // Get all matching cards across all games
  // We filter in-memory since IDB text search is limited
  const allCards = await db.cards.toArray()

  const matches = allCards.filter(c => {
    const name = (c.name || '').toLowerCase()
    const set = (c.set || '').toLowerCase()
    const number = (c.number || '').toLowerCase()
    return name.includes(q) || set.includes(q) || number.includes(q)
  })

  // Sort by relevance: exact match > starts-with > includes
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

  // Normalize to multiSearch shape (strip cachedAt)
  return {
    cards: paged.map(({ cachedAt, ...card }) => card),
    totalCount,
  }
}
