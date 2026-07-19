// Rarebox Price Service — PriceCharting search runs directly in the browser;
// complete graded guides use a read-only same-origin endpoint. No API key.
//
// The CORS-open search JSON exposes only loose, PSA 10, and Grade 9. For a
// graded request we resolve the exact product first, then call Rarebox's
// same-origin /api/pricecharting_grades endpoint for PriceCharting's complete
// public grade guide (1-9.5 plus company-specific 10 tiers).

import {
  extractCollectorNumber,
  pickRiftboundPcCandidate,
} from '../utils/riftboundVariant.js'

const PC_BASE = 'https://www.pricecharting.com'

// In-memory cache — 1 hour TTL, max 200 entries
const _cache = new Map()
const CACHE_TTL = 60 * 60 * 1000
const FULL_GRADE_TIMEOUT = 15000
const _gradeCache = new Map()

function cacheGet(key) {
  const entry = _cache.get(key)
  if (entry && Date.now() < entry.expires) return entry.data
  _cache.delete(key)
  return null
}

function cacheSet(key, data) {
  _cache.set(key, { data, expires: Date.now() + CACHE_TTL })
  if (_cache.size > 200) {
    const oldest = _cache.keys().next().value
    _cache.delete(oldest)
  }
}

/**
 * Always online — no server to check.
 */
export async function checkServerHealth() {
  return true
}

/**
 * Search PriceCharting JSON API.
 * Returns array of { productName, consoleName, price1, price2, price3, id, imageUri }
 */
async function searchPC(query) {
  const key = `search:${query.toLowerCase()}`
  const cached = cacheGet(key)
  if (cached) return cached

  const url = `${PC_BASE}/search-products?type=prices&q=${encodeURIComponent(query)}`
  const MAX_RETRIES = 2
  let lastError

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      })
      if (res.status === 429 || res.status >= 500) {
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
          continue
        }
      }
      if (!res.ok) throw new Error(`pc_error_${res.status}`)

      const data = await res.json()
      const products = Array.isArray(data) ? data : (data.products || [])
      cacheSet(key, products)
      return products
    } catch (e) {
      lastError = e
      if (e.name === 'TimeoutError' || e.name === 'AbortError') {
        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
          continue
        }
        throw new Error('timeout')
      }
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)))
        continue
      }
    }
  }
  throw lastError || new Error('server_down')
}

/**
 * Parse "$1,234.56" or number → float, or null if missing/invalid.
 */
function parsePrice(val) {
  if (typeof val === 'number') return val >= 0 ? val : null
  if (!val) return null
  const num = parseFloat(String(val).replace(/[$,]/g, '').trim())
  return Number.isFinite(num) && num >= 0 ? num : null
}

/**
 * Select one exact normalized full-guide tier. Missing data returns null;
 * never substitute PSA 10, Grade 9, raw market, or another company.
 */
export function priceForGrade(product, grade, fullPrices = null) {
  const key = String(grade || 'ungraded').toLowerCase()
  if (key === 'ungraded') return parsePrice(product?.price1)
  if (!fullPrices || key === 'unsupported10') return null
  return parsePrice(fullPrices[key])
}

function gradeLabel(key) {
  const labels = {
    psa10: 'PSA 10', bgs10: 'BGS 10', bgs10_black: 'BGS 10 Black',
    cgc10: 'CGC 10', cgc10_pristine: 'CGC 10 Pristine', sgc10: 'SGC 10',
    ace10: 'ACE 10', tag10: 'TAG 10', unsupported10: 'Unsupported 10',
  }
  if (labels[key]) return labels[key]
  const m = String(key).match(/^grade(\d+)(?:_(\d+))?$/)
  return m ? `Grade ${m[1]}${m[2] ? `.${m[2]}` : ''}` : String(key)
}

async function fetchFullGradePrices(productId) {
  const id = String(productId || '')
  if (!/^\d{1,20}$/.test(id)) throw new Error('no_graded_data')
  const hit = _gradeCache.get(id)
  if (hit && Date.now() < hit.expires) return hit.data
  let res
  try {
    res = await fetch(`/api/pricecharting_grades?id=${encodeURIComponent(id)}`, {
      signal: AbortSignal.timeout(FULL_GRADE_TIMEOUT),
    })
  } catch (e) {
    if (e?.name === 'TimeoutError' || e?.name === 'AbortError') throw new Error('timeout')
    throw new Error('server_down')
  }
  if (!res.ok) throw new Error(res.status === 404 ? 'no_graded_data' : 'server_down')
  const data = await res.json()
  const prices = data?.prices && typeof data.prices === 'object' ? data.prices : null
  if (!prices) throw new Error('no_graded_data')
  const value = { prices, product_url: data.product_url || '' }
  _gradeCache.set(id, { data: value, expires: Date.now() + CACHE_TTL })
  return value
}

/**
 * Fetch market price from PriceCharting.
 * @param {string} query  - e.g. "Gengar VMAX Fusion Strike"
 * @param {string} grade  - "ungraded", "9", "10", "psa10", etc.
 */
/**
 * Graded-market search for the booth pickers: products that actually have
 * graded prices, mapped to { name, set, image, psa9, psa10 }.
 */
export async function searchGradedProducts(query, { limit = 12 } = {}) {
  const products = await searchPC(query)
  return products
    .map(p => ({
      id: String(p.id ?? p.productName ?? ''),
      name: p.productName || '',
      set: p.consoleName || '',
      image: p.imageUri || '',
      psa9: parsePrice(p.price3),
      psa10: parsePrice(p.price2),
      graded: true,
    }))
    .filter(p => p.name && (p.psa9 || p.psa10))
    .slice(0, limit)
}

export async function fetchPrice(query, grade = 'ungraded') {
  const q = query.trim()
  if (!q) throw new Error('empty_query')

  const cacheKey = `price:${q.toLowerCase()}:${grade}`
  const cached = cacheGet(cacheKey)
  if (cached) return { ...cached, cached: true }

  let products
  try {
    products = await searchPC(q)
  } catch (e) {
    if (e.name === 'TimeoutError') throw new Error('timeout')
    throw new Error('server_down')
  }

  const lq = q.toLowerCase()
  const isMtg = lq.includes('magic') || lq.includes('mtg')
  const isOnePiece = lq.includes('one piece') || lq.includes('op0')
  const isRiftbound = lq.includes('riftbound')
  const isYugioh = lq.includes('yugioh') || lq.includes('yu-gi-oh')
  const isLorcana = lq.includes('lorcana')

  // Prefer relevant products; fall back to all results
  let filtered = products.filter(p => {
    const consoleName = (p.consoleName || '').toLowerCase()
    if (isMtg) return consoleName.includes('magic')
    if (isOnePiece) return consoleName.includes('one piece')
    if (isRiftbound) return consoleName.includes('riftbound')
    if (isYugioh) return consoleName.includes('yugioh')
    if (isLorcana) return consoleName.includes('lorcana')
    return consoleName.includes('pokemon')
  })

  if (!filtered.length) filtered = products
  if (!filtered.length) throw new Error('no_results')

  const isGraded = grade !== 'ungraded'
  let product

  // Riftbound graded: strict number + variant match (Signature/alt-art/plain).
  // Never fall back to unfiltered token-score winner — wrong printing risk.
  if (isRiftbound && isGraded) {
    if (!extractCollectorNumber(q)) throw new Error('no_results')
    const pick = pickRiftboundPcCandidate(q, filtered)
    if (!pick.ok) throw new Error('no_results')
    product = pick.product
  } else {
    // Pick best match by name overlap instead of blindly taking [0].
    // This prevents wrong SKU (e.g. case vs box, wrong variant) for ambiguous names
    // like "Spider-Man Collector Booster Box".
    const queryTokens = lq.split(/\s+/).filter(t => t.length > 2)
    const scored = filtered.map(p => {
      const name = (p.productName || '').toLowerCase()
      const score = queryTokens.reduce((s, tok) => s + (name.includes(tok) ? 1 : 0), 0)
      return { p, score }
    }).sort((a, b) => b.score - a.score)

    product = (scored[0]?.score > 0 ? scored[0].p : filtered[0])
  }

  let fullGradeData = null
  if (isGraded) fullGradeData = await fetchFullGradePrices(product.id)
  const price = priceForGrade(product, grade, fullGradeData?.prices)
  // $0 is a valid market price — only null means missing graded/raw data.
  // Graded requests must never fall through to raw price1 (priceForGrade
  // already returns null when graded fields are absent).
  if (price == null) throw new Error(isGraded ? 'no_graded_data' : 'no_results')

  const result = {
    query: q,
    grade,
    grade_label: gradeLabel(grade),
    price,
    product_name: product.productName || '',
    product_set: product.consoleName || '',
    product_url: fullGradeData?.product_url || (product.id ? `${PC_BASE}/game/${product.id}` : ''),
    image: product.imageUri || '',
    all_grades: { ungraded: parsePrice(product.price1), ...(fullGradeData?.prices || {}) },
    cached: false,
  }

  cacheSet(cacheKey, result)
  return result
}

// Backwards-compat alias
export const fetchEbayPrice = fetchPrice

/**
 * Search for sealed products.
 * @param {string} query - e.g. "Fusion Strike booster box"
 * @param {string} game - "pokemon", "magic", "one-piece", or "riftbound"
 */
export async function searchSealed(query, game = 'pokemon') {
  const q = query.trim()
  if (!q) throw new Error('empty_query')

  const cacheKey = `sealed:${game}:${q.toLowerCase()}`
  const cached = cacheGet(cacheKey)
  if (cached) return { results: cached, cached: true }

  let products = []
  let suffix = 'sealed pokemon'
  if (game === 'magic') suffix = 'magic'
  else if (game === 'one-piece') suffix = 'one piece'
  else if (game === 'riftbound') suffix = 'riftbound'

  const searchQuery = `${q} ${suffix}`
  
  try {
    products = await searchPC(searchQuery)
    
    // If query mentions "case", also search without "sealed" to find case listings
    if (q.toLowerCase().includes('case')) {
      try {
        const caseProducts = await searchPC(`${q} ${game.replace('-', ' ')}`)
        // Merge, dedup by slug
        const seen = new Set(products.map(p => p.id))
        for (const p of caseProducts) {
          if (p.id && !seen.has(p.id)) products.push(p)
        }
      } catch { /* best effort */ }
    }
  } catch (e) {
    if (e.name === 'TimeoutError') throw new Error('timeout')
    throw new Error('server_down')
  }

  const skip = ['sleeve', 'portfolio', 'binder', 'dice', 'coin']
  const notSkipped = (p) => !skip.some(s => (p.productName || '').toLowerCase().includes(s))
  const matchesGame = (p) => {
    const consoleName = (p.consoleName || '').toLowerCase()
    if (game === 'magic') return consoleName.includes('magic')
    if (game === 'one-piece') return consoleName.includes('one piece')
    if (game === 'riftbound') return consoleName.includes('riftbound')
    return consoleName.includes('pokemon')
  }

  // Prefer game-matched results; fall back to skip-only filtering if the
  // consoleName game filter drops everything (PriceCharting doesn't always
  // put the game name in consoleName for sealed products).
  let filtered = products.filter(p => matchesGame(p) && notSkipped(p))
  if (filtered.length === 0) filtered = products.filter(notSkipped)

  const results = filtered.map(p => ({
    name: p.productName || '',
    set: p.consoleName || '',
    url: p.id ? `${PC_BASE}/game/${p.id}` : '',
    slug: p.id || '',
    price: parsePrice(p.price1),
    image: p.imageUri || '',
  }))

  cacheSet(cacheKey, results)
  return { results, cached: false }
}
