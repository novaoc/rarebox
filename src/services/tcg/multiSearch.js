// Multi-TCG search — fans out to Pokémon (pokemontcg.io), MTG (Scryfall),
// Lorcana (Lorcast), One Piece (optcgapi), Riftbound (riftcodex), and
// Yu-Gi-Oh! (YGOPRODeck) in parallel.
// Results are normalised to a common shape so the search UI works for all.
//
// When the in-memory search index is ready, searches are instant (no network).
// Falls back to live APIs otherwise.

import { searchCache, isGameCached } from './cardCache.js'
import { getProvider, getOpPriceMap, opPriceFor, opVariantSlug, getYgoPriceMap, ygoPriceFor } from './providers.js'
import { tokenMatch } from '../../utils/search.js'

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
  return Number.isFinite(n) && n >= 0 ? n : null
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
        set: c.set?.name || c.set?.code || '',
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
  _optCards = Array.isArray(d) ? d : (d?.data || d?.cards || [])
  return _optCards
}

async function searchOnePiece(query) {
  const [cards, priceMap] = await Promise.all([getOptCards(), getOpPriceMap()])
  // Cap to avoid huge payloads — but generously: popular names ("Monkey.D.Luffy")
  // span 50+ printings, and smartSearch may post-filter to one set, so a tight
  // cap can drop the exact card the user asked for.
  const matches = cards.filter(c => tokenMatch(query, c.card_name, c.card_set_id)).slice(0, 150)
  return {
    cards: matches.map(c => {
      const variant = opVariantSlug(c.card_name)
      return {
        id: variant ? `${c.card_set_id}#${variant}` : c.card_set_id,
        name: c.card_name,
        number: c.card_set_id,
        set: c.set_name || '',
        image: c.card_image || '',
        price: opPriceFor(priceMap, c.card_set_id, c.card_name, c.market_price || c.inventory_price),
        rarity: c.rarity || '',
        game: 'one-piece',
        _raw: c,
      }
    }),
    total: matches.length,
  }
}

// ── Riftbound: client-side search from riftcodex.com ─────────────────────────
// Optimized: parallel set fetches, no PriceCharting on bulk load (prices fetched
// lazily via resolveRiftboundCard). Returns quickly so meta deck import doesn't time out.
let _riftCards = null
let _riftCardsPromise = null

async function getRiftboundCards() {
  if (_riftCards) return _riftCards
  if (_riftCardsPromise) return _riftCardsPromise

  _riftCardsPromise = (async () => {
    try {
      const setsRes = await fetchJson('https://api.riftcodex.com/sets')
      const sets = setsRes.items || []
      if (!sets.length) return []

      // Fetch all sets' cards in parallel
      const results = await Promise.allSettled(sets.map(async (s) => {
        const setCards = []
        let page = 1
        let total = Infinity
        while (setCards.length < total && page <= 5) {
          const d = await fetchJson(
            `https://api.riftcodex.com/cards?set_id=${encodeURIComponent(s.set_id)}&limit=100&page=${page}`
          )
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
        return setCards
      }))

      _riftCards = results.flatMap(r => r.status === 'fulfilled' ? r.value : [])
      return _riftCards
    } catch {
      _riftCards = []
      return []
    }
  })()

  return _riftCardsPromise
}

async function searchRiftbound(query) {
  const cards = await getRiftboundCards()
  const matches = cards.filter(c => tokenMatch(query, c.name, c.number, c.set)).slice(0, 50)
  await hydrateRiftboundPrices(matches)
  return { cards: matches, total: matches.length }
}

// The raw riftcodex feed has no prices. The riftbound browse provider merges
// variant-aware PriceCharting prices per set (cached) — reuse it so search,
// trade analyzer and portfolio refresh show the same variant-correct prices.
async function hydrateRiftboundPrices(matches) {
  const setIds = [...new Set(
    matches.filter(m => m.price == null).map(m => m._raw?.set?.set_id).filter(Boolean)
  )]
  if (setIds.length === 0) return
  const provider = getProvider('riftbound')
  await Promise.allSettled(setIds.map(async setId => {
    const priced = await provider.getSetCards(setId)
    const byId = new Map(priced.map(c => [c.id, c.price]))
    for (const m of matches) {
      if (m._raw?.set?.set_id === setId && byId.get(m.id) != null) m.price = byId.get(m.id)
    }
  }))
}

// Fast path for Riftbound: only fetch cards for a specific set by set_id or name.
// Avoids loading all sets' cards (~10+ HTTP requests). Used by findRegularCard.
export async function searchRiftboundBySet(name, setCode) {
  try {
    const setsRes = await fetchJson('https://api.riftcodex.com/sets')
    const sets = setsRes.items || []

    // Match by set_id first, then by set name prefix (handles
    // fallback data using "core" / "spiritforged" labels).
    // Guard against empty setCode — startsWith('') matches ALL sets,
    // which causes the wrong set to win and cards not to be found.
    const matchSet = setCode
      ? (sets.find(s => s.set_id?.toLowerCase() === setCode?.toLowerCase())
        || sets.find(s => s.name?.toLowerCase().startsWith(setCode?.toLowerCase()))
        || sets.find(s => s.name?.toLowerCase().includes(setCode?.toLowerCase())))
      : null

    if (matchSet) {
      const cards = []
      let page = 1
      let total = Infinity
      while (cards.length < total && page <= 5) {
        const d = await fetchJson(
          `https://api.riftcodex.com/cards?set_id=${encodeURIComponent(matchSet.set_id)}&limit=100&page=${page}`
        )
        const items = d.items || []
        total = d.total || 0
        for (const c of items) {
          cards.push({
            id: c.id,
            name: c.name,
            number: String(c.collector_number || ''),
            set: c.set?.label || matchSet.name,
            image: c.media?.image_url || '',
            price: null,
            rarity: c.classification?.rarity || '',
            game: 'riftbound',
            _raw: c,
          })
        }
        page++
      }

      const q = name.toLowerCase()
      return cards.find(c => c.name.toLowerCase() === q)
        || cards.find(c => c.name.toLowerCase().includes(q))
        || cards.find(c => c.number.toLowerCase() === q)
        || null
    }

    // No matching set found — fall back to full card load
    const allCards = await getRiftboundCards()
    const q = name.toLowerCase()
    return allCards.find(c => c.name.toLowerCase() === q)
      || allCards.find(c => c.name.toLowerCase().includes(q))
      || allCards.find(c => c.number.toLowerCase() === q)
      || null
  } catch {
    return null
  }
}

export async function searchLorcanaBySet(name, setCode) {
  try {
    const setsRes = await fetchJson('https://api.lorcast.com/v0/sets')
    const sets = setsRes.results || setsRes || []

    const matchSet = setCode
      ? (sets.find(s => s.code?.toLowerCase() === setCode?.toLowerCase())
        || sets.find(s => s.name?.toLowerCase().startsWith(setCode?.toLowerCase()))
        || sets.find(s => s.name?.toLowerCase().includes(setCode?.toLowerCase())))
      : null

    if (matchSet) {
      const d = await fetchJson(`https://api.lorcast.com/v0/sets/${matchSet.code}/cards`)
      const cards = d.results || d || []
      const q = name.toLowerCase()
      const fullName = (c) => c.version ? `${c.name} — ${c.version}` : c.name
      const match = cards.find(c => fullName(c).toLowerCase() === q)
        || cards.find(c => fullName(c).toLowerCase().includes(q))
        || null

      if (match) {
        const img = match.image_uris?.digital || {}
        return {
          id: match.id,
          name: match.version ? `${match.name} — ${match.version}` : match.name,
          number: match.collector_number || '',
          set: match.set?.name || matchSet.name,
          image: img.small || '',
          price: num(match.prices?.usd) || num(match.prices?.usd_foil),
          rarity: match.rarity || '',
          game: 'lorcana',
        }
      }
    }

    return null
  } catch {
    return null
  }
}

// ── Sealed products: PriceCharting ──────────────────────────────────────────

const PC_BASE = 'https://www.pricecharting.com/search-products'

// Keywords that indicate a product is sealed (not a single card)
const SEALED_HINTS = [
  'booster box', 'booster bundle', 'elite trainer', 'booster pack', 'box set',
  ' box', 'case', ' pack', ' tin', 'collection', 'bundle', 'display', 'blister',
  'starter deck', 'theme deck', 'gift set', 'premium', 'deck', 'trove',
  'build & battle', 'battle deck', 'fat pack', 'booster',
]
export function isSealedProductName(name) {
  const n = (name || '').toLowerCase()
  return SEALED_HINTS.some(h => n.includes(h))
}

// Accessories to skip in sealed search results
const SKIP_ACCESSORIES = ['sleeve', 'portfolio', 'binder', 'dice', 'coin', 'playmat']

export function normalizeSealedProducts(products) {
  return (products || []).filter(p => {
    const name = `${p.productName || ''} ${p.consoleName || ''}`
    const pn = p.productName || ''
    if (/#\d/.test(pn)) return false
    if (/\d+\/\d+/.test(pn)) return false
    if (/-\w{3,6}-\d{3,4}/i.test(pn)) return false
    if (SKIP_ACCESSORIES.some(s => name.toLowerCase().includes(s))) return false
    return isSealedProductName(name)
  }).map(p => ({
    id: p.id || '',
    name: `${p.productName || ''} — ${p.consoleName || ''}`,
    number: '',
    set: p.consoleName || '',
    image: p.imageUri || '',
    price: num(p.price1),
    rarity: '',
    game: 'sealed',
  }))
}

async function searchSealed(query) {
  const url = `${PC_BASE}?type=prices&q=${encodeURIComponent(query)}`
  const d = await fetchJson(url)
  const cards = normalizeSealedProducts(d.products || [])
  return {
    cards,
    total: cards.length,
  }
}

// ── Yu-Gi-Oh: YGOPRODeck ────────────────────────────────────────────────────
async function searchYugioh(query) {
  const url = `https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(query)}`
  // some multi-word fname queries 400 — the hyphenated form succeeds
  // ("blue eyes white dragon" → "blue-eyes-white-dragon")
  const fetchYgo = () => fetchJson(url).catch(() => {
    const alt = query.trim().replace(/\s+/g, '-')
    if (alt === query.trim()) throw new Error('ygo_search_failed')
    return fetchJson(`https://db.ygoprodeck.com/api/v7/cardinfo.php?fname=${encodeURIComponent(alt)}`)
  })
  const [d, priceMap] = await Promise.all([fetchYgo(), getYgoPriceMap()])
  const arr = d.data || []
  return {
    cards: arr.map(c => {
      const setInfo = c.card_sets?.[0] || {}
      return {
        id: `ygo-${c.id}`,
        name: c.name,
        number: setInfo.set_code || `${c.id}`,
        set: setInfo.set_name || c.archetype || '',
        image: c.card_images?.[0]?.image_url_small || '',
        price: ygoPriceFor(priceMap, setInfo.set_name, setInfo.set_code, setInfo.set_rarity,
          num(c.card_prices?.[0]?.tcgplayer_price) || num(c.card_prices?.[0]?.cardmarket_price)),
        rarity: setInfo.set_rarity || '',
        game: 'yugioh',
        _raw: c,
      }
    }),
    total: arr.length,
  }
}

// ── Card resolve (for deck price refresh) ─────────────────────────────────────

async function resolvePokemonCard(cardId) {
  const url = `https://api.pokemontcg.io/v2/cards/${encodeURIComponent(cardId)}`
  const d = await fetchJson(url)
  if (!d.data) return null
  return {
    id: d.data.id,
    name: d.data.name,
    number: d.data.number || '',
    set: d.data.set?.name || '',
    image: d.data.images?.small || '',
    price: extractPokemonPrice(d.data),
    rarity: d.data.rarity || '',
    game: 'pokemon',
    _raw: d.data,
  }
}

async function resolveMtgCard(cardId) {
  const url = `https://api.scryfall.com/cards/${encodeURIComponent(cardId)}`
  const d = await fetchJson(url)
  const imgs = d.image_uris || d.card_faces?.[0]?.image_uris || {}
  return {
    id: d.id,
    name: d.name,
    number: d.collector_number || '',
    set: d.set_name || '',
    image: imgs.small || '',
    price: num(d.prices?.usd) || num(d.prices?.usd_foil),
    rarity: d.rarity || '',
    game: 'mtg',
    _raw: d,
  }
}

async function resolveYugiohCard(cardId) {
  const id = cardId.replace('ygo-', '')
  const url = `https://db.ygoprodeck.com/api/v7/cardinfo.php?id=${id}`
  const d = await fetchJson(url)
  const c = d.data?.[0]
  if (!c) return null
  const setInfo = c.card_sets?.[0] || {}
  return {
    id: cardId,
    name: c.name,
    number: setInfo.set_code || `${c.id}`,
    set: setInfo.set_name || c.archetype || '',
    image: c.card_images?.[0]?.image_url_small || '',
    price: num(c.card_prices?.[0]?.tcgplayer_price) || num(c.card_prices?.[0]?.cardmarket_price),
    rarity: setInfo.set_rarity || '',
    game: 'yugioh',
    _raw: c,
  }
}

async function resolveLorcanaCard(cardId) {
  const url = `https://api.lorcast.com/v0/cards/${encodeURIComponent(cardId)}`
  const d = await fetchJson(url)
  if (!d) return null
  const img = d.image_uris?.digital || {}
  return {
    id: d.id,
    name: d.name,
    number: d.collector_number || '',
    set: d.set?.name || d.set?.code || '',
    image: img.small || '',
    price: num(d.prices?.usd) || num(d.prices?.usd_foil),
    rarity: d.rarity || '',
    game: 'lorcana',
    _raw: d,
  }
}

async function resolveOnePieceCard(cardId) {
  const cards = await getOptCards()
  const c = cards.find(x => x.card_set_id === cardId)
  if (!c) return null
  return {
    id: c.card_set_id,
    name: c.card_name,
    number: c.card_set_id,
    set: c.set_name || '',
    image: c.card_image || '',
    price: c.market_price || c.inventory_price || null,
    rarity: c.rarity || '',
    game: 'one-piece',
    _raw: c,
  }
}

async function resolveRiftboundCard(cardId) {
  const url = `https://api.riftcodex.com/cards/${encodeURIComponent(cardId)}`
  try {
    const d = await fetchJson(url)
    if (!d) return null
    const card = {
      id: d.id,
      name: d.name,
      number: String(d.collector_number || ''),
      set: d.set?.label || '',
      image: d.media?.image_url || '',
      price: null,
      rarity: d.classification?.rarity || '',
      game: 'riftbound',
      _raw: d,
    }
    await hydrateRiftboundPrices([card])
    return card
  } catch {
    // Fallback: search by name via getRiftboundCards cache
    const cards = await getRiftboundCards()
    const match = cards.find(c => c.id === cardId || c.name.toLowerCase() === cardId.toLowerCase())
    if (match) await hydrateRiftboundPrices([match])
    return match || null
  }
}

// Resolve a card by ID for deck price refresh — routes to the correct API
export async function resolveCard(cardId, game) {
  try {
    if (game === 'pokemon') return await resolvePokemonCard(cardId)
    if (game === 'mtg') return await resolveMtgCard(cardId)
    if (game === 'yugioh') return await resolveYugiohCard(cardId)
    if (game === 'lorcana') return await resolveLorcanaCard(cardId)
    if (game === 'one-piece') return await resolveOnePieceCard(cardId)
    if (game === 'riftbound') return await resolveRiftboundCard(cardId)
    return null
  } catch { return null }
}

// ── Main search ─────────────────────────────────────────────────────────────
// Searches all TCGs in parallel, merges + sorts by relevance (name match first).

// serverPaged: the API itself returns page N — those results must NOT be
// sliced again locally. Full-list providers (and cache hits) return every
// match, so the local page slice is correct for them.
const ALL_PROVIDERS = {
  pokemon: (q, p, ps) => searchPokemon(q, p, ps).then(r => ({ ...r, serverPaged: true })),
  mtg: (q, p, ps) => searchMtg(q, p, ps).then(r => ({ ...r, serverPaged: true })),
  lorcana: (q) => searchLorcana(q),
  'one-piece': (q) => searchOnePiece(q),
  riftbound: (q) => searchRiftbound(q),
  yugioh: (q) => searchYugioh(q),
}

export function createMultiSearch({
  providerFns = ALL_PROVIDERS,
  isGameCachedFn = isGameCached,
  searchCacheFn = searchCache,
  getOnline = () => (typeof navigator === 'undefined' ? true : navigator.onLine),
} = {}) {
  return async function runMultiSearch(query, { page = 1, pageSize = 20, category = 'cards', providers } = {}) {
  if (category === 'sealed') {
    const result = await searchSealed(query).catch(() => ({ cards: [], total: 0 }))
    return result
  }

  const active = providers || Object.keys(providerFns)

  // Per-game: try the local cache first, but fall through to the live API
  // when the cache has no hits — the cached snapshot can lag behind new sets
  // (and a cache-only miss used to make those cards unfindable entirely).
  const searches = active.map(async k => {
    let localHit = null
    if (isGameCachedFn(k)) {
      try {
        const cached = searchCacheFn(query, { page: 1, pageSize: 500, providers: [k] })
        localHit = cached
        // A hit set where NO card has a price means the cache predates the
        // price pass (Pokemon bulk data lands before prices) - the live API
        // returns results WITH prices, so prefer it in that window.
        const priced = cached.cards.filter(c => c.price != null).length
        if (cached.cards.length > 0 && priced >= cached.cards.length * 0.3) return cached
      } catch { /* fall through to live */ }
    }
    // Offline (or live API down): unpriced local hits beat an empty page —
    // without this, on-device search returns "No cards found" whenever the
    // price pass hasn't finished before the connection dropped.
    if (!getOnline() && localHit?.cards.length) return localHit
    return providerFns[k](query, page, pageSize).catch(() => (localHit?.cards.length ? localHit : { cards: [], total: 0 }))
  })

  const results = await Promise.all(searches)
  const totalCount = results.reduce((sum, r) => sum + (r.totalCount || r.total || 0), 0)

  const q = query.toLowerCase()
  const rank = (a, b) => {
    const aExact = a.name.toLowerCase() === q ? 0 : 1
    const bExact = b.name.toLowerCase() === q ? 0 : 1
    if (aExact !== bExact) return aExact - bExact
    const aStarts = a.name.toLowerCase().startsWith(q) ? 0 : 1
    const bStarts = b.name.toLowerCase().startsWith(q) ? 0 : 1
    if (aStarts !== bStarts) return aStarts - bStarts
    return a.name.localeCompare(b.name)
  }

  // Server-paged results are already page N — slicing them again would
  // drop their head and repeat items across pages. Only full result sets
  // get the local page slice; the two groups then merge for display.
  const serverPagedCards = results.filter(r => r.serverPaged).flatMap(r => r.cards || [])
  const fullCards = results.filter(r => !r.serverPaged).flatMap(r => r.cards || []).sort(rank)
  const start = (page - 1) * pageSize
  const paged = [...fullCards.slice(start, start + pageSize), ...serverPagedCards].sort(rank)

  return { cards: paged, totalCount }
  }
}

export const multiSearch = createMultiSearch()
