/**
 * Card Preloader — Fetches all TCG card data and stores in IndexedDB.
 * Each TCG has its own fetch strategy (bulk data, single API, per-set).
 *
 * Progress callbacks: onProgress({ game, phase, loaded, total })
 */
import { saveGameCards, clearGameCards } from './cardCache.js'

const TIMEOUT = 30000

async function fetchJson(url, signal) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: signal || AbortSignal.timeout(TIMEOUT),
  })
  if (!res.ok) throw new Error(`http_${res.status}`)
  return res.json()
}

function num(v) {
  if (v == null) return null
  const n = parseFloat(String(v).replace(/[$,]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

// ── Pokemon ─────────────────────────────────────────────────────────────────
// Uses the bulk data endpoint for fast full download.

async function fetchPokemon(onProgress) {
  onProgress({ game: 'pokemon', phase: 'Fetching bulk data…', loaded: 0, total: 0 })

  // Get bulk data manifest
  const manifest = await fetchJson('https://api.pokemontcg.io/v2/bulk-data')
  const allCards = manifest.data?.find(d => d.type === 'all_cards')
  if (!allCards?.download_uri) throw new Error('No bulk data endpoint')

  onProgress({ game: 'pokemon', phase: 'Downloading all cards…', loaded: 0, total: 0 })

  const bulk = await fetchJson(allCards.download_uri)
  const cards = bulk.data || []

  onProgress({ game: 'pokemon', phase: 'Processing…', loaded: cards.length, total: cards.length })

  const normalized = cards.map(c => {
    const prices = c.tcgplayer?.prices || {}
    const price = prices.holofoil?.market
      || prices['1stEditionHolofoil']?.market
      || prices.unlimitedHolofoil?.market
      || prices.reverseHolofoil?.market
      || prices.normal?.market
      || null
    return {
      id: c.id,
      name: c.name,
      set: c.set?.name || '',
      number: c.number || '',
      image: c.images?.small || '',
      price: num(price),
      rarity: c.rarity || '',
    }
  })

  await saveGameCards('pokemon', normalized)
  return normalized.length
}

// ── MTG ─────────────────────────────────────────────────────────────────────
// Uses Scryfall bulk data for fast download.

async function fetchMtg(onProgress) {
  onProgress({ game: 'mtg', phase: 'Fetching bulk data…', loaded: 0, total: 0 })

  const manifest = await fetchJson('https://api.scryfall.com/bulk-data')
  const oracleCards = manifest.data?.find(d => d.type === 'oracle_cards')
  const defaultCards = manifest.data?.find(d => d.type === 'default_cards')
  const bulk = oracleCards || defaultCards
  if (!bulk?.download_uri) throw new Error('No bulk data endpoint')

  onProgress({ game: 'mtg', phase: 'Downloading all cards…', loaded: 0, total: 0 })

  const data = await fetchJson(bulk.download_uri)
  const cards = Array.isArray(data) ? data : []

  onProgress({ game: 'mtg', phase: 'Processing…', loaded: cards.length, total: cards.length })

  const normalized = cards
    .filter(c => !c.digital) // exclude digital-only
    .map(c => {
      const img = c.image_uris || c.card_faces?.[0]?.image_uris
      return {
        id: c.id,
        name: c.name,
        set: c.set_name || '',
        number: c.collector_number || '',
        image: img?.small || '',
        price: num(c.prices?.usd || c.prices?.usd_foil),
        rarity: c.rarity || '',
      }
    })

  await saveGameCards('mtg', normalized)
  return normalized.length
}

// ── Lorcana ─────────────────────────────────────────────────────────────────
// Fetches all cards via lorcast API (single request, ~2000 cards).

async function fetchLorcana(onProgress) {
  onProgress({ game: 'lorcana', phase: 'Fetching cards…', loaded: 0, total: 0 })

  // lorcast search with empty query returns all cards
  const d = await fetchJson('https://api.lorcast.com/v0/cards/search?q=&limit=5000')
  const cards = d.data || []

  onProgress({ game: 'lorcana', phase: 'Processing…', loaded: cards.length, total: cards.length })

  const normalized = cards.map(c => {
    const set_name = c.set_name || c.set?.name || ''
    const name = c.version ? `${c.name} — ${c.version}` : c.name
    return {
      id: c.id || c.name,
      name,
      set: set_name,
      number: c.number || '',
      image: c.image_uris?.small || c.image || '',
      price: num(c.tcgplayer?.prices?.holofoil?.market || c.tcgplayer?.prices?.normal?.market),
      rarity: c.rarity || '',
    }
  })

  await saveGameCards('lorcana', normalized)
  return normalized.length
}

// ── One Piece ───────────────────────────────────────────────────────────────
// Single API call fetches all ~3300 cards.

async function fetchOnePiece(onProgress) {
  onProgress({ game: 'one-piece', phase: 'Fetching cards…', loaded: 0, total: 0 })

  const d = await fetchJson('https://optcgapi.com/api/allSetCards/')
  const cards = d.data || d || []

  onProgress({ game: 'one-piece', phase: 'Processing…', loaded: cards.length, total: cards.length })

  const normalized = cards.map(c => ({
    id: c.card_id || c.id || c.card_name,
    name: c.card_name || '',
    set: c.set_name || c.card_set_id || '',
    number: c.card_number || c.card_id || '',
    image: c.card_image || '',
    price: num(c.market_price || c.inventory_price),
    rarity: c.rarity || '',
  }))

  await saveGameCards('one-piece', normalized)
  return normalized.length
}

// ── Yu-Gi-Oh ────────────────────────────────────────────────────────────────
// Fetches set list, then cards per set (batched to avoid rate limits).

async function fetchYugioh(onProgress) {
  onProgress({ game: 'yugioh', phase: 'Fetching sets…', loaded: 0, total: 0 })

  const YGO_API = 'https://db.ygoprodeck.com/api/v7'
  const setsData = await fetchJson(`${YGO_API}/cardsets.php`)
  const sets = setsData.filter(s => s.num_of_cards > 0 && s.tcg_date)

  onProgress({ game: 'yugioh', phase: `Loading ${sets.length} sets…`, loaded: 0, total: sets.length })

  const allCards = []
  const seen = new Set() // dedupe by id

  for (let i = 0; i < sets.length; i++) {
    const s = sets[i]
    try {
      const d = await fetchJson(`${YGO_API}/cardinfo.php?cardset=${encodeURIComponent(s.set_name)}`)
      for (const c of (d.data || [])) {
        if (seen.has(c.id)) continue
        seen.add(c.id)
        const setInfo = (c.card_sets || []).find(cs => cs.set_name === s.set_name) || {}
        const prices = c.card_prices?.[0] || {}
        const imgs = c.card_images || []
        allCards.push({
          id: String(c.id),
          name: c.name,
          set: s.set_name,
          number: setInfo.set_code || '',
          image: imgs[0]?.image_url_small || imgs[0]?.image_url || '',
          price: num(prices.tcgplayer_price),
          rarity: setInfo.set_rarity || '',
        })
      }
    } catch { /* skip failed sets */ }

    onProgress({
      game: 'yugioh',
      phase: `Loading sets… ${i + 1}/${sets.length}`,
      loaded: i + 1,
      total: sets.length,
    })
  }

  await saveGameCards('yugioh', allCards)
  return allCards.length
}

// ── Riftbound ───────────────────────────────────────────────────────────────
// Per-set fetch with PriceCharting prices.

async function fetchRiftbound(onProgress) {
  onProgress({ game: 'riftbound', phase: 'Fetching sets…', loaded: 0, total: 0 })

  const setsRes = await fetchJson('https://riftcodex.com/sets')
  const sets = setsRes.data || setsRes || []

  onProgress({ game: 'riftbound', phase: `Loading ${sets.length} sets…`, loaded: 0, total: sets.length })

  const allCards = []
  const PC_BASE = 'https://www.pricecharting.com/search-products'

  for (let i = 0; i < sets.length; i++) {
    const s = sets[i]
    try {
      // Fetch cards for this set (paginate)
      let page = 1
      let hasMore = true
      const setCards = []
      while (hasMore && page <= 20) {
        const d = await fetchJson(`https://riftcodex.com/cards?set_id=${s.id || s.slug}&limit=50&page=${page}`)
        const items = d.data || d || []
        if (items.length === 0) { hasMore = false; break }
        setCards.push(...items)
        page++
      }

      // Fetch PriceCharting prices for this set
      const pcData = await fetchJson(`${PC_BASE}?type=prices&q=riftbound+${encodeURIComponent(s.name || s.label || '')}`)
      const priceMap = {}
      for (const p of (pcData.products || [])) {
        const numMatch = (p.productName || '').match(/#(\d+)/)
        if (numMatch && p.price1) {
          const n = numMatch[1]
          priceMap[n] = num(p.price1)
        }
      }

      for (const c of setCards) {
        const cNum = String(c.number || c.collector_number || '')
        allCards.push({
          id: `${s.id || s.slug}-${cNum}`,
          name: c.name || '',
          set: s.name || s.label || '',
          number: cNum,
          image: c.image || c.image_url || '',
          price: priceMap[cNum] || null,
          rarity: c.rarity || '',
        })
      }
    } catch { /* skip failed sets */ }

    onProgress({
      game: 'riftbound',
      phase: `Loading sets… ${i + 1}/${sets.length}`,
      loaded: i + 1,
      total: sets.length,
    })
  }

  await saveGameCards('riftbound', allCards)
  return allCards.length
}

// ── Main Preloader ──────────────────────────────────────────────────────────

const FETCHERS = {
  pokemon: fetchPokemon,
  mtg: fetchMtg,
  lorcana: fetchLorcana,
  'one-piece': fetchOnePiece,
  yugioh: fetchYugioh,
  riftbound: fetchRiftbound,
}

const GAME_ORDER = ['pokemon', 'mtg', 'lorcana', 'one-piece', 'yugioh', 'riftbound']

/**
 * Preload all TCG card data into IndexedDB.
 * @param {Function} onProgress - Called with { game, phase, loaded, total }
 * @param {string[]} games - Which games to load (default: all)
 * @returns {Object} Card counts per game
 */
export async function preloadAll(onProgress = () => {}, games = GAME_ORDER) {
  const counts = {}

  for (const game of games) {
    const fetcher = FETCHERS[game]
    if (!fetcher) continue

    try {
      onProgress({ game, phase: 'Starting…', loaded: 0, total: 0 })
      const count = await fetcher(onProgress)
      counts[game] = count
      onProgress({ game, phase: 'Done', loaded: count, total: count })
    } catch (err) {
      console.error(`Failed to preload ${game}:`, err)
      counts[game] = 0
      onProgress({ game, phase: `Failed: ${err.message}`, loaded: 0, total: 0 })
    }
  }

  counts.total = Object.values(counts).reduce((a, b) => a + b, 0)
  return counts
}

/**
 * Refresh prices only (update existing cached cards with fresh prices).
 */
export async function refreshPrices(onProgress = () => {}) {
  // For now, just re-run the full preload — APIs return prices inline
  // A smarter approach would hit price-only endpoints, but these APIs
  // bundle prices with card data.
  return preloadAll(onProgress)
}
