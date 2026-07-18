/**
 * Resolve the persisted item type for non-Pokémon Add Item submit.
 *
 * Explicit graded mode always wins over a stale selectedIsSealed flag so a
 * sealed→graded tab switch can never save a Riftbound/other slab as sealed.
 * Sealed is preserved when the user is on the sealed tab or still has a sealed
 * product selected while on the card tab.
 *
 * @param {'card' | 'graded' | 'sealed' | string} itemType
 * @param {boolean} selectedIsSealed
 * @returns {'card' | 'graded' | 'sealed'}
 */
export function resolveNonPokemonSubmitType(itemType, selectedIsSealed) {
  if (itemType === 'graded') return 'graded'
  if (itemType === 'sealed' || selectedIsSealed) return 'sealed'
  return 'card'
}
