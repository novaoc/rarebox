/**
 * Shared Riftbound variant / collector-number semantics.
 *
 * Used by raw PriceCharting set pricing (providers) and grade-aware
 * PriceCharting matching so Signature / alternate-art / plain printings
 * never cross-match. Keep aliases here — do not fork divergent maps.
 */

/** riftcodex name suffix → PriceCharting bracket tag. */
export const RIFT_VARIANT_ALIASES = {
  overnumbered: '',
  'launch exclusive': 'launch promo',
  sig: 'signature',
  'alt art': 'alternate art',
  alt: 'alternate art',
  'alternative art': 'alternate art',
}

/** Canonical variant tags after aliasing (empty string = plain printing). */
const RIFT_VARIANT_PHRASES = [
  ['alternate art', 'alternate art'],
  ['alternative art', 'alternate art'],
  ['alt art', 'alternate art'],
  ['launch exclusive', 'launch promo'],
  ['launch promo', 'launch promo'],
  ['signature', 'signature'],
  ['overnumbered', ''],
]

/**
 * Normalize punctuation/brackets/parentheses for token compare.
 * @param {unknown} text
 * @returns {string}
 */
export function normalizeRiftboundKey(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[[\](){}]/g, ' ')
    .replace(/[^\w\s#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Normalize collector number: strip #, take first slash segment (299/350 → 299),
 * strip non-digits, drop leading zeros.
 * @param {unknown} raw
 * @returns {string} empty when absent
 */
export function normalizeCollectorNumber(raw) {
  if (raw == null || raw === '') return ''
  let s = String(raw).trim().replace(/^#/, '')
  // Collectr / set lists often use "299/350" — never concatenate to 299350.
  if (s.includes('/')) s = s.split('/')[0]
  const digits = s.replace(/\D/g, '')
  if (!digits) return ''
  return digits.replace(/^0+/, '') || '0'
}

/**
 * Canonical parenthetical label for a Riftbound variant tag.
 * @param {string} variant detectRiftboundVariant result
 * @returns {string} e.g. "Signature", or '' for plain
 */
export function riftboundVariantLabel(variant) {
  const v = String(variant || '').toLowerCase().trim()
  if (!v) return ''
  if (v === 'signature') return 'Signature'
  if (v === 'alternate art') return 'Alternate Art'
  if (v === 'launch promo') return 'Launch Promo'
  // Title-case unknown known-ish tags
  return v.replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Build a Collectr/import graded display name that keeps Signature/alt identity.
 * Prefers existing name markers; otherwise folds Variance/Rarity via shared detect.
 * @param {string} productName
 * @param {string} [variance]
 * @param {string} [rarity]
 * @returns {string}
 */
export function canonicalRiftboundGradedName(productName, variance = '', rarity = '') {
  const name = String(productName || '').trim()
  if (!name) return name
  if (detectRiftboundVariant(name)) return name
  const fromMeta =
    detectRiftboundVariant(variance) ||
    detectRiftboundVariant(rarity)
  const label = riftboundVariantLabel(fromMeta)
  if (!label) return name
  return `${name} (${label})`
}

/**
 * Extract `#123` collector number from free text.
 * @param {unknown} text
 * @returns {string}
 */
export function extractCollectorNumber(text) {
  const m = String(text || '').match(/#\s*(\d+)/)
  return m ? normalizeCollectorNumber(m[1]) : ''
}

function aliasVariant(raw) {
  let v = String(raw || '').toLowerCase().trim()
  if (v in RIFT_VARIANT_ALIASES) v = RIFT_VARIANT_ALIASES[v]
  return v
}

/**
 * Extract variant from riftcodex-style trailing parentheses.
 * Same contract historically used in providers.js.
 * @param {string} [name]
 * @returns {string} canonical variant or '' for plain
 */
export function riftVariantFromName(name) {
  const m = (name || '').match(/\(([^)]+)\)\s*$/)
  return m ? aliasVariant(m[1]) : ''
}

/**
 * Detect Riftbound variant from query or PriceCharting product name.
 * Handles (parens), [brackets], and known marker phrases.
 * @param {unknown} text
 * @returns {string}
 */
export function detectRiftboundVariant(text) {
  const s = String(text || '')

  const bracket = s.match(/\[([^\]]+)\]/)
  if (bracket) return aliasVariant(bracket[1])

  const fromParens = riftVariantFromName(s)
  if (fromParens) return fromParens

  // Parentheses that are not only trailing (e.g. mid-string) still count
  const anyParen = s.match(/\(([^)]+)\)/)
  if (anyParen) {
    const aliased = aliasVariant(anyParen[1])
    // Only accept if it maps to a known variant or empty-via-alias (overnumbered)
    if (aliased || String(anyParen[1]).toLowerCase().trim() in RIFT_VARIANT_ALIASES) {
      return aliased
    }
  }

  const norm = normalizeRiftboundKey(s)
  for (const [phrase, canon] of RIFT_VARIANT_PHRASES) {
    const re = new RegExp(`(?:^|\\s)${phrase.replace(/\s+/g, '\\s+')}(?:\\s|$)`)
    if (re.test(norm)) return canon
  }
  return ''
}

/**
 * @param {string} queryVariant
 * @param {string} candidateVariant
 * @returns {boolean}
 */
export function riftboundVariantsCompatible(queryVariant, candidateVariant) {
  return (queryVariant || '') === (candidateVariant || '')
}

/**
 * True when a Riftbound graded auto-fetch lacks a collector number.
 * @param {string} [game]
 * @param {unknown} [number]
 * @param {string} [query]
 * @returns {boolean}
 */
export function riftboundGradedMissingNumber(game, number, query = '') {
  if (String(game || '').toLowerCase() !== 'riftbound') return false
  const n = normalizeCollectorNumber(number) || extractCollectorNumber(query)
  return !n
}

export const RIFTBOUND_GRADED_NO_NUMBER_MSG =
  'Select this card from search/browse or add a collector number before fetching a graded price. You can still enter the value manually.'

/**
 * Strict Riftbound PriceCharting candidate pick.
 * Requires collector-number match when the query has `#n`, and exact variant
 * compatibility (Signature/alt-art/plain). Never falls back to an unfiltered
 * first result.
 *
 * @param {string} query
 * @param {Array<{ productName?: string, name?: string, consoleName?: string, set?: string }>} products
 * @returns {{ ok: true, product: object } | { ok: false, reason: 'no_results' }}
 */
export function pickRiftboundPcCandidate(query, products) {
  const q = String(query || '')
  const qNum = extractCollectorNumber(q)
  const qVar = detectRiftboundVariant(q)

  const list = Array.isArray(products) ? products : []
  const compatible = []
  for (const p of list) {
    const name = p.productName || p.name || ''
    const cNum = extractCollectorNumber(name)
    const cVar = detectRiftboundVariant(name)

    if (qNum) {
      if (!cNum || cNum !== qNum) continue
    }
    if (!riftboundVariantsCompatible(qVar, cVar)) continue
    compatible.push(p)
  }

  if (!compatible.length) return { ok: false, reason: 'no_results' }

  const lq = normalizeRiftboundKey(q)
  const queryTokens = lq.split(/\s+/).filter(t => t.length > 2 && t !== 'riftbound')
  const scored = compatible
    .map(p => {
      const name = normalizeRiftboundKey(p.productName || p.name || '')
      const score = queryTokens.reduce((s, tok) => s + (name.includes(tok) ? 1 : 0), 0)
      return { p, score }
    })
    .sort((a, b) => b.score - a.score)

  if (scored[0].score > 0) return { ok: true, product: scored[0].p }
  // Number + variant already constrained the set — accept best remaining.
  if (qNum) return { ok: true, product: scored[0].p }
  // No number and no token overlap among multi-matches: refuse fuzzy pick.
  if (compatible.length === 1) return { ok: true, product: compatible[0] }
  return { ok: false, reason: 'no_results' }
}

/**
 * Whether an imported graded identity is safe to enrich from a multiSearch hit.
 * Never allows Signature ↔ plain (or different variant) swaps.
 * If the import has no collector number, refuse auto-attach (manual identity stays).
 * @param {object} item cardData-bearing shelf item
 * @param {object} match multiSearch card
 * @param {string} [game]
 * @returns {boolean}
 */
export function isSafeRiftboundGradedMatch(item, match, game) {
  if (String(game || item?.game || '').toLowerCase() !== 'riftbound') return true
  if (!match) return false
  const exName = item?.cardData?.name || item?.name || ''
  const mName = match.name || ''
  if (!riftboundVariantsCompatible(detectRiftboundVariant(exName), detectRiftboundVariant(mName))) {
    return false
  }
  const exNum = normalizeCollectorNumber(item?.cardData?.number)
  const mNum = normalizeCollectorNumber(match.number)
  // No number on the import → do not fuzzy-attach a Riftbound identity.
  if (!exNum) return false
  if (!mNum || exNum !== mNum) return false
  return true
}

/**
 * First multiSearch candidate that is a safe exact variant+number match.
 * @param {object} item
 * @param {object[]} candidates
 * @param {string} [game]
 * @returns {object|null}
 */
export function findSafeRiftboundGradedMatch(item, candidates, game) {
  if (String(game || item?.game || '').toLowerCase() !== 'riftbound') return null
  const list = Array.isArray(candidates) ? candidates : []
  for (const c of list) {
    if (isSafeRiftboundGradedMatch(item, c, game)) return c
  }
  return null
}
