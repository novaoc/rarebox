import fs from 'node:fs'
import path from 'node:path'
import { assert, ok, read, root, runEval } from './lib.mjs'

// pokemontcg.io has NO set for several real TCGplayer card groups (verified
// 2026-08-08: /sets/mep 404s; pokemon-tcg-data has no Mega-era promo set),
// so the ME: Mega Evolution Promo cards — incl. the Phantasmal Flames tin
// Mega Charizard X/Y ex — were unsearchable and untrackable. en-extras.json
// supplements the catalog; this eval pins the asset shape and the wiring.

// enExtras.js loads '/en-extras.json' via fetch — serve the real asset.
const asset = JSON.parse(fs.readFileSync(path.join(root, 'public/en-extras.json'), 'utf8'))
globalThis.fetch = async () => ({ ok: true, json: async () => asset })

const { searchEnExtras, extraCardById, isExtraCardId } = await import('../../src/services/enExtras.js')

await runEval('EN extras — TCGplayer-only cards are searchable & trackable', async () => {
  // Asset shape: x- prefixed ids only (never collide with pokemontcg ids)
  assert(Object.keys(asset.sets).every(s => s.startsWith('x-')), 'all extras set ids are x- prefixed')
  assert(asset.sets['x-mep']?.count >= 50, 'ME promo set present with a full card list')
  ok('asset shape: x- namespace, x-mep populated')

  // The reported card: Phantasmal Flames tin Mega Charizard X ex promo #029
  const hits = await searchEnExtras('mega charizard x ex')
  const tin = hits.find(h => h.id === 'x-mep-29')
  assert(tin, 'search finds the MEP tin promo')
  assert(typeof tin.price === 'number' && tin.price > 0, 'tin promo carries a market price')
  assert(/tcgplayer-cdn\.tcgplayer\.com\/product\/\d+_200w\.jpg/.test(tin.image), 'tin promo has a product image')
  assert(tin.set.includes('Mega Evolution Promo'), 'set label names the promo set')
  ok(`search surfaces x-mep-29 (${tin.name}, $${tin.price})`)

  // Refresh path: getCard('x-…') resolves through the supplement
  const card = await extraCardById('x-mep-29')
  assert(card && card.set.id === 'x-mep' && card.images.small, 'extraCardById returns a rich card')
  assert(card.tcgplayer.prices.normal.market === tin.price, 'detail price matches the index')
  assert(await extraCardById('x-mep-99999') === null, 'unknown extras id → null, not a fake card')
  assert(isExtraCardId('x-mep-29') && !isExtraCardId('svp-44'), 'x- namespace detection')
  ok('extras ids resolve for refresh; unknown ids stay unknown')

  // Wiring: getCard branches on x- ids; the search brain runs the extras leg
  const api = read('src/services/pokemonApi.js')
  assert(/\^x-.*extraCardById|extraCardById.*\^x-/s.test(api) || (api.includes("/^x-/") && api.includes('extraCardById')),
    'pokemonApi.getCard must route x- ids to the extras supplement')
  const intel = read('src/utils/searchIntel.js')
  assert(intel.includes('searchEnExtras'), 'searchIntel must run the EN extras leg')
  ok('getCard + search brain wired to the supplement')
})
