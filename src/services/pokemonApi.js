import db from '../db'
const BASE_URL = 'https://api.pokemontcg.io/v2'

const cache = new Map()
const CACHE_TTL = 1000 * 60 * 60 // 1 hour in memory
const FETCH_TIMEOUT = 15000 // 15s timeout
const MAX_RETRIES = 2

async function fetchWithRetry(url, retries = MAX_RETRIES) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT),
      })
      if (res.status === 429 || res.status >= 500) {
        // Rate limited or server error — retry with backoff
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
          continue
        }
      }
      if (!res.ok) {
        const err = new Error(`API error ${res.status}`)
        err.status = res.status
        throw err
      }
      return await res.json()
    } catch (e) {
      // Client errors (404 etc.) are definitive — retrying won't help
      if (e.status && e.status < 500) throw e
      if (e.name === 'TimeoutError' || e.name === 'AbortError') {
        if (attempt < retries) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
          continue
        }
        throw new Error('timeout')
      }
      // Network error — retry
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
        continue
      }
      throw e
    }
  }
}

async function fetchWithCache(url, { durable = true } = {}) {
  const cached = cache.get(url)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data
  }
  // Durable second layer (IndexedDB): serves Browse offline and rides out
  // API outages — set lists and card pages persist across sessions.
  // Per-query search URLs opt out (durable: false): every distinct query
  // would otherwise pile up a row in IndexedDB forever.
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const stale = cached?.data ?? (durable ? await fromDurableUrl(url) : null)
    if (stale) return stale
  }
  try {
    const data = await fetchWithRetry(url)
    cache.set(url, { data, timestamp: Date.now() })
    if (durable) toDurableUrl(url, data)
    return data
  } catch (e) {
    const stale = cached?.data ?? (durable ? await fromDurableUrl(url) : null)
    if (stale) return stale
    throw e
  }
}

async function fromDurableUrl(url) {
  try { return (await db.state.get('browse:url:' + url))?.value ?? null } catch { return null }
}
function toDurableUrl(url, data) {
  db.state.put({ key: 'browse:url:' + url, value: JSON.parse(JSON.stringify(data)) }).catch(() => {})
}

export async function searchCards(query, page = 1, pageSize = 20) {
  // Replace spaces with * wildcards so "mega charizard" → "mega*charizard"
  const term = query.replace(/\s+/g, '*')
  const encoded = encodeURIComponent(term)
  const url = `${BASE_URL}/cards?q=name:${encoded}*&page=${page}&pageSize=${pageSize}&orderBy=-set.releaseDate&select=id,name,number,set,supertype,rarity,tcgplayer,images`
  const data = await fetchWithCache(url, { durable: false })
  return data
}

export async function getCard(id, lang = null) {
  // If explicitly marked as Japanese, use tcgdex
  if (lang === 'ja') {
    return getJapaneseCardDetail(id)
  }
  const url = `${BASE_URL}/cards/${id}`
  const data = await fetchWithCache(url)
  return data.data
}

export async function getSets() {
  // Persist sets to localStorage — they rarely change
  const LS_KEY = 'rarebox_en_sets'
  const LS_TS = 'rarebox_en_sets_ts'
  const cached = localStorage.getItem(LS_KEY)
  const ts = localStorage.getItem(LS_TS)
  // One corrupt localStorage write must not brick the sets list forever —
  // parse failures fall through to the network
  try {
    if (cached && ts && Date.now() - Number(ts) < 24 * 60 * 60 * 1000) {
      return JSON.parse(cached)
    }
    if (cached && typeof navigator !== 'undefined' && !navigator.onLine) {
      return JSON.parse(cached) // stale sets beat an offline error
    }
  } catch { /* corrupt cache — refetch */ }
  const url = `${BASE_URL}/sets?orderBy=-releaseDate&select=id,name,series,total,printedTotal,releaseDate,images`
  const data = await fetchWithCache(url)
  const sets = data.data
  localStorage.setItem(LS_KEY, JSON.stringify(sets))
  localStorage.setItem(LS_TS, String(Date.now()))
  return sets
}

export async function getCardsBySet(setId, page = 1, pageSize = 36) {
  const url = `${BASE_URL}/cards?q=set.id:${setId}&page=${page}&pageSize=${pageSize}&orderBy=number&select=id,name,number,set,supertype,rarity,tcgplayer,images`
  const data = await fetchWithCache(url)
  return data
}

// Extract the best available market price from a card's TCGPlayer data
export function getMarketPrice(card, variantKey = null) {
  const prices = card?.tcgplayer?.prices
  if (!prices) return null

  if (variantKey && prices[variantKey]) {
    return prices[variantKey].market || prices[variantKey].mid || null
  }

  // Priority order
  const priority = ['holofoil', '1stEditionHolofoil', 'unlimitedHolofoil', 'reverseHolofoil', 'normal', '1stEditionNormal']
  for (const key of priority) {
    if (prices[key]?.market) return { price: prices[key].market, variant: key }
  }

  // fallback: first available
  for (const key of Object.keys(prices)) {
    if (prices[key]?.market) return { price: prices[key].market, variant: key }
  }
  return null
}

export function getAllVariants(card) {
  const prices = card?.tcgplayer?.prices
  if (!prices) return []
  return Object.entries(prices).map(([key, val]) => ({
    key,
    label: formatVariantLabel(key),
    market: val.market,
    mid: val.mid,
    low: val.low,
    high: val.high
  }))
}

// Japanese sets via tcgdex
// Japanese set ID → English (community) name. Verified against the tcgdex
// /v2/ja/sets data (Japanese names + official card counts) — these are the
// names Collectr and most EN-speaking collectors use for JP sets.
export const JP_EN_NAMES = {
  PMCG1: 'Base Set', PMCG2: 'Jungle', PMCG3: 'Fossil',
  neo1: 'Neo Genesis', neo2: 'Neo Discovery', neo3: 'Neo Revelation', neo4: 'Neo Destiny',
  S1W: 'Sword', S1H: 'Shield', S1a: 'VMAX Rising',
  S2: 'Rebellion Crash', S2a: 'Explosive Walker',
  S3: 'Infinity Zone', S3a: 'Legendary Heartbeat',
  S4: 'Amazing Volt Tackle', S4a: 'Shiny Star V',
  S5I: 'Single Strike Master', S5R: 'Rapid Strike Master', S5a: 'Matchless Fighters',
  S6H: 'Silver Lance', S6K: 'Jet-Black Spirit', S6a: 'Eevee Heroes',
  S7D: 'Skyscraping Perfection', S7R: 'Blue Sky Stream',
  S8: 'Fusion Arts', S8a: '25th Anniversary Collection', S8b: 'VMAX Climax',
  S9: 'Star Birth', S9a: 'Battle Region',
  S10D: 'Time Gazer', S10P: 'Space Juggler', S10a: 'Dark Phantasma', S10b: 'Pokémon GO',
  S11: 'Lost Abyss', S11a: 'Incandescent Arcana',
  S12: 'Paradigm Trigger', S12a: 'VSTAR Universe',
  SV1S: 'Scarlet ex', SV1V: 'Violet ex', SV1a: 'Triplet Beat',
  SV2D: 'Clay Burst', SV2P: 'Snow Hazard', SV2a: 'Pokémon Card 151',
  SV3: 'Ruler of the Black Flame', SV3a: 'Raging Surf',
  SV4K: 'Ancient Roar', SV4M: 'Future Flash', SV4a: 'Shiny Treasure ex',
  SV5K: 'Wild Force', SV5M: 'Cyber Judge', SV5a: 'Crimson Haze',
  SV6: 'Mask of Change', SV6a: 'Night Wanderer',
  SV7: 'Stellar Miracle', SV7a: 'Paradise Dragona',
  SV8: 'Super Electric Breaker', SV8a: 'Terastal Festival ex',
  SV9: 'Battle Partners', SV9a: 'Heat Wave Arena',
  SV10: 'Glory of Team Rocket',
  SV11B: 'Black Bolt', SV11W: 'White Flare',
  SVK: 'Deck Build Box Stellar Miracle',
  SVLN: 'Starter Set Terastal Sylveon ex', SVLS: 'Starter Set Terastal Ceruledge ex',
  M1L: 'Mega Brave', M1S: 'Mega Symphonia', M2: 'Inferno X', M3: 'Munikis Zero'
}

// Pokellector CDN logo URLs for Japanese sets (tcgdex has no set logos)
// Source: https://jp.pokellector.com/sets
const JP_SET_LOGOS = {
  // Scarlet & Violet era
  SV1S: 'https://den-media.pokellector.com/logos/Scarlet-ex.logo.361.png',
  SV1V: 'https://den-media.pokellector.com/logos/Violet-ex.logo.362.png',
  SV2D: 'https://den-media.pokellector.com/logos/Snow-Hazard.logo.369.png',
  SV2P: 'https://den-media.pokellector.com/logos/Clay-Burst.logo.370.png',
  SV3: 'https://den-media.pokellector.com/logos/Ruler-of-the-Black-Flame.logo.368.png',
  SV3a: 'https://den-media.pokellector.com/logos/Raging-Surf.logo.376.png',
  SV4K: 'https://den-media.pokellector.com/logos/Ancient-Roar.logo.381.png',
  SV4M: 'https://den-media.pokellector.com/logos/Future-Flash.logo.382.png',
  SV5K: 'https://den-media.pokellector.com/logos/Wild-Force.logo.386.png',
  SV5a: 'https://den-media.pokellector.com/logos/Cyber-Judge.logo.387.png',
  SV6: 'https://den-media.pokellector.com/logos/Stella-Miracle.logo.401.png',
  SV7: 'https://den-media.pokellector.com/logos/Super-Electric-Breaker.logo.405.png',
  SV7a: 'https://den-media.pokellector.com/logos/Paradise-Dragona.logo.403.png',
  SV8: 'https://den-media.pokellector.com/logos/Terastal-Festival-ex.logo.406.png',
  SV8a: 'https://den-media.pokellector.com/logos/Terastal-Festival-ex.logo.406.png',
  SV9: 'https://den-media.pokellector.com/logos/Battle-Partners.logo.408.png',
  SV9a: 'https://den-media.pokellector.com/logos/Glory-of-Team-Rocket.logo.413.png',
  SV10: 'https://den-media.pokellector.com/logos/Hot-Air-Arena.logo.411.png',
  SV10a: 'https://den-media.pokellector.com/logos/Glory-of-Team-Rocket.logo.413.png',
  SVK: 'https://den-media.pokellector.com/logos/Shiny-Treasure-ex.logo.375.png',
  SV11B: 'https://den-media.pokellector.com/logos/Black-Bolt.logo.414.png',
  SV11W: 'https://den-media.pokellector.com/logos/White-Flare.logo.415.png',
  // Sword & Shield era
  S1: 'https://den-media.pokellector.com/logos/Sword-Shield.logo.282.png',
  S4a: 'https://den-media.pokellector.com/logos/Shiny-Star-V.logo.301.png',
  S8b: 'https://den-media.pokellector.com/logos/VMAX-Climax.logo.338.png',
  S9: 'https://den-media.pokellector.com/logos/Star-Birth.logo.336.png',
  S9a: 'https://den-media.pokellector.com/logos/Battle-Region.logo.339.png',
  S10: 'https://den-media.pokellector.com/logos/Space-Juggler.logo.342.png',
  S10D: 'https://den-media.pokellector.com/logos/Time-Gazer.logo.341.png',
  S10b: 'https://den-media.pokellector.com/logos/Pokmon-GO.logo.347.png',
  S11: 'https://den-media.pokellector.com/logos/Triple-Beat.logo.366.png',
  S12: 'https://den-media.pokellector.com/logos/Paradigm-Trigger.logo.351.png',
  S12a: 'https://den-media.pokellector.com/logos/VSTAR-Universe.logo.357.png',
  // Mega era
  M1S: 'https://den-media.pokellector.com/logos/Mega-Symphonia.logo.417.png',
}

// Determine tcgdex CDN series prefix from set ID
export function jpSetToSeries(setId) {
  if (!setId) return null
  const id = setId.startsWith('neo') ? setId : setId.toUpperCase()
  if (id.startsWith('SV')) return 'SV'
  if (id.startsWith('SM')) return 'SM'
  if (id.startsWith('ST')) return null
  if (id.startsWith('S')) return 'S'
  if (id.startsWith('M')) return 'M'
  if (id.startsWith('XY')) return 'XY'
  if (id.startsWith('BW') || id.startsWith('B')) return 'BW'
  if (id.startsWith('DP')) return 'DP'
  if (id.startsWith('EX') || id.startsWith('E')) return 'EX'
  if (id.startsWith('neo')) return 'NEO'
  return null
}

// Sort Japanese sets by era (newest first) using ID patterns
function sortJapaneseSets(sets) {
  const eraOrder = { SV: 0, S: 1, M: 2, PCG: 3, PMCG: 4, neo: 5, E: 6 }
  function getSortKey(id) {
    const upper = id.toUpperCase()
    // SV series: SV9 > SV8 > SV4a > SV1a
    if (upper.startsWith('SV')) {
      const rest = upper.slice(2)
      const num = parseInt(rest) || 0
      const suffix = rest.replace(String(num), '')
      return [0, -num, suffix] // newer SV numbers first
    }
    // S series: S12 > S9 > S4a
    if (upper.startsWith('S') && !upper.startsWith('SV') && !upper.startsWith('ST')) {
      const rest = upper.slice(1)
      const num = parseInt(rest) || 0
      const suffix = rest.replace(String(num), '')
      return [1, -num, suffix]
    }
    // M series
    if (upper.startsWith('M')) {
      const num = parseInt(upper.slice(1)) || 0
      return [2, -num, '']
    }
    // Older series: push to end
    const era = eraOrder[upper.replace(/\d.*$/, '').replace(/[a-z].*$/, '')] || 9
    return [era, 0, '']
  }
  sets.sort((a, b) => {
    const ka = getSortKey(a.id)
    const kb = getSortKey(b.id)
    for (let i = 0; i < 3; i++) {
      if (ka[i] !== kb[i]) return ka[i] - kb[i]
    }
    return 0
  })
  return sets
}

export async function getJapaneseSets() {
  // Persist to localStorage — JP sets rarely change
  const LS_KEY = 'rarebox_ja_sets'
  const LS_TS = 'rarebox_ja_sets_ts'
  const cached = localStorage.getItem(LS_KEY)
  const ts = localStorage.getItem(LS_TS)
  try {
    if (cached && ts && Date.now() - Number(ts) < 24 * 60 * 60 * 1000) {
      return JSON.parse(cached)
    }
  } catch { /* corrupt cache — refetch */ }
  const url = 'https://api.tcgdex.net/v2/ja/sets'
  const data = await fetchWithCache(url)
  sortJapaneseSets(data)
  const sets = data.map(s => ({
    id: s.id,
    name: JP_EN_NAMES[s.id] || s.name,
    nameJp: s.name,
    series: '',
    total: s.cardCount?.total || 0,
    printedTotal: s.cardCount?.official || 0,
    releaseDate: s.releaseDate || null,
    images: { logo: JP_SET_LOGOS[s.id] || null, symbol: null },
    _lang: 'ja',
    _series: jpSetToSeries(s.id),
    _hasImages: !!jpSetToSeries(s.id)
  }))
  localStorage.setItem(LS_KEY, JSON.stringify(sets))
  localStorage.setItem(LS_TS, String(Date.now()))
  return sets
}

// TCGplayer market prices for JP cards — static asset built daily in CI
// (scripts/build_jp_prices.py). tcgdex only carries Cardmarket pricing for
// the newest Mega-era sets; every SV-era and older JP set comes back
// priceless without this. Keyed `${set id}-${number}`: lowercase, no
// leading zeros.
let _jpPrices = null
async function getJpPriceMap() {
  if (_jpPrices) return _jpPrices
  try {
    const res = await fetch('/jp-prices.json')
    if (res.ok) _jpPrices = (await res.json()).prices || {}
  } catch { /* leave null — retry next call (first attempt may be offline) */ }
  return _jpPrices || {}
}

function jpPriceKey(setId, localId) {
  const num = String(localId ?? '').split('/')[0].replace(/^0+/, '') || '0'
  return `${String(setId || '').toLowerCase()}-${num.toLowerCase()}`
}

export async function getJapaneseCardsBySet(setId, page = 1, pageSize = 36) {
  // Fetch the set to get card list (names, numbers)
  const url = `https://api.tcgdex.net/v2/ja/sets/${setId}`
  const setData = await fetchWithCache(url)
  const series = jpSetToSeries(setId)
  const enName = JP_EN_NAMES[setId] || setData.name
  
  let rawCards = setData.cards || []
  
  // Some sets (e.g. SV1a) return empty cards array in set listing
  // Fall back to fetching individual card details by ID pattern
  if (rawCards.length === 0 && setData.cardCount?.total > 0) {
    const total = setData.cardCount.total
    // Generate card IDs and fetch only needed pages
    rawCards = []
    for (let i = 1; i <= total; i++) {
      const localId = String(i).padStart(3, '0')
      const image = series ? `https://assets.tcgdex.net/ja/${series}/${setId}/${localId}` : null
      rawCards.push({ id: `${setId}-${localId}`, localId, name: `Card ${localId}`, image })
    }
  }

  const jpPrices = await getJpPriceMap()
  const allCards = rawCards.map(c => {
    const localId = c.localId || c.id?.split('-').pop() || ''
    // tcgdex card briefs carry the canonical image base URL; absence means the CDN
    // has no scan for this card (e.g. Mega era) — show placeholder, not a 404
    const imageBase = c.image || null
    const price = jpPrices[jpPriceKey(setId, localId)]
    return {
      id: c.id,
      name: c.name,
      number: localId,
      set: { id: setId, name: enName },
      images: imageBase ? { small: imageBase + '/low.webp', large: imageBase + '/high.webp' } : { small: null, large: null },
      supertype: 'Pokémon',
      tcgplayer: price ? { prices: { normal: { market: price, low: null, mid: price } } } : undefined,
      _lang: 'ja',
      _hasImage: !!imageBase
    }
  })
  const start = (page - 1) * pageSize
  const paged = allCards.slice(start, start + pageSize)
  return { data: paged, totalCount: allCards.length }
}

export async function getJapaneseCardDetail(cardId) {
  const url = `https://api.tcgdex.net/v2/ja/cards/${cardId}`
  const data = await fetchWithCache(url)
  
  // Prefer the TCGplayer USD price from the static asset; fall back to
  // tcgdex's cardmarket data (EUR, converted) where TCGplayer has nothing.
  let tcgPrices = null
  const jpPrices = await getJpPriceMap()
  const jpUsd = jpPrices[jpPriceKey(data.set?.id, data.localId)]
  if (jpUsd) {
    tcgPrices = { normal: { market: jpUsd, low: null, mid: jpUsd } }
  } else {
    const EUR_TO_USD = 1.08
    const cm = data.pricing?.cardmarket
    if (cm && (cm.avg || cm.trend)) {
      tcgPrices = {
        normal: {
          market: cm.trend ? +(cm.trend * EUR_TO_USD).toFixed(2) : null,
          low: cm.low ? +(cm.low * EUR_TO_USD).toFixed(2) : null,
          mid: cm.avg ? +(cm.avg * EUR_TO_USD).toFixed(2) : null
        }
      }
    }
  }
  
  return {
    id: data.id,
    name: data.name,
    number: data.localId,
    set: { id: data.set?.id, name: data.set?.name },
    images: (() => {
      const imgBase = data.image || (() => {
        const setId = data.set?.id
        const localId = data.localId
        const series = setId ? jpSetToSeries(setId) : null
        return series ? `https://assets.tcgdex.net/ja/${series}/${setId}/${String(localId).padStart(3, '0')}` : null
      })()
      return imgBase ? { small: imgBase + '/low.webp', large: imgBase + '/high.webp' } : { small: null, large: null }
    })(),
    supertype: data.category || 'Pokémon',
    subtypes: data.stage ? [data.stage] : [],
    types: data.types || [],
    hp: data.hp ? String(data.hp) : null,
    rarity: data.rarity || null,
    attacks: (data.attacks || []).map(a => ({
      name: a.name,
      cost: a.cost || [],
      damage: a.damage ? String(a.damage) : '',
      text: a.effect || ''
    })),
    weaknesses: data.weaknesses || [],
    retreatCost: data.retreat != null ? Array(data.retreat).fill(undefined).map((_, i) => i) : [],
    tcgplayer: { prices: tcgPrices },
    _lang: 'ja'
  }
}

export function formatVariantLabel(key) {
  const labels = {
    holofoil: 'Holofoil',
    reverseHolofoil: 'Reverse Holofoil',
    normal: 'Normal',
    '1stEditionHolofoil': '1st Edition Holofoil',
    '1stEditionNormal': '1st Edition Normal',
    unlimitedHolofoil: 'Unlimited Holofoil',
    unlimitedNormal: 'Unlimited Normal',
    shadowlessHolofoil: 'Shadowless Holofoil',
    shadowlessNormal: 'Shadowless Normal',
  }
  return labels[key] || key.replace(/([A-Z])/g, ' $1').trim()
}
