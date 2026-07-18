// PriceCharting.com API — free tier, requires a free API key from pricecharting.com
// Covers Pokemon cards (raw + PSA/BGS graded) and sealed products.
// Prices returned in cents; we convert to dollars.

const PC_API = 'https://www.pricecharting.com/api'
const KEY_STORAGE = 'pc_api_key'
const CACHE_PREFIX = 'pc_cache_'
const CACHE_TTL = 1000 * 60 * 60 * 4 // 4 hours
const FETCH_TIMEOUT = 10000 // 10s timeout

export function getPCApiKey() {
  return localStorage.getItem(KEY_STORAGE) || ''
}

export function savePCApiKey(key) {
  if (key?.trim()) localStorage.setItem(KEY_STORAGE, key.trim())
  else localStorage.removeItem(KEY_STORAGE)
}

function readCache(key) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key)
    if (!raw) return null
    const { data, ts } = JSON.parse(raw)
    if (Date.now() - ts > CACHE_TTL) { localStorage.removeItem(CACHE_PREFIX + key); return null }
    return data
  } catch { return null }
}

function writeCache(key, data) {
  try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ data, ts: Date.now() })) } catch {}
}

// Search PriceCharting for products matching a query string.
// Returns array of product objects.
export async function searchPCProducts(query) {
  const key = getPCApiKey()
  if (!key) throw new Error('no_key')

  const q = query.trim().toLowerCase()
  const cached = readCache('s_' + q)
  if (cached) return cached

  const url = `${PC_API}/products?q=${encodeURIComponent(q)}&t=${key}`
  let res
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT) })
  } catch (e) {
    throw new Error('cors') // likely CORS, network error, or timeout
  }

  if (res.status === 401 || res.status === 403) throw new Error('bad_key')
  if (!res.ok) throw new Error(`api_${res.status}`)

  const data = await res.json()
  const products = data.products || []
  writeCache('s_' + q, products)
  return products
}

// Get full product details (includes all grade prices).
export async function getPCProduct(id) {
  const key = getPCApiKey()
  if (!key) throw new Error('no_key')

  const cached = readCache('p_' + id)
  if (cached) return cached

  const url = `${PC_API}/product?id=${id}&t=${key}`
  let res
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT) })
  } catch (e) {
    throw new Error('cors') // likely CORS, network error, or timeout
  }

  if (res.status === 401 || res.status === 403) throw new Error('bad_key')
  if (!res.ok) throw new Error(`api_${res.status}`)

  const data = await res.json()
  writeCache('p_' + id, data)
  return data
}

/**
 * Extract the most relevant price from a product based on item type.
 * @param {Object} product - Product data from PriceCharting
 * @param {'sealed' | 'graded' | 'card'} itemType - The context of the item being priced
 * @param {string|number} [grade] - Numeric grade for graded cards (e.g. 10, 9.5)
 * @returns {number|null} Price in dollars, or null if unavailable.
 */
export function extractPrice(product, itemType, grade = null) {
  if (!product) return null
  const toDollars = v => (v && v > 0) ? Math.round(v) / 100 : null

  if (itemType === 'sealed') {
    return toDollars(product['new-price'])
      || toDollars(product['cib-price'])
      || toDollars(product['loose-price'])
  }

  if (itemType === 'graded' && grade != null) {
    const g = parseFloat(grade)
    if (!isNaN(g)) {
      // Try exact, floor, ceil in order
      for (const k of [`grade-${g}`, `grade-${Math.floor(g)}`, `grade-${Math.ceil(g)}`]) {
        const v = toDollars(product[k])
        if (v) return v
      }
    }
    // Fallback to loose
    return toDollars(product['loose-price'])
  }

  // Raw card fallback
  return toDollars(product['loose-price']) || toDollars(product['cib-price'])
}

export function formatPCProductName(product) {
  return [product['product-name'], product['console-name']]
    .filter(Boolean).join(' — ')
}

// Clear PriceCharting cache entries from localStorage
export function clearPCCache() {
  Object.keys(localStorage)
    .filter(k => k.startsWith(CACHE_PREFIX))
    .forEach(k => localStorage.removeItem(k))
}
