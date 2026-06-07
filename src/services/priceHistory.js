// Fetches historical price data from tcgdex/price-history GitHub repo
// Data goes from Nov 2022 → Sep 2024, we bridge to current via pokemontcg.io

const REPO_BASE = 'https://raw.githubusercontent.com/tcgdex/price-history/master/en'
const LS_PREFIX = 'ph_cache_'
const CACHE_TTL = 1000 * 60 * 60 * 24 // 24 hours

// Some set IDs differ between pokemontcg.io and tcgdex repo
const SET_ID_MAP = {
  'sv1': 'sv01',
  'sv2': 'sv02',
  'sv3': 'sv03',
  'sv3pt5': 'sv03.5',
  'sv4': 'sv04',
  'sv4pt5': 'sv04.5',
  'sv5': 'sv05',
  'sv6': 'sv06',
  'sv6pt5': 'sv06.5',
  'sv7': 'sv07',
  'sv8': 'sv08',
  'sv8pt5': 'sv08.5',
  'sv9': 'sv09',
}

function mapSetId(pokemonTcgSetId) {
  return SET_ID_MAP[pokemonTcgSetId] || pokemonTcgSetId
}

// Parse card ID like "base1-4" or "sv1-25" into { setId, cardNumber }
function parseCardId(cardId) {
  const lastDash = cardId.lastIndexOf('-')
  if (lastDash === -1) return null
  return {
    setId: cardId.substring(0, lastDash),
    cardNumber: cardId.substring(lastDash + 1)
  }
}

function getCacheKey(cardId) {
  return `${LS_PREFIX}${cardId}`
}

function getFromLocalStorage(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (Date.now() - parsed.timestamp > CACHE_TTL) {
      localStorage.removeItem(key)
      return null
    }
    return parsed.data
  } catch {
    return null
  }
}

function saveToLocalStorage(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }))
  } catch (e) {
    // localStorage full — clear old price caches
    clearOldCaches()
  }
}

function clearOldCaches() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith(LS_PREFIX))
  // Remove oldest half
  keys.slice(0, Math.ceil(keys.length / 2)).forEach(k => localStorage.removeItem(k))
  // Also clean miss caches
  Object.keys(localStorage)
    .filter(k => k.startsWith(LS_PREFIX) && k.endsWith('_miss'))
    .forEach(k => localStorage.removeItem(k))
}

// Fetch raw price history from GitHub
export async function fetchPriceHistory(cardId) {
  const cacheKey = getCacheKey(cardId)
  const cached = getFromLocalStorage(cacheKey)
  if (cached) return cached

  // Cache "not found" so we don't re-fetch 404s
  const missKey = cacheKey + '_miss'
  const miss = getFromLocalStorage(missKey)
  if (miss) return null

  const parsed = parseCardId(cardId)
  if (!parsed) return null

  const mappedSetId = mapSetId(parsed.setId)
  const url = `${REPO_BASE}/${mappedSetId}/${parsed.cardNumber}.tcgplayer.json`

  try {
    const res = await fetch(url)
    if (!res.ok) {
      // Cache the miss for 24h so we don't re-fetch
      saveToLocalStorage(missKey, 'miss')
      return null
    }
    const json = await res.json()
    const result = processHistoryData(json)
    if (result) {
      saveToLocalStorage(cacheKey, result)
    } else {
      saveToLocalStorage(missKey, 'miss')
    }
    return result
  } catch {
    saveToLocalStorage(missKey, 'miss')
    return null
  }
}

// Process raw data into { variants: { variantKey: [{date, price}] } }
function processHistoryData(raw) {
  if (!raw?.data) return null

  const variants = {}
  for (const [variantKey, variantData] of Object.entries(raw.data)) {
    if (!variantData?.history) continue

    const points = Object.entries(variantData.history)
      .map(([date, vals]) => ({
        date,
        price: (vals.avg || 0) / 100, // cents to dollars
        min: vals.min ? vals.min / 100 : null,
        max: vals.max ? vals.max / 100 : null,
        count: vals.count || 0
      }))
      .filter(p => p.price > 0)
      .sort((a, b) => a.date.localeCompare(b.date))

    if (points.length > 0) {
      variants[variantKey] = points
    }
  }

  return Object.keys(variants).length > 0 ? { variants } : null
}

// Build chart series — merges historical data + current price as final point
// Returns array of { x: timestamp, y: price } suitable for ApexCharts
export function buildChartSeries(historyData, currentPrice, variantKey = null) {
  const available = historyData?.variants ? Object.keys(historyData.variants) : []
  
  // Pick variant: prefer exact match, then near mint, then first available
  let key = variantKey && available.includes(variantKey)
    ? variantKey
    : available.find(k => k.includes('nearmint') || k.includes('good'))
      || available[0]
      || null

  let series = []
  if (key && historyData.variants[key]) {
    const points = historyData.variants[key]
    series = points.map(p => ({
      x: new Date(p.date).getTime(),
      y: Math.round(p.price * 100) / 100
    }))
  }

  // Append current price as latest point if it's newer
  if (currentPrice) {
    const now = Date.now()
    if (series.length > 0) {
      const lastDate = series[series.length - 1].x
      if (now > lastDate + 1000 * 60 * 60 * 24) { // at least 1 day gap
        series.push({ x: now, y: Math.round(currentPrice * 100) / 100 })
      }
    } else {
      // FIX: Ensure even with no history, we return a point for the current price
      series.push({ x: now, y: Math.round(currentPrice * 100) / 100 })
    }
  }

  return { series, key, availableVariants: available }
}

// Filter series to last N years
export function filterByYears(series, years = 3) {
  const cutoff = Date.now() - years * 365.25 * 24 * 60 * 60 * 1000
  return series.filter(p => p.x >= cutoff)
}

export const VARIANT_LABELS = {
  'holo-nearmint': 'Near Mint',
  'holo-good': 'Good',
  'holo-played': 'Played',
  'holo-poor': 'Poor',
  'holo-used': 'Used',
  'normal-nearmint': 'Normal NM',
  'normal-good': 'Normal Good',
  'normal-played': 'Normal Played',
  'reverse-nearmint': 'Reverse Holo NM',
  'reverse-good': 'Reverse Holo Good',
  '1st-nearmint': '1st Ed NM',
  '1st-good': '1st Ed Good',
}

export function getVariantLabel(key) {
  if (!key) return 'Market'
  return VARIANT_LABELS[key] || key.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
