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

async function buildCodeIndex() {
  const index = new Map()
  const jobs = [
    getPokemonSets().then((sets) => {
      for (const s of sets || []) {
        const e = { game: 'pokemon', lang: 'en', setId: s.id, name: s.name }
        addCode(index, s.id, e)
        addCode(index, s.ptcgoCode, e)
      }
    }),
    getJapaneseSets().then((sets) => {
      for (const s of sets || []) {
        const e = { game: 'pokemon', lang: 'ja', setId: s.id, name: JP_EN_NAMES[s.id] || s.name || s.id }
        addCode(index, s.id, e)
      }
    }),
    ...['mtg', 'yugioh', 'lorcana', 'one-piece', 'riftbound'].map(g =>
      getProvider(g)?.getSets().then((sets) => {
        for (const s of sets || []) {
          const e = { game: g, lang: null, setId: s.id, name: s.name }
          addCode(index, s.code, e)
          addCode(index, s.id, e)
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
  if (/\d/.test(rawToken)) return /^[A-Za-z]{0,5}-?\d{1,4}[A-Za-z]{0,3}$/.test(rawToken)
  // pure letters: only ALL-CAPS short tokens ("MRD", "OGN") — never words
  return /^[A-Z]{3,5}$/.test(rawToken)
}

function resolveCode(index, rawToken) {
  const key = rawToken.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const exact = index.get(key)
  if (exact?.length) return exact
  // prefix family for digit-bearing tokens: "M2" → M2a/M2b, "SV8" → sv8/sv8a
  if (/\d/.test(key)) {
    const hits = []
    for (const [k, entries] of index) {
      if (k.startsWith(key)) hits.push(...entries)
    }
    if (hits.length && hits.length <= 12) return hits
  }
  return null
}

// ── Query parsing ────────────────────────────────────────────────────────

export async function parseQuery(q) {
  const tokens = String(q || '').trim().split(/\s+/)
  let lang = null
  const sets = []
  const understood = []
  const rest = []
  const index = await codeIndexFast()

  for (const t of tokens) {
    if (LANG_JA.test(t)) { lang = 'ja'; continue }
    if (LANG_EN.test(t)) { lang = 'en'; continue }
    if (index && codeLike(t)) {
      const hits = resolveCode(index, t)
      if (hits) { sets.push(...hits); continue }
    }
    rest.push(t)
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

  return { clean: rest.join(' '), lang, sets: dedupeSets(setsFinal), understood }
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

function matchesSets(result, sets) {
  if (!sets.length) return true
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

async function searchPokemonInSets(text, setIds, pageSize) {
  const setQ = '(' + setIds.map(id => `set.id:${id}`).join(' OR ') + ')'
  const nameQ = text ? `name:${text.trim().replace(/\s+/g, '*')}* ` : ''
  const url = `https://api.pokemontcg.io/v2/cards?q=${encodeURIComponent(nameQ + setQ)}&page=1&pageSize=${pageSize}&orderBy=id&select=id,name,number,set,rarity,tcgplayer,images`
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
  const memoKey = `${q.trim().toLowerCase()}|${pageSize}`
  const hit = _memo.get(memoKey)
  if (hit && Date.now() - hit.ts < MEMO_TTL) return hit.result
  const parsed = await parseQuery(q)
  const text = parsed.clean || q.trim()
  const jaSets = parsed.sets.filter(s => s.lang === 'ja').map(s => s.setId)
  const wantJa = parsed.lang === 'ja' || (jaSets.length > 0 && parsed.sets.every(s => s.lang === 'ja'))

  const jobs = []

  // EN Pokémon set codes get a TARGETED query — post-filtering a paged
  // newest-first search would miss older sets entirely
  const enPkmSets = parsed.sets.filter(s => s.game === 'pokemon' && s.lang === 'en')
  if (!wantJa && enPkmSets.length) {
    jobs.push(searchPokemonInSets(parsed.clean, enPkmSets.map(s => s.setId), pageSize)
      .then(cards => ({ kind: 'cards', cards })).catch(() => ({ kind: 'cards', cards: [] })))
  }

  // Japanese leg — its own index; included on JP intent
  if (wantJa || jaSets.length) {
    jobs.push(searchJapanese(parsed.clean, { limit: pageSize, setIds: jaSets.length ? jaSets : null })
      .then(cards => ({ kind: 'cards', cards })).catch(() => ({ kind: 'cards', cards: [] })))
  }

  // Everything else — skipped entirely when the seller said "JP"
  if (!wantJa) {
    const games = [...new Set(parsed.sets.filter(s => s.lang !== 'ja').map(s => s.game))]
    jobs.push(multiSearch(text, { page: 1, pageSize, providers: games.length ? games : undefined })
      .then(r => ({ kind: 'cards', cards: r.cards || [] })).catch(() => ({ kind: 'cards', cards: [] })))
  }

  // Sealed rides along, filtered by the same understanding
  jobs.push(searchSealed(text, { limit: sealedLimit })
    .then(items => ({ kind: 'sealed', items: items || [] })).catch(() => ({ kind: 'sealed', items: [] })))

  const results = await Promise.all(jobs)
  let cards = results.filter(r => r.kind === 'cards').flatMap(r => r.cards)
  let sealed = results.find(r => r.kind === 'sealed')?.items || []

  if (parsed.sets.length) {
    cards = cards.filter(c => matchesSets(c, parsed.sets))
    sealed = sealed.filter(c => matchesSets(c, parsed.sets))
  }
  // targeted + generic legs can both return the same card
  const seen = new Set()
  cards = cards.filter((c) => {
    const k = `${c.game}:${c.id}`
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
  if (parsed.lang === 'ja') sealed = sealed.filter(s => /japan|jp\b/i.test(`${s.set} ${s.name}`))

  const result = { cards, sealed, understood: parsed.understood }
  _memo.set(memoKey, { ts: Date.now(), result })
  if (_memo.size > MEMO_MAX) _memo.delete(_memo.keys().next().value)
  return result
}
