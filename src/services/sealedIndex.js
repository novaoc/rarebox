/**
 * Sealed-product search over the static per-game indexes the data pipeline
 * builds daily (scripts/build_sealed_index.py → public/sealed-index/*.json).
 *
 * Sealed product has no industry-standard identifier — the same booster box
 * goes by many names — so both sides of a booth deal pick from this one
 * canonical list and matching becomes exact TCGplayer-product-id equality,
 * the same join the Riftbound price feed uses. Rows: [pid, name, group,
 * upc, marketPrice]; product images derive from the pid, so the index
 * carries none.
 */
import { tokenMatch } from '../utils/search'

// pokemon-jp (tcgcsv category 85) is its own file so EN-only sessions never
// pay for it — but it joins the Pokémon lane at search time.
const GAME_FILES = {
  pokemon: ['pokemon', 'pokemon-jp'],
  mtg: ['mtg'],
  yugioh: ['yugioh'],
  lorcana: ['lorcana'],
  'one-piece': ['one-piece'],
  riftbound: ['riftbound'],
}

export const SEALED_GAMES = Object.keys(GAME_FILES)

const cache = new Map() // file → Promise<rows>

function loadFile(file) {
  if (!cache.has(file)) {
    const p = fetch(`/sealed-index/${file}.json`, { signal: AbortSignal.timeout(10000) })
      .then(r => (r.ok ? r.json() : { rows: [] }))
      .then(d => (Array.isArray(d.rows) ? d.rows : []))
      .catch(() => {
        cache.delete(file) // transient failure — retry on next search
        return []
      })
    cache.set(file, p)
  }
  return cache.get(file)
}

export function sealedImageUrl(productId) {
  return `https://tcgplayer-cdn.tcgplayer.com/product/${productId}_200w.jpg`
}

/**
 * Search sealed products across games. Returns booth/search-shaped entries:
 * { game, id, name, set, number:'', price, image, sealed:true, upc }.
 */
export async function searchSealed(query, { games = SEALED_GAMES, limit = 24 } = {}) {
  const q = String(query || '').trim()
  if (q.length < 2) return []
  const out = []
  for (const game of games) {
    for (const file of GAME_FILES[game] || []) {
      const rows = await loadFile(file)
      for (const [pid, name, group, upc, price] of rows) {
        if (!tokenMatch(q, name, group)) continue
        out.push({
          game,
          id: String(pid),
          name: file === 'pokemon-jp' ? `${name} (JP)` : name,
          set: group,
          number: '',
          price: price || 0,
          image: sealedImageUrl(pid),
          sealed: true,
          upc: upc || '',
        })
        if (out.length >= limit * 3) break // plenty to rank from
      }
    }
  }
  // Priced products first (in print, buyable today), then newest product id
  out.sort((a, b) => (b.price > 0) - (a.price > 0) || Number(b.id) - Number(a.id))
  return out.slice(0, limit)
}
