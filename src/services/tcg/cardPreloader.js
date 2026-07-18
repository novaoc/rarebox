/**
 * Card Preloader — Fetches TCG card data and stores in IndexedDB.
 *
 * Two-phase approach:
 * Phase 1 (fast): Fetch set lists for all TCGs — ~6 API calls, ~2 seconds
 * Phase 2 (background): Progressively preload full card data per TCG
 *
 * Retry logic: Each failed TCG gets 2 retries with exponential backoff.
 */

import { saveGameCards, isCacheFresh, getGameCards } from './cardCache.js'
import { getOpPriceMap, opPriceFor, opVariantSlug, getYgoPriceMap, ygoPriceFor } from './providers.js'
import { getEnPriceAsset, getEnPriceMap, enPriceForCardId } from './enPrices.js'
import { getProvider } from './providers.js'

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
      return await fn(onProgress)
    } catch (err) {
      if (attempt < retries) {
        const delay = RETRY_DELAY[attempt] || 5000
        onProgress({ game: '', phase: `Retrying in ${delay / 1000}s…` })
        await sleep(delay)
      } else {
        throw err
      }
    }
  }
}

// ── Pokemon ─────────────────────────────────────────────────────────────────
// Two-phase, mirroring the MTG bulk approach:
//
// Phase 1: card DATA from the official pokemon-tcg-data GitHub repo via the
//   jsDelivr CDN — ~173 per-set JSON files fetched in parallel. Seconds, not
//   minutes, and no rate limits. Cards become searchable immediately.
// Phase 2: PRICES from api.pokemontcg.io (the bulk repo carries none) with a
//   slim select=id,tcgplayer payload and parallel pages. That API averages
//   7-30s per page, which is exactly why the old fully-sequential 82-page
//   fetch took 10-45 minutes. Prices fill in in the background; a failure
//   here still leaves a usable card database.

const PKM_BULK = 'https://cdn.jsdelivr.net/gh/PokemonTCG/pokemon-tcg-data@master'

// Mirrors getMarketPrice priority/fallback: market ?? mid per variant so
// mid-only live data (accepted by hasLivePrices) resolves; $0 survives via
// num()+??. Includes 1stEditionNormal and first finite odd-key fallback.
// Exported for the harness evals.
export function pickPokemonPrice(tcgplayer) {
  const prices = tcgplayer?.prices || {}
  const variants = ['holofoil', '1stEditionHolofoil', 'unlimitedHolofoil', 'reverseHolofoil', 'normal', '1stEditionNormal']
  for (const v of variants) {
    const p = num(prices[v]?.market) ?? num(prices[v]?.mid)
    if (p != null) return p
  }
  // fallback: first available finite market/mid on any odd key
  for (const key of Object.keys(prices)) {
    const p = num(prices[key]?.market) ?? num(prices[key]?.mid)
    if (p != null) return p
  }
  return null
}

// Static TCGplayer fallback (public/en-prices.json, CI-built — see
// services/tcg/enPrices.js): pokemontcg.io omits tcgplayer.prices for
// me2pt5 and later sets, so the live price pass leaves those cards
// priceless forever. Fill ONLY still-null prices — live data (including a
// live $0) stays authoritative — so cached search/browse gets real market
// prices. priceMap is injectable for tests. Exported for the harness evals.
export async function applyEnFallbackPrices(allCards, priceMap = null) {
  if (priceMap == null) {
    try { priceMap = await getEnPriceMap() } catch { return 0 }
  }
  let filled = 0
  for (const card of allCards) {
    if (card.price != null) continue // live-priced already — never overwrite
    const p = enPriceForCardId(priceMap, card.id)
    if (p != null) { card.price = p; filled++ }
  }
  return filled
}

// Fill-only EN fallback for ALREADY-cached Pokémon rows, gated on the
// fallback ASSET's stamp (rarebox_en_price_fill) — deliberately separate
// from the rarebox_tcgp_price_merge daily stamp, which an older build may
// already have set today, and from the >30% live-resume threshold below.
// Either would strand priceless me2pt5+ rows until the next cache rebuild.
// The asset stamp re-runs the fill when CI ships a new map (e.g. a new
// set's mapping lands); a failed/empty asset load is NOT stamped, so the
// next launch retries.
const EN_FILL_KEY = 'rarebox_en_price_fill'
let _enFillPromise = null
function fillPokemonEnFallbackPrices(rows = null) {
  if (_enFillPromise) return _enFillPromise
  _enFillPromise = (async () => {
    try {
      const asset = await getEnPriceAsset()
      const prices = asset?.prices || {}
      if (!asset?.stamp || Object.keys(prices).length === 0) return 0 // failed/empty — retry next launch
      if (localStorage.getItem(EN_FILL_KEY) === asset.stamp) return 0
      const pkmRows = rows ?? await getGameCards('pokemon')
      if (!pkmRows.length) return 0
      let changed = 0
      for (const r of pkmRows) {
        if (r.price != null) continue // live-derived price stays authoritative
        const next = enPriceForCardId(prices, r.id)
        if (next != null) { r.price = next; changed++ }
      }
      if (changed) await saveGameCards('pokemon', pkmRows)
      localStorage.setItem(EN_FILL_KEY, asset.stamp)
      return changed
    } finally {
      _enFillPromise = null
    }
  })()
  return _enFillPromise
}

/** Run `fn(item)` over items with a fixed concurrency. Failures are skipped. */
async function parallelPool(items, concurrency, fn) {
  const queue = [...items]
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length > 0) {
      const item = queue.shift()
      try { await fn(item) } catch { /* per-item failures are non-fatal */ }
    }
  }))
}

async function fetchPokemonBulk(onProgress) {
  const sets = await fetchJson(`${PKM_BULK}/sets/en.json`)
  if (!Array.isArray(sets) || sets.length === 0) throw new Error('bulk set index empty')

  const allCards = []
  let done = 0
  onProgress({ game: 'pokemon', phase: `Downloading ${sets.length} sets…`, loaded: 0, total: sets.length })

  await parallelPool(sets, 12, async (s) => {
    const cards = await fetchJson(`${PKM_BULK}/cards/en/${s.id}.json`)
    for (const c of (cards || [])) {
      allCards.push({
        id: c.id, name: c.name, set: s.name || '', number: c.number || '',
        image: c.images?.small || '',
        price: null, // bulk repo has no prices — phase 2 fills them in
        rarity: c.rarity || '',
      })
    }
    done++
    onProgress({ game: 'pokemon', phase: `Sets ${done}/${sets.length} (${allCards.length.toLocaleString()} cards)`, loaded: done, total: sets.length })
  })

  if (allCards.length === 0) throw new Error('No cards fetched from bulk data')
  return allCards
}

async function fetchPokemonPrices(allCards, onProgress) {
  const PAGE_SIZE = 250
  const first = await fetchJson(
    `https://api.pokemontcg.io/v2/cards?page=1&pageSize=${PAGE_SIZE}&select=id,tcgplayer`
  )
  const totalPages = first.totalCount ? Math.ceil(first.totalCount / PAGE_SIZE) : 90
  const priceById = new Map()
  for (const c of (first.data || [])) priceById.set(c.id, pickPokemonPrice(c.tcgplayer))

  function applyPrices() {
    let priced = 0
    for (const card of allCards) {
      const p = priceById.get(card.id)
      if (p != null) { card.price = p; priced++ }
    }
    return priced
  }

  let fetched = 1
  const pages = Array.from({ length: totalPages - 1 }, (_, i) => i + 2)
  await parallelPool(pages, 6, async (page) => {
    const d = await fetchJson(`https://api.pokemontcg.io/v2/cards?page=${page}&pageSize=${PAGE_SIZE}&select=id,tcgplayer`)
    for (const c of (d.data || [])) priceById.set(c.id, pickPokemonPrice(c.tcgplayer))
    fetched++
    onProgress({ game: 'pokemon', phase: `Prices ${fetched}/${totalPages}`, loaded: fetched, total: totalPages })
    // Persist progress every ~15 pages — the pass takes minutes and the user
    // may close the tab; partial prices beat a priceless 24h cache.
    if (fetched % 15 === 0) {
      if (applyPrices() > 0) await saveGameCards('pokemon', allCards)
    }
  })

  const priced = applyPrices()
  const filled = await applyEnFallbackPrices(allCards)
  return priced + filled
}

// If the cached Pokémon DB is fresh but mostly priceless (the user closed the
// tab before the price pass finished), resume the pass in the background.
let _priceResumeStarted = false
async function resumePokemonPricesIfNeeded() {
  if (_priceResumeStarted) return
  _priceResumeStarted = true
  try {
    const rows = await getGameCards('pokemon')
    if (rows.length === 0) return
    // Cheap fill-only EN fallback FIRST — the >30% live-resume threshold
    // must not strand rows the static asset already covers (asset-stamp
    // gated inside; a no-op once today's asset has been applied).
    await fillPokemonEnFallbackPrices(rows)
    const priced = rows.filter(c => c.price != null).length
    if (priced / rows.length >= 0.3) return
    const cards = rows.map(({ game, cachedAt, cid, ...c }) => c)
    const n = await fetchPokemonPrices(cards, () => {})
    if (n > 0) await saveGameCards('pokemon', cards)
  } catch (e) {
    console.warn('Pokemon price resume failed:', e.message)
  }
}

async function fetchPokemon(onProgress) {
  let allCards
  try {
    // Phase 1 — bulk card data (seconds)
    allCards = await fetchPokemonBulk(onProgress)
  } catch (err) {
    // Bulk source down — fall back to the slow paginated API with full fields
    console.warn('Pokemon bulk fetch failed, falling back to paginated API:', err.message)
    return fetchPokemonPaginated(onProgress)
  }

  // Cards are usable right now — save before the (slow) price pass
  await saveGameCards('pokemon', allCards)

  // Phase 2 — prices, fire-and-forget. pokemontcg.io takes minutes even in
  // parallel; blocking the loader UI on it made the preload look stuck.
  // Prices merge into the cache silently when they arrive.
  fetchPokemonPrices(allCards, () => {})
    .then(priced => { if (priced > 0) return saveGameCards('pokemon', allCards) })
    .catch(err => console.warn('Pokemon price pass failed (cards remain usable):', err.message))

  return allCards.length
}

// Legacy fallback: sequential paginated fetch with full fields.
async function fetchPokemonPaginated(onProgress) {
  const PAGE_SIZE = 250
  const allCards = []
  let consecutiveErrors = 0

  const first = await fetchJson(
    `https://api.pokemontcg.io/v2/cards?page=1&pageSize=${PAGE_SIZE}&select=id,name,number,set,rarity,tcgplayer,images`
  )
  const totalPages = first.totalCount ? Math.ceil(first.totalCount / PAGE_SIZE) : 100
  onProgress({ game: 'pokemon', phase: 'Fetching cards…', loaded: 0, total: first.totalCount || 0 })

  const mapCard = c => ({
    id: c.id, name: c.name, set: c.set?.name || '', number: c.number || '',
    image: c.images?.small || '',
    price: pickPokemonPrice(c.tcgplayer),
    rarity: c.rarity || '',
  })
  for (const c of (first.data || [])) allCards.push(mapCard(c))

  for (let page = 2; page <= totalPages; page++) {
    try {
      const d = await fetchJson(
        `https://api.pokemontcg.io/v2/cards?page=${page}&pageSize=${PAGE_SIZE}&select=id,name,number,set,rarity,tcgplayer,images`
      )
      const cards = d.data || []
      if (cards.length === 0) break
      for (const c of cards) allCards.push(mapCard(c))
      consecutiveErrors = 0
      onProgress({
        game: 'pokemon',
        phase: `Page ${page}/${totalPages} (${allCards.length.toLocaleString()} cards)`,
        loaded: allCards.length,
        total: first.totalCount || 0,
      })
      await sleep(100)
    } catch (err) {
      consecutiveErrors++
      console.warn(`Pokemon page ${page} failed (${consecutiveErrors} consecutive): ${err.message}`)
      if (consecutiveErrors >= 3) throw err
      await sleep(500)
    }
  }

  if (allCards.length === 0) throw new Error('No cards fetched')
  await applyEnFallbackPrices(allCards)
  await saveGameCards('pokemon', allCards)
  return allCards.length
}

// ── MTG: Scryfall bulk data ────────────────────────────────────────────────
// Uses oracle_cards (~40 MB single JSON file, ~24k unique cards) instead of
// paginated search API (~95k prints across 545 pages at 5s each).
// Prices included in bulk data. Saves ~45 min of sequential fetches.

async function fetchMtg(onProgress) {
  onProgress({ game: 'mtg', phase: 'Fetching bulk data index…', loaded: 0, total: 0 })

  // Get bulk data catalog to find the oracle_cards download URL
  const catalog = await fetchJson('https://api.scryfall.com/bulk-data', BULK_TIMEOUT)
  const entry = (catalog.data || []).find(e => e.type === 'oracle_cards')
  if (!entry?.download_uri) throw new Error('oracle_cards bulk data not found')

  onProgress({ game: 'mtg', phase: 'Downloading card database (~40 MB)…', loaded: 0, total: 0 })

  const d = await fetchJson(entry.download_uri, BULK_TIMEOUT)
  const cards = Array.isArray(d) ? d : []

  onProgress({ game: 'mtg', phase: `Processing ${cards.length.toLocaleString()} cards…`, loaded: 0, total: cards.length })

  const allCards = []
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
          price: num(c.prices?.usd) || num(c.prices?.usd_foil) || num(c.tcgplayer?.prices?.holofoil?.market || c.tcgplayer?.prices?.normal?.market),
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

    await sleep(20)
  }

  await saveGameCards('lorcana', allCards)
  return allCards.length
}

// ── One Piece ───────────────────────────────────────────────────────────────
// Single API call gets all ~3,300 cards.

async function fetchOnePiece(onProgress) {
  onProgress({ game: 'one-piece', phase: 'Fetching all cards…', loaded: 0, total: 0 })

  const [d, priceMap] = await Promise.all([
    fetchJson('https://optcgapi.com/api/allSetCards/'),
    getOpPriceMap().catch(() => ({})),
  ])
  const cards = Array.isArray(d) ? d : d?.data || []

  onProgress({ game: 'one-piece', phase: 'Processing…', loaded: cards.length, total: cards.length })

  const normalized = cards.map(c => {
    // variant-suffixed ids keep SP/Manga/Alt-Art distinct in the search
    // cache (they share card_set_id), matching the browse provider's ids
    const variant = opVariantSlug(c.card_name)
    return {
      id: (c.card_set_id ? (variant ? `${c.card_set_id}#${variant}` : c.card_set_id) : c.card_name),
      name: c.card_name || '',
      set: c.set_name || '',
      number: c.card_set_id || '',
      image: c.card_image || '',
      // TCGplayer-first: optcgapi's own prices lag badly on fast movers
      price: num(opPriceFor(priceMap, c.card_set_id, c.card_name, c.market_price || c.inventory_price)),
      rarity: c.rarity || '',
    }
  })

  await saveGameCards('one-piece', normalized)
  return normalized.length
}

/** Daily price refresh for ALREADY-downloaded card caches — the cards don't
 *  change, the market does. TCGplayer-asset games only; stamp-gated.
 *  (Named for its first game; also merges Yu-Gi-Oh!. Priceless EN Pokémon
 *  rows are handled by fillPokemonEnFallbackPrices above — fill-only, gated
 *  on the fallback asset's own stamp so it runs promptly after deploy even
 *  when today's tcgp merge stamp is already set.) */
export async function refreshOnePiecePrices() {
  try { await fillPokemonEnFallbackPrices() } catch { /* best effort */ }
  try {
    const today = new Date().toISOString().slice(0, 10)
    if (localStorage.getItem('rarebox_tcgp_price_merge') === today) return

    const opRows = await getGameCards('one-piece')
    if (opRows.length) {
      const priceMap = await getOpPriceMap()
      let changed = 0
      for (const r of opRows) {
        const next = num(opPriceFor(priceMap, r.number, r.name, null))
        if (next != null && next !== r.price) { r.price = next; changed++ }
      }
      if (changed) await saveGameCards('one-piece', opRows)
    }

    const ygoRows = await getGameCards('yugioh')
    if (ygoRows.length) {
      const priceMap = await getYgoPriceMap()
      let changed = 0
      for (const r of ygoRows) {
        const next = num(ygoPriceFor(priceMap, r.set, r.number, r.rarity, null))
        if (next != null && next !== r.price) { r.price = next; changed++ }
      }
      if (changed) await saveGameCards('yugioh', ygoRows)
    }

    // Stamp a COMPLETED merge pass (changed or not) so it runs once a day;
    // an exception above skips the stamp and the next launch retries.
    localStorage.setItem('rarebox_tcgp_price_merge', today)
  } catch { /* best effort — browse/search overrides still apply */ }
}

// ── Yu-Gi-Oh ────────────────────────────────────────────────────────────────
// Batch fetching: 5000 cards per request. ~38k cards = ~8 requests.

async function fetchYugioh(onProgress) {
  const YGO_API = 'https://db.ygoprodeck.com/api/v7'
  const BATCH = 5000
  const allCards = []
  const seen = new Set()
  let offset = 0
  let batchNum = 0

  onProgress({ game: 'yugioh', phase: 'Fetching cards…', loaded: 0, total: 0 })
  const ygoPrices = await getYgoPriceMap().catch(() => ({}))

  while (offset < 100_000) {
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
        price: num(ygoPriceFor(ygoPrices, setInfo.set_name, setInfo.set_code, setInfo.set_rarity, num(prices.tcgplayer_price))),
        rarity: setInfo.set_rarity || '',
      })
    }

    offset += BATCH
    batchNum++
    if (cards.length < BATCH) break

    onProgress({
      game: 'yugioh',
      phase: `Batch ${batchNum} (${allCards.length.toLocaleString()} cards)`,
      loaded: allCards.length,
      total: 0,
    })

    await sleep(100)
  }

  await saveGameCards('yugioh', allCards)
  return allCards.length
}

// ── Riftbound ───────────────────────────────────────────────────────────────
// Small dataset: ~1,064 cards across 7 sets. Delegates to the browse provider
// so the cache gets the same variant-aware prices (a number-only price map
// here used to give Signature cards the plain printing's price).

async function fetchRiftbound(onProgress) {
  onProgress({ game: 'riftbound', phase: 'Fetching sets…', loaded: 0, total: 0 })

  const provider = getProvider('riftbound')
  const sets = await provider.getSets()

  onProgress({ game: 'riftbound', phase: `${sets.length} sets…`, loaded: 0, total: sets.length })

  const allCards = []
  for (let i = 0; i < sets.length; i++) {
    const s = sets[i]
    try {
      const cards = await provider.getSetCards(s.id)
      for (const c of cards) {
        allCards.push({
          id: c.id,
          name: c.name,
          set: c.set || s.name,
          number: c.number,
          image: c.image,
          price: c.price ?? null,
          rarity: c.rarity || '',
        })
      }
    } catch { /* skip failed sets */ }

    onProgress({
      game: 'riftbound',
      phase: `Sets ${i + 1}/${sets.length}`,
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

// All available games
const ALL_GAMES = ['pokemon', 'mtg', 'lorcana', 'one-piece', 'yugioh', 'riftbound']

/**
 * Preload selected TCGs in PARALLEL.
 * All APIs are independent — no rate limit conflicts between different TCGs.
 * @param {string[]} games - Which TCGs to preload
 */
export async function preloadGames(games, onProgress = () => {}, { force = false } = {}) {
  const counts = {}

  const tasks = games.map(async (game) => {
    const fetcher = FETCHERS[game]
    if (!fetcher) return

    // Skip if already cached and fresh (< 24h old) — unless forced
    if (!force && await isCacheFresh(game)) {
      onProgress({ game, phase: 'Already cached', loaded: 0, total: 0 })
      if (game === 'pokemon') resumePokemonPricesIfNeeded()
      return
    }

    try {
      onProgress({ game, phase: 'Starting…', loaded: 0, total: 0 })
      counts[game] = await fetchWithRetry((p) => fetcher(p), 2, (prog) => {
        onProgress({ game, ...prog })
      })
      onProgress({ game, phase: 'Done', loaded: counts[game], total: counts[game] })
    } catch (err) {
      console.error(`Failed to preload ${game}:`, err)
      counts[game] = 0
      onProgress({ game, phase: `Failed: ${err.message}`, loaded: 0, total: 0 })
    }
  })

  await Promise.allSettled(tasks)
  counts.total = Object.values(counts).reduce((a, b) => (typeof b === 'number' ? a + b : a), 0)
  return counts
}

/**
 * Refresh all TCG data (for manual refresh in Settings).
 * Forces a re-download — without force, preloadGames skips every game whose
 * cache is <24h old, which made the Settings refresh button a silent no-op.
 */
export async function refreshAll(onProgress = () => {}) {
  return preloadGames(ALL_GAMES, onProgress, { force: true })
}
