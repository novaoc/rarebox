// Japanese Pokémon search by ENGLISH name.
//
// tcgdex (the JP card source) names cards in Japanese, so a query like
// "mega charizard ex" can't match it. public/jp-index.json (built daily in
// CI from TCGplayer's Pokemon Japan catalog, which uses English names)
// bridges that: [tcgdexSetId, localId, englishName, price] per card.
// Images come from the tcgdex CDN; set display names from JP_EN_NAMES.

import { jpSetToSeries, JP_EN_NAMES, jpProductImage } from './pokemonApi'
import { tokenMatch } from '../utils/search.js'

let _index = null
let _sets = {}
let _loading = null

async function loadIndex() {
  if (_index) return _index
  if (_loading) return _loading
  _loading = (async () => {
    try {
      const res = await fetch('/jp-index.json', { signal: AbortSignal.timeout(10000) })
      if (!res.ok) throw new Error(`http_${res.status}`)
      const d = await res.json()
      _index = d.cards || []
      _sets = d.sets || {}
    } catch {
      _index = []
      _loading = null // allow a retry on the next search
    }
    return _index
  })()
  return _loading
}

function stripZeros(s) {
  return s.replace(/^0+(?=\d)/, '')
}

function jpImage(setId, localId, pid) {
  // tcgdex scans when the set has them; TCGplayer product photo otherwise
  // (the Mega era has NO tcgdex scans — blind URLs there 404)
  const meta = _sets[String(setId).toLowerCase()]
  if (meta && meta.scans === false) return jpProductImage(pid) || ''
  const series = jpSetToSeries(setId)
  // CDN paths need 3-digit zero-padding: /SV8/006 works, /SV8/6 is a 404
  if (series) return `https://assets.tcgdex.net/ja/${series}/${setId}/${String(localId).padStart(3, '0')}/low.webp`
  return jpProductImage(pid) || ''
}

/** Set display: "Inferno X (M2a)" when we know the EN community name. */
function jpSetLabel(setId) {
  const en = JP_EN_NAMES[setId]
  return en ? `${en} (${setId})` : setId
}

/**
 * Search JP cards by English name. Optional setIds restricts to specific
 * tcgdex sets (case-insensitive); optional number matches the localId with
 * zero-padding tolerance ("110" hits "110", "012" hits "12").
 * Returns booth-search-shaped results.
 */
export async function searchJapanese(query, { limit = 24, setIds = null, number = null } = {}) {
  const idx = await loadIndex()
  const q = (query || '').trim()
  const wantSets = setIds ? new Set(setIds.map(s => String(s).toLowerCase())) : null
  const wantNum = number != null && number !== '' ? stripZeros(String(number)) : null
  const out = []
  for (const [setId, localId, name, price, pid] of idx) {
    if (wantSets && !wantSets.has(setId.toLowerCase())) continue
    if (wantNum && stripZeros(String(localId)) !== wantNum) continue
    if (q && !tokenMatch(q, name)) continue
    out.push({
      id: `${setId}-${localId}`,
      name,
      number: localId,
      set: jpSetLabel(setId),
      image: jpImage(setId, localId, pid),
      price: price ?? null, // $0 is a real price
      game: 'pokemon',
      _lang: 'ja',
      jp: true,
    })
    if (out.length >= limit * 3) break // rank below, keep the scan bounded
  }
  const ql = q.toLowerCase()
  out.sort((a, b) => {
    const ax = a.name.toLowerCase() === ql ? 0 : a.name.toLowerCase().startsWith(ql) ? 1 : 2
    const bx = b.name.toLowerCase() === ql ? 0 : b.name.toLowerCase().startsWith(ql) ? 1 : 2
    if (ax !== bx) return ax - bx
    return (b.price || 0) - (a.price || 0) // pricier printings first — usually the wanted ones
  })
  return out.slice(0, limit)
}
