/**
 * Token-based text matching for card search.
 *
 * Plain substring matching fails the moment punctuation differs from the
 * query: searching "ahri inquisitive" can never match "Ahri - Inquisitive",
 * and "monkey d luffy" can never match "Monkey.D.Luffy". Split the query
 * into words and require every word to match, where "match" is tiered
 * (cheap first, each tier only runs when the previous ones fail):
 *
 *   (a) substring of the plain lowercase haystack
 *   (b) substring of the COLLAPSED haystack ([^a-z0-9] stripped) — makes
 *       punctuated names space/period-insensitive ("monkeydluffy")
 *   (c) fuzzy: within Damerau-Levenshtein distance 1 of some haystack word
 *       ("charzard" → "charizard", "lufy" → "luffy"). Guarded to longer
 *       tokens so short words never fuzz into false positives.
 *
 * PERF: this runs against ~150k cached cards per keystroke-search, so the
 * haystack is normalized once per call, query tokenization is memoized
 * across calls, and tier (c) prunes by word length before any edit-distance
 * work.
 */

// The same query string is passed for every card in a scan — tokenize once.
const _tokCache = { q: null, tokens: null }

export function tokenMatch(query, ...fields) {
  const qs = String(query || '')
  let tokens
  if (_tokCache.q === qs) {
    tokens = _tokCache.tokens
  } else {
    tokens = qs.toLowerCase().split(/\s+/).filter(Boolean)
    _tokCache.q = qs
    _tokCache.tokens = tokens
  }
  if (tokens.length === 0) return false

  const hay = fields.filter(Boolean).join(' ').toLowerCase()
  let collapsed = null // lazily built, shared across tokens
  let words = null

  outer: for (const t of tokens) {
    // (a) plain substring
    if (hay.includes(t)) continue

    // (b) collapsed substring (haystack punctuation removed). Gated to
    // tokens ≥5 chars: short tokens match ACROSS word boundaries in the
    // collapsed string ("mew" inside "aetherfla·mew·all") — pure noise.
    const tc = t.replace(/[^a-z0-9]/g, '')
    if (tc.length >= 5) {
      if (collapsed === null) collapsed = hay.replace(/[^a-z0-9]/g, '')
      if (collapsed.includes(t)) continue
      if (tc !== t && tc && collapsed.includes(tc)) continue
    }

    // (c) fuzzy — distance-1 typo against individual haystack words.
    // Only for tokens of 4+ chars, and a 4-char token may only fuzz
    // against a 5-char word (pure insertion, e.g. "lufy" → "luffy");
    // anything shorter is too noisy.
    if (tc.length < 4) return false
    if (words === null) words = hay.split(/[^a-z0-9]+/).filter(Boolean)
    for (const w of words) {
      const d = tc.length - w.length
      if (d > 1 || d < -1) continue // length prune
      if (tc.length === 4 && w.length !== 5) continue
      // typos almost never break the FIRST letter — and without this
      // anchor "gengar" fuzzes into "Rengar", "mew" into "new"
      if (tc[0] !== w[0]) continue
      if (withinDL1(tc, w)) continue outer
    }
    return false
  }
  return true
}

/**
 * True when a and b are within Damerau-Levenshtein distance 1
 * (one substitution, insertion, deletion, or adjacent transposition).
 * Callers must pre-prune |len(a)-len(b)| > 1.
 */
function withinDL1(a, b) {
  const la = a.length
  const lb = b.length
  if (la === lb) {
    let i = 0
    while (i < la && a[i] === b[i]) i++
    if (i === la) return true // identical
    // substitution at i
    if (a.slice(i + 1) === b.slice(i + 1)) return true
    // adjacent transposition at i
    return i + 1 < la && a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2)
  }
  // single insertion/deletion
  const long_ = la > lb ? a : b
  const short_ = la > lb ? b : a
  let i = 0
  while (i < short_.length && long_[i] === short_[i]) i++
  return long_.slice(i + 1) === short_.slice(i)
}
