// Typo rescue — names-only fuzzy lookup over every game.
//
// Live card APIs have no fuzzy matching (pokemontcg.io rejects Lucene's ~
// operator), so a typo'd query returns nothing unless the offline card DB
// is downloaded. public/name-index.json (daily CI, names + identity only)
// lets the app's own matcher rescue those queries; MTG is rescued live via
// Scryfall's named?fuzzy= endpoint, which is excellent.
//
// This is a LAST-RESORT lane: smartSearch only calls it when everything
// else returned zero cards.

import { tokenMatch } from '../utils/search.js'
import { getMarketPrice } from './pokemonApi.js'
import { getEnPriceMap, enrichPokemonCard, hasLivePrices } from './tcg/enPrices.js'

let _index = null
let _loading = null

async function loadIndex() {
  if (_index) return _index
  if (_loading) return _loading
  _loading = (async () => {
    try {
      const res = await fetch('/name-index.json')
      if (!res.ok) throw new Error(`http_${res.status}`)
      _index = (await res.json()).cards || []
    } catch {
      _index = []
      _loading = null // retry on next call
    }
    return _index
  })()
  return _loading
}

/** Fuzzy name rescue across the index. Results carry identity but no
 *  price/image — callers may hydrate (Pokémon) or display as-is. */
export async function rescueByName(query, { limit = 12 } = {}) {
  const q = (query || '').trim()
  if (q.length < 3) return []
  const idx = await loadIndex()
  const out = []
  for (const [game, setId, number, name] of idx) {
    if (!tokenMatch(q, name)) continue
    out.push({
      id: game === 'pokemon' ? `${setId}-${number}` : `${game}:${setId}:${number}`,
      name,
      number,
      set: setId,
      image: '',
      price: null,
      rarity: '',
      game,
      rescued: true,
    })
    if (out.length >= limit * 4) break
  }
  const ql = q.toLowerCase()
  out.sort((a, b) => {
    const ax = a.name.toLowerCase().startsWith(ql) ? 0 : 1
    const bx = b.name.toLowerCase().startsWith(ql) ? 0 : 1
    return ax - bx
  })
  return out.slice(0, limit)
}

/** Pokémon rescues can be hydrated to full cards (image + price) with one
 *  targeted API call; other games keep identity-only rows. */
export async function hydratePokemonRescues(rescues) {
  const ids = rescues.filter(r => r.game === 'pokemon').map(r => r.id).slice(0, 10)
  if (!ids.length) return rescues
  try {
    const q = '(' + ids.map(id => `id:${id}`).join(' OR ') + ')'
    const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(q)}&pageSize=${ids.length}&select=id,name,number,set,rarity,tcgplayer,images`,
      { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return rescues
    const d = await res.json()
    const rows = d.data || []
    // Shared EN fallback: me2pt5+ rescues hydrate URL-only — fill from the
    // static asset (no-op for live-priced rows) before reading prices.
    if (rows.length && !rows.every(c => hasLivePrices(c?.tcgplayer))) {
      const priceMap = await getEnPriceMap()
      for (const c of rows) enrichPokemonCard(c, priceMap)
    }
    const byId = new Map(rows.map(c => [c.id, c]))
    return rescues.map((r) => {
      const c = byId.get(r.id)
      if (!c) return r
      const price = getMarketPrice(c)?.price ?? null
      return { ...r, name: c.name, number: c.number || r.number, set: c.set?.name || r.set, image: c.images?.small || '', price, rarity: c.rarity || '' }
    })
  } catch { return rescues }
}

/** MTG typo rescue via Scryfall (server-side fuzzy, very good). */
export async function rescueMtg(query) {
  const q = (query || '').trim()
  if (q.length < 3) return []
  try {
    const res = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(q)}`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) })
    if (!res.ok) return []
    const c = await res.json()
    if (!c?.name) return []
    const imgs = c.image_uris || c.card_faces?.[0]?.image_uris || {}
    const num = (v) => { const n = parseFloat(String(v || '')); return Number.isFinite(n) && n >= 0 ? n : null }
    return [{
      id: c.id,
      name: c.name,
      number: c.collector_number || '',
      set: c.set_name || '',
      image: imgs.small || '',
      price: num(c.prices?.usd) || num(c.prices?.usd_foil),
      rarity: c.rarity || '',
      game: 'mtg',
      rescued: true,
    }]
  } catch { return [] }
}
