// Multi-TCG pricing & search for Rarebox.
//
// Backed by PriceCharting's CORS-open JSON search endpoint, which covers every
// major TCG (Pokémon, Magic, One Piece, Riftbound, …) — so a single source
// powers search + pricing for any supported game. Results are cached in
// IndexedDB (Dexie `prices_cache` table) so repeat lookups are instant and
// survive reloads.
//
// Pokémon singles/graded continue to use the richer pokemontcg.io path; this
// service is what makes OTHER TCGs trackable in the app.

import db from '../db'

const PC_BASE = 'https://www.pricecharting.com'
const CACHE_DURATION = 6 * 60 * 60 * 1000 // 6 hours

// Games the app can track. `suffix` is appended to the search query to bias
// PriceCharting toward the right catalog; `match` filters results by console.
export const SUPPORTED_GAMES = [
  { id: 'pokemon',   label: 'Pokémon',   suffix: 'pokemon',   match: 'pokemon' },
  { id: 'magic',     label: 'Magic: The Gathering', suffix: 'magic', match: 'magic' },
  { id: 'yugioh',    label: 'Yu-Gi-Oh!', suffix: 'yugioh',   match: 'yugioh' },
  { id: 'one-piece', label: 'One Piece',  suffix: 'one piece', match: 'one piece' },
  { id: 'lorcana',   label: 'Lorcana',    suffix: 'lorcana',   match: 'lorcana' },
  { id: 'riftbound', label: 'Riftbound',  suffix: 'riftbound', match: 'riftbound' },
]

export function gameLabel(id) {
  return (SUPPORTED_GAMES.find(g => g.id === id) || {}).label || id
}

function gameDef(id) {
  return SUPPORTED_GAMES.find(g => g.id === id) || SUPPORTED_GAMES[0]
}

function parsePrice(val) {
  if (typeof val === 'number') return val > 0 ? val : null
  if (!val) return null
  const n = parseFloat(String(val).replace(/[$,]/g, '').trim())
  return Number.isFinite(n) && n > 0 ? n : null
}

// Heuristic: is this product a sealed product (box/pack/…) vs a single card?
const SEALED_HINTS = [
  'booster box', 'booster bundle', 'elite trainer', 'booster pack', 'box set',
  ' box', 'case', ' pack', ' tin', 'collection', 'bundle', 'display', 'blister',
  'starter deck', 'theme deck', 'gift set', 'premium',
]
function inferSealed(name) {
  const n = (name || '').toLowerCase()
  return SEALED_HINTS.some(h => n.includes(h))
}

async function cacheGet(key) {
  try {
    const row = await db.prices_cache.get(key)
    if (row && Date.now() - row.timestamp < CACHE_DURATION) return row.data
  } catch { /* IDB unavailable — fall through to network */ }
  return null
}

async function cacheSet(key, game, data) {
  try {
    await db.prices_cache.put({ key, game, data, timestamp: Date.now() })
  } catch { /* best effort */ }
}

async function rawSearch(query) {
  const url = `${PC_BASE}/search-products?type=prices&q=${encodeURIComponent(query)}`
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`pc_error_${res.status}`)
  const data = await res.json()
  return Array.isArray(data) ? data : (data.products || [])
}

/**
 * Search PriceCharting for products of a given game.
 * @param {string} query  free-text (card or sealed product name)
 * @param {string} game   one of SUPPORTED_GAMES ids
 * @returns {Promise<Array<{name,set,image,price,all_prices,url,slug,sealed}>>}
 */
export async function searchProducts(query, game = 'pokemon') {
  const q = (query || '').trim()
  if (!q) return []

  const def = gameDef(game)
  const cacheKey = `search:${def.id}:${q.toLowerCase()}`
  const cached = await cacheGet(cacheKey)
  if (cached) return cached

  let products
  try {
    products = await rawSearch(`${q} ${def.suffix}`)
  } catch (e) {
    if (e.name === 'TimeoutError' || e.name === 'AbortError') throw new Error('timeout')
    throw new Error('server_down')
  }

  // Prefer products whose console matches the game; fall back to all results so
  // a valid search never comes back empty just because PriceCharting omits the
  // game name from consoleName.
  let matched = products.filter(p => (p.consoleName || '').toLowerCase().includes(def.match))
  if (matched.length === 0) matched = products

  const skip = ['sleeve', 'portfolio', 'binder', 'dice', 'coin', 'playmat']
  const results = matched
    .filter(p => !skip.some(s => (p.productName || '').toLowerCase().includes(s)))
    .map(p => ({
      name: p.productName || '',
      set: p.consoleName || '',
      image: p.imageUri || '',
      price: parsePrice(p.price1),
      all_prices: {
        ungraded: parsePrice(p.price1),
        grade9:   parsePrice(p.price2),
        grade10:  parsePrice(p.price3),
      },
      url: p.id ? `${PC_BASE}/game/${p.id}` : '',
      slug: p.id || '',
      sealed: inferSealed(p.productName),
    }))

  await cacheSet(cacheKey, def.id, results)
  return results
}

/**
 * Market price for a known product name of a given game.
 * Used by portfolio refresh. Returns a number, or null if not found.
 */
export async function getPrice(query, game = 'pokemon') {
  const q = (query || '').trim()
  if (!q) return null
  try {
    const results = await searchProducts(q, game)
    const hit = results.find(r => r.price != null) || results[0]
    return hit ? hit.price : null
  } catch {
    return null
  }
}
