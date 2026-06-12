// Rarebox Price Service — PriceCharting JSON API, runs directly in the browser.
// No backend, no API key. CORS is fully open on PriceCharting's search endpoint.
//
// Price fields from the API:
//   price1 = ungraded / loose (used for raw cards and sealed)
//   price2 = mid-grade (approx. PSA 8–9 range)
//   price3 = gem mint / grade 10 (PSA 10, BGS 10, CGC 10, etc.)

const PC_BASE = 'https://www.pricecharting.com'

// In-memory cache — 1 hour TTL, max 200 entries
const _cache = new Map()
const CACHE_TTL = 60 * 60 * 1000

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
 * Parse "$1,234.56" or number → float, or null if zero/missing.
 */
function parsePrice(val) {
  if (typeof val === 'number') return val > 0 ? val : null
  if (!val) return null
  const num = parseFloat(String(val).replace(/[$,]/g, '').trim())
  return num > 0 ? num : null
}

/**
 * Pick the right price field based on grade.
 * Grade 10 (PSA 10, BGS 10, CGC 10, etc.) → price3 (gem mint)
 * Grade 9–9.5 → price2 (mid-grade)
 * Ungraded / grade <9 → price1 (loose)
 */
function priceForGrade(product, grade) {
  const g = String(grade || 'ungraded').toLowerCase()

  // Gem mint (grade 10, psa10, bgs10, cgc10, ace10, etc.)
  if (g === '10' || g.endsWith('10') || g === 'bgs10b') {
    return parsePrice(product.price3) || parsePrice(product.price2) || parsePrice(product.price1)
  }

  // Mid-grade (9, 9.5, psa9, etc.)
  if (g.includes('9')) {
    return parsePrice(product.price2) || parsePrice(product.price1)
  }

  // Ungraded or lower grade
  return parsePrice(product.price1)
}

/**
 * Fetch market price from PriceCharting.
 * @param {string} query  - e.g. "Gengar VMAX Fusion Strike"
 * @param {string} grade  - "ungraded", "9", "10", "psa10", etc.
 */
/**
 * Graded-market search for the booth pickers: products that actually have
 * graded prices, mapped to { name, set, image, psa9, psa10 }. psa9 ≈
 * PriceCharting's mid-grade band (PSA 8-9), psa10 = gem mint.
 */
export async function searchGradedProducts(query, { limit = 12 } = {}) {
  const products = await searchPC(query)
  return products
    .map(p => ({
      id: String(p.id ?? p.productName ?? ''),
      name: p.productName || '',
      set: p.consoleName || '',
      image: p.imageUri || '',
      psa9: parsePrice(p.price2),
      psa10: parsePrice(p.price3),
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

  // Prefer relevant products; fall back to all results
  let filtered = products.filter(p => {
    const consoleName = (p.consoleName || '').toLowerCase()
    if (isMtg) return consoleName.includes('magic')
    if (isOnePiece) return consoleName.includes('one piece')
    if (isRiftbound) return consoleName.includes('riftbound')
    return consoleName.includes('pokemon')
  })

  if (!filtered.length) filtered = products
  if (!filtered.length) throw new Error('no_results')

  const product = filtered[0]
  const price = priceForGrade(product, grade)
  if (!price) throw new Error('no_results')

  const result = {
    query: q,
    grade,
    price,
    product_name: product.productName || '',
    product_set: product.consoleName || '',
    product_url: product.id ? `${PC_BASE}/game/${product.id}` : '',
    image: product.imageUri || '',
    all_grades: {
      ungraded: parsePrice(product.price1),
      grade9:   parsePrice(product.price2),
      grade10:  parsePrice(product.price3),
    },
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
