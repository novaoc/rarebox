/**
 * Pure result-picking for PriceCharting searches — no imports so the
 * harness evals can exercise it directly in node.
 *
 * Best priced result by token overlap against name + set — same lesson as
 * fetchPrice (1113af2): never take PriceCharting's first result for an
 * ambiguous name. "Collector Booster Box" + set "Magic Marvel Spider-Man"
 * must not resolve to another set's collector box ($380 → $1800 bug).
 * Ties keep PriceCharting's own order.
 */
export function pickBestPriced(results, query) {
  const priced = (results || []).filter(r => r.price != null)
  if (!priced.length) return null
  const tokens = String(query).toLowerCase().split(/\s+/).filter(t => t.length > 2)
  let best = priced[0]
  let bestScore = -1
  for (const r of priced) {
    const hay = `${r.name || ''} ${r.set || ''}`.toLowerCase()
    const score = tokens.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0)
    if (score > bestScore) { best = r; bestScore = score }
  }
  return best
}
