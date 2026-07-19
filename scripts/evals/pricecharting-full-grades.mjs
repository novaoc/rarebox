import { assert, ok, runEval } from './lib.mjs'
import { pcGradeForItem } from '../../src/utils/gradedPriceQuery.js'
import { priceForGrade } from '../../src/services/priceServer.js'
import { read } from './lib.mjs'

runEval('PriceCharting grade tokens preserve exact tier', () => {
  const token = (company, grade) => pcGradeForItem({ type: 'graded', gradingCompany: company, grade })
  assert(token('BGS', '9.5') === 'grade9_5', 'BGS 9.5 uses Grade 9.5, not Grade 9/PSA 10')
  assert(token('PSA', '10') === 'psa10', 'PSA 10 token')
  assert(token('BGS', '10') === 'bgs10', 'BGS 10 token')
  assert(token('BGS Black', '10') === 'bgs10_black', 'BGS Black token')
  assert(token('CGC', '10') === 'cgc10', 'CGC 10 token')
  assert(token('CGC Pristine', '10') === 'cgc10_pristine', 'CGC Pristine token')
  assert(token('SGC', '10') === 'sgc10', 'SGC 10 token')
  assert(token('ACE', '10') === 'ace10', 'ACE 10 token')
  assert(token('TAG', '10') === 'tag10', 'TAG 10 token')
  assert(token('Other', '10') === 'unsupported10', 'unknown company must not impersonate PSA 10')
  assert(token('PSA', '8') === 'grade8', 'lower grades use their exact generic guide tier')
  ok('company-specific 10s and exact numeric grades remain distinct')
})

runEval('full grade lookup never substitutes another tier', () => {
  const p = { price1: '$10', price2: '$6000', price3: '$2000' }
  const full = { grade8: 800, grade9: 900, grade9_5: 4400, psa10: 6000, bgs10: 7800, cgc10: 4300 }
  assert(priceForGrade(p, 'grade9_5', full) === 4400, 'BGS 9.5 exact value')
  assert(priceForGrade(p, 'cgc10', full) === 4300, 'CGC 10 exact value')
  assert(priceForGrade(p, 'bgs10', full) === 7800, 'BGS 10 exact value')
  assert(priceForGrade(p, 'grade8', full) === 800, 'Grade 8 exact value')
  assert(priceForGrade(p, 'grade7', full) == null, 'missing Grade 7 stays unavailable')
  assert(priceForGrade(p, 'unsupported10', full) == null, 'unknown company 10 stays unavailable')
  assert(priceForGrade(p, 'grade9_5', null) == null, 'search JSON price3 never substitutes Grade 9.5')
  ok('missing grades remain null; no PSA 10/Grade 9/$0 substitution')
})

runEval('graded submit preserves unknown instead of manufacturing $0', () => {
  const modal = read('src/components/AddItemModal.vue')
  const exactNullSafeWrites = modal.match(/currentValue:\s*num\(form\.value\.currentValue\),/g) || []
  assert(exactNullSafeWrites.length >= 2,
    'both Pokemon and non-Pokemon graded payloads keep missing market value null')
  ok('missing graded data remains unknown; explicit $0 remains valid')
})
