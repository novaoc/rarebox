// Multi-TCG browse providers.
//
// Each provider normalizes a game's API into a uniform shape so one generic
// browse UI (sets grid → cards grid with prices) works for every TCG.
//
//   Set:  { id, name, code, releaseDate, total, logo }
//   Card: { id, name, number, image, price, rarity }
//
// Data sources (English, free):
//   • MTG       — Scryfall   (api.scryfall.com)    CORS *  — browser-direct
//   • Lorcana   — Lorcast    (api.lorcast.com)     CORS *  — browser-direct
//   • One Piece — optcgapi   (via /api/optcg proxy — optcgapi has no CORS)
//   • Pokémon keeps its richer dedicated flow (SetsView) — not handled here.

async function getJson(url, { signal } = {}) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`http_${res.status}`)
  return res.json()
}

// Simple in-memory cache — avoids re-fetching sets on repeated visits.
// TTL: sets (1hr, they rarely change), cards (10min).
const _cache = new Map()
function cached(key, ttlMs, fn, { signal } = {}) {
  const hit = _cache.get(key)
  if (hit && Date.now() - hit.ts < ttlMs) return Promise.resolve(hit.val)
  // fn receives an AbortSignal so it can cancel in-flight fetches.
  // If the caller provides a signal, use AbortSignal.any() to combine it
  // with an internal timeout so navigation-abort and timeout both work.
  const ac = new AbortController()
  const merged = signal
    ? AbortSignal.any([signal, ac.signal, AbortSignal.timeout(30000)])
    : AbortSignal.timeout(30000)
  const p = fn(merged).then(val => { _cache.set(key, { val, ts: Date.now() }); return val })
  p.abort = () => ac.abort()
  return p
}

function num(v) {
  if (v == null) return null
  const n = parseFloat(String(v).replace(/[$,]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

// ── MTG: Scryfall ───────────────────────────────────────────────────────────
const SCRY = 'https://api.scryfall.com'
const MTG_SET_TYPES = new Set([
  'core', 'expansion', 'masters', 'draft_innovation', 'commander',
  'masterpiece', 'funny', 'starter', 'box', 'duel_deck',
])

const mtg = {
  id: 'mtg',
  async getSets(opts) {
    return cached('mtg:sets', 3600_000, async (signal) => {
      const d = await getJson(`${SCRY}/sets`, { signal })
      return (d.data || [])
        .filter(s => MTG_SET_TYPES.has(s.set_type) && !s.digital && (s.card_count || 0) > 0)
        .map(s => ({
          id: s.code,
          name: s.name,
          code: (s.code || '').toUpperCase(),
          releaseDate: s.released_at || null,
          total: s.card_count || null,
          logo: s.icon_svg_uri || '',
        }))
    })
  },
  async getSetCards(setId, opts) {
    return cached(`mtg:cards:${setId}`, 600_000, async (signal) => {
      let url = `${SCRY}/cards/search?q=${encodeURIComponent(`set:${setId} game:paper`)}&unique=prints&order=set`
      const cards = []
      let guard = 0
      while (url && guard < 12) {
        guard++
        const d = await getJson(url, { signal })
        for (const c of (d.data || [])) {
          const imgs = c.image_uris || c.card_faces?.[0]?.image_uris || {}
          cards.push({
            id: c.id,
            name: c.name,
            number: c.collector_number || '',
            image: imgs.small || imgs.normal || '',
            price: num(c.prices?.usd) || num(c.prices?.usd_foil),
            rarity: c.rarity || '',
          })
        }
        url = d.has_more ? d.next_page : null
      }
      return cards
    })
  },
}

// ── Lorcana: Lorcast ─────────────────────────────────────────────────────────
const LOR = 'https://api.lorcast.com/v0'

const lorcana = {
  id: 'lorcana',
  async getSets(opts) {
    return cached('lorcana:sets', 3600_000, async (signal) => {
      const d = await getJson(`${LOR}/sets`, { signal })
      const arr = d.results || d || []
      return arr.map(s => ({
        id: s.code,
        name: s.name,
        code: s.code,
        releaseDate: s.released_at || null,
        total: s.card_count || null,
        logo: '',
      }))
    })
  },
  async getSetCards(setId, opts) {
    return cached(`lorcana:cards:${setId}`, 600_000, async (signal) => {
      const d = await getJson(`${LOR}/sets/${encodeURIComponent(setId)}/cards`, { signal })
      const arr = Array.isArray(d) ? d : (d.results || [])
      return arr.map(c => {
        const img = c.image_uris?.digital || {}
        return {
          id: c.id,
          name: c.version ? `${c.name} — ${c.version}` : c.name,
          number: c.collector_number || '',
          image: img.small || img.normal || '',
          price: num(c.prices?.usd) || num(c.prices?.usd_foil),
          rarity: c.rarity || '',
        }
      })
    })
  },
}

// ── One Piece: OPTCG API ────────────────────────────────────────────────────
const OPT = 'https://optcgapi.com/api'
// The /allSetCards/ endpoint returns ALL cards in one call (~3300 cards).
// We cache aggressively because the data changes infrequently.
let _allCards = null
async function fetchAllOptCards() {
  if (_allCards) return _allCards
  const d = await getJson(`${OPT}/allSetCards/`)
  _allCards = Array.isArray(d) ? d : []
  return _allCards
}

const OPT_SET_ORDER = [
  'OP-01','OP-02','OP-03','OP-04','OP-05','OP-06','OP-07','OP-08','OP-09','OP-10',
  'OP-11','OP-12','OP-13','OP-15-EB04','OP14-EB04','EB-01','EB-02','EB-03','PRB-01','PRB-02',
]

const onePiece = {
  id: 'one-piece',
  async getSets() {
    return cached('opt:sets', 3600_000, async (signal) => {
      const d = await getJson(`${OPT}/allSets/`, { signal })
      const sets = Array.isArray(d) ? d : []
      // Count cards per set from the full card list
      const allCards = await fetchAllOptCards()
      const counts = {}
      for (const c of allCards) {
        const sid = c.set_id
        counts[sid] = (counts[sid] || 0) + 1
      }
      return sets.map((s, i) => ({
        id: s.set_id,
        name: s.set_name,
        code: s.set_id,
        releaseDate: null, // API doesn't provide dates
        total: counts[s.set_id] || null,
        logo: '',
        _order: OPT_SET_ORDER.indexOf(s.set_id),
      })).sort((a, b) => (a._order === -1 ? 99 : a._order) - (b._order === -1 ? 99 : b._order))
    })
  },
  async getSetCards(setId, opts) {
    return cached(`opt:cards:${setId}`, 600_000, async (signal) => {
      const allCards = await fetchAllOptCards()
      return allCards
        .filter(c => c.set_id === setId)
        .map(c => ({
          id: c.card_set_id,
          name: c.card_name,
          number: c.card_set_id,
          image: c.card_image || '',
          price: c.market_price || c.inventory_price || null,
          rarity: c.rarity || '',
        }))
    })
  },
}

// ── Riftbound: riftcodex.com + PriceCharting prices ─────────────────────────
// Card data + images from riftcodex (CORS *). Prices from PriceCharting JSON
// search — matches by collector number after fetching both sources.
const RIFTCODEX = 'https://api.riftcodex.com'
const PC_SEARCH = 'https://www.pricecharting.com/search-products'

// Fetch PriceCharting prices for a Riftbound set.
// Returns map of "number|variant" → price, where variant is lowercase
// ("signature", "alternate art", etc.) or "" for normal/foil.
async function fetchRiftboundPrices(setName, signal) {
  const q = `riftbound ${setName}`
  const d = await getJson(`${PC_SEARCH}?type=prices&q=${encodeURIComponent(q)}`, { signal })
  const products = d.products || []
  const priceMap = {}
  for (const p of products) {
    const name = p.productName || ''
    const numMatch = name.match(/#(\d+)/)
    if (!numMatch || !p.price1) continue
    const n = numMatch[1]
    const price = typeof p.price1 === 'string'
      ? parseFloat(p.price1.replace(/[$,]/g, ''))
      : p.price1
    if (!(price > 0)) continue
    // Extract variant from PriceCharting name: [Signature], [Alternate Art], [Foil], etc.
    const variantMatch = name.match(/\[([^\]]+)\]/)
    const variant = variantMatch ? variantMatch[1].toLowerCase() : ''
    priceMap[`${n}|${variant}`] = price
    // Also store a plain-number fallback for cards with no variant
    if (!variant) priceMap[`${n}|`] = price
  }
  return priceMap
}

const riftbound = {
  id: 'riftbound',
  async getSets() {
    return cached('riftbound:sets', 3600_000, async (signal) => {
      const d = await getJson(`${RIFTCODEX}/sets`, { signal })
      const sets = d.items || []
      return sets.map(s => ({
        id: s.set_id,
        name: s.name,
        code: s.set_id,
        releaseDate: s.published_on || null,
        total: s.card_count || 0,
        logo: '',
      }))
    })
  },
  async getSetCards(setId, opts) {
    return cached(`riftbound:cards:${setId}`, 600_000, async (signal) => {
      // 1. Fetch all cards from riftcodex (paginated)
      const cards = []
      let page = 1
      let total = Infinity
      while (cards.length < total && page <= 20) {
        const d = await getJson(`${RIFTCODEX}/cards?set_id=${encodeURIComponent(setId)}&limit=50&page=${page}`, { signal })
        const items = d.items || []
        total = d.total || 0
        for (const c of items) {
          cards.push({
            id: c.id,
            name: c.name,
            number: String(c.collector_number || ''),
            set: c.set?.label || setId,
            image: c.media?.image_url || '',
            price: null,
            rarity: c.classification?.rarity || '',
          })
        }
        page++
      }

      // 2. Fetch PriceCharting prices for this set (one request, cached)
      const setName = cards[0]?.set || setId
      const priceMap = await cached(`riftbound:prices:${setId}`, 600_000, async (sig) => {
        return fetchRiftboundPrices(setName, sig)
      })

      // 3. Merge prices by collector number + variant
      // Riftcodex names: "Kai'Sa - Daughter of the Void (Signature)"
      // Extract variant from parentheses and match against PriceCharting key.
      for (const card of cards) {
        if (!card.number) continue
        // Extract variant from riftcodex name: "(Signature)" → "signature"
        const variantMatch = card.name.match(/\(([^)]+)\)/)
        const variant = variantMatch ? variantMatch[1].toLowerCase() : ''
        const key = `${card.number}|${variant}`
        if (priceMap[key] != null) {
          card.price = priceMap[key]
        } else if (!variant && priceMap[`${card.number}|`] != null) {
          // Fallback: normal card with no variant
          card.price = priceMap[`${card.number}|`]
        }
      }

      return cards
    })
  },
}

const PROVIDERS = { mtg, lorcana, 'one-piece': onePiece, riftbound }

export function getProvider(id) {
  return PROVIDERS[id] || null
}

// Registry powering the browse landing page. `available:false` = no open data
// source yet (shown as "coming soon"). Brand colors drive the logo tiles.
// Logos are inline SVGs so they never break from external URL issues.
export const TCGS = [
  { id: 'pokemon',   name: 'Pokémon',             tagline: 'Cards, sets & live prices', c1: '#ffcb05', c2: '#2a75bb', route: '/sets/pokemon', available: true,
    logoSvg: `<svg viewBox="0 0 200 80" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg"><text x="100" y="36" text-anchor="middle" fill="#ffcb05" font-family="Arial Black,sans-serif" font-size="22" font-weight="900" stroke="#1a1a2e" stroke-width="0.5">POKÉMON</text><text x="100" y="56" text-anchor="middle" fill="#888" font-family="Arial,sans-serif" font-size="10" font-weight="700" letter-spacing="3">TRADING CARD GAME</text></svg>` },
  { id: 'mtg',       name: 'Magic: The Gathering', tagline: 'Every English set · USD prices', c1: '#f8991c', c2: '#c0202a', route: '/sets/mtg', available: true,
    logoSvg: `<svg viewBox="0 0 200 80" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg"><text x="100" y="34" text-anchor="middle" fill="#f8991c" font-family="Georgia,serif" font-size="24" font-weight="700" font-style="italic">Magic</text><text x="100" y="54" text-anchor="middle" fill="#888" font-family="Georgia,serif" font-size="11" letter-spacing="1">THE GATHERING</text></svg>` },
  { id: 'lorcana',   name: 'Disney Lorcana',       tagline: 'Sets & USD prices', c1: '#7b2c9e', c2: '#0f9b8e', route: '/sets/lorcana', available: true,
    logoSvg: `<svg viewBox="0 0 200 80" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg"><text x="100" y="36" text-anchor="middle" fill="#c9a0dc" font-family="Georgia,serif" font-size="24" font-weight="700" font-style="italic">Lorcana</text><text x="100" y="54" text-anchor="middle" fill="#0f9b8e" font-family="Arial,sans-serif" font-size="10" letter-spacing="3">DISNEY</text></svg>` },
  { id: 'one-piece', name: 'One Piece Card Game',  tagline: '20 sets · 3300+ cards · USD prices', c1: '#d7263d', c2: '#1b1b3a', route: '/sets/one-piece', available: true,
    logoSvg: `<svg viewBox="0 0 200 80" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg"><text x="100" y="34" text-anchor="middle" fill="#d7263d" font-family="Arial Black,sans-serif" font-size="20" font-weight="900">ONE PIECE</text><text x="100" y="54" text-anchor="middle" fill="#888" font-family="Arial,sans-serif" font-size="10" letter-spacing="2">CARD GAME</text></svg>` },
  { id: 'riftbound', name: 'Riftbound (LoL TCG)',  tagline: '7 sets · 1000+ cards · images from Riot', c1: '#0bc6e3', c2: '#0a2540', route: '/sets/riftbound', available: true,
    logoSvg: `<svg viewBox="0 0 200 80" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg"><text x="100" y="34" text-anchor="middle" fill="#0bc6e3" font-family="Arial Black,sans-serif" font-size="18" font-weight="900">RIFTBOUND</text><text x="100" y="54" text-anchor="middle" fill="#667" font-family="Arial,sans-serif" font-size="9" letter-spacing="1">LEAGUE OF LEGENDS</text></svg>` },
]
