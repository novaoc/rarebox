/**
 * Shared Riftbound variant / collector-number semantics.
 *
 * Used by raw PriceCharting set pricing (providers) and grade-aware
 * PriceCharting matching so Signature / alternate-art / plain printings
 * never cross-match. Keep aliases here — do not fork divergent maps.
 *
 * Graded PC / Collectr identity also requires set + base-name compatibility
 * (number/variant alone must never accept a different card).
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
 * Promo set labels that PriceCharting collapses to "Riftbound Promo".
 * Keep in sync with providers.js `RIFT_PC_PROMO_SETS` / `riftPcConsole`.
 */
const RIFT_PC_PROMO_SET_LABELS = [
  'riftbound promotional cards',
  'riftbound organized play promotional cards',
  'riftbound judge promotional cards',
  'riftbound promo',
  'promotional cards',
  'organized play promotional cards',
  'judge promotional cards',
  'promo',
]

/** Longest-first promo prefixes after stripping a leading "riftbound". */
const RIFT_PROMO_PREFIXES = [
  'organized play promotional cards',
  'judge promotional cards',
  'promotional cards',
  'promo',
]

/** Variant / finish words that must never count as card-name evidence. */
const RIFT_VARIANT_NAME_STOPWORDS = new Set([
  'signature',
  'sig',
  'alternate',
  'alternative',
  'alt',
  'art',
  'launch',
  'exclusive',
  'promo',
  'overnumbered',
])

/**
 * Normalize punctuation/brackets/parentheses for token compare.
 * @param {unknown} text
 * @returns {string}
 */
export function normalizeRiftboundKey(text) {
  return String(text || '')
    .toLowerCase()
    // Fold curly/smart apostrophes into plain ASCII before stripping punct.
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[[\](){}]/g, ' ')
    .replace(/[^\w\s#']/g, ' ')
    .replace(/'/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Coerce set field that may be a string or `{ name, id }`.
 * @param {unknown} set
 * @returns {string}
 */
export function riftboundSetFieldText(set) {
  if (set == null || set === '') return ''
  if (typeof set === 'string' || typeof set === 'number') return String(set).trim()
  if (typeof set === 'object') {
    const name = set.name ?? set.id ?? ''
    return String(name || '').trim()
  }
  return ''
}

/**
 * Canonical set key for consoleName / set labels.
 * Promo aliases → `promo`; Origin/Origins → `origin`; else normalized set text.
 * @param {unknown} raw
 * @returns {string} empty when absent
 */
export function normalizeRiftboundSetKey(raw) {
  const text = riftboundSetFieldText(raw)
  if (!text) return ''
  let s = normalizeRiftboundKey(text)
  if (!s) return ''

  // Drop leading game token(s); Collectr sometimes stores "Riftbound Origin".
  while (s.startsWith('riftbound ')) s = s.slice('riftbound '.length).trim()

  if (!s) return ''
  if (RIFT_PC_PROMO_SET_LABELS.includes(s) || RIFT_PC_PROMO_SET_LABELS.includes(`riftbound ${s}`)) {
    return 'promo'
  }
  for (const prefix of RIFT_PROMO_PREFIXES) {
    if (s === prefix || s.startsWith(`${prefix} `)) return 'promo'
  }

  // Plural drift seen on Origin / Origins listings (console or bare set).
  if (s === 'origins' || s === 'origin') return 'origin'
  const parts = s.split(/\s+/).filter(Boolean)
  if (parts[0] === 'origins') parts[0] = 'origin'
  return parts.join(' ')
}

/**
 * Set key requested by a graded PC query (`Riftbound {set} …`).
 * @param {unknown} query
 * @returns {string}
 */
export function extractRiftboundQuerySetKey(query) {
  let s = normalizeRiftboundKey(query)
  if (!s) return ''
  while (s.startsWith('riftbound ')) s = s.slice('riftbound '.length).trim()
  if (!s) return ''

  for (const prefix of RIFT_PROMO_PREFIXES) {
    if (s === prefix || s.startsWith(`${prefix} `)) return 'promo'
  }
  if (RIFT_PC_PROMO_SET_LABELS.includes(s)) return 'promo'

  // Set is the prefix before card name / collector number.
  // Standard Riftbound sets are single tokens (Origin, Spiritforged, …).
  const first = s.split(/\s+/)[0] || ''
  if (!first || first.startsWith('#')) return ''
  if (first === 'origins') return 'origin'
  return first
}

/**
 * @param {unknown} a set/console/query set key or label
 * @param {unknown} b set/console/query set key or label
 * @returns {boolean}
 */
export function riftboundSetsCompatible(a, b) {
  const ka = normalizeRiftboundSetKey(a) || extractRiftboundQuerySetKey(a)
  const kb = normalizeRiftboundSetKey(b) || extractRiftboundQuerySetKey(b)
  if (!ka || !kb) return false
  return ka === kb
}

/**
 * Strip game/set/number/variant noise → normalized base card name tokens.
 * @param {unknown} text
 * @param {string} [setKey] canonical set key when known
 * @returns {string}
 */
export function extractRiftboundBaseName(text, setKey = '') {
  let s = String(text || '')
  // Drop bracket/paren variant markers before key normalize.
  s = s.replace(/\[[^\]]*\]/g, ' ')
  s = s.replace(/\([^)]*\)/g, ' ')

  let n = normalizeRiftboundKey(s)
  if (!n) return ''

  // Collector numbers and slash print runs.
  n = n.replace(/#\s*\d+/g, ' ')
  n = n.replace(/\b\d+\s*\/\s*\d+\b/g, ' ')

  // Game token anywhere (query prefix or accidental product noise).
  n = n.replace(/\briftbound\b/g, ' ')

  const sk = String(setKey || '').trim()
  if (sk === 'promo') {
    n = n.replace(/\b(promo|promotional|organized|play|judge|cards)\b/g, ' ')
  } else if (sk) {
    const esc = sk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    // Origin ↔ Origins
    const setRe = sk === 'origin'
      ? /\borigins?\b/g
      : new RegExp(`\\b${esc}\\b`, 'g')
    n = n.replace(setRe, ' ')
  }

  // Variant phrases / finish words — never name evidence.
  for (const [phrase] of RIFT_VARIANT_PHRASES) {
    const pre = phrase.replace(/\s+/g, '\\s+')
    n = n.replace(new RegExp(`\\b${pre}\\b`, 'g'), ' ')
  }
  n = n
    .split(/\s+/)
    .filter(tok => tok && !RIFT_VARIANT_NAME_STOPWORDS.has(tok) && !/^\d+$/.test(tok))
    .join(' ')

  return n.replace(/\s+/g, ' ').trim()
}

/**
 * Full card-identity compare after base-name extraction.
 * Allows subtitle / punctuation forms (selected "Ahri" vs PC "Ahri Loose Cannon")
 * without accepting unrelated names.
 * @param {unknown} a
 * @param {unknown} b
 * @returns {boolean}
 */
export function riftboundBaseNamesCompatible(a, b) {
  const na = String(a || '').trim()
  const nb = String(b || '').trim()
  if (!na || !nb) return false
  if (na === nb) return true

  const ta = na.split(/\s+/).filter(Boolean)
  const tb = nb.split(/\s+/).filter(Boolean)
  if (!ta.length || !tb.length) return false

  // Contiguous phrase inclusion on token boundaries (subtitle forms).
  const aPhrase = ta.join(' ')
  const bPhrase = tb.join(' ')
  if (aPhrase.length <= bPhrase.length) {
    if (new RegExp(`(?:^|\\s)${escapeRegExp(aPhrase)}(?:\\s|$)`).test(bPhrase)) return true
  } else if (new RegExp(`(?:^|\\s)${escapeRegExp(bPhrase)}(?:\\s|$)`).test(aPhrase)) {
    return true
  }

  // All tokens of the shorter name appear in the longer (order-flexible subtitle).
  const [shorter, longer] = ta.length <= tb.length ? [ta, tb] : [tb, ta]
  // Require real name evidence: at least one token longer than 2 chars, or exact short name.
  const hasCore = shorter.some(t => t.length > 2)
  if (!hasCore) {
    return shorter.length === 1 && longer.includes(shorter[0])
  }
  return shorter.every(t => longer.includes(t))
}

function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Base-name confidence for ranking multi-survivors (never uses #/set/variant tokens).
 * @param {string} queryBase
 * @param {string} candBase
 * @returns {number}
 */
function scoreRiftboundBaseName(queryBase, candBase) {
  if (!queryBase || !candBase) return 0
  if (queryBase === candBase) return 100
  const tq = queryBase.split(/\s+/).filter(Boolean)
  const tc = candBase.split(/\s+/).filter(Boolean)
  if (!tq.length || !tc.length) return 0
  if (new RegExp(`(?:^|\\s)${escapeRegExp(queryBase)}(?:\\s|$)`).test(candBase)) return 80
  if (new RegExp(`(?:^|\\s)${escapeRegExp(candBase)}(?:\\s|$)`).test(queryBase)) return 80
  const overlap = tq.filter(t => tc.includes(t)).length
  if (overlap === 0) return 0
  // Prefer covering the full shorter side.
  const need = Math.min(tq.length, tc.length)
  if (overlap < need) return Math.max(1, overlap * 10)
  return 50 + overlap
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
 * Strict Riftbound PriceCharting candidate pick for graded pricing.
 * Requires all four identities: normalized collector number, exact canonical
 * variant, compatible set/console, and compatible base card name.
 * Number/variant/set tokens alone never accept. Never falls back to an
 * unfiltered first result.
 *
 * @param {string} query
 * @param {Array<{ productName?: string, name?: string, consoleName?: string, set?: string }>} products
 * @returns {{ ok: true, product: object } | { ok: false, reason: 'no_results' }}
 */
export function pickRiftboundPcCandidate(query, products) {
  const q = String(query || '')
  const qNum = extractCollectorNumber(q)
  // Graded path must have a collector number — refuse unconditional fuzzy pick.
  if (!qNum) return { ok: false, reason: 'no_results' }

  const qVar = detectRiftboundVariant(q)
  const qSet = extractRiftboundQuerySetKey(q)
  if (!qSet) return { ok: false, reason: 'no_results' }

  const qBase = extractRiftboundBaseName(q, qSet)
  if (!qBase) return { ok: false, reason: 'no_results' }

  const list = Array.isArray(products) ? products : []
  const compatible = []
  for (const p of list) {
    const name = p.productName || p.name || ''
    // Graded: missing console/set is not safe to auto-accept.
    const consoleRaw = p.consoleName != null && String(p.consoleName).trim() !== ''
      ? p.consoleName
      : (p.set != null ? p.set : '')
    const cSet = normalizeRiftboundSetKey(consoleRaw)
    if (!cSet) continue
    if (!riftboundSetsCompatible(qSet, cSet)) continue

    const cNum = extractCollectorNumber(name)
    if (!cNum || cNum !== qNum) continue

    const cVar = detectRiftboundVariant(name)
    if (!riftboundVariantsCompatible(qVar, cVar)) continue

    const cBase = extractRiftboundBaseName(name, cSet)
    if (!riftboundBaseNamesCompatible(qBase, cBase)) continue

    compatible.push({
      p,
      cBase,
      score: scoreRiftboundBaseName(qBase, cBase),
    })
  }

  if (!compatible.length) return { ok: false, reason: 'no_results' }

  compatible.sort((a, b) => b.score - a.score)
  const best = compatible[0]
  // Hard filters already required name compatibility; score must still be > 0.
  if (!best || best.score <= 0) return { ok: false, reason: 'no_results' }

  // Ambiguous survivors with equal name confidence and different identities → manual.
  if (
    compatible.length > 1 &&
    compatible[1].score === best.score &&
    compatible[1].cBase !== best.cBase
  ) {
    return { ok: false, reason: 'no_results' }
  }

  return { ok: true, product: best.p }
}

/**
 * Whether an imported graded identity is safe to enrich from a multiSearch hit.
 * Never allows Signature ↔ plain (or different variant) swaps.
 * Also requires set + base-name compatibility (not only number+variant).
 * Fail-closed on set: both import and candidate must carry a non-empty set key
 * and they must be compatible. Blank-set imports keep manual identity/value and
 * do not auto-attach (avoids stamping a wrong set from a same name+#/variant hit).
 * If the import has no collector number, refuse auto-attach (manual identity stays).
 * Existing item/match set shapes may be object or string.
 * @param {object} item cardData-bearing shelf item
 * @param {object} match multiSearch card
 * @param {string} [game]
 * @returns {boolean}
 */
export function isSafeRiftboundGradedMatch(item, match, game) {
  if (String(game || item?.game || '').toLowerCase() !== 'riftbound') return true
  if (!match) return false
  const exName = item?.cardData?.name || item?.name || ''
  const mName = match.name || match.productName || ''
  if (!riftboundVariantsCompatible(detectRiftboundVariant(exName), detectRiftboundVariant(mName))) {
    return false
  }
  const exNum =
    normalizeCollectorNumber(item?.cardData?.number) ||
    extractCollectorNumber(exName)
  const mNum =
    normalizeCollectorNumber(match.number) ||
    extractCollectorNumber(mName)
  // No number on the import → do not fuzzy-attach a Riftbound identity.
  if (!exNum) return false
  if (!mNum || exNum !== mNum) return false

  const exSetRaw =
    riftboundSetFieldText(item?.cardData?.set) ||
    String(item?.setName || item?.set || '').trim()
  const mSetRaw =
    riftboundSetFieldText(match.set) ||
    String(match.consoleName || match.setName || '').trim()
  const exSetKey = normalizeRiftboundSetKey(exSetRaw)
  const mSetKey = normalizeRiftboundSetKey(mSetRaw)
  // Fail-closed: blank import set or blank candidate set never auto-attaches.
  if (!exSetKey || !mSetKey || !riftboundSetsCompatible(exSetKey, mSetKey)) return false

  const exBase = extractRiftboundBaseName(exName, exSetKey)
  const mBase = extractRiftboundBaseName(mName, mSetKey)
  if (!riftboundBaseNamesCompatible(exBase, mBase)) return false

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
