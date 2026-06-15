import { assert, ok, read, runEval } from './lib.mjs'
import { normalizeSealedProducts, isSealedProductName } from '../../src/services/tcg/multiSearch.js'

runEval('sealed PriceCharting filtering', () => {
  const fixture = JSON.parse(read('scripts/evals/fixtures/sealed-pricecharting-products.json'))
  const cards = normalizeSealedProducts(fixture.products)
  const ids = cards.map(c => c.id)

  assert(ids.includes('sealed-booster-box'), 'Booster boxes should pass sealed filtering')
  assert(ids.includes('sealed-case'), 'Cases should pass sealed filtering')
  assert(!ids.includes('single-card-number'), 'Single cards with #number must be filtered out')
  assert(!ids.includes('single-ygo-code'), 'Single cards with set-code-number patterns must be filtered out')
  assert(!ids.includes('accessory-binder'), 'Accessories/binders must be filtered out')
  assert(!ids.includes('fractional-collector-number'), 'Single cards with collector fractions must be filtered out')

  for (const card of cards) {
    assert(card.game === 'sealed', 'Normalized sealed result should use game=sealed', JSON.stringify(card))
    assert(card.number === '', 'Normalized sealed result should not expose card numbers', JSON.stringify(card))
    assert(typeof card.price === 'number' && card.price >= 0, 'Normalized sealed price should parse as a non-negative number', JSON.stringify(card))
  }

  assert(isSealedProductName('Elite Trainer Box Pokemon') === true, 'ETB names should count as sealed')
  assert(isSealedProductName('Charizard ex #125 Pokemon') === false, 'Plain card names should not count as sealed')

  ok(`sealed fixture kept ${cards.length} real sealed products and rejected ${fixture.products.length - cards.length} non-sealed results`)
})
