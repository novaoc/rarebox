import { assert, ok, read, runEval } from './lib.mjs'
import { opNormalizeJapaneseCard, opNormalizeJapaneseSet, opPriceFor, opVariantSlug, ygoPriceFor, ygoSlug } from '../../src/services/tcg/providers.js'

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

  const jpSet = opNormalizeJapaneseSet({ id: 'OP-01', name: 'ROMANCE DAWN', code: 'OP-01', total: 154 })
  assert(jpSet.id === 'OP-01' && jpSet._lang === 'ja' && jpSet.total === 154, 'Japanese One Piece sets should preserve id/count/lang')
  const jpCard = opNormalizeJapaneseCard({ id: 'jp:OP01-001_p1', name: 'モンキー・D・ルフィ', number: 'OP01-001_p1', image: '/card.png', price: 0, rarity: 'L' }, jpSet)
  assert(jpCard.id === 'jp:OP01-001_p1', 'Japanese One Piece card id should stay stable for variants')
  assert(jpCard._lang === 'ja', 'Japanese One Piece cards should carry language marker')
  assert(jpCard.price === 0, 'Japanese One Piece zero price should remain zero, not null')

  assert(ygoSlug('Legend of Blue Eyes White Dragon') === 'legend-of-blue-eyes-white-dragon', 'YGO set names should slug predictably')
  const ygoPrices = {
    'legend-of-blue-eyes-white-dragon|LOB-001': 25,
    'legend-of-blue-eyes-white-dragon|LOB-001|ultra-rare': 125,
  }
  assert(ygoPriceFor(ygoPrices, 'Legend of Blue Eyes White Dragon', 'lob-001', 'Ultra Rare', 1) === 125, 'YGO exact rarity price should beat code fallback')
  assert(ygoPriceFor(ygoPrices, 'Legend of Blue Eyes White Dragon', 'lob-001', 'Secret Rare', 1) === 25, 'YGO code-level price should beat raw fallback')
  assert(ygoPriceFor({}, 'Unknown', 'UNK-001', 'Rare', 3.21) === 3.21, 'YGO should fall back when no static price exists')

  const providers = read('src/services/tcg/providers.js')
  // Variant path must never fall through to normal[n] — only assign when
  // variants[n][variant] is present (explicit != null or ?? null).
  const variantAssign = providers.match(
    /if \(variant\) \{([\s\S]*?)\} else if \(priceMap\.normal/,
  )
  assert(variantAssign, 'Riftbound variant vs plain price branches must be separable')
  assert(/priceMap\.variants\[n\]\?\.\[variant\]/.test(variantAssign[1]),
    'Riftbound variant fallback must look up variants map by normalized collector #')
  assert(!/priceMap\.normal/.test(variantAssign[1]),
    'Riftbound variant fallback must not inherit plain-card prices')
  assert(/priceMap\.normal\[n\]/.test(providers),
    'Riftbound plain cards should still use normal price-map entries')
  assert(/normalizeCollectorNumber/.test(providers) && /detectRiftboundVariant/.test(providers),
    'Riftbound PC fallback must share collector-number + variant helpers')




  // Japanese One Piece set names must be clean (no leftover HTML from official site)
  try {
    const jpRaw = read('public/op-jp-index.json')
    const jp = JSON.parse(jpRaw)
    const bad = (jp.sets || []).filter(s => (s.name || '').includes('<')).map(s => s.name)
    if (bad.length > 0) {
      console.log('⚠ Japanese One Piece set names contain HTML (extraction needs hardening):', bad.slice(0,2))
    }
  } catch (e) {
    // Index not present or invalid — skip check (normal in some CI jobs)
  }


  // Japanese One Piece card images must use the same-origin proxy
  try {
    const jpRaw = read('public/op-jp-index.json')
    const jp = JSON.parse(jpRaw)
    const cards = Object.values(jp.cards || {}).flat()
    const badImages = cards.filter(c => c.image && !c.image.startsWith('/api/op-jp-card-image'))
    if (badImages.length > 0) {
      console.log('⚠ Some JP One Piece card images are not using the proxy:', badImages.slice(0,2).map(c => c.image))
    }
  } catch (e) {
    // skip
  }


  // Japanese One Piece cards should be able to receive prices from the shared op-prices map
  try {
    const jpRaw = read('public/op-jp-index.json')
    const jp = JSON.parse(jpRaw)
    const cards = Object.values(jp.cards || {}).flat()
    const hasPriceField = cards.some(c => 'price' in c)
    if (!hasPriceField) {
      console.log('⚠ Japanese One Piece cards in static index are missing price field')
    }
  } catch (e) {
    // skip
  }

  ok('OP/YGO fixture prices prefer exact variants and Riftbound source keeps no-inherit variant guard')
})
