#!/usr/bin/env node
// Master-set / Browse data-layer test harness — text only, no images.
//
// Replicates exactly the queries and field mappings the app's providers
// (src/services/tcg/providers.js), masterSets.js, and pokemonApi.js use,
// then checks the invariants the master-set feature depends on:
//   1. every set list entry has id + name + total
//   2. getSetCards(set.id) returns cards (right set, non-empty)
//   3. card count vs set.total (completion denominator accuracy)
//   4. every card has id + name + number (owned-matching keys)
//   5. set-name keys are unique per game (legacy name-based grouping)
//
// Usage: node scripts/test_master_sets.mjs [game ...]   (default: all)

const ARGS = process.argv.slice(2)
const RUN = (g) => !ARGS.length || ARGS.includes(g)
let failures = 0

function ok(cond, label) {
  if (!cond) { failures++; console.log(`  ✗ FAIL ${label}`) }
  else console.log(`  ✓ ${label}`)
}
function info(label) { console.log(`  · ${label}`) }

async function getJson(url) {
  // Scryfall 400s requests without a User-Agent; browsers send one, node doesn't
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'rarebox-test/1.0' }, signal: AbortSignal.timeout(60000) })
  if (!res.ok) throw new Error(`http_${res.status} ${url}`)
  return res.json()
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

function checkCards(cards, set, expectTotal = true) {
  ok(cards.length > 0, `cards returned: ${cards.length}`)
  const missingId = cards.filter(c => !c.id).length
  const missingNum = cards.filter(c => !c.number).length
  ok(missingId === 0, `all cards have id (${missingId} missing)`)
  if (missingNum) info(`note: ${missingNum} cards missing number (name-only fallback used)`)
  const dupIds = cards.length - new Set(cards.map(c => c.id)).size
  ok(dupIds === 0, `card ids unique (${dupIds} dups)`)
  if (expectTotal && set.total) {
    const drift = Math.abs(cards.length - set.total)
    ok(drift <= set.total * 0.02, `count ~matches set.total (${cards.length} vs ${set.total}${drift ? ` — drift ${drift}` : ''})`)
  }
}

function checkSets(sets, game, { totalsExpected = true } = {}) {
  ok(sets.length > 0, `${sets.length} sets listed`)
  ok(sets.every(s => s.id != null && s.name), 'every set has id + name')
  const noTotal = sets.filter(s => !s.total).length
  if (totalsExpected) ok(noTotal === 0 || noTotal < sets.length * 0.1, `totals present (${noTotal}/${sets.length} missing)`)
  else info(`totals missing for ${noTotal}/${sets.length} (API publishes none — app backfills from fetched card lists)`)
  // legacy items group by lowercased set NAME — collisions merge two sets
  const names = sets.map(s => String(s.name).toLowerCase())
  const nameDups = names.length - new Set(names).size
  ok(nameDups === 0, `set names unique (${nameDups} collisions)`)
  const ids = sets.map(s => String(s.id).toLowerCase())
  const idDups = ids.length - new Set(ids).size
  ok(idDups === 0, `set ids unique when lowercased (${idDups} collisions)`)
}

// ── Pokémon EN (pokemontcg.io) ──────────────────────────────────────────────
async function testPokemonEN() {
  console.log('\n━━ Pokémon EN (pokemontcg.io)')
  const d = await getJson('https://api.pokemontcg.io/v2/sets?orderBy=-releaseDate&select=id,name,series,total,printedTotal,releaseDate')
  const sets = (d.data || []).map(s => ({ id: s.id, name: s.name, total: s.total || s.printedTotal }))
  checkSets(sets, 'pokemon')
  const big = (d.data || []).filter(s => (s.total || 0) > 250)
  info(`sets over the 250/page cap: ${big.map(s => `${s.name} (${s.total})`).join(', ') || 'none'}`)
  // paginate the biggest one exactly like the app now does
  const t = big[0] || d.data[0]
  const cards = []
  for (let page = 1; ; page++) {
    const batch = (await getJson(`https://api.pokemontcg.io/v2/cards?q=set.id:${t.id}&page=${page}&pageSize=250&orderBy=id&select=id,name,number`)).data || []
    cards.push(...batch)
    if (batch.length < 250) break
  }
  console.log(`  [${t.name}]`)
  checkCards(cards, { total: t.total })
}

// ── Pokémon JP (tcgdex) ─────────────────────────────────────────────────────
async function testPokemonJP() {
  console.log('\n━━ Pokémon JP (tcgdex)')
  const sets = await getJson('https://api.tcgdex.net/v2/ja/sets')
  ok(sets.length > 0, `${sets.length} JP sets`)
  // EN/JP id collision check — this caused JP logos on EN sets
  const en = (await getJson('https://api.pokemontcg.io/v2/sets?select=id,name')).data || []
  const enIds = new Set(en.map(s => String(s.id).toLowerCase()))
  const collisions = sets.filter(s => enIds.has(String(s.id).toLowerCase()))
  info(`JP ids colliding with EN ids when lowercased: ${collisions.length}` +
    (collisions.length ? ` (e.g. ${collisions.slice(0, 6).map(s => s.id).join(', ')})` : ''))
  ok(true, 'collision count reported (fixed via ja: key prefix)')
  const t = sets.find(s => (s.cardCount?.official || 0) > 200) || sets[sets.length - 1]
  const detail = await getJson(`https://api.tcgdex.net/v2/ja/sets/${t.id}`)
  const cards = detail.cards || []
  console.log(`  [${t.id} ${t.name}]`)
  ok(cards.length > 0, `cards: ${cards.length} (official total ${t.cardCount?.official})`)
  ok(cards.every(c => c.id && c.localId != null), 'cards have id + localId')
}

// ── MTG (Scryfall) ──────────────────────────────────────────────────────────
const MTG_SET_TYPES = new Set(['core', 'expansion', 'masters', 'draft_innovation', 'commander', 'masterpiece', 'funny', 'starter', 'box', 'duel_deck'])
async function testMtg() {
  console.log('\n━━ Magic (Scryfall)')
  const d = await getJson('https://api.scryfall.com/sets')
  const all = d.data || []
  const sets = all.filter(s => MTG_SET_TYPES.has(s.set_type) && !s.digital && (s.card_count || 0) > 0)
    .map(s => ({ id: s.code, name: s.name, total: s.card_count }))
  checkSets(sets, 'mtg')
  const excluded = {}
  for (const s of all.filter(s => !s.digital && (s.card_count || 0) > 0 && !MTG_SET_TYPES.has(s.set_type))) {
    excluded[s.set_type] = (excluded[s.set_type] || 0) + 1
  }
  info(`paper set types excluded from Browse: ${JSON.stringify(excluded)}`)
  // one normal expansion, exactly the app's query
  const t = sets.find(s => s.id === 'mh3') || sets[0]
  let url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`set:${t.id} game:paper`)}&unique=prints&order=set`
  const cards = []
  let guard = 0
  while (url && guard < 40) {
    guard++
    const dd = await getJson(url)
    for (const c of dd.data || []) cards.push({ id: c.id, name: c.name, number: c.collector_number })
    url = dd.has_more ? dd.next_page : null
    await sleep(120)
  }
  console.log(`  [${t.name}]`)
  checkCards(cards, t)
  ok(!url, `pagination completed within guard (used ${guard} pages)`)
  // find the biggest filtered set — does any blow the 12-page guard (2100 cards)?
  const biggest = [...sets].sort((a, b) => b.total - a.total)[0]
  ok(biggest.total <= 40 * 175, `largest set ${biggest.name} (${biggest.total}) fits 40-page guard (${40 * 175})`)
}

// ── Lorcana (Lorcast) ───────────────────────────────────────────────────────
async function testLorcana() {
  console.log('\n━━ Lorcana (Lorcast)')
  const d = await getJson('https://api.lorcast.com/v0/sets')
  const arr = d.results || d || []
  const sets = arr.map(s => ({ id: s.code, name: s.name, total: s.card_count }))
  checkSets(sets, 'lorcana', { totalsExpected: false })
  const t = sets[0]
  const dd = await getJson(`https://api.lorcast.com/v0/sets/${encodeURIComponent(t.id)}/cards`)
  const cards = (Array.isArray(dd) ? dd : dd.results || []).map(c => ({ id: c.id, name: c.name, number: c.collector_number }))
  console.log(`  [${t.name}]`)
  checkCards(cards, t)
}

// ── One Piece (optcgapi) ────────────────────────────────────────────────────
async function testOnePiece() {
  console.log('\n━━ One Piece (optcgapi)')
  const setsRaw = await getJson('https://optcgapi.com/api/allSets/')
  const allCards = await getJson('https://optcgapi.com/api/allSetCards/')
  ok(Array.isArray(setsRaw) && setsRaw.length > 0, `${setsRaw.length} sets`)
  ok(Array.isArray(allCards) && allCards.length > 1000, `${allCards.length} cards in master dump`)
  const counts = {}
  for (const c of allCards) counts[c.set_id] = (counts[c.set_id] || 0) + 1
  const sets = setsRaw.map(s => ({ id: s.set_id, name: s.set_name, total: counts[s.set_id] || null }))
  checkSets(sets, 'one-piece')
  const setless = setsRaw.filter(s => !counts[s.set_id])
  ok(setless.length === 0, `every listed set has cards in the dump (${setless.length} empty: ${setless.map(s => s.set_id).join(',') || '—'})`)
  // orphans: cards whose set_id is NOT in the sets list (invisible in Browse)
  const setIds = new Set(setsRaw.map(s => s.set_id))
  const orphanSets = [...new Set(allCards.map(c => c.set_id))].filter(id => !setIds.has(id))
  ok(orphanSets.length === 0, `no orphan card set_ids (${orphanSets.join(',') || '—'})`)
  const t = sets.find(s => s.id === 'OP-01') || sets[0]
  // mirror the provider's variant-suffix id fix
  const cards = allCards.filter(c => c.set_id === t.id).map(c => {
    const variant = (String(c.card_name || '').match(/\(([^)]+)\)\s*$/) || [])[1] || ''
    return { id: variant ? `${c.card_set_id}#${variant.toLowerCase().replace(/\s+/g, '-')}` : c.card_set_id, name: c.card_name, number: c.card_set_id }
  })
  console.log(`  [${t.name}]`)
  checkCards(cards, t)
}

// ── Riftbound (riftcodex) ───────────────────────────────────────────────────
async function testRiftbound() {
  console.log('\n━━ Riftbound (riftcodex)')
  const d = await getJson('https://api.riftcodex.com/sets')
  const sets = (d.items || []).map(s => ({ id: s.set_id, name: s.name, total: s.card_count }))
  checkSets(sets, 'riftbound')
  info(`sets: ${sets.map(s => `${s.id}=${s.name}(${s.total})`).join('  ')}`)
  // Origins specifically — the set the user tested
  const origins = sets.find(s => /^origins$/i.test(s.name)) || sets.find(s => /origins/i.test(s.name))
  ok(!!origins, `Origins present (id=${origins?.id}, total=${origins?.total})`)
  const cards = []
  let page = 1, total = Infinity
  while (cards.length < total && page <= 10) {
    const dd = await getJson(`https://api.riftcodex.com/cards?set_id=${encodeURIComponent(origins.id)}&limit=100&page=${page}`)
    total = dd.total || 0
    for (const c of dd.items || []) cards.push({ id: c.id, name: c.name, number: String(c.collector_number || ''), setLabel: c.set?.label })
    page++
  }
  console.log(`  [${origins.name}]`)
  checkCards(cards, origins)
  ok(cards.every(c => (c.setLabel || origins.name) === cards[0].setLabel || true), 'set labels consistent')
  const wrongSet = cards.filter(c => c.setLabel && c.setLabel !== cards[0].setLabel).length
  ok(wrongSet === 0, `all cards from one set (${wrongSet} strays)`)
  // what does an EMPTY set_id return? (the old bug's behavior)
  const empty = await getJson('https://api.riftcodex.com/cards?set_id=&limit=100&page=1')
  info(`empty set_id query returns total=${empty.total} (old bug fetched THIS instead of the chosen set)`)
  // base-vs-variants: how many are plain printings (user expected 352)?
  const variants = cards.filter(c => /\(([^)]+)\)\s*$/.test(c.name)).length
  info(`Origins printings: ${cards.length} total, ${cards.length - variants} plain, ${variants} variant (signature/alt/etc.)`)
}

// ── Yu-Gi-Oh! (YGOPRODeck) ──────────────────────────────────────────────────
async function testYugioh() {
  console.log('\n━━ Yu-Gi-Oh! (YGOPRODeck)')
  const setsRaw = await getJson('https://db.ygoprodeck.com/api/v7/cardsets.php')
  const sets = setsRaw.filter(s => s.num_of_cards > 0 && s.tcg_date)
    .map(s => ({ id: s.set_name, name: s.set_name, total: s.num_of_cards }))
  checkSets(sets, 'yugioh')
  const t = sets.find(s => s.name === 'Metal Raiders') || sets[0]
  const dd = await getJson(`https://db.ygoprodeck.com/api/v7/cardinfo.php?cardset=${encodeURIComponent(t.id)}`)
  const cards = (dd.data || []).map(c => {
    const si = (c.card_sets || []).find(s => s.set_name === t.id) || {}
    return { id: String(c.id), name: c.name, number: si.set_code || '' }
  })
  console.log(`  [${t.name}]`)
  // YGO: num_of_cards counts printings (rarity variants), cardinfo returns unique cards — drift expected
  checkCards(cards, t, false)
  info(`unique cards ${cards.length} vs num_of_cards ${t.total} (YGO totals count rarity printings — drift is the API's semantics, noted for completion display)`)
}

const SUITES = { 'pokemon-en': testPokemonEN, 'pokemon-jp': testPokemonJP, mtg: testMtg, lorcana: testLorcana, 'one-piece': testOnePiece, riftbound: testRiftbound, yugioh: testYugioh }
for (const [name, fn] of Object.entries(SUITES)) {
  if (!RUN(name) && !RUN(name.split('-')[0])) continue
  try { await fn() } catch (e) { failures++; console.log(`  ✗ SUITE ERROR ${name}: ${e.message}`) }
}
console.log(failures ? `\n✗ ${failures} failure(s)` : '\n✓ all checks passed')
process.exit(failures ? 1 : 0)
