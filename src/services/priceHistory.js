// Card price history — all games.
//
// Primary source: the rarebox-price-history repo (per-set JSON built daily in
// CI from tcgcsv's TCGplayer archives, data since 2024-02-08), fetched per set
// over raw.githubusercontent (CORS *) and cached in IndexedDB so a set you've
// charted once works offline. EN Pokémon additionally splices the older
// tcgdex/price-history dataset (Nov 2022 → Sep 2024, now frozen) in front.
//
// fetchPriceHistory() accepts either a Pokémon card id string ("sv8-1",
// legacy callers) or a ref object:
//   { game, setId, setName, number, cardId, lang, tcgplayerId }

import db from '../db'

const HIST_BASE = 'https://raw.githubusercontent.com/novaoc/rarebox-price-history/main/data'
const LEGACY_BASE = 'https://raw.githubusercontent.com/tcgdex/price-history/master/en'
const SET_TTL = 1000 * 60 * 60 * 12 // 12h — data updates once a day

// ── Key normalization (must mirror scripts in rarebox-price-history) ───────

function normNumber(num) {
  let n = String(num || '').split('/')[0].trim().toLowerCase()
  n = n.replace(/^0+(?=[a-z0-9])/, '')
  const m = n.match(/^([a-z]+)0*(\d.*)$/)
  if (m) n = m[1] + m[2]
  return n
}

function slugify(s) {
  return String(s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'unknown'
}

// "reverse holofoil" → "reverseHolofoil" (legacy tcgdex/app variant keys)
function camelKey(sub) {
  const parts = String(sub || 'normal').toLowerCase().split(/\s+/)
  return parts[0] + parts.slice(1).map(w => w[0].toUpperCase() + w.slice(1)).join('')
}

/** Resolve a card reference to { game, setKey, cardKey } in the history repo. */
export function resolveHistoryKey(ref) {
  if (typeof ref === 'string') {
    // bare Pokémon card id "sv8-1" / tcgdex "SV8a-001"
    const i = ref.lastIndexOf('-')
    if (i === -1) return null
    ref = { game: 'pokemon', setId: ref.slice(0, i), number: ref.slice(i + 1) }
  }
  const game = ref.game || 'pokemon'
  if (game === 'pokemon') {
    let setId = ref.setId
    let number = ref.number
    if ((!setId || !number) && ref.cardId) {
      const i = ref.cardId.lastIndexOf('-')
      if (i > 0) { setId = setId || ref.cardId.slice(0, i); number = number || ref.cardId.slice(i + 1) }
    }
    if (!setId || !number) return null
    const ja = ref.lang === 'ja' || ref._lang === 'ja'
    return { game: ja ? 'pokemon-ja' : 'pokemon', setKey: String(setId).toLowerCase(), cardKey: normNumber(number) }
  }
  if (game === 'mtg') {
    if (!ref.setId || !ref.number) return null
    return { game, setKey: String(ref.setId).toLowerCase(), cardKey: String(ref.number).toLowerCase() }
  }
  if (game === 'yugioh') {
    const setName = ref.setName || ref.setId
    if (!setName || !ref.number) return null
    return { game, setKey: slugify(setName), cardKey: String(ref.number).split('/')[0].trim().toUpperCase() }
  }
  if (game === 'lorcana') {
    if (!ref.setId || !ref.number) return null
    return { game, setKey: String(ref.setId), cardKey: normNumber(ref.number) }
  }
  if (game === 'one-piece') {
    const num = String(ref.number || ref.cardId || '').split('#')[0]
    if (!ref.setId || !num) return null
    return { game, setKey: String(ref.setId).toUpperCase(), cardKey: num.split('/')[0].trim().toUpperCase() }
  }
  if (game === 'riftbound') {
    if (!ref.setId || !ref.tcgplayerId) return null
    return { game, setKey: String(ref.setId).toUpperCase(), cardKey: String(ref.tcgplayerId) }
  }
  return null
}

// ── Set-file fetch with two-layer cache (memory + IndexedDB) ────────────────

const _mem = new Map()

async function fromIdb(key) {
  try { return (await db.state.get('hist:' + key))?.value ?? null } catch { return null }
}
function toIdb(key, val) {
  db.state.put({ key: 'hist:' + key, value: val, ts: Date.now() }).catch(() => {})
}

async function fetchJson(url) {
  const res = await fetch(url)
  if (res.status === 404) return { __miss: true }
  if (!res.ok) throw new Error(`http_${res.status}`)
  return res.json()
}

async function fetchSetFile(base, key, path) {
  const hit = _mem.get(key)
  if (hit && Date.now() - hit.ts < SET_TTL) return hit.val
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const stale = hit?.val ?? await fromIdb(key)
    if (stale) return stale
  }
  try {
    const val = await fetchJson(`${base}/${path}`)
    _mem.set(key, { val, ts: Date.now() })
    toIdb(key, val)
    return val
  } catch {
    const stale = hit?.val ?? await fromIdb(key)
    if (stale) return stale
    return null
  }
}

export async function fetchSetHistory(game, setKey) {
  return fetchSetFile(HIST_BASE, `${game}/${setKey}`, `${game}/${encodeURIComponent(setKey)}.json`)
}

async function fetchLegacyPokemon(setId, number) {
  // tcgdex repo uses zero-padded sv ids (sv01, sv03.5)
  const LEGACY_SET_MAP = {
    sv1: 'sv01', sv2: 'sv02', sv3: 'sv03', 'sv3pt5': 'sv03.5', sv4: 'sv04',
    'sv4pt5': 'sv04.5', sv5: 'sv05', sv6: 'sv06', 'sv6pt5': 'sv06.5',
    sv7: 'sv07', sv8: 'sv08', 'sv8pt5': 'sv08.5', sv9: 'sv09',
  }
  const mapped = LEGACY_SET_MAP[setId] || setId
  const file = await fetchSetFile(LEGACY_BASE, `legacy/${mapped}/${number}`, `${mapped}/${number}.tcgplayer.json`)
  if (!file || file.__miss || !file.data) return null
  const variants = {}
  for (const [vk, vd] of Object.entries(file.data)) {
    if (!vd?.history) continue
    const pts = Object.entries(vd.history)
      .map(([date, vals]) => ({ date, price: (vals.avg || 0) / 100 }))
      .filter(p => p.price > 0)
      .sort((a, b) => a.date.localeCompare(b.date))
    if (pts.length) variants[vk] = pts
  }
  return Object.keys(variants).length ? variants : null
}

function dayToDate(epochDay) {
  return new Date(epochDay * 86400000).toISOString().slice(0, 10)
}

/**
 * Fetch a card's price history → { variants: { key: [{date, price}] } }.
 * Accepts a Pokémon card-id string or a ref object (see header).
 */
export async function fetchPriceHistory(ref) {
  // Riftbound history is keyed by tcgplayer product id; shelf items only
  // store the riftcodex card id — resolve via the (cached) provider set list
  if (typeof ref === 'object' && ref?.game === 'riftbound' && !ref.tcgplayerId && ref.setId && ref.cardId) {
    try {
      const { getProvider } = await import('./tcg/providers')
      const cards = await getProvider('riftbound')?.getSetCards(ref.setId) || []
      const hit = cards.find(c => c.id === ref.cardId)
      if (hit?.tcgplayerId) ref = { ...ref, tcgplayerId: hit.tcgplayerId }
    } catch { /* no resolution → no history, callers fall back */ }
  }
  const k = resolveHistoryKey(ref)
  if (!k) return null

  const variants = {}
  const setFile = await fetchSetHistory(k.game, k.setKey)
  const card = setFile && !setFile.__miss ? setFile.cards?.[k.cardKey] : null
  if (card) {
    for (const [sub, pts] of Object.entries(card)) {
      const key = camelKey(sub)
      variants[key] = pts.map(([d, p]) => ({ date: dayToDate(d), price: p }))
    }
  }

  // EN Pokémon: splice the frozen 2022→2024 dataset in front
  if (k.game === 'pokemon') {
    const legacy = await fetchLegacyPokemon(k.setKey, k.cardKey)
    if (legacy) {
      for (const [vk, pts] of Object.entries(legacy)) {
        const cur = variants[vk]
        if (!cur || !cur.length) {
          if (!variants[vk]) variants[vk] = pts
          continue
        }
        const firstNew = cur[0].date
        const older = pts.filter(p => p.date < firstNew)
        if (older.length) variants[vk] = [...older, ...cur]
      }
    }
  }

  return Object.keys(variants).length ? { variants } : null
}

// ── Chart helpers (API unchanged for existing callers) ─────────────────────

export function buildChartSeries(historyData, currentPrice, variantKey = null) {
  const available = historyData?.variants ? Object.keys(historyData.variants) : []
  let key = variantKey && available.includes(variantKey)
    ? variantKey
    : available.includes('normal') ? 'normal'
      : available.includes('holofoil') ? 'holofoil'
        : available[0] || null

  let series = []
  if (key && historyData.variants[key]) {
    series = historyData.variants[key].map(p => ({
      x: new Date(p.date).getTime(),
      y: Math.round(p.price * 100) / 100,
    }))
  }

  if (currentPrice) {
    const now = Date.now()
    if (series.length > 0) {
      const lastDate = series[series.length - 1].x
      if (now > lastDate + 1000 * 60 * 60 * 24) {
        series.push({ x: now, y: Math.round(currentPrice * 100) / 100 })
      }
    } else {
      series.push({ x: now, y: Math.round(currentPrice * 100) / 100 })
    }
  }

  return { series, key, availableVariants: available }
}

export function filterByYears(series, years = 3) {
  const cutoff = Date.now() - years * 365.25 * 24 * 60 * 60 * 1000
  return series.filter(p => p.x >= cutoff)
}

const VARIANT_LABELS = {
  normal: 'Normal',
  holofoil: 'Holofoil',
  reverseHolofoil: 'Reverse Holo',
  foil: 'Foil',
  '1stEdition': '1st Edition',
  '1stEditionHolofoil': '1st Ed Holo',
  unlimited: 'Unlimited',
  unlimitedHolofoil: 'Unlimited Holo',
}

export function getVariantLabel(key) {
  if (!key) return 'Market'
  return VARIANT_LABELS[key]
    || key.replace(/([A-Z])/g, ' $1').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim()
}

/** Build a history ref from a shelf item (PortfolioChart, item detail). */
export function itemHistoryRef(item) {
  return {
    game: item.game || 'pokemon',
    lang: item._lang || item.cardData?._lang || null,
    setId: item.cardData?.set?.id || null,
    setName: item.cardData?.set?.name || item.setName || null,
    number: item.cardData?.number || null,
    cardId: item.cardId || null,
    tcgplayerId: item.tcgplayerId || null,
  }
}
