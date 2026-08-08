// Binder progress — set-completion rows for Home and the Sets hub, derived
// entirely from data the app already stores: showcased master sets
// (portfolio.masterSets) and the shelf items grouped the same way
// PortfolioView's master-set showcase groups them.

/** Same grouping key as PortfolioView's msItemKey — kept in sync by the
 *  master-set smoke eval. JP set ids are qualified (EN sv3 ≠ JP SV3). */
export function msItemKey(item) {
  if (item.type !== 'card') return null
  const setId = item.cardData?.set?.id || item.cardData?.set?.name || item.setName
  if (!setId) return null
  const lang = item._lang === 'ja' ? 'ja:' : ''
  return `${item.game || 'pokemon'}:${lang}${String(setId).toLowerCase()}`
}

/**
 * One row per showcased master set across the given shelves:
 * { portfolioId, portfolioName, key, name, game, owned, total, pct,
 *   missing, complete }. Sorted closest-to-done first (momentum),
 * complete sets last.
 */
export function binderRows(portfolios) {
  const rows = []
  for (const p of portfolios || []) {
    const showcased = p.masterSets || {}
    const keys = Object.keys(showcased)
    if (keys.length === 0) continue

    // Unique-card tally per group key — cardId when stored, name|number
    // for older items (mirrors the showcase's own counting)
    const ownedByKey = new Map()
    for (const item of p.items || []) {
      const key = msItemKey(item)
      if (!key) continue
      let ids = ownedByKey.get(key)
      if (!ids) ownedByKey.set(key, (ids = new Set()))
      ids.add(item.cardId || `${(item.cardData?.name || '').toLowerCase()}|${item.cardData?.number || ''}`)
    }

    for (const key of keys) {
      const meta = showcased[key] || {}
      const owned = ownedByKey.get(key)?.size || 0
      const total = meta.total || null
      const pct = total ? Math.min(100, Math.round((owned / total) * 100)) : null
      rows.push({
        portfolioId: p.id,
        portfolioName: p.name,
        key,
        name: meta.name || key.split(':').pop().toUpperCase(),
        game: meta.game || key.split(':')[0],
        owned,
        total,
        pct,
        missing: total ? Math.max(0, total - owned) : null,
        complete: !!(total && owned >= total),
      })
    }
  }
  return rows.sort((a, b) =>
    (a.complete ? 1 : 0) - (b.complete ? 1 : 0) ||
    (b.pct ?? -1) - (a.pct ?? -1)
  )
}

/** Per-game completion summary for the Sets hub tiles: game → { pct, sets } */
export function gameCompletion(portfolios) {
  const byGame = new Map()
  for (const row of binderRows(portfolios)) {
    if (row.total == null) continue
    let g = byGame.get(row.game)
    if (!g) byGame.set(row.game, (g = { owned: 0, total: 0, sets: 0 }))
    g.owned += Math.min(row.owned, row.total)
    g.total += row.total
    g.sets += 1
  }
  const out = {}
  for (const [game, g] of byGame) {
    out[game] = { pct: g.total ? Math.round((g.owned / g.total) * 100) : 0, sets: g.sets }
  }
  return out
}
