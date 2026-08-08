import { assert, ok, read, runEval } from './lib.mjs'
import { pickBestPriced } from '../../src/services/priceMatch.js'

// Live PriceCharting shapes captured 2026-08-08: the query "collector
// booster box magic" returns other sets' collector boxes FIRST — taking
// [0] priced a $380 Spider-Man box at $1800 (Final Fantasy) on refresh.
// Same lesson as fetchPrice's 1113af2 fix, now on the priceFeedService
// path that sealed non-Pokémon refresh actually uses.
const LIVE_RESULTS = [
  { name: 'Booster Box [Collector]', set: 'Magic Final Fantasy', price: 1800.0 },
  { name: 'Booster Box [Collector]', set: 'Magic Lord of the Rings', price: 1219.0 },
  { name: 'Booster Box [Collector Special Edition]', set: 'Magic Lord of the Rings', price: 6661.81 },
  { name: 'Collector Booster Box', set: 'Magic Marvel Spider-Man', price: 380.38 },
  { name: 'Collector Booster Box', set: 'Magic Fallout', price: 1865.18 },
]

await runEval('sealed SKU scoring — set-qualified queries pick the right box', async () => {
  // Set-qualified query (what refresh now sends for sealed) wins on overlap.
  const hit = pickBestPriced(LIVE_RESULTS, 'Collector Booster Box Magic Marvel Spider-Man')
  assert(hit && hit.set === 'Magic Marvel Spider-Man', 'set-qualified query must pick its own set')
  assert(hit.price === 380.38, `expected $380.38, got $${hit?.price}`)
  ok('Spider-Man collector box resolves to $380.38, not the $1800 first result')

  // Unpriced rows never win; all-null price list returns null.
  const withNull = [{ name: 'Collector Booster Box', set: 'Magic Marvel Spider-Man', price: null }, ...LIVE_RESULTS]
  const hit2 = pickBestPriced(withNull, 'Collector Booster Box Magic Marvel Spider-Man')
  assert(hit2 && hit2.price === 380.38, 'null-priced exact match must not shadow the priced one')
  assert(pickBestPriced([{ name: 'x', set: 'y', price: null }], 'x') === null, 'all-null prices → null')
  ok('null prices never selected')

  // $0 is a valid PriceCharting price, not a miss (AGENTS.md) — it must
  // stay selectable and never collapse to null.
  const zero = pickBestPriced([{ name: 'Bulk Lot', set: 'Magic Fallout', price: 0 }], 'bulk lot fallout')
  assert(zero && zero.price === 0, '$0 stays a valid selectable price')
  ok('$0 prices remain valid')

  // No-overlap queries keep PriceCharting order (first priced result).
  const hit3 = pickBestPriced(LIVE_RESULTS, 'zz')
  assert(hit3 === LIVE_RESULTS[0], 'no usable tokens falls back to first priced result')
  ok('token-less query keeps original order')

  // The refresh call site actually sends the set-qualified query for sealed.
  const src = read('src/views/PortfolioView.vue')
  assert(
    /item\.type === 'sealed'\s*\n?\s*\?\s*\[name, item\.setName\]/.test(src),
    'PortfolioView sealed refresh must join name + setName into the query'
  )
  ok('sealed refresh query includes setName')
})
