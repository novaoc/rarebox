/**
 * Table-mode re-ranker — booth table search happens MID-TRADE with real
 * money on the table, so precision beats recall. This re-orders (never
 * filters) smartSearch output `[...cards, ...sealed]` so the card the
 * seller is holding lands first.
 *
 * Signals, strictly tiered (a higher tier always beats any pile-up of
 * lower ones):
 *   1. exact id / set-code+number match in the query
 *      ("luffy op05-060" → card id OP05-060, incl. variant ids OP05-060_p1)
 *   2. exact collector-number token match  ("charizard 4" → #4)
 *   3. set-code token match                ("pikachu sv8" → Surging Sparks)
 *   4. name startsWith the residual text   ("char..." → Charizard first)
 *   5. rarity/variant tag match            ("manga", "sp", "alt art" …)
 *   6. price descending — final tiebreak: at a trade table the chase
 *      printing is usually the one in hand.
 *
 * Pure functions, no imports — safe to unit-test in bare node.
 */

// Tier weights: each tier dominates everything beneath it.
const W_EXACT_ID = 1_000_000
const W_NUMBER = 100_000
const W_SETCODE = 10_000
const W_NAME = 1_000
const W_VARIANT = 100 // per matched tag, capped well under W_NAME

/** lowercase + strip everything but [a-z0-9] */
function norm(s) {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** strip leading zeros so "060" ≡ "60" (keep at least one char) */
function z(s) {
  return String(s ?? '').replace(/^0+(?=.)/, '')
}

function numEq(a, b) {
  if (!a || !b) return false
  return a === b || z(a) === z(b)
}

/** split a card id like "OP05-060_p1" / "sv8-67" / "base1-4" into
 *  { set, num } (both normalized); ids without a separator → num: '' */
function splitId(id) {
  const m = String(id ?? '').match(/^(.*?)[-_./](.+)$/)
  if (m) return { set: norm(m[1]), num: norm(m[2]) }
  return { set: norm(id), num: '' }
}

// language tokens parseQuery already understands — never part of a name
const LANG_TOKEN = /^(jp|jpn|jap|japanese|en|eng|english)$/

// variant / rarity shorthand → what it looks like in `rarity` or `name`
const VARIANT_TAGS = [
  [/^manga$/, /manga/],
  [/^sp$/, /\bsp\b|special/],
  [/^(aa|alt|altart|alt-art)$/, /alt(ernate)?[\s-]?art|\baa\b/],
  [/^sar$/, /\bsar\b|special[\s-]?art/],
  [/^sir$/, /\bsir\b|special illustration/],
  [/^ir$/, /\bir\b|illustration rare/],
  [/^sr$/, /\bsr\b|super rare/],
  [/^ur$/, /\bur\b|ultra rare/],
  [/^sec$/, /\bsec\b|secret/],
  [/^(fa|fullart|full-art)$/, /full[\s-]?art/],
  [/^promo$/, /promo/],
  [/^parallel$/, /parallel/],
  [/^gold$/, /gold/],
  [/^rainbow$/, /rainbow/],
  [/^shiny$/, /shin(y|ing)/],
  [/^holo$/, /holo/],
  [/^(1st|first)$/, /1st|first edition/],
]

/** Parse the raw query into match signals. Exported for tests. */
export function parseTableQuery(query) {
  const tokens = String(query ?? '').toLowerCase().split(/\s+/).filter(Boolean)
  const idCands = []    // [{ set, num }] — set-code+number combos
  const numTokens = []  // normalized collector-number tokens
  const codeTokens = [] // normalized possible set-code tokens
  const variants = []   // matcher regexes for tags present in the query
  const nameTokens = [] // whatever's left = the name part

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (LANG_TOKEN.test(t)) continue

    const tag = VARIANT_TAGS.find(([q]) => q.test(t))
    if (tag) { variants.push(tag[1]); continue }

    // "op05-060", "sv8/67", "swsh12.5-160"
    const combo = t.match(/^([a-z]{1,8}[0-9]{0,4}(?:\.[0-9])?)[-/.](\d{1,4}[a-z]{0,3})$/)
    if (combo) {
      idCands.push({ set: norm(combo[1]), num: norm(combo[2]) })
      codeTokens.push(norm(combo[1]))
      numTokens.push(norm(combo[2]))
      continue
    }

    // bare collector number ("060", "44a")
    if (/^\d{1,4}[a-z]?$/.test(t)) {
      numTokens.push(norm(t))
      // a set-code-ish token right before it forms a combo ("op05 060")
      const prev = tokens[i - 1]
      if (prev && /^[a-z]{1,6}\d{1,4}$/.test(prev)) idCands.push({ set: norm(prev), num: norm(t) })
      continue
    }

    // set-code-shaped ("op05", "sv8") — only ever compared by EQUALITY
    // against real set codes, so false candidates are harmless
    if (/^[a-z]{1,6}\d{1,4}$/.test(t)) {
      codeTokens.push(norm(t))
      continue
    }
    if (/^[a-z]{2,5}$/.test(t)) codeTokens.push(norm(t)) // "mrd", "obf" — also stays a name token

    nameTokens.push(t)
  }

  return { idCands, numTokens, codeTokens, variants, nameTokens }
}

/** Score one result row against parsed query signals. Exported for tests. */
export function scoreForTable(c, sig) {
  if (!c) return 0
  const idNorm = norm(c.id)
  const { set: idSet, num: idNum } = splitId(c.id)
  const cardNum = norm(c.number) || idNum
  const name = String(c.name ?? '').toLowerCase()
  const rarityHay = `${c.rarity ?? ''} ${c.name ?? ''}`.toLowerCase()
  let s = 0

  // 1. exact id / set-code+number — prefix on the number side keeps
  //    variant printings (OP05-060_p1) in the top tier too
  let exactId = false
  for (const cand of sig.idCands) {
    const candFull = cand.set + cand.num
    if (idNorm === candFull || idNorm.startsWith(candFull)) { exactId = true; break }
    if (cand.set === idSet && (numEq(cand.num, idNum) || (idNum && z(idNum).startsWith(z(cand.num))))) {
      exactId = true; break
    }
  }
  // also a single pasted token that IS the id ("op05060")
  if (!exactId && sig.codeTokens.some(t => t.length >= 5 && idNorm === t)) exactId = true
  if (exactId) s += W_EXACT_ID

  // 2. exact collector-number token
  if (sig.numTokens.some(t => numEq(t, cardNum) || numEq(t, idNum))) s += W_NUMBER

  // 3. set-code token (equality only — never substring)
  if (sig.codeTokens.some(t => t === idSet || numEq(t, idSet))) s += W_SETCODE

  // 4. name startsWith the residual text
  if (sig.nameTokens.length) {
    const q = sig.nameTokens.join(' ')
    if (name.startsWith(q) || name.startsWith(sig.nameTokens[0])) s += W_NAME
  }

  // 5. variant/rarity tags — each matched tag lifts the printing above base
  for (const re of sig.variants) if (re.test(rarityHay)) s += W_VARIANT

  return s
}

/**
 * Re-rank smartSearch output for table mode. Stable: equal-score rows keep
 * smartSearch's order except for the price-desc final tiebreak.
 * Never drops rows; returns a new array, input untouched.
 */
export function rankForTable(results, query) {
  if (!Array.isArray(results) || results.length < 2) return Array.isArray(results) ? [...results] : []
  const sig = parseTableQuery(query)
  const scored = results.map((c, i) => ({ c, i, s: scoreForTable(c, sig) }))
  scored.sort((a, b) => {
    if (b.s !== a.s) return b.s - a.s
    const pa = Number(a.c?.price) || 0
    const pb = Number(b.c?.price) || 0
    if (pb !== pa) return pb - pa
    return a.i - b.i // stable
  })
  return scored.map(x => x.c)
}

/**
 * Collapse obvious duplicate rows (same game + id + kind), keeping order.
 * The targeted and generic search legs can both return the same card, and
 * a sealed pid can collide with a card id — kind is part of the key.
 */
export function dedupeForTable(results) {
  if (!Array.isArray(results)) return []
  const seen = new Set()
  const out = []
  for (const c of results) {
    if (!c) continue
    const id = c.id ?? ''
    if (id === '') { out.push(c); continue } // never merge id-less rows
    const key = `${c.graded ? 'g' : c.sealed ? 's' : 'c'}|${c.game ?? ''}|${id}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(c)
  }
  return out
}
