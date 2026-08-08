import { assert, ok, read, runEval } from './lib.mjs'

// pokemontcg.io 500s for hours (live-observed 2026-08-08); tcgdex too. The
// public dataset (novaoc/rarebox-data, daily snapshots) now backs Browse and
// card lookups when a primary API fails. This pins the shape mapping and the
// wiring — the fallback must return app-shaped cards, not dataset rows.

const FIXTURE = {
  'catalog/pokemon/sets/me2.json': [
    { id: 'me2-13', name: 'Mega Charizard X ex', number: '13',
      set: { id: 'me2', name: 'Phantasmal Flames' }, rarity: 'Double Rare',
      supertype: 'Pokémon', image: 'https://images.pokemontcg.io/me2/13.png', game: 'pokemon' },
  ],
  'catalog/pokemon/sets/x-mep.json': [
    { id: 'x-mep-29', name: 'Mega Charizard X ex', number: '029',
      set: { id: 'x-mep', name: 'ME: Mega Evolution Promo' },
      image: 'https://tcgplayer-cdn.tcgplayer.com/product/680639_200w.jpg', game: 'pokemon' },
  ],
  'catalog/pokemon-ja/sets/SV8.json': [
    { id: 'SV8-136', name: 'Pikachu ex', number: '136',
      set: { id: 'SV8', name: 'Super Electric Breaker' }, _lang: 'ja',
      image: 'https://assets.tcgdex.net/ja/SV/SV8/136/low.webp', game: 'pokemon' },
  ],
  'catalog/pokemon/sets.json': [
    { id: 'me2', name: 'Phantasmal Flames', series: 'Mega Evolution',
      total: 130, printedTotal: 96, releaseDate: '2025/11/14', logo: null },
  ],
}

globalThis.fetch = async (url) => {
  const path = String(url).split('/main/')[1]
  const body = FIXTURE[path]
  return { ok: !!body, status: body ? 200 : 404, json: async () => body }
}

const { dsPokemonSets, dsPokemonSetCards, dsJapaneseSetCards, dsCardById } =
  await import('../../src/services/datasetFallback.js')

await runEval('dataset fallback — app-shaped cards when upstream APIs die', async () => {
  const cards = await dsPokemonSetCards('me2')
  const c = cards[0]
  assert(c.images.small === 'https://images.pokemontcg.io/me2/13.png', 'small image mapped')
  assert(c.images.large === 'https://images.pokemontcg.io/me2/13_hires.png',
    'pokemontcg small URL derives its _hires sibling')
  assert(c.set.id === 'me2' && c.set.name === 'Phantasmal Flames', 'set object preserved')
  assert(c._dataset === true, 'fallback cards are marked')
  ok('EN set cards map to the app shape')

  const x = await dsCardById('x-mep-29')
  assert(x.name === 'Mega Charizard X ex' && x.set.id === 'x-mep',
    'two-dash x- ids resolve via last-dash set prefix')
  assert(x.images.large === x.images.small, 'non-pokemontcg URLs keep one image')
  const jp = await dsCardById('SV8-136', 'ja')
  assert(jp.name === 'Pikachu ex' && jp._lang === 'ja', 'JA lookup routes to the JA catalog')
  await dsCardById('me2-999').then(() => assert(false, 'missing id must throw'), () => {})
  ok('card-by-id: EN, x- extras, and JA all resolve; misses throw')

  const sets = await dsPokemonSets()
  assert(sets[0].images && 'logo' in sets[0].images, 'set rows carry the images.logo shape')
  ok('set list maps to the app shape')

  const api = read('src/services/pokemonApi.js')
  for (const fn of ['dsPokemonSets', 'dsPokemonSetCards', 'dsJapaneseSetCards', 'dsCardById']) {
    assert(api.includes(fn), `pokemonApi must wire ${fn} into a failure path`)
  }
  ok('pokemonApi failure paths wired to the dataset')
})
