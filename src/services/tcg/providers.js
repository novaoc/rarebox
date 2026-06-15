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
//   • One Piece — optcgapi   (optcgapi.com)        CORS *  — browser-direct
//   • Riftbound — riftcodex  (api.riftcodex.com)   CORS *  — browser-direct
//   • Yu-Gi-Oh! — YGOPRODeck (db.ygoprodeck.com)   CORS *  — browser-direct
//   • Pokémon keeps its richer dedicated flow (SetsView) — not handled here.

async function getJson(url, { signal } = {}) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`http_${res.status}`)
  return res.json()
}

import db from '../../db.js'

// Two-layer cache: memory (TTL-fresh) + IndexedDB (durable, no TTL).
// The durable layer is what makes Browse work offline — the card database
// lives on-device, so "can't reach the database" made no sense. Fresh data
// still wins whenever the network is there; the durable copy is served when
// the device is offline or the API is down (stale beats blank).
const _cache = new Map()

async function fromDurable(key) {
  try { return (await db.state.get('browse:' + key))?.value ?? null } catch { return null }
}
function toDurable(key, val) {
  db.state.put({ key: 'browse:' + key, value: JSON.parse(JSON.stringify(val)), ts: Date.now() }).catch(() => {})
}

/** Cap the durable browse cache. Rows carry `ts` since 2026-06-11; older
 *  rows (no ts) are evicted first. Called from App startup, post-idle. */
export async function sweepBrowseCache(max = 400) {
  try {
    const rows = await db.state.where('key').startsWith('browse:').toArray()
    if (rows.length <= max) return
    rows.sort((a, b) => (a.ts || 0) - (b.ts || 0))
    const evict = rows.slice(0, rows.length - max).map(r => r.key)
    await db.state.bulkDelete(evict)
  } catch { /* sweep is best-effort */ }
}

const _inflight = new Map()

function cached(key, ttlMs, fn, { signal } = {}) {
  const hit = _cache.get(key)
  if (hit && Date.now() - hit.ts < ttlMs) return Promise.resolve(hit.val)
  // In-flight dedup: concurrent callers for the same key share one fetch
  // (MTG's getSets is up to 12 paginated requests — doubling it hurts).
  const pending = _inflight.get(key)
  if (pending) return pending
  // fn receives an AbortSignal so it can cancel in-flight fetches —
  // ac.signal is always armed so p.abort() actually works. Caller
  // signals are deliberately NOT merged: the run is shared (dedup), and
  // one navigating view must not cancel the fetch everyone else awaits —
  // a completed fetch fills the cache either way. Views drop stale
  // responses themselves (see TcgSetsView loadSetCards).
  const ac = new AbortController()
  const merged = AbortSignal.any([ac.signal, AbortSignal.timeout(30000)])
  const p = (async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      const stale = hit?.val ?? await fromDurable(key)
      if (stale) return stale
    }
    try {
      const val = await fn(merged)
      _cache.set(key, { val, ts: Date.now() })
      toDurable(key, val)
      return val
    } catch (e) {
      const stale = hit?.val ?? await fromDurable(key)
      if (stale) return stale
      throw e
    } finally {
      _inflight.delete(key)
    }
  })()
  p.abort = () => ac.abort()
  _inflight.set(key, p)
  return p
}

function num(v) {
  if (v == null) return null
  const n = parseFloat(String(v).replace(/[$,]/g, ''))
  return Number.isFinite(n) && n >= 0 ? n : null
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
      // 40 × 175/page = 7000 — "The List" alone is 5120 cards; the old
      // 12-page guard silently truncated it at 2100
      while (url && guard < 40) {
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

// ── One Piece: OPTCG API + TCGplayer prices (static asset) ─────────────────
// optcgapi's own market prices lag badly on fast movers (Luffy SP EB-02:
// $232 there vs $2,386 on TCGplayer). public/op-prices.json is built daily
// in CI from tcgcsv's TCGplayer dump (+ a PriceCharting gap-fill) keyed by
// `{card_set_id}|{variant}` — exact per-printing prices incl. SP/Manga.

const OP_VARIANT_ALIASES = { spr: 'sp' }

/** 'Monkey.D.Luffy (SPR)' → 'sp'; '(061)' → '' (collector number). */
export function opVariantSlug(name) {
  const m = String(name || '').match(/\(((?!.*\/)[^)]+)\)\s*$/)
  if (!m || !/[a-zA-Z]/.test(m[1])) return ''
  const slug = m[1].trim().toLowerCase().replace(/\s+/g, '-')
  return OP_VARIANT_ALIASES[slug] || slug
}

export async function getOpPriceMap(signal) {
  try {
    return await cached('opt:tcgp-prices', 3600_000, async (sig) => {
      const d = await getJson('/op-prices.json', { signal: sig })
      return d.prices || {}
    }, { signal })
  } catch { return {} }
}

/** TCGplayer-first price for an optcgapi card row. */
export function opPriceFor(priceMap, cardSetId, cardName, fallback) {
  const key = `${String(cardSetId || '').toUpperCase()}|${opVariantSlug(cardName)}`
  return priceMap[key] ?? fallback ?? null
}

const OPT = 'https://optcgapi.com/api'
// The /allSetCards/ endpoint returns ALL cards in one call (~3300 cards).
// We cache aggressively because the data changes infrequently.
let _allCards = null
async function fetchAllOptCards(signal) {
  if (_allCards) return _allCards
  // signal comes from cached()'s merged controller — the ~3,300-card
  // download now respects the 30s timeout instead of running unbounded
  const d = await getJson(`${OPT}/allSetCards/`, { signal })
  _allCards = Array.isArray(d) ? d : []
  return _allCards
}

const OPT_SET_ORDER = [
  'OP-01','OP-02','OP-03','OP-04','OP-05','OP-06','OP-07','OP-08','OP-09','OP-10',
  'OP-11','OP-12','OP-13','OP14-EB04','OP15-EB04','EB-01','EB-02','EB-03','PRB-01','PRB-02',
]

const onePiece = {
  id: 'one-piece',
  async getSets() {
    return cached('opt:sets', 3600_000, async (signal) => {
      const d = await getJson(`${OPT}/allSets/`, { signal })
      const sets = Array.isArray(d) ? d : []
      // Count cards per set from the full card list
      const allCards = await fetchAllOptCards(signal)
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
      const allCards = await fetchAllOptCards(signal)
      return allCards
        .filter(c => c.set_id === setId)
        .map(c => {
          // Alt arts / box toppers share the base card's card_set_id —
          // suffix the variant so ids stay unique (Vue keys, owned-matching)
          const variant = (String(c.card_name || '').match(/\(([^)]+)\)\s*$/) || [])[1] || ''
          return {
            id: variant ? `${c.card_set_id}#${variant.toLowerCase().replace(/\s+/g, '-')}` : c.card_set_id,
            name: c.card_name,
            number: c.card_set_id,
            image: c.card_image || '',
            price: c.market_price || c.inventory_price || null,
            rarity: c.rarity || '',
          }
        })
    })
  },
}

// ── Riftbound: riftcodex.com + TCGplayer prices (static asset) ──────────────
// Card data + images from riftcodex (CORS *). Prices come from TCGplayer's
// daily dump, pre-built into /riftbound-prices.json by a daily GitHub Action
// (scripts/build_riftbound_prices.py — tcgcsv.com is backend-only, no CORS)
// and shipped as a static asset like the scan indexes. Joined on each card's
// tcgplayer_id — exact per-printing matches, including promo sets (PR/OPP/JDG)
// and the tail of 280-350 card sets that PriceCharting's 100-result search
// cap drops. PriceCharting search remains as a fallback.
const RIFTCODEX = 'https://api.riftcodex.com'
const PC_SEARCH = 'https://www.pricecharting.com/search-products'

// TCGplayer market prices for ALL Riftbound cards, keyed by product id.
// One same-origin request covers every set.
async function fetchRiftboundTcgplayerPrices(signal) {
  const d = await getJson('/riftbound-prices.json', { signal })
  return d.prices || {}
}

// riftcodex promo sets all live under one PriceCharting console. Search
// queries with the full riftcodex label ("riftbound Riftbound Promotional
// Cards") return nothing, and `riftbound ${setName}` never equals
// "riftbound promo" — so promos priced $0 until this mapping.
const RIFT_PC_PROMO_SETS = new Set([
  'riftbound promotional cards',
  'riftbound organized play promotional cards',
  'riftbound judge promotional cards',
])
function riftPcConsole(setName) {
  return RIFT_PC_PROMO_SETS.has(setName.toLowerCase()) ? 'Riftbound Promo' : `Riftbound ${setName}`
}

// Fetch PriceCharting prices for a Riftbound set.
// PC caps each search at 100 products, and one bulk query drops the less
// popular variant listings — so query base + signature + alternate art and
// merge. Products from other sets (PC search is fuzzy) are filtered out by
// console name.
// Returns { normal: {num→price}, variants: {num→{variant→price}} }
async function fetchRiftboundPrices(setName, signal) {
  const pcConsole = riftPcConsole(setName)
  const queries = [
    pcConsole,
    `${pcConsole} signature`,
    `${pcConsole} alternate art`,
  ]
  const results = await Promise.allSettled(queries.map(q =>
    getJson(`${PC_SEARCH}?type=prices&q=${encodeURIComponent(q)}`, { signal })
  ))
  const seen = new Set()
  const products = []
  for (const r of results) {
    if (r.status !== 'fulfilled') continue
    for (const p of (r.value.products || [])) {
      const key = p.id || p.productName
      if (key == null || seen.has(key)) continue
      seen.add(key)
      products.push(p)
    }
  }

  const expectedConsole = pcConsole.toLowerCase()
  const normal = {}   // "299" → price (plain cards)
  const variants = {} // "299" → {"signature": price, "alternate art": price}
  for (const p of products) {
    const consoleName = (p.consoleName || '').toLowerCase()
    if (consoleName && consoleName !== expectedConsole) continue
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
}

// riftcodex name suffix → PriceCharting bracket tag. "Overnumbered" is just
// the plain printing of an over-set-size champion card, not a variant.
const RIFT_VARIANT_ALIASES = {
  'overnumbered': '',
  'launch exclusive': 'launch promo',
}
function riftVariantFromName(name) {
  const m = (name || '').match(/\(([^)]+)\)\s*$/)
  let v = m ? m[1].toLowerCase() : ''
  if (v in RIFT_VARIANT_ALIASES) v = RIFT_VARIANT_ALIASES[v]
  return v
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
      while (cards.length < total && page <= 10) {
        const d = await getJson(`${RIFTCODEX}/cards?set_id=${encodeURIComponent(setId)}&limit=100&page=${page}`, { signal })
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
            tcgplayerId: c.tcgplayer_id ? String(c.tcgplayer_id) : '',
          })
        }
        page++
      }

      // 2. Join TCGplayer market prices on product id — exact per printing,
      // so a Signature/promo can never inherit its plain card's price.
      let priced = 0
      try {
        const tcgp = await cached('riftbound:tcgp-prices', 3600_000, fetchRiftboundTcgplayerPrices)
        for (const card of cards) {
          const p = tcgp[card.tcgplayerId]
          if (!p) continue
          // Promos/Signatures are foil-only; plain cards use the normal print.
          const val = p.normal ?? p.foil
          if (val > 0) { card.price = val; priced++ }
        }
      } catch { /* proxy unreachable — fall back to PriceCharting below */ }

      // 3. Fallback: PriceCharting fuzzy search (pre-TCGplayer pipeline).
      // Plain cards get the plain price, variants their variant price — a
      // variant must NEVER inherit the plain price ($600 Signature at $50
      // is worse than no price at all).
      if (priced === 0) {
        const setName = cards[0]?.set || setId
        const priceMap = await cached(`riftbound:prices:${setId}`, 600_000, async (sig) => {
          return fetchRiftboundPrices(setName, sig)
        })
        for (const card of cards) {
          if (!card.number) continue
          const variant = riftVariantFromName(card.name)
          if (variant) {
            card.price = priceMap.variants[card.number]?.[variant] ?? null
          } else if (priceMap.normal[card.number] != null) {
            card.price = priceMap.normal[card.number]
          }
        }
      }

      return cards
    })
  },
}

// ── Yu-Gi-Oh!: YGOPRODeck + TCGplayer prices (static asset) ─────────────────
// Card data + images from YGOPRODeck (CORS *). PRICES from public/
// ygo-prices.json (daily CI, tcgcsv's TCGplayer dump): the 2026-06-12 audit
// measured YGOPRODeck's own fields at median 68.8% drift vs TCGplayer —
// set_price is a stale low-listing snapshot, tcgplayer_price is the card's
// cheapest printing. Keys: `{setSlug}|{SET_CODE}|{raritySlug}` with a
// code-level key when the code has a single rarity in that set.
const YGO_API = 'https://db.ygoprodeck.com/api/v7'

export function ygoSlug(s) {
  return String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown'
}

export async function getYgoPriceMap(signal) {
  try {
    return await cached('ygo:tcgp-prices', 3600_000, async (sig) => {
      const d = await getJson('/ygo-prices.json', { signal: sig })
      return d.prices || {}
    }, { signal })
  } catch { return {} }
}

/** TCGplayer-first price for one YGO printing. */
export function ygoPriceFor(priceMap, setName, setCode, rarity, fallback) {
  const sl = ygoSlug(setName)
  const code = String(setCode || '').toUpperCase()
  return priceMap[`${sl}|${code}|${ygoSlug(rarity)}`]
    ?? priceMap[`${sl}|${code}`]
    ?? fallback
    ?? null
}

const yugioh = {
  id: 'yugioh',
  async getSets() {
    return cached('yugioh:sets', 3600_000, async (signal) => {
      const sets = await getJson(`${YGO_API}/cardsets.php`, { signal })
      return sets
        .filter(s => s.num_of_cards > 0 && s.tcg_date)
        .sort((a, b) => (b.tcg_date || '').localeCompare(a.tcg_date || ''))
        .map(s => ({
          id: s.set_name,
          name: s.set_name,
          code: s.set_code || '',
          releaseDate: s.tcg_date || null,
          total: s.num_of_cards || null,
          logo: s.set_image || '',
        }))
    })
  },
  async getSetCards(setName) {
    return cached(`yugioh:cards:${setName}`, 600_000, async (signal) => {
      const d = await getJson(`${YGO_API}/cardinfo.php?cardset=${encodeURIComponent(setName)}`, { signal })
      const cards = d.data || []
      const priceMap = await getYgoPriceMap()
      return cards.map(c => {
        const setInfo = (c.card_sets || []).find(s => s.set_name === setName) || {}
        const prices = c.card_prices?.[0] || {}
        const imgs = c.card_images || []
        return {
          id: String(c.id),
          name: c.name,
          number: setInfo.set_code || '',
          image: imgs[0]?.image_url_small || imgs[0]?.image_url || '',
          // TCGplayer market first; YGOPRODeck's own fields only as a last
          // resort (audit: median 68.8% drift — see header note)
          price: ygoPriceFor(priceMap, setName, setInfo.set_code, setInfo.set_rarity,
            num(setInfo.set_price) || num(prices.tcgplayer_price)),
          rarity: setInfo.set_rarity || '',
        }
      })
    })
  },
}

const PROVIDERS = { mtg, lorcana, 'one-piece': onePiece, riftbound, yugioh }

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
  { id: 'yugioh',    name: 'Yu-Gi-Oh!',             tagline: '130+ sets · 12000+ cards · USD prices', c1: '#000', c2: '#c0202a', route: '/sets/yugioh', available: true,
    logoSvg: `<svg viewBox="0 0 200 80" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg"><text x="100" y="36" text-anchor="middle" fill="#c0202a" font-family="Arial Black,sans-serif" font-size="22" font-weight="900">YU-GI-OH!</text><text x="100" y="56" text-anchor="middle" fill="#888" font-family="Arial,sans-serif" font-size="10" font-weight="700" letter-spacing="3">TRADING CARD GAME</text></svg>` },
]
