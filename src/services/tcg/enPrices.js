// EN Pokémon TCGplayer fallback prices — static asset built daily in CI
// (scripts/build_en_prices.py) and shipped as /en-prices.json.
//
// Why: since Ascended Heroes (me2pt5, released 2026-01-30) api.pokemontcg.io
// lists new-set cards but omits `tcgplayer.prices` entirely (URL only), and
// Rarebox single-sourced EN spot prices from that field. Older sets (me1/me2
// and back) still carry live prices, so this asset ONLY fills missing price
// data — live pokemontcg.io prices stay authoritative (hasLivePrices gate).
//
// Keys: `{pokemontcg set id}-{normalized collector number}` — lowercase, no
// leading zeros ("001/217" → "1", "TG07" → "tg7", "SWSH001" → "swsh1"),
// mirroring priceHistory.js's normNumber and the rarebox-price-history repo
// scripts. One safe market variant per card, chosen at build time with
// getMarketPrice's priority (holofoil → … → reverseHolofoil → normal).

import db from '../../db.js'

// Two-layer cache: memory for the session + IndexedDB durable copy so the
// fallback still works offline (mirrors the providers.js browse: pattern).
// Memoized ONLY on a non-empty load — a successful-but-empty map (bad
// deploy, truncated write) must not stick for the session: the next call
// retries the network instead of enriching nothing.
let _enAsset = null // { stamp, prices }
const DURABLE_KEY = 'browse:en:tcgp-prices'
const FETCH_TIMEOUT = 10_000 // bounded — a hung static fetch must not stall search

async function fromDurable() {
  try {
    const v = (await db.state.get(DURABLE_KEY))?.value
    if (!v) return null
    // Current shape { stamp, prices }; the first deploy stored the bare map.
    if (v.prices && typeof v.prices === 'object') return { stamp: v.stamp ?? null, prices: v.prices }
    return { stamp: null, prices: v }
  } catch { return null }
}
function toDurable(asset) {
  db.state.put({ key: DURABLE_KEY, value: asset, ts: Date.now() }).catch(() => {})
}

/** The fallback asset: { stamp, prices } with prices keyed
 *  `{set}-{normalized number}` ({ "me2pt5-1": 12.34, … }); stamp null and
 *  prices {} when unavailable. In-flight dedup: a shelf refresh fires many
 *  getCard calls at once, and they must share ONE fetch of the asset, not
 *  race a burst of them. */
let _enAssetPromise = null
export async function getEnPriceAsset() {
  if (_enAsset) return _enAsset
  if (_enAssetPromise) return _enAssetPromise
  _enAssetPromise = (async () => {
    try {
      const res = await fetch('/en-prices.json', { signal: AbortSignal.timeout(FETCH_TIMEOUT) })
      if (res.ok) {
        const d = await res.json()
        const prices = d?.prices || {}
        if (Object.keys(prices).length > 0) {
          _enAsset = { stamp: d?.stamp ?? null, prices }
          toDurable(_enAsset)
          return _enAsset
        }
        // empty successful map — fall through to durable, retry next call
      }
    } catch { /* offline, timeout, or asset missing — durable copy below */ }
    const stale = await fromDurable()
    if (stale && Object.keys(stale.prices).length > 0) {
      _enAsset = stale
      return _enAsset
    }
    // Leave _enAsset null on total failure so the next call retries (same
    // recovery pattern as the JP price map in pokemonApi.js).
    return { stamp: null, prices: {} }
  })()
  try {
    return await _enAssetPromise
  } finally {
    _enAssetPromise = null
  }
}

/** The fallback price map ({ "me2pt5-1": 12.34, … }); {} when unavailable. */
export async function getEnPriceMap() {
  return (await getEnPriceAsset()).prices
}

/** Number normalizer — MUST mirror scripts/build_en_prices.py and
 *  priceHistory.js's normNumber (the history repo scripts mirror it too). */
export function normEnNumber(num) {
  let n = String(num ?? '').split('/')[0].trim().toLowerCase()
  n = n.replace(/^0+(?=[a-z0-9])/, '')
  const m = n.match(/^([a-z]+)0*(\d.*)$/)
  if (m) n = m[1] + m[2]
  return n
}

export function enPriceKey(setId, number) {
  const sid = String(setId || '').toLowerCase()
  if (!sid) return ''
  return `${sid}-${normEnNumber(number)}`
}

/** Card-id form ("me2pt5-1") for rows that only carry the id. */
export function enPriceKeyFromCardId(cardId) {
  const i = String(cardId || '').lastIndexOf('-')
  if (i <= 0) return ''
  return enPriceKey(String(cardId).slice(0, i), String(cardId).slice(i + 1))
}

/** Exact-key lookup. 0 is a valid price; unknown stays null. */
export function enPriceFor(priceMap, setId, number) {
  const v = priceMap?.[enPriceKey(setId, number)]
  return (typeof v === 'number' && Number.isFinite(v) && v >= 0) ? v : null
}

export function enPriceForCardId(priceMap, cardId) {
  const v = priceMap?.[enPriceKeyFromCardId(cardId)]
  return (typeof v === 'number' && Number.isFinite(v) && v >= 0) ? v : null
}

/** Does this card carry usable live pokemontcg.io prices? 0 counts. */
export function hasLivePrices(tcgplayer) {
  const prices = tcgplayer?.prices
  if (!prices) return false
  for (const v of Object.values(prices)) {
    if (!v) continue
    if (typeof v.market === 'number' && Number.isFinite(v.market)) return true
    if (typeof v.mid === 'number' && Number.isFinite(v.mid)) return true
  }
  return false
}

/**
 * Fill ONE normal-variant market price from the static fallback when (and
 * only when) the card has no usable live tcgplayer.prices. Mutates and
 * returns the card so it can run inline in existing map() normalizers; a
 * no-op for JP cards, live-priced cards, and keys the asset doesn't cover.
 * Never removes or downgrades richer live variant data.
 */
export function enrichPokemonCard(card, priceMap = {}) {
  if (!card || card._lang === 'ja') return card
  if (hasLivePrices(card.tcgplayer)) return card
  const setId = card.set?.id
  const number = card.number
  const price = (setId != null && number != null)
    ? enPriceFor(priceMap, setId, number)
    : enPriceForCardId(priceMap, card.id)
  if (price == null) return card
  card.tcgplayer = {
    ...card.tcgplayer, // keep the live tcgplayer.url when present
    prices: { normal: { market: price, low: null, mid: price } },
  }
  return card
}
