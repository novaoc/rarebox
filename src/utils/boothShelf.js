/**
 * Booth ⇄ shelf sync — the booth's physical inventory as a real shelf.
 *
 * Every booth (with sync on) owns an auto-created shelf ("Booth: <name>")
 * that mirrors what's actually in the seller's show box:
 *
 *   list from a curated shelf  → the item MOVES curated → booth shelf
 *                                (collection totals stay truthful — the
 *                                cards are in the box now, not the binder)
 *   list from search           → added to the booth shelf
 *   sale / trade-out           → removed from the booth shelf
 *   buy / trade-in             → added to the booth shelf (cost basis =
 *                                what you paid / the value you gave up)
 *   delist                     → returns to its source shelf when it came
 *                                from one, otherwise leaves the collection
 *
 * Booth items carry two local-only fields (never packed into shares):
 *   shelfItemId — the mirrored item's id on the booth shelf
 *   srcShelfId  — where it came from, for delist round-trips
 */

import { usePortfolioStore } from '../stores/portfolio'

export function syncOn(booth) {
  return booth?.syncShelf === true
}

/** Create (or recover) the booth's shelf. Returns its id. */
export function ensureBoothShelf(booth) {
  const store = usePortfolioStore()
  if (booth.shelfId && store.portfolios.some(p => p.id === booth.shelfId)) return booth.shelfId
  const p = store.createPortfolio(`Booth: ${booth.name || 'My booth'}`, '#f59e0b')
  booth.shelfId = p.id
  return p.id
}

function shelfOf(booth) {
  const store = usePortfolioStore()
  const id = ensureBoothShelf(booth)
  return store.portfolios.find(p => p.id === id)
}

/** Booth listing → shelf item shape (when we don't have the original). */
function listingToShelfItem(bi, { purchasePrice = 0, qty = null } = {}) {
  return {
    type: bi.type === 'graded' ? 'graded' : bi.type === 'sealed' ? 'sealed' : 'card',
    game: bi.game && bi.game !== 'pokemon' ? bi.game : undefined,
    cardId: bi.cardId || undefined,
    _lang: bi._lang || null,
    quantity: qty ?? (bi.qty || 1),
    purchasePrice,
    purchaseDate: new Date().toISOString().slice(0, 10),
    notes: '',
    cardData: {
      name: bi.name || '',
      number: bi.number || '',
      set: { name: bi.setName || '' },
      images: { small: bi.img || '' },
    },
    currentMarketPrice: bi.price || purchasePrice || 0,
  }
}

function sameCard(shelfItem, bi) {
  const a = shelfItem.cardData?.name || shelfItem.name || ''
  if (bi.cardId && shelfItem.cardId) return shelfItem.cardId === bi.cardId && (shelfItem.type || 'card') === (bi.type || 'card')
  return a === bi.name && (shelfItem.type || 'card') === (bi.type || 'card')
}

function findMirror(shelf, bi) {
  if (bi.shelfItemId) {
    const hit = shelf.items.find(i => i.id === bi.shelfItemId)
    if (hit) return hit
  }
  return shelf.items.find(i => sameCard(i, bi)) || null
}

/** Add `qty` of a listing to the booth shelf (merging into a match). */
export function shelfAdd(booth, bi, { qty = null, purchasePrice = 0, fromItem = null } = {}) {
  if (!syncOn(booth)) return
  const store = usePortfolioStore()
  const shelf = shelfOf(booth)
  if (!shelf) return
  const n = qty ?? (bi.qty || 1)
  const existing = findMirror(shelf, bi)
  if (existing) {
    store.updateItem(shelf.id, existing.id, { quantity: (existing.quantity || 1) + n })
    bi.shelfItemId = existing.id
    return
  }
  let payload
  if (fromItem) {
    // moved from a curated shelf — keep its full identity (cardData,
    // language, variant, purchase price) so price history stays attached
    const { id, ...rest } = fromItem
    payload = { ...JSON.parse(JSON.stringify(rest)), quantity: n }
  } else {
    payload = listingToShelfItem(bi, { purchasePrice, qty: n })
  }
  const added = store.addItem(shelf.id, payload)
  if (added) bi.shelfItemId = added.id
}

/** Remove `qty` of a listing from the booth shelf (sale, trade-out). */
export function shelfRemove(booth, bi, qty = 1) {
  if (!syncOn(booth)) return
  const store = usePortfolioStore()
  const shelf = shelfOf(booth)
  if (!shelf) return
  const hit = findMirror(shelf, bi)
  if (!hit) return
  const left = (hit.quantity || 1) - qty
  if (left > 0) store.updateItem(shelf.id, hit.id, { quantity: left })
  else store.removeItem(shelf.id, hit.id)
}

/** Mirror a listing's edited quantity. */
export function shelfSetQty(booth, bi) {
  if (!syncOn(booth)) return
  const store = usePortfolioStore()
  const shelf = shelfOf(booth)
  if (!shelf) return
  const hit = findMirror(shelf, bi)
  if (hit) store.updateItem(shelf.id, hit.id, { quantity: bi.qty || 1 })
  else shelfAdd(booth, bi)
}

/** List an item FROM a curated shelf: move curated → booth shelf. */
export function moveFromCurated(booth, srcShelfId, srcItem, takeQty) {
  if (!syncOn(booth)) return
  const store = usePortfolioStore()
  const n = Math.min(takeQty, srcItem.quantity || 1)
  // clone first (removal would orphan the reference)
  const bi = { cardId: srcItem.cardId, name: srcItem.cardData?.name || srcItem.name, type: srcItem.type || 'card', qty: n }
  shelfAdd(booth, bi, { qty: n, fromItem: srcItem })
  const left = (srcItem.quantity || 1) - n
  if (left > 0) store.updateItem(srcShelfId, srcItem.id, { quantity: left })
  else store.removeItem(srcShelfId, srcItem.id)
  return { shelfItemId: bi.shelfItemId, srcShelfId }
}

/** Delist: back to the source shelf if it came from one, else gone. */
export function returnToSource(booth, bi) {
  if (!syncOn(booth)) return
  const store = usePortfolioStore()
  const shelf = shelfOf(booth)
  if (!shelf) return
  const hit = findMirror(shelf, bi)
  const n = bi.qty || 1
  const src = bi.srcShelfId && store.portfolios.find(p => p.id === bi.srcShelfId)
  if (hit && src) {
    const { id, ...rest } = hit
    const back = store.portfolios.find(p => p.id === src.id)?.items.find(i => sameCard(i, bi))
    if (back) store.updateItem(src.id, back.id, { quantity: (back.quantity || 1) + n })
    else store.addItem(src.id, { ...JSON.parse(JSON.stringify(rest)), quantity: n })
  }
  shelfRemove(booth, bi, n)
}

/** Undo of a delist: the item went back to its source shelf — take it out
 *  again before re-mirroring, or it would exist in both places. */
export function reclaimFromSource(booth, bi, qty = null) {
  if (!syncOn(booth) || !bi.srcShelfId) return
  const store = usePortfolioStore()
  const src = store.portfolios.find(p => p.id === bi.srcShelfId)
  if (!src) return
  const hit = src.items.find(i => sameCard(i, bi))
  if (!hit) return
  const n = qty ?? (bi.qty || 1)
  const left = (hit.quantity || 1) - n
  if (left > 0) store.updateItem(src.id, hit.id, { quantity: left })
  else store.removeItem(src.id, hit.id)
}

/** Turning sync on for a booth that already has listings: mirror them all. */
export function syncAll(booth) {
  if (!syncOn(booth)) return
  for (const bi of booth.items || []) {
    if (!bi.shelfItemId) shelfAdd(booth, bi)
    else shelfSetQty(booth, bi)
  }
}
