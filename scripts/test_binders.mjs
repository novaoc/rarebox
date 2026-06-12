#!/usr/bin/env node
// Binders + raised-cap tests — pure node (booth.js share codecs run on
// web-standard APIs). Covers rule matching, auto-suggestions, the packed
// share roundtrip (additive `bnd` field), the 600-item cap, and that a
// worst-case full booth still fits da.gd's measured 32KB URL ceiling.
//
//   node scripts/test_binders.mjs

import {
  MAX_BOOTH_ITEMS, binderMatch, binderItems, suggestBinders,
  encodeBoothBytes, decodeBoothBytes,
} from '../src/utils/booth.js'

let failures = 0
const ok = (cond, label) => { console.log(`${cond ? '✓' : '✗ FAIL'} ${label}`); if (!cond) failures++ }

// ── rule matching ──
const items = [
  { type: 'card', game: '', setName: 'Surging Sparks', name: 'Pikachu ex', price: 80, qty: 1 },
  { type: 'card', game: 'pokemon', setName: 'Surging Sparks', name: 'Budew', price: 2, qty: 4 },
  { type: 'card', game: 'mtg', setName: 'Modern Horizons 3', name: 'Ulamog', price: 40, qty: 1 },
  { type: 'graded', game: '', setName: 'Base', name: 'Charizard · PSA 9', price: 1200, qty: 1 },
  { type: 'sealed', game: 'one-piece', setName: 'OP-05', name: 'OP-05 Booster Box', price: 90, qty: 2 },
]
const booth = { name: 'T', items }

ok(binderMatch({ type: 'graded' }, items[3]) && !binderMatch({ type: 'graded' }, items[0]), 'type rule')
ok(binderMatch({ game: 'pokemon' }, items[0]) && binderMatch({ game: 'pokemon' }, items[1]), "game rule treats '' as pokemon")
ok(!binderMatch({ game: 'pokemon' }, items[2]), 'game rule excludes other games')
ok(binderMatch({ set: 'Surging Sparks' }, items[0]) && !binderMatch({ set: 'Surging Sparks' }, items[2]), 'set rule')
ok(binderMatch({ pmax: 5 }, items[1]) && !binderMatch({ pmax: 5 }, items[0]), 'price max rule')
ok(binderMatch({ pmin: 50 }, items[3]) && !binderMatch({ pmin: 50 }, items[2]), 'price min rule')
ok(binderItems(booth, { rule: { game: 'pokemon' } }).length === 3, 'binderItems filters live (game lens includes its graded/sealed)')

// ── suggestions ──
const bigBooth = {
  items: [
    ...Array.from({ length: 12 }, (_, i) => ({ type: 'card', game: '', setName: 'Surging Sparks', name: `P${i}`, price: 3 })),
    ...Array.from({ length: 7 }, (_, i) => ({ type: 'card', game: 'mtg', setName: 'MH3', name: `M${i}`, price: 60 })),
    ...Array.from({ length: 4 }, (_, i) => ({ type: 'graded', game: '', setName: 'Base', name: `G${i}`, price: 500 })),
    ...Array.from({ length: 3 }, (_, i) => ({ type: 'sealed', game: '', setName: 'SV8', name: `S${i}`, price: 120 })),
  ],
}
const sug = suggestBinders(bigBooth)
const names = sug.map(s => s.name)
ok(names.includes('Graded slabs'), `suggests graded (${names.join(', ')})`)
ok(names.includes('Sealed'), 'suggests sealed')
ok(names.includes('Pokémon') && names.includes('Magic'), 'suggests per-game (multi-game table)')
ok(names.includes('Surging Sparks'), 'suggests dominant set')
ok(names.some(n => n.startsWith('Bargain bin')), 'suggests bargain bin')
ok(names.some(n => n.startsWith('Heavy hitters')), 'suggests heavy hitters')
ok(sug.length <= 12, 'suggestion count capped')

// ── share roundtrip with binders ──
const shareBooth = {
  name: 'Binder Booth', venue: 'Show', items,
  binders: [
    { id: 'a', name: 'Slabs', icon: '🏆', rule: { type: 'graded' } },
    { id: 'b', name: 'Cheap', icon: '🪙', rule: { pmax: 5 } },
    { id: 'c', name: 'SS singles', icon: '📚', rule: { set: 'Surging Sparks', type: 'card' } },
  ],
}
const bytes = await encodeBoothBytes(shareBooth)
const back = await decodeBoothBytes(bytes)
ok(back.binders?.length === 3, `binders survive the share (${back.binders?.length})`)
ok(back.binders[0].rule.type === 'graded' && back.binders[1].rule.pmax === 5 && back.binders[2].rule.set === 'Surging Sparks',
  'rules roundtrip intact')
ok(binderItems(back, back.binders[0]).length === 1, 'decoded binder filters decoded items')

// legacy share (no bnd) still decodes
const legacy = await decodeBoothBytes(await encodeBoothBytes({ name: 'Old', items }))
ok(Array.isArray(legacy.binders) && legacy.binders.length === 0, 'binder-less shares decode with empty binders')

// ── cap + size envelope ──
ok(MAX_BOOTH_ITEMS === 600, `cap raised to 600 (${MAX_BOOTH_ITEMS})`)
const monster = {
  name: 'Mega booth', venue: 'Worlds',
  items: Array.from({ length: 600 }, (_, i) => ({
    type: 'card', game: ['', 'mtg', 'yugioh', 'lorcana'][i % 4],
    cardId: `set${i % 37}-${i}`, name: `Card Name Number ${i} Holo Rare ex`,
    setName: `Some Set Name ${i % 37}`, number: String(i),
    qty: (i % 3) + 1, price: Math.round(Math.random() * 0 + (i % 90) + 0.99),
    img: `https://images.pokemontcg.io/sv8/${i}.png`,
  })),
}
const monsterBytes = await encodeBoothBytes(monster)
const url = `https://rarebox.io/booth#b=x${Buffer.from(monsterBytes).toString('base64url')}`
console.log(`  · 600-item share: ${monsterBytes.length} bytes → ${url.length} char URL`)
ok(url.length < 32 * 1024, `600-item URL fits da.gd's 32KB ceiling (${url.length})`)
const monsterBack = await decodeBoothBytes(monsterBytes)
ok(monsterBack.items.length === 600, 'all 600 items decode')

console.log(failures ? `\n✗ ${failures} failure(s)` : '\n✓ binders + cap: all checks passed')
process.exit(failures ? 1 : 0)
