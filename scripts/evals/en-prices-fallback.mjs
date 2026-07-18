import { assert, ok, read, runEval } from './lib.mjs'
import {
  enrichPokemonCard, enPriceFor, enPriceForCardId, enPriceKey,
  hasLivePrices, normEnNumber,
} from '../../src/services/tcg/enPrices.js'
import { getMarketPrice } from '../../src/services/pokemonApi.js'
import { extractPokemonPrice } from '../../src/services/tcg/multiSearch.js'
import { applyEnFallbackPrices, pickPokemonPrice } from '../../src/services/tcg/cardPreloader.js'

// Live payload shapes captured 2026-07-18 (see task root cause):
// me2pt5+ cards return tcgplayer URL only; me1 and older carry full prices.
const me2pt5UrlOnly = {
  id: 'me2pt5-1', name: "Erika's Oddish", number: '1',
  set: { id: 'me2pt5', name: 'Ascended Heroes' },
  tcgplayer: { url: 'https://prices.pokemontcg.io/tcgplayer/me2pt5-1' },
}
const me1LivePriced = {
  id: 'me1-1', name: 'Bulbasaur', number: '1',
  set: { id: 'me1', name: 'Mega Evolution' },
  tcgplayer: {
    url: 'https://prices.pokemontcg.io/tcgplayer/me1-1',
    updatedAt: '2026/07/18',
    prices: {
      reverseHolofoil: { low: 0.03, mid: 0.3, high: 30.0, market: 0.29 },
      normal: { low: 0.01, mid: 0.23, high: 1000.0, market: 0.23 },
    },
  },
}

await runEval('EN Pokémon static price fallback', async () => {
  // Key normalization — must match scripts/build_en_prices.py norm_number.
  assert(enPriceKey('me2pt5', '001/217') === 'me2pt5-1', 'tcgcsv Number 001/217 should key as me2pt5-1')
  assert(enPriceKey('me2pt5', '1') === 'me2pt5-1', 'pokemontcg number 1 should key as me2pt5-1')
  assert(enPriceKey('swshp', 'SWSH001') === 'swshp-swsh1', 'letter-prefixed promo numbers should normalize')
  assert(enPriceKey('sv8pt5', 'TG07') === 'sv8pt5-tg7', 'gallery numbers should normalize')
  assert(normEnNumber('0') === '0', 'literal zero number stays zero')
  assert(enPriceForCardId({ 'me2pt5-1': 0.13 }, 'me2pt5-1') === 0.13, 'card-id lookup works for preloader rows')

  // 1. URL-only me2pt5 live card gets the fallback price, url preserved.
  const priceMap = { 'me2pt5-1': 0.13, 'me1-1': 99.99, 'me3-5': 0 }
  const filled = enrichPokemonCard({ ...me2pt5UrlOnly, tcgplayer: { ...me2pt5UrlOnly.tcgplayer } }, priceMap)
  assert(filled.tcgplayer.prices?.normal?.market === 0.13, 'me2pt5 URL-only card should receive fallback market price')
  assert(filled.tcgplayer.url === me2pt5UrlOnly.tcgplayer.url, 'live tcgplayer url must be preserved')
  const viaConsumer = getMarketPrice(filled)
  assert(viaConsumer?.price === 0.13 && viaConsumer?.variant === 'normal',
    'synchronous getMarketPrice should read the enriched card', JSON.stringify(viaConsumer))

  // 2. A working old live price always wins over the fallback asset.
  const live = enrichPokemonCard({ ...me1LivePriced, tcgplayer: structuredClone(me1LivePriced.tcgplayer) }, priceMap)
  const liveResult = getMarketPrice(live)
  assert(liveResult?.price === 0.29 && liveResult?.variant === 'reverseHolofoil',
    'live reverseHolofoil must stay authoritative (fallback value 99.99 ignored)', JSON.stringify(liveResult))
  assert(Object.keys(live.tcgplayer.prices).length === 2, 'live variant data must not be replaced by the fallback')

  // 3. $0 is a valid price — kept as 0, never collapsed to null.
  assert(hasLivePrices({ prices: { normal: { market: 0 } } }), 'hasLivePrices treats $0 market as usable data')
  assert(enPriceFor({ 'me3-5': 0 }, 'me3', '5') === 0, 'enPriceFor returns 0, not null')
  const zeroCard = enrichPokemonCard({ id: 'me3-5', number: '5', set: { id: 'me3' }, tcgplayer: { url: 'u' } }, priceMap)
  assert(zeroCard.tcgplayer.prices?.normal?.market === 0, 'enriched $0 price stays 0')

  // 4. Unknown stays null — no fallback key, no invented price.
  const unknown = enrichPokemonCard({ id: 'xy99-7', number: '7', set: { id: 'xy99' }, tcgplayer: { url: 'u' } }, priceMap)
  assert(!unknown.tcgplayer.prices, 'unmapped card must keep absent prices, not gain one')
  assert(enPriceFor(priceMap, 'xy99', '7') === null, 'unknown key is null, not 0')
  assert(getMarketPrice(unknown) === null, 'getMarketPrice on priceless card stays null')

  // Edge shapes: empty live prices object counts as missing; JP untouched.
  const emptyLive = enrichPokemonCard({ id: 'me2pt5-2', number: '2', set: { id: 'me2pt5' }, tcgplayer: { prices: {} } },
    { 'me2pt5-2': 1.5 })
  assert(emptyLive.tcgplayer.prices.normal.market === 1.5, 'empty live prices object should be treated as missing')
  const ja = { id: 'SV8a-001', number: '001', set: { id: 'SV8a' }, _lang: 'ja' }
  assert(enrichPokemonCard(ja, { 'sv8a-1': 5 }) === ja && !ja.tcgplayer, 'JP cards must not be enriched by the EN asset')

  ok('fallback fills URL-only cards, live prices win, $0 stays 0, unknown stays null')
})

await runEval('$0 survives every feature-dependent price extractor', async () => {
  // getMarketPrice(0): a live $0 market price must return {price:0}, not null.
  const zeroPriority = { tcgplayer: { prices: { holofoil: { market: 0 } } } }
  const g = getMarketPrice(zeroPriority)
  assert(g?.price === 0 && g?.variant === 'holofoil', 'getMarketPrice must return $0, not null', JSON.stringify(g))
  // variantKey path: $0 market survives; falls back to mid only when market is absent.
  assert(getMarketPrice({ tcgplayer: { prices: { normal: { market: 0, mid: 5 } } } }, 'normal') === 0,
    'getMarketPrice(variant) must return market $0 over mid')
  assert(getMarketPrice({ tcgplayer: { prices: { normal: { mid: 5 } } } }, 'normal') === 5,
    'getMarketPrice(variant) falls back to mid when market absent')
  // Unknown/non-finite stays null across all extractors.
  assert(getMarketPrice({ tcgplayer: { prices: { normal: { market: null } } } }) === null,
    'getMarketPrice null market stays null')

  // multiSearch normalized-row extraction.
  assert(extractPokemonPrice({ tcgplayer: { prices: { holofoil: { market: 0 } } } }) === 0,
    'extractPokemonPrice keeps $0')
  assert(extractPokemonPrice({ tcgplayer: { prices: { foo: { mid: 0 } } } }) === 0,
    'extractPokemonPrice first-available keeps $0 mid')
  assert(extractPokemonPrice({ tcgplayer: { prices: {} } }) === null, 'extractPokemonPrice empty stays null')

  // preloader row picker.
  assert(pickPokemonPrice({ prices: { normal: { market: 0 } } }) === 0, 'pickPokemonPrice keeps $0')
  assert(pickPokemonPrice({ prices: { holofoil: { market: 1.5 }, normal: { market: 0 } } }) === 1.5,
    'pickPokemonPrice honors holofoil priority')
  assert(pickPokemonPrice({ prices: {} }) === null, 'pickPokemonPrice empty stays null')

  ok('getMarketPrice / extractPokemonPrice / pickPokemonPrice all treat $0 as a real price')
})

await runEval('mid-only live data resolves through every feature-dependent extractor', async () => {
  // hasLivePrices accepts finite mid-only live data (no market field), so the
  // extractors it gates must also fall back market ?? mid or they skew: the
  // card passes the live gate yet every price reads null. $0 mid is real too.
  const midOnly = { tcgplayer: { prices: { holofoil: { low: 1, mid: 4.2, high: 9 } } } }
  assert(hasLivePrices(midOnly.tcgplayer), 'hasLivePrices must accept mid-only live data')

  // getMarketPrice priority loop: mid-only variant resolves, shape preserved.
  const gm = getMarketPrice(midOnly)
  assert(gm?.price === 4.2 && gm?.variant === 'holofoil',
    'getMarketPrice priority must fall back to mid, keeping {price,variant}', JSON.stringify(gm))
  // getMarketPrice fallback loop: non-standard variant, mid-only.
  const gmFallback = getMarketPrice({ tcgplayer: { prices: { foo: { mid: 7 } } } })
  assert(gmFallback?.price === 7 && gmFallback?.variant === 'foo',
    'getMarketPrice first-available must fall back to mid', JSON.stringify(gmFallback))
  // market still wins over mid within a variant (priority preserved).
  assert(getMarketPrice({ tcgplayer: { prices: { holofoil: { mid: 4.2, market: 3.1 } } } })?.price === 3.1,
    'getMarketPrice must prefer market over mid within a variant')
  // $0 mid is a real price, not null.
  assert(getMarketPrice({ tcgplayer: { prices: { normal: { mid: 0 } } } })?.price === 0,
    'getMarketPrice must return $0 mid, not null')

  // multiSearch extractPokemonPrice: named-variant loop falls back to mid.
  assert(extractPokemonPrice(midOnly) === 4.2, 'extractPokemonPrice must fall back to mid on a named variant')
  assert(extractPokemonPrice({ tcgplayer: { prices: { normal: { mid: 0 } } } }) === 0,
    'extractPokemonPrice keeps $0 mid')

  // cardPreloader pickPokemonPrice: named-variant loop falls back to mid.
  assert(pickPokemonPrice(midOnly.tcgplayer) === 4.2, 'pickPokemonPrice must fall back to mid on a named variant')
  assert(pickPokemonPrice({ prices: { holofoil: { mid: 4.2 }, normal: { market: 1 } } }) === 4.2,
    'pickPokemonPrice honors variant priority (holofoil mid beats normal market)')
  assert(pickPokemonPrice({ prices: { normal: { mid: 0 } } }) === 0, 'pickPokemonPrice keeps $0 mid')

  ok('mid-only live data yields a price from getMarketPrice / extractPokemonPrice / pickPokemonPrice')
})

await runEval('preloader cache fill is fill-only and $0-safe', async () => {
  // applyEnFallbackPrices fills ONLY null prices; live prices (incl. live $0)
  // are never overwritten; unmapped rows stay null. priceMap injected.
  const priceMap = { 'me2pt5-1': 0.13, 'me3-5': 0, 'me4-9': 4.5 }
  const rows = [
    { id: 'me2pt5-1', price: null },   // priceless → filled from fallback
    { id: 'me3-5', price: null },      // priceless, fallback is $0 → filled to 0
    { id: 'me4-9', price: 0 },         // live $0 → must NOT be overwritten
    { id: 'me1-1', price: 2.5 },       // live-priced → untouched
    { id: 'xy99-7', price: null },     // unmapped → stays null
  ]
  const filled = await applyEnFallbackPrices(rows, priceMap)
  assert(filled === 2, `applyEnFallbackPrices should fill exactly 2 priceless mapped rows, got ${filled}`)
  assert(rows[0].price === 0.13, 'priceless me2pt5 row filled from fallback')
  assert(rows[1].price === 0, 'priceless row with $0 fallback filled to 0')
  assert(rows[2].price === 0, 'live $0 row must stay 0 (never overwritten)')
  assert(rows[3].price === 2.5, 'live-priced row untouched')
  assert(rows[4].price === null, 'unmapped row stays null')
  ok('applyEnFallbackPrices fills only null prices, preserves live $0, leaves unmapped null')
})

await runEval('EN fallback asset coverage (checked-in public/en-prices.json)', async () => {
  const asset = JSON.parse(read('public/en-prices.json'))
  assert(typeof asset.stamp === 'string' && asset.stamp.length > 0, 'asset needs a tcgcsv stamp')
  const prices = asset.prices || {}
  const count = Object.keys(prices).length
  assert(count >= 10000, `asset should cover the English catalog (>=10000 keys), got ${count}`)
  // The sets that lost live prices must be covered by exact keys. me5 is
  // covered via the explicit tcgcsv group 24688 → me5 override (ptcgoCode
  // PBL mismatches the ME05 abbreviation), so it is required, not soft.
  for (const [sid, min] of [['me2pt5', 200], ['me3', 80], ['me4', 80], ['me5', 50]]) {
    const n = Object.keys(prices).filter(k => k.startsWith(`${sid}-`)).length
    assert(n >= min, `${sid} coverage ${n} < ${min} — build join regressed`)
  }
  assert(typeof prices['me2pt5-1'] === 'number', 'me2pt5-1 (Erika\'s Oddish) must be keyed by normalized number')
  for (const [k, v] of Object.entries(prices)) {
    assert(typeof v === 'number' && Number.isFinite(v) && v >= 0, `invalid price value for ${k}`, String(v))
    assert(!k.includes('/'), `key must be normalized (no slash): ${k}`)
  }
  const me5 = Object.keys(prices).filter(k => k.startsWith('me5-')).length
  ok(`asset: ${count} priced cards, me2pt5/me3/me4/me5 covered (me5=${me5})`)
})

await runEval('EN fallback build script sanity', async () => {
  const src = read('scripts/build_en_prices.py')
  assert(src.includes('ptcgoCode'), 'script must join tcgcsv groups via pokemontcg ptcgoCode (live mapping)')
  assert(src.includes('maps/groups.json'), 'script must use the rarebox-price-history group map (history mapping)')
  assert(src.includes('REQUIRED_SETS'), 'script must guard coverage for known-broken sets')
  assert(/EXPLICIT_GROUPS\s*=\s*\{[^}]*["']24688["']\s*:\s*["']me5["']/.test(src),
    'script must carry the explicit tcgcsv group 24688 → me5 override (ptcgoCode PBL mismatch)')
  assert(/REQUIRED_SETS\s*=\s*\{[^}]*["']me5["']/.test(src), 'me5 must be required coverage, not warn-only')
  assert(src.includes('last-updated.txt'), 'script must keep the tcgcsv stamp gate (rate-respectful rebuilds)')
  assert(!/releaseDate.*cutoff|datetime\.now|date\.today\(\)\s*-/.test(src), 'mapping must not be a date-cutoff heuristic')
  const workflow = read('.github/workflows/refresh-data.yml')
  assert(workflow.includes('build_en_prices.py'), 'refresh-data workflow must run the EN price build')
  assert(workflow.includes('public/en-prices.json'), 'refresh-data workflow must commit the EN price asset')
  ok('build script wired into refresh-data with grounded mapping + guards')
})

await runEval('pickPokemonPrice / extractPokemonPrice align with getMarketPrice priority', async () => {
  // 1stEditionNormal is in getMarketPrice priority — extractors must match.
  const firstEd = { prices: { '1stEditionNormal': { market: 2.5 } } }
  assert(pickPokemonPrice(firstEd) === 2.5, 'pickPokemonPrice must resolve 1stEditionNormal')
  assert(extractPokemonPrice({ tcgplayer: firstEd }) === 2.5, 'extractPokemonPrice must resolve 1stEditionNormal')
  assert(getMarketPrice({ tcgplayer: firstEd })?.price === 2.5, 'getMarketPrice must resolve 1stEditionNormal')
  // Odd-key first finite market/mid fallback (live-first, $0-safe).
  assert(pickPokemonPrice({ prices: { unlimited: { mid: 0 } } }) === 0,
    'pickPokemonPrice odd-key $0 mid fallback')
  assert(extractPokemonPrice({ tcgplayer: { prices: { unlimited: { market: 0 } } } }) === 0,
    'extractPokemonPrice odd-key $0 market fallback')
  assert(getMarketPrice({ tcgplayer: { prices: { unlimited: { mid: 1.1 } } } })?.price === 1.1,
    'getMarketPrice odd-key mid fallback')
  ok('priority lists + odd-key fallback aligned across extractors')
})

await runEval('source guards: no object-price write, $0 display/write preserved', async () => {
  // The classic bug: `r?.price || r || 0` returns the whole {price,variant}
  // object when price is 0 — that object must never be persisted as a price.
  const hotPaths = [
    'src/utils/masterSets.js',
    'src/views/SetsView.vue',
    'src/views/SearchView.vue',
    'src/views/DeckBuilderView.vue',
    'src/stores/decks.js',
    'src/components/BulkImportModal.vue',
    'src/components/AddItemModal.vue',
  ]
  for (const rel of hotPaths) {
    const src = read(rel)
    assert(!/r\?\.price\s*\|\|\s*r\s*\|\|/.test(src),
      `${rel} must not use r?.price || r || … (object-price write when $0)`)
    assert(!/priceResult\?\.price\s*\|\|\s*priceResult\s*\|\|/.test(src),
      `${rel} must not use priceResult?.price || priceResult || …`)
  }

  // Bulk import: resolve stores ?? null; doImport writes finite market incl. 0.
  const bulk = read('src/components/BulkImportModal.vue')
  assert(/price:\s*priceResult\?\.price\s*\?\?\s*null/.test(bulk),
    'BulkImportModal resolve must use ?? null so $0 survives lookup')
  assert(/currentMarketPrice:\s*market/.test(bulk) || /currentMarketPrice:\s*r\.price\s*\?\?/.test(bulk),
    'BulkImportModal doImport must write market price with $0 preserved')
  assert(/v-if="r\.price\s*!=\s*null"/.test(bulk),
    'BulkImportModal preview must display valid zero (v-if != null)')

  // AddItemModal: variant market ?? mid; default ?.price ?? ; display != null
  const add = read('src/components/AddItemModal.vue')
  assert(/v-if="currentPrice\s*!=\s*null"/.test(add),
    'AddItemModal must show Market: $0.00 when currentPrice is 0')
  assert(/num\(v\?\.market\)\s*\?\?\s*num\(v\?\.mid\)/.test(add) ||
    /v\?\.market\s*\?\?\s*v\?\.mid/.test(add),
    'AddItemModal selected variant must use market ?? mid')

  // Feature getPrice display conditions treat 0 as priced.
  const sets = read('src/views/SetsView.vue')
  assert(/v-if="getPrice\(card\)\s*!=\s*null"/.test(sets),
    'SetsView must display $0 via getPrice(card) != null')
  const search = read('src/views/SearchView.vue')
  assert(/v-if="getPrice\(card\)\s*!=\s*null"/.test(search),
    'SearchView must display $0 via getPrice(card) != null')
  const deck = read('src/views/DeckBuilderView.vue')
  assert(/v-if="getPrice\(card\)\s*!=\s*null"/.test(deck),
    'DeckBuilderView must display $0 via getPrice(card) != null')

  // decks.js addCardToDeck must not collapse $0 with || null on getMarketPrice
  const decks = read('src/stores/decks.js')
  assert(!/getMarketPrice\(card\)\?\.price\s*\|\|\s*null/.test(decks),
    'decks.addCardToDeck must not use ?.price || null (collapses $0)')

  ok('hot paths never write price objects; $0 display and write preserved')
})
