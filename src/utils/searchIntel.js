/**
 * Search intelligence for the booth pickers — understands the shorthand
 * collectors actually type instead of treating the box as dumb text:
 *
 *   "mega charizard ex JP"   → Japanese Pokémon only
 *   "charizard M2"           → JP sets starting M2 (Inferno X …)
 *   "luffy OP-05"            → One Piece, Awakening of the New Era
 *   "pikachu SV8 ENG"        → English Pokémon, Surging Sparks
 *   "blue-eyes MRD"          → Yu-Gi-Oh!, Metal Raiders
 *
 * Two parts:
 *   parseQuery(q)  — splits language tokens (JP/ENG…) and set codes out of
 *                    the text, resolving codes against the real set lists
 *                    (cached browse data; offline-tolerant)
 *   smartSearch(q) — runs the right sources with the cleaned text and
 *                    filters to the resolved sets; returns
 *                    { cards, sealed, understood } where `understood` is a
 *                    human-readable badge list for the UI
 */

import { multiSearch } from '../services/tcg/multiSearch'
import { searchSealed } from '../services/sealedIndex'
import { searchJapanese } from '../services/jpSearch'
import { getSets as getPokemonSets, getJapaneseSets, JP_EN_NAMES } from '../services/pokemonApi'
import { getProvider } from '../services/tcg/providers'

const LANG_JA = /^(jp|jpn|jap|japanese)$/i
const LANG_EN = /^(en|eng|english)$/i

// ── Set-code index (lazy, cached, offline-tolerant) ─────────────────────

let _codeIndex = null
let _building = null

function addCode(index, code, entry) {
  if (!code) return
  const key = String(code).toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (key.length < 2) return
  if (!index.has(key)) index.set(key, [])
  index.get(key).push(entry)
}

function addName(names, name, entry) {
  const key = String(name || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (key.length < 3) return
  if (!names.has(key)) names.set(key, [])
  names.get(key).push(entry)
}

async function buildCodeIndex() {
  const index = new Map()
  const names = new Map()
  index.NAMES = names // piggyback — both built together, cached together
  const jobs = [
    getPokemonSets().then((sets) => {
      for (const s of sets || []) {
        const e = { game: 'pokemon', lang: 'en', setId: s.id, name: s.name }
        addCode(index, s.id, e)
        addCode(index, s.ptcgoCode, e)
        addName(names, s.name, e)
      }
    }),
    getJapaneseSets().then((sets) => {
      for (const s of sets || []) {
        const e = { game: 'pokemon', lang: 'ja', setId: s.id, name: JP_EN_NAMES[s.id] || s.name || s.id }
        addCode(index, s.id, e)
        addName(names, JP_EN_NAMES[s.id] || '', e)
      }
    }),
    ...['mtg', 'yugioh', 'lorcana', 'one-piece', 'riftbound'].map(g =>
      getProvider(g)?.getSets().then((sets) => {
        for (const s of sets || []) {
          const e = { game: g, lang: null, setId: s.id, name: s.name }
          addCode(index, s.code, e)
          addCode(index, s.id, e)
          addName(names, s.name, e)
        }
      })),
  ]
  await Promise.allSettled(jobs)
  return index
}

async function codeIndex() {
  if (_codeIndex) return _codeIndex
  if (!_building) _building = buildCodeIndex().then(i => { _codeIndex = i; return i })
  return _building
}

/** Kick the set-list fetches off early (call when a search UI opens) so the
 *  first real search finds the index already built. */
export function warmSearchIntel() {
  codeIndex().catch(() => {})
}

/** Awaitable readiness (tests, optional UI states). */
export function searchIntelReady() {
  return codeIndex()
}

// A cold code index fans out to 7 APIs (YGO alone lists 1,018 sets) — that
// must NEVER gate a search. Race a short window; on miss the search runs
// without set-code resolution and the build finishes for the next one.
const INDEX_WAIT_MS = 600
async function codeIndexFast() {
  if (_codeIndex) return _codeIndex
  return Promise.race([
    codeIndex().catch(() => null),
    new Promise(res => setTimeout(() => res(null), INDEX_WAIT_MS)),
  ])
}

/** Token looks like a deliberate set code, not a word. */
function codeLike(rawToken) {
  // digit-bearing: EB2, OP-05, SV8a, sv3pt5, 2x2 — letters/digits mixed tails
  if (/\d/.test(rawToken)) return /^[A-Za-z]{0,5}-?\d{1,4}[A-Za-z]{0,3}\d{0,2}$/.test(rawToken)
  // pure letters: ALL-CAPS always; lowercase only via the exact-resolve +
  // stoplist path in parseQuery (sellers type "yasuo ogn" without shifting)
  return /^[A-Za-z]{3,5}$/.test(rawToken)
}

// English words that double as set codes/abbreviations — never auto-eat
// these from a lowercase query ("ice charizard" must search the words)
const CODE_STOPWORDS = new Set([
  'the', 'and', 'art', 'box', 'ice', 'war', 'one', 'two', 'six', 'ten',
  'all', 'mega', 'dark', 'fire', 'star', 'time', 'ace', 'don', 'king',
  'gold', 'evil', 'hero', 'fury', 'aqua', 'wild', 'jack', 'card', 'rare',
])

function resolveCode(index, rawToken, { exactOnly = false } = {}) {
  const key = rawToken.toUpperCase().replace(/[^A-Z0-9]/g, '')
  // Sets publish zero-padded codes ("EB-02", "OP-05") but people type the
  // short form ("eb2", "op5") — try the digit-padded variant too.
  const keys = [key]
  const m = /^([A-Z]+)(\d)([A-Z]*)$/.exec(key)
  if (m) keys.push(`${m[1]}0${m[2]}${m[3]}`)
  for (const k of keys) {
    const exact = index.get(k)
    if (exact?.length) return exact
  }
  if (exactOnly) return null
  // prefix family for digit-bearing tokens: "M2" → M2a/M2b, "SV8" → sv8/sv8a
  if (/\d/.test(key)) {
    for (const k of keys) {
      const hits = []
      for (const [ik, entries] of index) {
        if (ik.startsWith(k)) hits.push(...entries)
      }
      if (hits.length && hits.length <= 12) return hits
    }
  }
  return null
}

// ── Query parsing ────────────────────────────────────────────────────────

// "110", "110/80", "#110" — a collector number (unless it names a set
// like "151", or sits next to sealed-product words: "151 booster box")
const NUMBER_TOKEN = /^#?(\d{1,3})(?:\/\d{1,3})?$/
const SEALED_WORDS = new Set(['booster', 'box', 'etb', 'bundle', 'tin', 'pack', 'collection', 'display', 'case', 'blister', 'deck'])
const TEXT_EXPAND = { etb: 'elite trainer box' }

// Rarity shorthand collectors type. Two-letter codes must be typed in CAPS
// (lowercase "ar"/"sp" are too word-like); 3+ letters accepted any case.
const RARITY_WORDS = new Set([
  'sar', 'ar', 'sr', 'ssr', 'ur', 'sec', 'chr', 'sp', 'spr', 'manga', 'aa', 'alt', 'promo', 'sir', 'ir',
])
const RARITY_CAPS_ONLY = new Set(['ar', 'sr', 'ur', 'sp', 'aa', 'ir'])
// first word of two-word rarity phrases ("alt art", "full art", "alternate art")
const RARITY_PHRASE_HEAD = new Set(['alt', 'full', 'alternate', 'alternative'])

function rarityLabel(r) {
  return r.length <= 3
    ? r.toUpperCase()
    : r.replace(/\b[a-z]/g, ch => ch.toUpperCase()) // "alt art" → "Alt Art"
}

export async function parseQuery(q) {
  const tokens = String(q || '').trim().split(/\s+/)
  let lang = null
  let number = null
  let rarity = null
  const sets = []
  const soft = [] // code-shaped tokens that resolved to nothing — dropped from clean text
  const understood = []
  const rest = []
  const index = await codeIndexFast()
  const names = index?.NAMES || null
  const sealedish = tokens.some(t => SEALED_WORDS.has(t.toLowerCase()))

  // multiword set NAMES first: "surging sparks", "metal raiders" — consume
  // consecutive tokens that exactly form a known set name
  const consumed = new Set()
  if (names) {
    for (let n = 3; n >= 2; n--) {
      for (let i = 0; i + n <= tokens.length; i++) {
        if ([...Array(n).keys()].some(k => consumed.has(i + k))) continue
        const key = tokens.slice(i, i + n).join('').toUpperCase().replace(/[^A-Z0-9]/g, '')
        const hits = names.get(key)
        if (hits?.length) {
          sets.push(...hits)
          for (let k = 0; k < n; k++) consumed.add(i + k)
        }
      }
    }
  }

  for (let i = 0; i < tokens.length; i++) {
    if (consumed.has(i)) continue
    const t = tokens[i]
    if (LANG_JA.test(t)) { lang = 'ja'; continue }
    if (LANG_EN.test(t)) { lang = 'en'; continue }
    const tl = t.toLowerCase()
    // two-word rarity phrase: "alt art", "full art", "alternate art"
    if (!rarity && RARITY_PHRASE_HEAD.has(tl) && /^art$/i.test(tokens[i + 1] || '')) {
      rarity = `${tl} art`
      i++
      continue
    }
    if (!number) {
      const m = NUMBER_TOKEN.exec(t)
      if (m) {
        // bare numbers can BE a set ("151") or part of a product name
        // ("151 booster box") — set/product wins over collector number
        const asSet = !t.includes('/') && !t.startsWith('#') && names?.get(t)
        if (asSet?.length) { sets.push(...asSet); continue }
        if (!t.includes('/') && !t.startsWith('#') && sealedish) { rest.push(t); continue }
        number = m[1]
        continue
      }
    }
    if (!rarity && RARITY_WORDS.has(tl) && (!RARITY_CAPS_ONLY.has(tl) || t === t.toUpperCase())) {
      rarity = tl
      continue
    }
    if (index && codeLike(t)) {
      // lowercase letter-only tokens resolve EXACTLY or not at all, and
      // never when they're common words ("ice charizard")
      const lower = !/\d/.test(t) && t !== t.toUpperCase()
      if (!(lower && CODE_STOPWORDS.has(tl))) {
        const hits = resolveCode(index, t, { exactOnly: lower })
        if (hits) { sets.push(...hits); continue }
      }
      // A digit-bearing code-shaped token that resolved to NOTHING ("eb9",
      // a typo'd set) must not stay in the text — name matching would then
      // demand the literal token in the card name and zero the results.
      // Pure-letter tokens stay: they may be a real word ("MEGA").
      if (/\d/.test(t)) { soft.push(t); continue }
    }
    rest.push(TEXT_EXPAND[tl] || t)
  }

  // a JP-only set code implies Japanese even without the JP token
  if (!lang && sets.length && sets.every(s => s.lang === 'ja')) lang = 'ja'
  // language narrows ambiguous codes (e.g. a code matching both EN and JP)
  const setsFinal = lang ? sets.filter(s => !s.lang || s.lang === lang) : sets

  if (lang === 'ja') understood.push('Japanese only')
  if (lang === 'en') understood.push('English only')
  for (const s of dedupeSets(setsFinal)) {
    understood.push(`Set: ${s.name}${String(s.setId).toUpperCase() !== s.name.toUpperCase() ? ` (${s.setId})` : ''}`)
  }
  if (number) understood.push(`No. ${number}`)
  if (rarity) understood.push(`Rarity: ${rarityLabel(rarity)}`)

  return { clean: rest.join(' '), lang, sets: dedupeSets(setsFinal), number, rarity, soft, understood }
}

function dedupeSets(sets) {
  const seen = new Set()
  return sets.filter((s) => {
    const k = `${s.game}:${s.lang || ''}:${String(s.setId).toLowerCase()}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

// ── Result filtering ─────────────────────────────────────────────────────

function norm(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function stripZeros(s) {
  return s.replace(/^0+(?=\d)/, '')
}

/** Collector-number match with zero-padding tolerance: "110" hits "110",
 *  "110/80"-style queries arrive pre-split, "012" hits "12", "110a" hits 110. */
function matchesNumber(card, number) {
  const want = stripZeros(String(number).toLowerCase())
  const n = stripZeros(String(card.number || '').toLowerCase())
  if (!n) return false
  if (n === want) return true
  const lead = /^\d+/.exec(n)?.[0]
  if (lead && stripZeros(lead) === want) return true
  // full-code numbers (OP05-060, MRD-060): the collector part is the TAIL
  const tail = /(\d+)\D*$/.exec(n)?.[1]
  return tail ? stripZeros(tail) === want : false
}

// Rarity shorthand → the strings APIs/names actually carry. Matched
// word-bounded against card.rarity AND card.name (covers "(SPR)", "(Manga)",
// "Luffy (Alternate Art)" suffixes).
const ALT_TERMS = ['alt art', 'alternate art', 'alternative art', 'alt']
const RARITY_EXPAND = {
  sar: ['sar', 'special art rare', 'special illustration rare'],
  sir: ['sir', 'special illustration rare'],
  ir: ['ir', 'illustration rare'],
  ar: ['ar', 'art rare', 'illustration rare'],
  sr: ['sr', 'super rare'],
  ssr: ['ssr'],
  ur: ['ur', 'ultra rare'],
  sec: ['sec', 'secret rare'],
  chr: ['chr', 'character rare'],
  sp: ['sp'],
  spr: ['spr'],
  manga: ['manga'],
  aa: ['aa', ...ALT_TERMS],
  alt: ALT_TERMS,
  'alt art': ALT_TERMS,
  'alternate art': ALT_TERMS,
  'alternative art': ALT_TERMS,
  'full art': ['full art'],
  promo: ['promo', 'promotional'],
}

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function matchesRarity(card, rarity) {
  const hay = `${card.rarity || ''} | ${card.name || ''}`
  const terms = RARITY_EXPAND[rarity.toLowerCase()] || [rarity.toLowerCase()]
  return terms.some(t => new RegExp(`(^|[^a-z])${escapeRe(t)}([^a-z]|$)`, 'i').test(hay))
}

// Understanding must never produce WORSE results than ignorance: a filter
// that would zero the list falls back to the unfiltered list instead.
function softFilter(items, pred) {
  const kept = items.filter(pred)
  return kept.length ? kept : items
}

function matchesSets(result, sets) {
  if (!sets.length) return true
  // YGO search rows carry only the FIRST printing; a card printed in the
  // requested set later must still match — and display THAT printing
  if (result.game === 'yugioh' && result._raw?.card_sets?.length) {
    for (const s of sets) {
      if (s.game !== 'yugioh') continue
      const sid = norm(s.setId)
      const sname = norm(s.name)
      const hit = result._raw.card_sets.find((cs) => {
        const csn = norm(cs.set_name)
        const code = norm(String(cs.set_code || '').split('-')[0])
        return csn === sname || csn.includes(sname) || sname.includes(csn) || (code && sid.startsWith(code))
      })
      if (hit) {
        result.set = hit.set_name || result.set
        result.number = hit.set_code || result.number
        result.rarity = hit.set_rarity || result.rarity
        return true
      }
    }
  }
  const rs = norm(result.set)
  const rid = norm(String(result.id || '').split('-')[0])
  return sets.some((s) => {
    if (result.game && s.game !== result.game && !(s.game === 'pokemon' && result.jp)) return false
    const sid = norm(s.setId)
    const sname = norm(s.name)
    return (rs && (rs === sname || rs.includes(sname) || sname.includes(rs)))
      || (rid && rid === sid)
      || (rs && rs.includes(sid) && sid.length >= 3)
  })
}

async function searchPokemonInSets(text, setIds, pageSize, number = null) {
  const clauses = []
  const safe = (text || '').replace(/[:"()*\[\]{}!^~\\]/g, ' ').trim()
  if (safe) clauses.push(`name:${safe.replace(/\s+/g, '*')}*`)
  if (setIds?.length) clauses.push('(' + setIds.map(id => `set.id:${id}`).join(' OR ') + ')')
  if (number) clauses.push(`number:${String(number).replace(/[^0-9a-zA-Z]/g, '')}`)
  if (!clauses.length) return []
  const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(clauses.join(' '))}&page=1&pageSize=${pageSize}&orderBy=id&select=id,name,number,set,rarity,tcgplayer,images`
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) throw new Error(`http_${res.status}`)
  const d = await res.json()
  return (d.data || []).map(c => ({
    id: c.id,
    name: c.name,
    number: c.number || '',
    set: c.set?.name || '',
    image: c.images?.small || '',
    price: (() => { const p = c.tcgplayer?.prices; if (!p) return null; for (const k of ['holofoil', 'normal', 'reverseHolofoil']) if (p[k]?.market) return p[k].market; const f = Object.values(p)[0]; return f?.market || f?.mid || null })(),
    rarity: c.rarity || '',
    game: 'pokemon',
  }))
}

// ── The smart search ─────────────────────────────────────────────────────

// Short-lived result memo: re-running the same query (chip flips, modal
// reopens, double-submits) returns instantly instead of re-fanning out
const _memo = new Map()
const MEMO_TTL = 5 * 60_000
const MEMO_MAX = 40

export async function smartSearch(q, { pageSize = 24, sealedLimit = 12 } = {}) {
  const memoKey = `v2|${q.trim().toLowerCase()}|${pageSize}`
  const hit = _memo.get(memoKey)
  if (hit && Date.now() - hit.ts < MEMO_TTL) return hit.result
  const parsed = await parseQuery(q)
  // When parsing consumed the whole query into filters ("M2 110/80 SAR"),
  // an empty clean text is CORRECT — only fall back to the raw query when
  // nothing was understood at all.
  const text = parsed.clean || (parsed.understood.length ? '' : q.trim())
  const jaSets = parsed.sets.filter(s => s.lang === 'ja').map(s => s.setId)
  const wantJa = parsed.lang === 'ja' || (jaSets.length > 0 && parsed.sets.every(s => s.lang === 'ja'))

  // Filters narrow AFTER fetching — fetch wider so truncation can't starve
  // the filter ("luffy eb02 manga": the Manga row must reach the filter)
  const hasFilters = parsed.sets.length || parsed.number || parsed.rarity
  const fetchSize = hasFilters ? Math.min(pageSize * 4, 96) : pageSize
  const sealedFetch = hasFilters ? Math.min(sealedLimit * 3, 36) : sealedLimit

  // One slow API must not hold the whole search hostage (pokemontcg.io's
  // 8s timeout was the p90) — every leg races a 4s deadline. But if the
  // fast pass nets ZERO cards, the slow legs get a second window: fast
  // when possible, correct when not.
  const LEG_MS = 4000
  const LEG_EXTRA_MS = 5000
  const rawJobs = []
  const leg = (p, empty) => {
    rawJobs.push(p.catch(() => empty))
    return Promise.race([p, new Promise(res => setTimeout(() => res(empty), LEG_MS))])
  }

  const jobs = []

  // EN Pokémon set codes (or a bare collector number) get a TARGETED
  // query — post-filtering a paged newest-first search would miss old sets
  const enPkmSets = parsed.sets.filter(s => s.game === 'pokemon' && s.lang === 'en')
  if (!wantJa && (enPkmSets.length || (parsed.number && !parsed.sets.length))) {
    jobs.push(leg(searchPokemonInSets(parsed.clean, enPkmSets.map(s => s.setId), fetchSize, parsed.number)
      .then(cards => ({ kind: 'cards', cards })).catch(() => ({ kind: 'cards', cards: [] })), { kind: 'cards', cards: [] }))
  }

  // Japanese leg — its own index; included on JP intent
  if (wantJa || jaSets.length) {
    jobs.push(leg(searchJapanese(parsed.clean, { limit: fetchSize, setIds: jaSets.length ? jaSets : null, number: parsed.number })
      .then(cards => ({ kind: 'cards', cards })).catch(() => ({ kind: 'cards', cards: [] })), { kind: 'cards', cards: [] }))
  }

  // Bare set browse ("OP05" with no card name): pull the set's own cards
  const browseSets = parsed.sets.filter(s => s.game !== 'pokemon')
  if (!text && !wantJa && browseSets.length) {
    for (const s of browseSets.slice(0, 2)) {
      jobs.push(leg((async () => {
        const { getProvider } = await import('../services/tcg/providers')
        const all = await getProvider(s.game)?.getSetCards(s.setId) || []
        return { kind: 'cards', cards: all.slice(0, fetchSize).map(c => ({ ...c, set: s.name, game: s.game })) }
      })().catch(() => ({ kind: 'cards', cards: [] })), { kind: 'cards', cards: [] }))
    }
  }

  // Everything else — skipped entirely when the seller said "JP"
  if (!wantJa && (text || !jobs.length)) {
    const games = [...new Set(parsed.sets.filter(s => s.lang !== 'ja').map(s => s.game))]
    jobs.push(leg(multiSearch(text, { page: 1, pageSize: fetchSize, providers: games.length ? games : undefined })
      .then(r => ({ kind: 'cards', cards: r.cards || [] })).catch(() => ({ kind: 'cards', cards: [] })), { kind: 'cards', cards: [] }))
  }

  // Sealed rides along, filtered by the same understanding
  jobs.push(leg(searchSealed(text, { limit: sealedFetch })
    .then(items => ({ kind: 'sealed', items: items || [] })).catch(() => ({ kind: 'sealed', items: [] })), { kind: 'sealed', items: [] }))

  let results = await Promise.all(jobs)
  let cards = results.filter(r => r.kind === 'cards').flatMap(r => r.cards)
  let sealed = results.find(r => r.kind === 'sealed')?.items || []
  if (!cards.length && rawJobs.length) {
    // empty fast pass — wait out the slow legs before giving up
    results = await Promise.race([
      Promise.all(rawJobs),
      new Promise(res => setTimeout(() => res(results), LEG_EXTRA_MS)),
    ])
    cards = results.filter(r => r.kind === 'cards').flatMap(r => r.cards)
    sealed = results.find(r => r.kind === 'sealed')?.items || sealed
  }

  if (parsed.sets.length) {
    // SOFT set filter: an empty set∩name intersection falls back to the
    // name matches instead of stranding the user with nothing
    cards = parsed.clean ? softFilter(cards, c => matchesSets(c, parsed.sets)) : cards.filter(c => matchesSets(c, parsed.sets))
    sealed = softFilter(sealed, c => matchesSets(c, parsed.sets))
  }
  // targeted + generic legs can both return the same card
  const seen = new Set()
  cards = cards.filter((c) => {
    const k = `${c.game}:${c.id}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  // Number/rarity understanding narrows SOFTLY — a filter that strands the
  // user with zero results yields to the unfiltered list.
  if (parsed.number) cards = softFilter(cards, c => matchesNumber(c, parsed.number))
  if (parsed.rarity) cards = softFilter(cards, c => matchesRarity(c, parsed.rarity))
  if (parsed.lang === 'ja') sealed = sealed.filter(s => /japan|jp\b/i.test(`${s.set} ${s.name}`))

  // exact name hits above fuzzy-assisted ones, then trim the overfetch
  if (parsed.clean) {
    const toks = parsed.clean.toLowerCase().split(/\s+/).filter(Boolean)
    const exact = (c) => { const n = (c.name || '').toLowerCase(); return toks.every(t => n.includes(t)) ? 0 : 1 }
    cards = cards.map((c, i) => [exact(c), i, c]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(x => x[2])
  }
  cards = cards.slice(0, Math.max(pageSize, 30))
  sealed = sealed.slice(0, sealedLimit)

  const result = { cards, sealed, understood: parsed.understood }
  // never memoize emptiness: a flaky API or case-variant retry must get a
  // real second chance, not 5 minutes of cached nothing
  if (cards.length || sealed.length) {
    _memo.set(memoKey, { ts: Date.now(), result })
    if (_memo.size > MEMO_MAX) _memo.delete(_memo.keys().next().value)
  }
  return result
}
