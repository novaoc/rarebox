/**
 * Merge a price-refresh result with self-healing of missing card media.
 *
 * Every refresh already fetches the FULL card (images, set, name included)
 * but historically persisted only the price — so an item saved without a
 * picture (old imports, flat search shapes, bulk paste) stayed faceless
 * forever even though the fix was in hand on every refresh. This builds
 * the updateItem payload: price when valid, plus cardData backfill for
 * missing images / set / name. Existing values are never overwritten.
 *
 * Returns null when there is nothing worth persisting.
 */
export function refreshUpdates(item, card, price) {
  const updates = {}
  if (typeof price === 'number' && Number.isFinite(price)) {
    updates.currentMarketPrice = price
    updates.lastPriceUpdate = new Date().toISOString()
  }

  let cardData = null
  const ensure = () => (cardData ||= { ...(item.cardData || {}) })

  const hasImage = !!(item.cardData?.images?.small || item.imageUrl)
  if (!hasImage && card?.images?.small) ensure().images = card.images

  if (!item.cardData?.set?.name && card?.set?.name) {
    ensure().set = { id: card.set.id, name: card.set.name }
  }
  if (!item.cardData?.name && card?.name) ensure().name = card.name
  if (!item.cardData?.number && card?.number) ensure().number = card.number

  if (cardData) updates.cardData = cardData
  return Object.keys(updates).length ? updates : null
}
