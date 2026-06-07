import db from '../db'

const CACHE_DURATION = 6 * 60 * 60 * 1000 // 6 hours

export async function getPrice(game, identifier) {
  const cacheKey = `${game}:${identifier}`
  
  // 1. Check local Dexie.js cache
  const cached = await db.prices_cache.get(cacheKey)
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data
  }

  // 2. Route-dispatching based on Game
  let data
  try {
    switch (game.toLowerCase()) {
      case 'mtg':
        data = await fetchMTGPrice(identifier)
        break
      case 'one-piece':
        data = await fetchOnePiecePrice(identifier)
        break
      case 'riftbound':
        data = await fetchRiftboundPrice(identifier)
        break
      default:
        throw new Error(`Unsupported game: ${game}`)
    }

    // 3. Update cache
    await db.prices_cache.put({
      key: cacheKey,
      game,
      data,
      timestamp: Date.now()
    })

    return data
  } catch (error) {
    console.error(`Price fetch failed for ${game}:`, error)
    return cached ? cached.data : null // Fallback to stale cache if network fails
  }
}

/**
 * MTG: Fetch directly from Scryfall API on client side
 */
async function fetchMTGPrice(id) {
  const response = await fetch(`https://api.scryfall.com/cards/${id}`)
  if (!response.ok) throw new Error('Scryfall request failed')
  const json = await response.json()
  return {
    usd: json.prices.usd,
    usd_foil: json.prices.usd_foil,
    market: json.prices.usd || json.prices.usd_foil
  }
}

/**
 * One Piece: Hits edge proxy to preserve secret keys/bypass CORS
 */
async function fetchOnePiecePrice(id) {
  const response = await fetch(`/api/prices/one-piece?id=${encodeURIComponent(id)}`)
  if (!response.ok) throw new Error('One Piece price proxy failed')
  return await response.json()
}

/**
 * Riftbound: Hits edge proxy to preserve secret keys/bypass CORS
 */
async function fetchRiftboundPrice(id) {
  const response = await fetch(`/api/prices/riftbound?id=${encodeURIComponent(id)}`)
  if (!response.ok) throw new Error('Riftbound price proxy failed')
  return await response.json()
}
