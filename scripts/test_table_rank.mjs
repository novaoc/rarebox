#!/usr/bin/env node
// Unit test for the booth-table re-ranker — pure node, no browser.
//   node scripts/test_table_rank.mjs

import { rankForTable, dedupeForTable, parseTableQuery, scoreForTable }
  from '../src/utils/tableSearchRank.js'

const checks = []
const ok = (cond, label) => checks.push({ ok: !!cond, label })

// ── synthetic corpus ──
const luffyBase = { id: 'OP05-060', game: 'one-piece', name: 'Monkey.D.Luffy', set: 'Awakening of the New Era', number: '060', rarity: 'L', price: 3.2 }
const luffyManga = { id: 'OP05-119_p3', game: 'one-piece', name: 'Monkey.D.Luffy (Manga)', set: 'Awakening of the New Era', number: '119', rarity: 'SEC Manga', price: 980 }
const luffyAlt = { id: 'OP05-060_p1', game: 'one-piece', name: 'Monkey.D.Luffy', set: 'Awakening of the New Era', number: '060', rarity: 'L Alternate Art', price: 45 }
const luffyOther = { id: 'OP01-003', game: 'one-piece', name: 'Monkey.D.Luffy', set: 'Romance Dawn', number: '003', rarity: 'L', price: 8 }
const zoro = { id: 'OP05-067', game: 'one-piece', name: 'Roronoa Zoro', set: 'Awakening of the New Era', number: '067', rarity: 'SR', price: 12 }
const zard4 = { id: 'base1-4', game: 'pokemon', name: 'Charizard', set: 'Base', number: '4', rarity: 'Rare Holo', price: 600 }
const zardEx = { id: 'sv8-67', game: 'pokemon', name: 'Charizard ex', set: 'Surging Sparks', number: '67', rarity: 'Double Rare', price: 9 }
const charmander = { id: 'base1-46', game: 'pokemon', name: 'Charmander', set: 'Base', number: '46', rarity: 'Common', price: 3 }
const sealedOp05 = { id: '5510', game: 'one-piece', name: 'OP-05 Awakening of the New Era Booster Box', set: 'One Piece', price: 110, sealed: true }

// 1. exact id from "name code-number" query wins, variant id rides the tier
let r = rankForTable([zoro, luffyOther, luffyBase, luffyManga, luffyAlt], 'luffy op05-060')
ok(r[0].id === 'OP05-060_p1' || r[0].id === 'OP05-060', 'exact id tier first: ' + r[0].id)
ok(['OP05-060', 'OP05-060_p1'].includes(r[1].id), 'both 060 printings occupy the top tier')
ok(r[0].id === 'OP05-060_p1', 'within exact tier, pricier printing first (alt art over base)')

// 2. split tokens "op05 060" behave like the dashed form
r = rankForTable([zoro, luffyOther, luffyBase], 'luffy op05 060')
ok(r[0].id === 'OP05-060', 'set-code + number as separate tokens → exact id first')

// 3. exact collector number beats set-code-only match
r = rankForTable([zardEx, charmander, zard4], 'charizard 4')
ok(r[0].id === 'base1-4', 'collector number "4" → base1-4 first, not base1-46')

// 4. leading zeros are equivalent
ok(rankForTable([charmander, zard4], 'charizard 04')[0].id === 'base1-4', '"04" matches #4')
r = rankForTable([luffyOther, luffyBase], 'luffy 60')
ok(r[0].id === 'OP05-060', '"60" matches #060')

// 5. set-code token narrows ("zard sv8" → Surging Sparks over Base)
r = rankForTable([zard4, zardEx], 'charizard sv8')
ok(r[0].id === 'sv8-67', 'set-code token sv8 outranks pricier off-set card')

// 6. name startsWith beats substring-ish noise; price desc breaks ties
r = rankForTable([charmander, zard4, zardEx], 'char')
ok(r[0].name === 'Charizard', 'name tier ties broken by price desc (Charizard $600 first)')

// 7. variant tag "manga" lifts the chase printing above base cards
r = rankForTable([luffyBase, luffyOther, luffyManga], 'luffy manga')
ok(r[0].id === 'OP05-119_p3', '"manga" tag → manga printing first')

// 8. variant tag "sp" matches Special rarity text
const sp = { ...luffyBase, id: 'OP05-060_sp', rarity: 'SP', price: 200 }
r = rankForTable([luffyBase, sp], 'luffy sp')
ok(r[0].id === 'OP05-060_sp', '"sp" tag → SP printing first')

// 9. no signals at all → pure price desc, stable
r = rankForTable([charmander, zoro, zard4], 'mystery query zzz')
ok(r[0].id === 'base1-4' && r[2].id === 'base1-46', 'no signal → price descending')

// 10. ranker never drops or mutates rows
const input = [zoro, luffyBase]
r = rankForTable(input, 'luffy')
ok(r.length === 2 && input[0] === zoro, 'returns new array, input order untouched')

// 11. sealed rows are rankable without crashing (id-less / numeric ids)
r = rankForTable([sealedOp05, luffyBase, { name: 'junk' }], 'luffy op05-060')
ok(r[0].id === 'OP05-060', 'sealed + id-less rows coexist; exact id still first')

// 12. dedupe: same game+id collapses, order kept, kinds stay distinct
const d = dedupeForTable([luffyBase, { ...luffyBase }, sealedOp05, { ...sealedOp05 }, zoro, { name: 'noid' }, { name: 'noid2' }])
ok(d.length === 5, 'dedupe collapses (game,id,kind) twins, keeps both id-less rows: ' + d.length)
ok(d[0].id === 'OP05-060' && d[1] === sealedOp05 && d[2] === zoro, 'dedupe keeps first occurrence order')
ok(dedupeForTable([{ id: '5510', game: 'one-piece' }, sealedOp05]).length === 2, 'card vs sealed with same id are NOT merged')

// 13. parse: language + variant tokens never pollute the name part
const sig = parseTableQuery('charizard JP manga sv8-67')
ok(sig.nameTokens.join(' ') === 'charizard' && sig.variants.length === 1 && sig.idCands.length === 1,
  'parse separates name / lang / variant / id tokens')

// 14. scoring is tiered: exact id alone beats number+set+name+variants combined
const sigId = parseTableQuery('op05-060')
ok(scoreForTable(luffyBase, sigId) > 100_000 + 10_000 + 1_000 + 10 * 100, 'exact-id tier dominates lower tiers')

const failures = checks.filter(c => !c.ok)
for (const c of checks) console.log(`${c.ok ? '✓' : '✗'} ${c.label}`)
console.log(failures.length ? `\n✗ ${failures.length} failure(s)` : '\n✓ table rank: all checks passed')
process.exit(failures.length ? 1 : 0)
