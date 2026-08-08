/**
 * English catalog supplement — cards TCGplayer sells but pokemontcg.io
 * does not know AT ALL (no set, no card, 404). Verified 2026-08-08 with
 * the ME: Mega Evolution Promo group (Phantasmal Flames tin Mega
 * Charizard X/Y ex): api /sets/mep 404s and the canonical
 * pokemon-tcg-data repo has no such set, so these cards were
 * unsearchable and untrackable in Rarebox (and, famously, in Collectr).
 *
 * public/en-extras.json (scripts/build_en_extras.py, daily CI) carries
 * every unmapped tcgcsv group: set meta + [setId, number, name, price,
 * productId] rows. Set ids are `x-` prefixed (x-mep) so they can never
 * collide with real pokemontcg ids; images are TCGplayer product photos.
 */
import { tokenMatch } from '../utils/search.js'
import { normEnNumber } from './tcg/enPrices.js'

let _data = null
let _loading = null

async function load() {
  if (_data) return _data
  if (_loading) return _loading
  _loading = (async () => {
    try {
      const res = await fetch('/en-extras.json', { signal: AbortSignal.timeout(10000) })
      if (!res.ok) throw new Error(`http_${res.status}`)
      const d = await res.json()
      _data = { sets: d.sets || {}, cards: d.cards || [] }
    } catch {
      _data = null
      _loading = null // retry on the next call
      return { sets: {}, cards: [] }
    }
    return _data
  })()
  return _loading
}

export function isExtraCardId(id) {
  return /^x-/.test(String(id || ''))
}

function productImage(pid, large = false) {
  return pid ? `https://tcgplayer-cdn.tcgplayer.com/product/${pid}_${large ? '400w' : '200w'}.jpg` : null
}

function setLabel(sets, sid) {
  const s = sets[sid]
  if (!s) return sid.replace(/^x-/, '').toUpperCase()
  return s.abbrev ? `${s.name} (${s.abbrev})` : s.name
}

/** Search extras by name — booth-search-shaped flat results, like jpSearch. */
export async function searchEnExtras(query, { limit = 10, number = null } = {}) {
  const { sets, cards } = await load()
  const q = (query || '').trim()
  if (!q && !number) return []
  const wantNum = number != null && number !== '' ? normEnNumber(String(number)) : null
  const out = []
  for (const [sid, num, name, price, pid] of cards) {
    if (wantNum && normEnNumber(String(num)) !== wantNum) continue
    if (q && !tokenMatch(q, name)) continue
    out.push({
      id: `${sid}-${normEnNumber(String(num))}`,
      name,
      number: String(num),
      set: setLabel(sets, sid),
      image: productImage(pid),
      price: price ?? null, // $0 is a real price
      game: 'pokemon',
    })
    if (out.length >= limit * 3) break
  }
  const ql = q.toLowerCase()
  out.sort((a, b) => {
    const ax = a.name.toLowerCase() === ql ? 0 : a.name.toLowerCase().startsWith(ql) ? 1 : 2
    const bx = b.name.toLowerCase() === ql ? 0 : b.name.toLowerCase().startsWith(ql) ? 1 : 2
    if (ax !== bx) return ax - bx
    return (b.price || 0) - (a.price || 0)
  })
  return out.slice(0, limit)
}

/** Rich-ish card for an x- id — getCard's extras branch (refresh + detail). */
export async function extraCardById(cardId) {
  const { sets, cards } = await load()
  const id = String(cardId || '')
  const at = id.lastIndexOf('-')
  if (at <= 0) return null
  const sid = id.slice(0, at)
  const num = id.slice(at + 1)
  const row = cards.find(([s, n]) => s === sid && normEnNumber(String(n)) === num)
  if (!row) return null
  const [, rawNum, name, price, pid] = row
  return {
    id,
    name,
    number: String(rawNum),
    set: { id: sid, name: sets[sid]?.name || sid },
    images: { small: productImage(pid), large: productImage(pid, true) },
    supertype: 'Pokémon',
    rarity: null,
    tcgplayer: { prices: price != null ? { normal: { market: price, low: null, mid: price } } : null },
  }
}
