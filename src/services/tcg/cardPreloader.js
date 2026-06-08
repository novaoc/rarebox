/**
 * Card Preloader — Fetches TCG card data and stores in IndexedDB.
 *
 * Two-phase approach:
 * Phase 1 (fast): Fetch set lists for all TCGs — ~6 API calls, ~2 seconds
 * Phase 2 (background): Progressively preload full card data per TCG
 *
 * Retry logic: Each failed TCG gets 2 retries with exponential backoff.
 */

import { saveGameCards, hasGameCards } from './cardCache.js'

const BULK_TIMEOUT = 300_000   // 5 min for large downloads
const API_TIMEOUT = 30_000     // 30s for normal API calls
const RETRY_DELAY = [2000, 5000] // backoff: 2s, 5s

async function fetchJson(url, timeout = API_TIMEOUT) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(timeout),
  })
  if (!res.ok) throw new Error(`http_${res.status}`)
  return res.json()
}

function num(v) {
  if (v == null) return null
  const n = parseFloat(String(v).replace(/[$,]/g, ''))
  return Number.isFinite(n) ? (n >= 0 ? n : null) : null
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

/** Fetch with retry. Tries up to `retries` times with exponential backoff. */
async function fetchWithRetry(fn, retries = 2, onProgress = () => {}) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt < retries) {
        const delay = RETRY_DELAY[attempt] || 5000
        onProgress({ phase: `Retrying in ${delay / 1000}s… (${attempt + 1}/${retries})` })
        await sleep(delay)
      } else {
        throw err
      }
    }
  }
}

// ── Pokemon ─────────────────────────────────────────────────────────────────
// Paginated: 250 cards per request, ~82 pages for 20k cards.
// Uses 100ms delay between requests to respect rate limits.

async function fetchPokemon(onProgress) {
  const PAGE_SIZE = 250
  const allCards = []
  let page = 1
  let hasMore = true

  onProgress({ game: 'pokemon', phase: 'Fetching cards…', loaded: 0, total: 0 })

  while (hasMore) {
    const d = await fetchJson(
      `https://api.pokemontcg.io/v2/cards?page=${page}&pageSize=${PAGE_SIZE}&select=id,name,number,set,rarity,tcgplayer,images`
    )
    const cards = d.data || []
    if (cards.length === 0) { hasMore = false; break }

    for (const c of cards) {
      const prices = c.tcgplayer?.prices || {}
      const price = prices.holofoil?.market
        || prices['1stEditionHolofoil']?.market
        || prices.unlimitedHolofoil?.market
        || prices.reverseHolofoil?.market
        || prices.normal?.market
        || null
      allCards.push({
        id: c.id,
        name: c.name,
        set: c.set?.name || '',
        number: c.number || '',
        image: c.images?.small || '',
        price: num(price),
        rarity: c.rarity || '',
      })
    }

    hasMore = cards.length === PAGE_SIZE
    page++

    onProgress({
      game: 'pokemon',
      phase: `Cards ${allCards.length.toLocaleString()}…`,
      loaded: allCards.length,
      total: d.totalCount || 0,
    })

    // Rate limit: 30 req/min without key, 100ms between requests is safe
    await sleep(100)
  }

  await saveGameCards('pokemon', allCards)
  return allCards.length
}

// ── MTG ─────────────────────────────────────────────────────────────────────
// Paginated via Scryfall: 175 cards per request, ~660 pages for 115k cards.
// Respects 100ms delay between requests.

async function fetchMtg(onProgress) {
  const PAGE_SIZE = 175
  const allCards = []
  let url = `https://api.scryfall.com/cards/search?q=&unique=prints&order=released&page=1&pageSize=${PAGE_SIZE}`
  let page = 0

  onProgress({ game: 'mtg', phase: 'Fetching cards…', loaded: 0, total: 0 })

  while (url) {
    const d = await fetchJson(url)
    const cards = d.data || []

    for (const c of cards) {
      const img = c.image_uris || c.card_faces?.[0]?.image_uris
      allCards.push({
        id: c.id,
        name: c.name,
        set: c.set_name || '',
        number: c.collector_number || '',
        image: img?.small || '',
        price: num(c.prices?.usd) || num(c.prices?.usd_foil),
        rarity: c.rarity || '',
      })
    }

    url = d.has_more ? d.next_page : null
    page++

    onProgress({
      game: 'mtg',
      phase: `Cards ${allCards.length.toLocaleString()}…`,
      loaded: allCards.length,
      total: d.total_cards || 0,
    })

    // Scryfall asks for 50-100ms between requests
    await sleep(100)
  }

  await saveGameCards('mtg', allCards)
  return allCards.length
}

// ── Lorcana ─────────────────────────────────────────────────────────────────
// Fetch sets, then cards per set. ~19 requests total.

async function fetchLorcana(onProgress) {
  onProgress({ game: 'lorcana', phase: 'Fetching sets…', loaded: 0, total: 0 })

  const setsData = await fetchJson('https://api.lorcast.com/v0/sets')
  const sets = setsData.results || setsData || []

  onProgress({ game: 'lorcana', phase: `${sets.length} sets found…`, loaded: 0, total: sets.length })

  const allCards = []
  for (let i = 0; i < sets.length; i++) {
    const s = sets[i]
    try {
      const d = await fetchJson(`https://api.lorcast.com/v0/sets/${s.code || s.id}/cards`)
      const cards = d.results || d || []
      for (const c of cards) {
        const set_name = c.set_name || s.name || ''
        const name = c.version ? `${c.name} — ${c.version}` : c.name
        allCards.push({
          id: c.id || `${set_name}-${c.number}`,
          name,
          set: set_name,
          number: c.collector_number || c.number || '',
          image: c.image_uris?.small || c.image || '',
          price: num(c.tcgplayer?.prices?.holofoil?.market || c.tcgplayer?.prices?.normal?.market),
          rarity: c.rarity || '',
        })
      }
    } catch { /* skip failed sets */ }

    onProgress({
      game: 'lorcana',
      phase: `Sets ${i + 1}/${sets.length}`,
      loaded: i + 1,
      total: sets.length,
    })

    await sleep(50)
  }

  await saveGameCards('lorcana', allCards)
  return allCards.length
}

// ── One Piece ───────────────────────────────────────────────────────────────
// Single API call gets all ~3,300 cards.

async function fetchOnePiece(onProgress) {
  onProgress({ game: 'one-piece', phase: 'Fetching all cards…', loaded: 0, total: 0 })

  const d = await fetchJson('https://optcgapi.com/api/allSetCards/')
  const cards = Array.isArray(d) ? d : d?.data || []

  onProgress({ game: 'one-piece', phase: 'Processing…', loaded: cards.length, total: cards.length })

  const normalized = cards.map(c => ({
    id: c.card_set_id || c.card_name,
    name: c.card_name || '',
    set: c.set_name || '',
    number: c.card_set_id || '',
    image: c.card_image || '',
    price: num(c.market_price || c.inventory_price),
    rarity: c.rarity || '',
  }))

  await saveGameCards('one-piece', normalized)
  return normalized.length
}

// ── Yu-Gi-Oh ────────────────────────────────────────────────────────────────
// Batch fetching: 5000 cards per request. ~38k cards = ~8 requests.

async function fetchYugioh(onProgress) {
  const YGO_API = 'https://db.ygoprodeck.com/api/v7'
  const BATCH = 5000
  const allCards = []
  const seen = new Set()
  let offset = 0

  onProgress({ game: 'yugioh', phase: 'Fetching cards…', loaded: 0, total: 0 })

  while (offset < 100_000) { // safety guard
    const d = await fetchJson(`${YGO_API}/cardinfo.php?num=${BATCH}&offset=${offset}`)
    const cards = d.data || []
    if (cards.length === 0) break

    for (const c of cards) {
      if (seen.has(c.id)) continue
      seen.add(c.id)

      const prices = c.card_prices?.[0] || {}
      const imgs = c.card_images || []
      const setInfo = c.card_sets?.[0] || {}

      allCards.push({
        id: String(c.id),
        name: c.name,
        set: setInfo.set_name || '',
        number: setInfo.set_code || '',
        image: imgs[0]?.image_url_small || imgs[0]?.image_url || '',
        price: num(prices.tcgplayer_price),
        rarity: setInfo.set_rarity || '',
      })
    }

    offset += BATCH
    if (cards.length < BATCH) break

    onProgress({
      game: 'yugioh',
      phase: `Cards ${allCards.length.toLocaleString()}…`,
      loaded: allCards.length,
      total: 0,
    })

    await sleep(100) // respect 20 req/sec limit
  }

  await saveGameCards('yugioh', allCards)
  return allCards.length
}

// ── Riftbound ───────────────────────────────────────────────────────────────
// Small dataset: ~1,064 cards across 7 sets. Fully preloadable.

async function fetchRiftbound(onProgress) {
  onProgress({ game: 'riftbound', phase: 'Fetching sets…', loaded: 0, total: 0 })

  const setsRes = await fetchJson('https://api.riftcodex.com/sets')
  const sets = setsRes.items || setsRes.data || setsRes || []

  onProgress({ game: 'riftbound', phase: `${sets.length} sets…`, loaded: 0, total: sets.length })

  const allCards = []
  const PC_BASE = 'https://www.pricecharting.com/search-products'

  for (let i = 0; i < sets.length; i++) {
    const s = sets[i]
    try {
      // Paginate cards for this set
      let page = 1
      let total = Infinity
      const setCards = []
      while (setCards.length < total && page <= 20) {
        const d = await fetchJson(`https://api.riftcodex.com/cards?set_id=${encodeURIComponent(s.set_id || s.slug)}&limit=50&page=${page}`)
        const items = d.items || d.data || d || []
        total = d.total || items.length || 0
        setCards.push(...items)
        page++
      }

      // Fetch PriceCharting prices
      let priceMap = {}
      try {
        const pcData = await fetchJson(`${PC_BASE}?type=prices&q=riftbound+${encodeURIComponent(s.name || s.label || '')}`)
        for (const p of (pcData.products || [])) {
          const numMatch = (p.productName || '').match(/#(\d+)/)
          if (numMatch && p.price1) {
            priceMap[numMatch[1]] = num(p.price1)
          }
        }
      } catch { /* prices optional */ }

      for (const c of setCards) {
        const cNum = String(c.collector_number || c.number || '')
        allCards.push({
          id: `${s.set_id || s.slug}-${cNum}`,
          name: c.name || '',
          set: s.name || s.label || '',
          number: cNum,
          image: c.media?.image_url || c.image || '',
          price: priceMap[cNum] || null,
          rarity: c.classification?.rarity || c.rarity || '',
        })
      }
    } catch { /* skip failed sets */ }

    onProgress({
      game: 'riftbound',
      phase: `Sets ${i + 1}/${sets.length}`,
      loaded: i + 1,
      total: sets.length,
    })

    await sleep(100)
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

// Fast TCGs that complete in <10 seconds
const FAST_GAMES = ['one-piece', 'lorcana', 'riftbound']
// Slow TCGs that take minutes
const SLOW_GAMES = ['pokemon', 'mtg', 'yugioh']

/**
 * Preload fast TCGs only (One Piece, Lorcana, Riftbound).
 * Used during the initial loading screen — completes in ~5 seconds.
 */
export async function preloadFast(onProgress = () => {}) {
  const counts = {}
  for (const game of FAST_GAMES) {
    const fetcher = FETCHERS[game]
    if (!fetcher) continue
    try {
      onProgress({ game, phase: 'Starting…', loaded: 0, total: 0 })
      counts[game] = await fetchWithRetry((p) => fetcher(p), 2, onProgress)
      onProgress({ game, phase: 'Done', loaded: counts[game], total: counts[game] })
    } catch (err) {
      console.error(`Failed to preload ${game}:`, err)
      counts[game] = 0
      onProgress({ game, phase: `Failed: ${err.message}`, loaded: 0, total: 0 })
    }
  }
  return counts
}

/**
 * Preload slow TCGs in the background (Pokemon, MTG, Yu-Gi-Oh).
 * Called after the app loads. Retries failures automatically.
 */
export async function preloadSlow(onProgress = () => {}) {
  const counts = {}
  for (const game of SLOW_GAMES) {
    // Skip if already cached
    if (await hasGameCards(game)) {
      onProgress({ game, phase: 'Already cached', loaded: 0, total: 0 })
      continue
    }
    const fetcher = FETCHERS[game]
    if (!fetcher) continue
    try {
      onProgress({ game, phase: 'Starting…', loaded: 0, total: 0 })
      counts[game] = await fetchWithRetry((p) => fetcher(p), 2, onProgress)
      onProgress({ game, phase: 'Done', loaded: counts[game], total: counts[game] })
    } catch (err) {
      console.error(`Failed to preload ${game}:`, err)
      counts[game] = 0
      onProgress({ game, phase: `Failed: ${err.message}`, loaded: 0, total: 0 })
    }
  }
  return counts
}

/**
 * Refresh all TCG data (for manual refresh in Settings).
 */
export async function refreshAll(onProgress = () => {}) {
  const counts = {}
  for (const game of Object.keys(FETCHERS)) {
    const fetcher = FETCHERS[game]
    try {
      onProgress({ game, phase: 'Refreshing…', loaded: 0, total: 0 })
      counts[game] = await fetchWithRetry((p) => fetcher(p), 2, onProgress)
      onProgress({ game, phase: 'Done', loaded: counts[game], total: counts[game] })
    } catch (err) {
      console.error(`Failed to refresh ${game}:`, err)
      counts[game] = 0
    }
  }
  return counts
}
