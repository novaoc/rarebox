/**
 * Condition multipliers for raw cards.
 * Based on industry standards (e.g., Card Ladder).
 * NM (Near Mint) is the baseline (1.0).
 */
export const CONDITION_MULTIPLIERS = {
  'NM': 1.0,
  'LP': 0.8,
  'MP': 0.5,
  'HP': 0.3,
  'DMG': 0.15
};

/**
 * Calculates the adjusted price based on condition.
 * Only applies to raw cards. Graded items are untouched.
 * 
 * @param {number} price - The raw market price (assumed NM)
 * @param {string} condition - The condition code (NM, LP, etc.)
 * @param {boolean} isGraded - Whether the item is a graded slab
 * @returns {number} The condition-adjusted price
 */
export function getAdjustedPrice(price, condition = 'NM', isGraded = false) {
  if (isGraded) return price;
  const multiplier = CONDITION_MULTIPLIERS[condition] || 1.0;
  return price * multiplier;
}
