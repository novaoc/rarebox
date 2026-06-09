/**
 * Token-based text matching for card search.
 *
 * Plain substring matching fails the moment punctuation differs from the
 * query: searching "ahri inquisitive" can never match "Ahri - Inquisitive".
 * Instead, split the query into words and require every word to appear
 * somewhere in the searched fields.
 */
export function tokenMatch(query, ...fields) {
  const tokens = String(query || '').toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return false
  const hay = fields.filter(Boolean).join(' ').toLowerCase()
  return tokens.every(t => hay.includes(t))
}
