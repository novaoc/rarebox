/**
 * Market comparison for saved shops — "is this table priced over or
 * under the market?"
 *
 * Booth items carry the seller's asking price plus enough identity
 * (game + cardId) to look up what Rarebox tracks as the live market
 * price. Lookups run a few at a time through the existing per-game
 * resolvers; items that can't be resolved (sealed products, custom
 * listings, dead ids) just don't count toward the comparison.
 *
 * Results are summarized as: matched item count, asking vs market
 * totals over the matched items only (apples to apples), and the
 * percentage delta. Callers persist the summary on the saved-shop
 * record so the list view can show it without re-fetching.
 */
import { resolveCard } from '../services/tcg/multiSearch'

const CONCURRENCY = 4

/**
 * @param {object} booth
 * @param {(done: number, total: number) => void} [onProgress]
 * @returns {{ matched, total, askTotal, marketTotal, deltaPct, perItem }}
 *   perItem: market price by item index (null when unresolved)
 */
export async function compareBoothToMarket(booth, onProgress) {
  const items = booth.items || []
  const perItem = new Array(items.length).fill(null)
  let done = 0

  // Singles only: sealed/graded listings carry a real `game` plus a
  // TCGplayer product id in cardId, which resolveCard would misread as a
  // card id and price against the wrong product.
  const queue = items.map((it, i) => ({ it, i }))
    .filter(({ it }) => it.cardId && it.game && (it.type || 'card') === 'card')

  const total = queue.length // fixed denominator — in-flight items made it fluctuate

  async function worker() {
    while (queue.length) {
      const { it, i } = queue.shift()
      const card = await resolveCard(it.cardId, it.game)
      if (card?.price > 0) perItem[i] = card.price
      done++
      onProgress?.(done, total)
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  let askTotal = 0
  let marketTotal = 0
  let matched = 0
  items.forEach((it, i) => {
    if (perItem[i] == null || !(it.price > 0)) return
    matched++
    const qty = it.qty || 1
    askTotal += qty * it.price
    marketTotal += qty * perItem[i]
  })

  return {
    matched,
    total: items.length,
    askTotal: +askTotal.toFixed(2),
    marketTotal: +marketTotal.toFixed(2),
    deltaPct: marketTotal > 0 ? +(((askTotal - marketTotal) / marketTotal) * 100).toFixed(1) : null,
    perItem,
    checkedAt: new Date().toISOString(),
  }
}

/** Human verdict for a deltaPct: under market = deal, over = pricey. */
export function marketVerdict(deltaPct) {
  if (deltaPct == null) return null
  if (deltaPct <= -3) return { cls: 'success', label: `${Math.abs(deltaPct).toFixed(0)}% under market` }
  if (deltaPct >= 3) return { cls: 'danger', label: `${deltaPct.toFixed(0)}% over market` }
  return { cls: 'info', label: 'At market' }
}
