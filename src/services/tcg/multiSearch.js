// Multi-TCG search — fans out to Pokémon (pokemontcg.io), MTG (Scryfall),
// Lorcana (Lorcast), One Piece (optcgapi), Riftbound (riftcodex), and
// Yu-Gi-Oh! (YGOPRODeck) in parallel.
// Results are normalised to a common shape so the search UI works for all.
//
// When the in-memory search index is ready, searches are instant (no network).
// Falls back to live APIs otherwise.

import { searchCache, isSearchReady } from './cardCache.js'

const TIMEOUT = 8000

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(TIMEOUT),
  })
  if (!res.ok) throw new Error(`http_${res.status}`)
  return res.json()
}

function num(v) {
  if (v == null) return null
  const n = parseFloat(String(v).replace(/[$,]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

// ── Pokémon ─────────────────────────────────────────────────────────────────
async function searchPokemon(query, page, pageSize) {
  const term = query.replace(/\s+/g, '*')
  const url = `https://api.pokemontcg.io/v2/cards?q=name:${encodeURIComponent(term)}*&page=${page}&pageSize=${pageSize}&orderBy=-set.releaseDate&select=id,name,number,set,supertype,rarity,tcgplayer,images`
  const d = await fetchJson(url)
  return {
    cards: (d.data || []).map(c => ({
      id: c.id,
      name: c.name,
      number: c.number || '',
      set: c.set?.name || '',
      image: c.images?.small || '',
      price: extractPokemonPrice(c),
      rarity: c.rarity || '',
      game: 'pokemon',
      _raw: c,
    })),
    total: d.totalCount || 0,
  }
}

function extractPokemonPrice(card) {
  const prices = card?.tcgplayer?.prices
  if (!prices) return null
  const variants = ['holofoil', '1stEditionHolofoil', 'unlimitedHolofoil', 'reverseHolofoil', 'normal']
  for (const v of variants) {
    if (prices[v]?.market) return prices[v].market
  }
  const first = Object.values(prices)[0]
  return first?.market || first?.mid || null
}

// ── MTG: Scryfall ───────────────────────────────────────────────────────────
async function searchMtg(query, page, pageSize) {
  // Scryfall uses 1-indexed pages
  const url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&page=${page}&pageSize=${pageSize}&unique=prints&order=released`
  const d = await fetchJson(url)
  return {
    cards: (d.data || []).map(c => {
      const imgs = c.image_uris || c.card_faces?.[0]?.image_uris || {}
      return {
        id: c.id,
        name: c.name,
        number: c.collector_number || '',
        set: c.set_name || '',
        image: imgs.small || '',
        price: num(c.prices?.usd) || num(c.prices?.usd_foil),
        rarity: c.rarity || '',
        game: 'mtg',
        _raw: c,
      }
    }),
    total: d.total_cards || 0,
  }
}

// ── Lorcana: Lorcast ────────────────────────────────────────────────────────
async function searchLorcana(query) {
  const url = `https://api.lorcast.com/v0/cards/search?q=${encodeURIComponent(query)}`
  const d = await fetchJson(url)
  const arr = d.results || []
  return {
    cards: arr.map(c => {
      const img = c.image_uris?.digital || {}
      return {
        id: c.id,
        name: c.version ? `${c.name} — ${c.version}` : c.name,
        number: c.collector_number || '',
        set: c.set_name || c.set_code || '',
        image: img.small || '',
        price: num(c.prices?.usd) || num(c.prices?.usd_foil),
        rarity: c.rarity || '',
        game: 'lorcana',
        _raw: c,
      }
    }),
    total: arr.length, // Lorcast doesn't return total
  }
}

// ── One Piece: optcgapi ─────────────────────────────────────────────────────
// The API returns all ~3300 cards at once; we search client-side.
let _optCards = null
async function getOptCards() {
  if (_optCards) return _optCards
  const d = await fetchJson('https://optcgapi.com/api/allSetCards/')
  _optCards = Array.isArray(d) ? d : []
  return _optCards
}

async function searchOnePiece(query) {
  const cards = await getOptCards()
  const q = query.toLowerCase()
  const matches = cards.filter(c =>
    (c.card_name || '').toLowerCase().includes(q) ||
    (c.card_set_id || '').toLowerCase().includes(q)
  ).slice(0, 50) // cap at 50 to avoid huge payloads
  return {
    cards: matches.map(c => ({
      id: c.card_set_id,
      name: c.card_name,
      number: c.card_set_id,
      set: c.set_name || '',
      image: c.card_image || '',
      price: c.market_price || c.inventory_price || null,
      rarity: c.rarity || '',
      game: 'one-piece',
      _raw: c,
    })),
    total: matches.length,
  }
}

// ── Yu-Gi-Oh!: YGOPRODeck ─────────────────────────────────────────────────────
// Uses the fname (fuzzy name) endpoint for search. Returns cards with prices.
async function searchYugioh(query) {
  const url = `https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(query)}`
  const d = await fetchJson(url)
  const cards = d.data || []
  return {
    cards: cards.slice(0, 50).map(c => {
      const prices = c.card_prices?.[0] || {}
      const imgs = c.card_images || []
      const setInfo = c.card_sets?.[0] || {}
      return {
        id: String(c.id),
        name: c.name,
        number: setInfo.set_code || '',
        set: setInfo.set_name || '',
        image: imgs[0]?.image_url_small || imgs[0]?.image_url || '',
        price: num(prices.tcgplayer_price),
        rarity: setInfo.set_rarity || '',
        game: 'yugioh',
        _raw: c,
      }
    }),
    total: cards.length,
  }
}

// ── Riftbound: client-side search from riftcodex.com ─────────────────────────
// Fetches all cards (paginated), fetches prices from PriceCharting per set,
// merges prices by collector number, searches client-side.
let _riftCards = null
const PC_RIFTBOUND = 'https://www.pricecharting.com/search-products'
// Fetch PriceCharting prices for a Riftbound set.
// Returns { normal: {num→price}, variants: {num→{variant→price}} }
async function fetchPCPrices(setName) {
  try {
    const d = await fetchJson(`${PC_RIFTBOUND}?type=prices&q=${encodeURIComponent('riftbound ' + setName)}`)
    const products = d.products || []
    const normal = {}
    const variants = {}
    for (const p of products) {
      const name = p.productName || ''
      const numMatch = name.match(/#(\d+)/)
      if (!numMatch || !p.price1) continue
      const n = numMatch[1]
      const price = typeof p.price1 === 'string'
        ? parseFloat(p.price1.replace(/[$,]/g, ''))
        : p.price1
      if (!(price > 0)) continue
      const variantMatch = name.match(/\[([^\]]+)\]/)
      const variant = variantMatch ? variantMatch[1].toLowerCase() : ''
      if (variant) {
        if (!variants[n]) variants[n] = {}
        variants[n][variant] = price
      } else {
        normal[n] = price
      }
    }
    return { normal, variants }
  } catch { return { normal: {}, variants: {} } }
}

async function getRiftboundCards() {
  if (_riftCards) return _riftCards
  const all = []
  const sets = await fetchJson('https://api.riftcodex.com/sets')
  for (const s of (sets.items || [])) {
    // Fetch cards from riftcodex
    let page = 1
    let total = Infinity
    const setCards = []
    while (setCards.length < total && page <= 20) {
      const d = await fetchJson(`https://api.riftcodex.com/cards?set_id=${encodeURIComponent(s.set_id)}&limit=50&page=${page}`)
      const items = d.items || []
      total = d.total || 0
      for (const c of items) {
        setCards.push({
          id: c.id,
          name: c.name,
          number: String(c.collector_number || ''),
          set: c.set?.label || s.name,
          image: c.media?.image_url || '',
          price: null,
          rarity: c.classification?.rarity || '',
          game: 'riftbound',
          _raw: c,
        })
      }
      page++
    }
    // Fetch PriceCharting prices for this set (one request)
    const priceMap = await fetchPCPrices(s.name)
    for (const card of setCards) {
      if (!card.number) continue
      const variantMatch = card.name.match(/\(([^)]+)\)/)
      const variant = variantMatch ? variantMatch[1].toLowerCase() : ''
      if (variant && priceMap.variants[card.number]?.[variant]) {
        card.price = priceMap.variants[card.number][variant]
      } else if (priceMap.normal[card.number] != null) {
        card.price = priceMap.normal[card.number]
      }
    }
    all.push(...setCards)
  }
  _riftCards = all
  return all
}

async function searchRiftbound(query) {
  const cards = await getRiftboundCards()
  const q = query.toLowerCase()
  const matches = cards.filter(c =>
    (c.name || '').toLowerCase().includes(q) ||
    (c.number || '').toLowerCase().includes(q) ||
    (c.set || '').toLowerCase().includes(q)
  ).slice(0, 50)
  return { cards: matches, total: matches.length }
}

// ── Sealed products: PriceCharting ──────────────────────────────────────────

const PC_BASE = 'https://www.pricecharting.com/search-products'

async function searchSealed(query) {
  const url = `${PC_BASE}?type=prices&q=${encodeURIComponent(query)}`
  const d = await fetchJson(url)
  const products = (d.products || []).filter(p => !/#\d/.test(p.productName || ''))
  return {
    cards: products.map(p => ({
      id: p.id || '',
      name: `${p.productName || ''} — ${p.consoleName || ''}`,
      number: '',
      set: p.consoleName || '',
      image: p.imageUri || '',
      price: num(p.price1),
      rarity: '',
      game: 'sealed',
    })),
    total: products.length,
  }
}

// ── Main search ─────────────────────────────────────────────────────────────
// Searches all TCGs in parallel, merges + sorts by relevance (name match first).

const ALL_PROVIDERS = {
  pokemon: (q, p, ps) => searchPokemon(q, p, ps),
  mtg: (q, p, ps) => searchMtg(q, p, ps),
  lorcana: (q) => searchLorcana(q),
  'one-piece': (q) => searchOnePiece(q),
  riftbound: (q) => searchRiftbound(q),
  yugioh: (q) => searchYugioh(q),
}

export async function multiSearch(query, { page = 1, pageSize = 20, category = 'cards', providers } = {}) {
  // Sealed products always hit PriceCharting (not in card cache)
  if (category === 'sealed') {
    const result = await searchSealed(query).catch(() => ({ cards: [], total: 0 }))
    return result
  }

  // If the in-memory search index is ready, search instantly (no network)
  if (isSearchReady()) {
    return searchCache(query, { page, pageSize })
  }

  // Fallback: hit live APIs (slow first time, used before preload completes)
  const active = providers || Object.keys(ALL_PROVIDERS)
  const searches = active.map(k =>
    ALL_PROVIDERS[k](query, page, pageSize).catch(() => ({ cards: [], total: 0 })),
  )

  const results = await Promise.all(searches)
  const allCards = results.flatMap(r => r.cards)
  const totalCount = results.reduce((sum, r) => sum + r.total, 0)

  // Sort: exact name matches first, then alphabetical
  const q = query.toLowerCase()
  allCards.sort((a, b) => {
    const aExact = a.name.toLowerCase() === q ? 0 : 1
    const bExact = b.name.toLowerCase() === q ? 0 : 1
    if (aExact !== bExact) return aExact - bExact
    const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1
    const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1
    if (aStarts !== bStarts) return aStarts - bStarts
    return a.name.localeCompare(b.name)
  })

  // Paginate the merged results
  const start = (page - 1) * pageSize
  const paged = allCards.slice(start, start + pageSize)

  return { cards: paged, totalCount }
}
