import { assert, ok, read, runEval } from './lib.mjs'
import { refreshUpdates } from '../../src/utils/refreshHeal.js'

// Root causes captured 2026-08-08 (Pikachu ex SV8 136/106 JP + Charmander
// svp-44): tcgdex's JP API stops at each set's official count (SV8-136 is
// a 404) even though its CDN serves the secret scan — but ONLY at 3-digit
// zero-padded paths (/SV8/006 → 200, /SV8/6 → 404). And refresh fetched
// full cards yet persisted only the price, so faceless items never healed.

await runEval('JP secret rares + faceless-item healing', async () => {
  // ── refreshUpdates: price + backfill, never overwrite ──
  const fetched = {
    name: 'Charmander', number: '44',
    images: { small: 'https://images.pokemontcg.io/svp/44.png', large: 'https://images.pokemontcg.io/svp/44_hires.png' },
    set: { id: 'svp', name: 'Scarlet & Violet Black Star Promos' },
  }
  const faceless = { cardData: { name: 'Charmander', number: '44' } }
  let u = refreshUpdates(faceless, fetched, 61.78)
  assert(u.currentMarketPrice === 61.78, 'valid price persists')
  assert(u.cardData.images.small === fetched.images.small, 'missing images backfill from the fetched card')
  assert(u.cardData.set.name === fetched.set.name, 'missing set backfills')
  ok('faceless item heals images + set alongside the price')

  const pictured = { cardData: { name: 'X', number: '9', images: { small: 'stored.png' }, set: { name: 'Stored Set' } } }
  u = refreshUpdates(pictured, fetched, 5)
  assert(u.cardData === undefined, 'fully-populated cardData produces no cardData write')
  assert(u.currentMarketPrice === 5, 'price still updates for pictured items')
  const partial = { cardData: { images: { small: 'stored.png' }, set: { name: 'Stored Set' } } }
  u = refreshUpdates(partial, fetched, 5)
  assert(u.cardData.images.small === 'stored.png' && u.cardData.set.name === 'Stored Set',
    'stored images/set are never overwritten while other gaps backfill')
  assert(u.cardData.name === 'Charmander', 'missing name backfills without touching media')
  ok('existing media never clobbered')

  u = refreshUpdates(faceless, fetched, null)
  assert(u.currentMarketPrice === undefined && u.cardData.images.small === fetched.images.small,
    'no price still heals images (tcgdex miss must not block healing)')
  u = refreshUpdates(faceless, fetched, 0)
  assert(u.currentMarketPrice === 0, '$0 is a valid refreshed price')
  assert(refreshUpdates(pictured, { images: null }, null) === null, 'nothing to persist → null')
  ok('price-less heal, $0 policy, and no-op all correct')

  // ── source invariants for the JP pipeline fixes ──
  const jpSearch = read('src/services/jpSearch.js')
  assert(/padStart\(3, '0'\)\/low\.webp|String\(localId\)\.padStart\(3, '0'\)\}\/low\.webp/.test(jpSearch),
    'jpSearch scan URLs must zero-pad to 3 digits (CDN 404s unpadded paths)')
  ok('jpSearch pads CDN scan paths')

  const api = read('src/services/pokemonApi.js')
  assert(api.includes("padStart(3, '0')") && api.includes('jpScanUrl'), 'pokemonApi scan URLs zero-pad via jpScanUrl')
  assert(api.includes('jpDetailFromIndex'), 'getJapaneseCardDetail must fall back to the jp-index on tcgdex 404 (secret rares)')
  assert(/prefix.*have\.has\(key\)/s.test(api) || api.includes('Append every index card the API left out'),
    'getJapaneseCardsBySet must append index-known secret rares beyond the official count')
  ok('secret rares synthesized from the jp-index for browse + detail')

  const modal = read('src/components/AddItemModal.vue')
  assert(modal.includes('const cardNorm = computed'), 'AddItemModal must normalize flat search card shapes')
  assert(modal.includes('num(props.card.price)'), 'flat top-level price must seed currentPrice')
  ok('AddItemModal tolerates flat JP search shapes')
})
