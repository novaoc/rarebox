import { assert, ok, read, runEval } from './lib.mjs'
import { opPriceFor, opVariantSlug, ygoPriceFor, ygoSlug } from '../../src/services/tcg/providers.js'

runEval('provider price normalization semantics', () => {
  assert(opVariantSlug('Monkey.D.Luffy (SPR)') === 'sp', 'One Piece SPR variant should normalize to sp')
  assert(opVariantSlug('Monkey.D.Luffy (061)') === '', 'One Piece collector numbers in parentheses should not become variants')

  const opPrices = {
    'OP01-001|': 12.34,
    'OP01-001|sp': 999.99,
  }
  assert(opPriceFor(opPrices, 'op01-001', 'Monkey.D.Luffy', 1) === 12.34, 'One Piece base printing should use base price-map key')
  assert(opPriceFor(opPrices, 'op01-001', 'Monkey.D.Luffy (SPR)', 1) === 999.99, 'One Piece variant should use variant-specific price-map key')
  assert(opPriceFor({}, 'OP99-999', 'Unknown', 7.5) === 7.5, 'One Piece should fall back when no TCGplayer price exists')

  assert(ygoSlug('Legend of Blue Eyes White Dragon') === 'legend-of-blue-eyes-white-dragon', 'YGO set names should slug predictably')
  const ygoPrices = {
    'legend-of-blue-eyes-white-dragon|LOB-001': 25,
    'legend-of-blue-eyes-white-dragon|LOB-001|ultra-rare': 125,
  }
  assert(ygoPriceFor(ygoPrices, 'Legend of Blue Eyes White Dragon', 'lob-001', 'Ultra Rare', 1) === 125, 'YGO exact rarity price should beat code fallback')
  assert(ygoPriceFor(ygoPrices, 'Legend of Blue Eyes White Dragon', 'lob-001', 'Secret Rare', 1) === 25, 'YGO code-level price should beat raw fallback')
  assert(ygoPriceFor({}, 'Unknown', 'UNK-001', 'Rare', 3.21) === 3.21, 'YGO should fall back when no static price exists')

  const providers = read('src/services/tcg/providers.js')
  assert(/card\.price\s*=\s*priceMap\.variants\[card\.number\]\?\.\[variant\]\s*\?\?\s*null/.test(providers),
    'Riftbound variant fallback must not inherit plain-card prices')
  assert(/card\.price\s*=\s*priceMap\.normal\[card\.number\]/.test(providers),
    'Riftbound plain cards should still use normal price-map entries')

  ok('OP/YGO fixture prices prefer exact variants and Riftbound source keeps no-inherit variant guard')
})
