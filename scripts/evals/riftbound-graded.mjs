/**
 * Riftbound graded-card tracking harness.
 * Static source + pure-helper checks — no network.
 */
import { assert, ok, read, runEval } from './lib.mjs'
import {
  buildGradedPcQuery,
  pcGradeForItem,
  isFiniteGradedPrice,
  pickRiftboundPcCandidate,
  detectRiftboundVariant,
  riftboundGradedMissingNumber,
  riftboundGradedFetchGuard,
  RIFTBOUND_GRADED_NO_NUMBER_MSG,
  isSafeRiftboundGradedMatch,
  normalizeCollectorNumber,
} from '../../src/utils/gradedPriceQuery.js'
import {
  riftVariantFromName,
  canonicalRiftboundGradedName,
  findSafeRiftboundGradedMatch,
} from '../../src/utils/riftboundVariant.js'
import { resolveNonPokemonSubmitType } from '../../src/utils/addItemSubmitType.js'

runEval('graded PC query keeps Riftbound identity + variant text', () => {
  const plain = buildGradedPcQuery({
    game: 'riftbound',
    name: 'Ahri',
    setName: 'Origin',
    number: '001',
  })
  assert(plain.includes('Riftbound'), 'query must include Riftbound game token', plain)
  assert(plain.includes('Origin'), 'query must include set name', plain)
  assert(plain.includes('Ahri'), 'query must include card name', plain)
  assert(/#0*1\b|#001\b/.test(plain) || plain.includes('#001') || plain.includes('#1'),
    'query must include collector number', plain)

  const sig = buildGradedPcQuery({
    game: 'riftbound',
    name: 'Ahri (Signature)',
    setName: 'Origin',
    number: '299',
  })
  assert(sig.toLowerCase().includes('signature'),
    'Signature text must stay in the query — never silently match plain', sig)
  assert(sig.includes('#299'), 'variant query must keep collector number', sig)

  const fromCardData = buildGradedPcQuery({
    game: 'riftbound',
    cardData: {
      name: 'Jinx (Alternate Art)',
      number: '42',
      set: { name: 'Spiritforged' },
    },
  })
  assert(fromCardData.includes('Riftbound') && fromCardData.includes('Spiritforged'),
    'cardData shape must build a full Riftbound query', fromCardData)
  assert(fromCardData.toLowerCase().includes('alternate art'),
    'alternate-art identity must remain in query', fromCardData)

  assert(pcGradeForItem({ type: 'graded', gradingCompany: 'PSA', grade: '10' }) === 'psa10',
    'PSA 10 grade token')
  assert(pcGradeForItem({ type: 'graded', gradingCompany: 'BGS', grade: '9.5' }) === 'grade9_5',
    'BGS 9.5 grade token')
  assert(pcGradeForItem({ type: 'card' }) === 'ungraded', 'non-graded is ungraded')

  assert(isFiniteGradedPrice({ price: 0 }) === true, '$0 graded price is valid')
  assert(isFiniteGradedPrice({ price: 12.5 }) === true, 'finite graded price is valid')
  assert(isFiniteGradedPrice({ price: null }) === false, 'null graded price is invalid')
  assert(isFiniteGradedPrice(null) === false, 'null result is invalid')

  ok('Riftbound graded queries preserve set/name/number/variant identity')
})

runEval('strict Riftbound PC candidate validation (variant + number)', () => {
  // Shared alias source: providers and graded path must not diverge
  assert(riftVariantFromName('Ahri (Signature)') === 'signature', 'parens Signature')
  assert(riftVariantFromName('Ahri (Overnumbered)') === '', 'Overnumbered is plain')
  assert(detectRiftboundVariant('Ahri [Signature] #303') === 'signature', 'PC bracket Signature')
  assert(detectRiftboundVariant('Ahri [Alternate Art] #42') === 'alternate art', 'PC bracket alt art')
  assert(detectRiftboundVariant('Ahri - Loose Cannon #301') === '', 'plain has no variant')
  assert(normalizeCollectorNumber('0299') === '299', 'leading zeros normalize')
  assert(normalizeCollectorNumber('#001') === '1', '# prefix + zeros')
  assert(normalizeCollectorNumber('299/350') === '299', 'slash form keeps first segment only')
  assert(normalizeCollectorNumber('0299/350') === '299', 'slash + leading zeros')
  assert(normalizeCollectorNumber('299/350') !== '299350', 'must not concatenate slash digits')

  const plain = { productName: 'Ahri #001', consoleName: 'Riftbound Origin', price2: '$50' }
  const sig = { productName: 'Ahri [Signature] #299', consoleName: 'Riftbound Origin', price2: '$600' }
  const sigWrongNum = { productName: 'Ahri [Signature] #303', consoleName: 'Riftbound Origin', price2: '$900' }
  const alt = { productName: 'Jinx [Alternate Art] #42', consoleName: 'Riftbound Spiritforged', price2: '$120' }

  // Signature query rejects plain candidate
  const sigQ = 'Riftbound Origin Ahri (Signature) #299'
  const sigVsPlain = pickRiftboundPcCandidate(sigQ, [plain, sigWrongNum])
  assert(!sigVsPlain.ok, 'Signature query must reject plain-only pool', JSON.stringify(sigVsPlain))

  // Plain rejects Signature
  const plainQ = 'Riftbound Origin Ahri #001'
  const plainVsSig = pickRiftboundPcCandidate(plainQ, [sig, plain])
  assert(plainVsSig.ok && plainVsSig.product === plain,
    'plain query must pick plain, not Signature', JSON.stringify(plainVsSig))
  const plainOnlySig = pickRiftboundPcCandidate(plainQ, [sig])
  assert(!plainOnlySig.ok, 'plain query must reject Signature-only pool')

  // Exact Signature + number succeeds
  const sigHit = pickRiftboundPcCandidate(sigQ, [plain, sig, sigWrongNum, alt])
  assert(sigHit.ok && sigHit.product === sig,
    'exact Signature+#299 must win', JSON.stringify(sigHit))

  // Number mismatch rejected
  const numMismatch = pickRiftboundPcCandidate(
    'Riftbound Origin Ahri (Signature) #299',
    [sigWrongNum, plain],
  )
  assert(!numMismatch.ok, 'Signature with wrong collector # must be rejected')

  // Bracket/paren normalization: query uses parens, candidate uses brackets
  const crossPunct = pickRiftboundPcCandidate(
    'Riftbound Origin Ahri (Signature) #299',
    [{ productName: 'Ahri [Signature] #299', consoleName: 'Riftbound Origin' }],
  )
  assert(crossPunct.ok, 'parens query must match bracket PC product')

  // Never fall back to unfiltered first result when nothing is compatible
  const garbage = pickRiftboundPcCandidate(sigQ, [
    { productName: 'Random Sealed Box', consoleName: 'Riftbound Origin' },
    plain,
  ])
  assert(!garbage.ok && garbage.reason === 'no_results',
    'incompatible pool must fail no_results, not first product')

  ok('Signature/plain/number strict candidate rules hold')
})

runEval('Riftbound graded PC pick requires set + base name (not only #/variant)', () => {
  // Exact user repro: same collector #, wrong name + wrong set must not accept.
  const repro = pickRiftboundPcCandidate('Riftbound Origin Ahri #001', [
    { productName: 'Teemo #001', consoleName: 'Riftbound Spiritforged' },
  ])
  assert(!repro.ok && repro.reason === 'no_results',
    'repro: Origin Ahri #001 must reject Spiritforged Teemo #001', JSON.stringify(repro))

  // Same set, wrong name, same number
  const wrongName = pickRiftboundPcCandidate('Riftbound Origin Ahri #001', [
    { productName: 'Teemo #001', consoleName: 'Riftbound Origin' },
  ])
  assert(!wrongName.ok, 'same set + same # + wrong name must reject')

  // Correct set/name/number accepts
  const ahri = { productName: 'Ahri #001', consoleName: 'Riftbound Origin', price2: '$50' }
  const hit = pickRiftboundPcCandidate('Riftbound Origin Ahri #001', [
    { productName: 'Teemo #001', consoleName: 'Riftbound Spiritforged' },
    ahri,
  ])
  assert(hit.ok && hit.product === ahri, 'correct set/name/number must accept', JSON.stringify(hit))

  // Origin ↔ Origins plural drift on console
  const originsConsole = pickRiftboundPcCandidate('Riftbound Origin Ahri #001', [
    { productName: 'Ahri #001', consoleName: 'Riftbound Origins' },
  ])
  assert(originsConsole.ok, 'Origin query must accept Origins console')

  // Correct name, wrong set, same number
  const wrongSet = pickRiftboundPcCandidate('Riftbound Origin Ahri #001', [
    { productName: 'Ahri #001', consoleName: 'Riftbound Spiritforged' },
  ])
  assert(!wrongSet.ok, 'correct name + wrong set must reject')

  // Missing console on graded candidate → reject
  const noConsole = pickRiftboundPcCandidate('Riftbound Origin Ahri #001', [
    { productName: 'Ahri #001' },
  ])
  assert(!noConsole.ok, 'missing consoleName must reject for graded pick')

  // Subtitle / punctuation form: selected short name vs PC subtitle
  const subtitle = pickRiftboundPcCandidate('Riftbound Origin Ahri #001', [
    { productName: 'Ahri - Loose Cannon #001', consoleName: 'Riftbound Origin' },
  ])
  assert(subtitle.ok, 'PC subtitle form must match short selected name', JSON.stringify(subtitle))

  const punct = pickRiftboundPcCandidate("Riftbound Origin Kai'Sa #010", [
    { productName: 'KaiSa #010', consoleName: 'Riftbound Origin' },
  ])
  assert(punct.ok, 'apostrophe/punctuation forms must be compatible', JSON.stringify(punct))

  // #number / set / variant tokens alone must not accept unrelated product
  const tokenOnly = pickRiftboundPcCandidate('Riftbound Origin Ahri (Signature) #299', [
    { productName: 'Teemo [Signature] #299', consoleName: 'Riftbound Origin' },
  ])
  assert(!tokenOnly.ok, 'shared # + variant + set without name must reject')

  // Unconditional qNum path gone: number match with zero name evidence fails
  const numOnlyPool = pickRiftboundPcCandidate('Riftbound Origin Ahri #001', [
    { productName: '#001', consoleName: 'Riftbound Origin' },
  ])
  assert(!numOnlyPool.ok, 'collector # alone must not accept')

  // Promo alias console vs query set label
  const promoHit = pickRiftboundPcCandidate('Riftbound Promo Ahri #001', [
    { productName: 'Ahri #001', consoleName: 'Riftbound Promo' },
  ])
  assert(promoHit.ok, 'Riftbound Promo query/console must match')

  const promoAlias = pickRiftboundPcCandidate(
    'Riftbound Riftbound Promotional Cards Ahri #001',
    [{ productName: 'Ahri #001', consoleName: 'Riftbound Promo' }],
  )
  assert(promoAlias.ok, 'Promotional Cards query must alias to Riftbound Promo console')

  ok('set + base-name graded PC identity rules hold')
})

runEval('no-number Riftbound graded auto-fetch is rejected', () => {
  assert(riftboundGradedMissingNumber('riftbound', '', 'Riftbound Origin Ahri (Signature)') === true,
    'missing number detected')
  assert(riftboundGradedMissingNumber('riftbound', '299', '') === false,
    'field number is enough')
  assert(riftboundGradedMissingNumber('riftbound', '', 'Riftbound Origin Ahri #299') === false,
    'query #number is enough')
  assert(riftboundGradedMissingNumber('pokemon', '', 'Charizard') === false,
    'non-Riftbound not blocked by this guard')

  const blocked = riftboundGradedFetchGuard(
    { game: 'riftbound', name: 'Ahri (Signature)', setName: 'Origin' },
    'Riftbound Origin Ahri (Signature)',
  )
  assert(!blocked.ok, 'guard rejects no-number Riftbound graded fetch')
  assert(String(blocked.message || '').includes('collector number') ||
    blocked.message === RIFTBOUND_GRADED_NO_NUMBER_MSG,
    'guard message asks for collector number or search/browse', blocked.message)

  const allowed = riftboundGradedFetchGuard(
    { game: 'riftbound', name: 'Ahri (Signature)', number: '299' },
    '',
  )
  assert(allowed.ok, 'guard allows fetch when number present')

  const priceServer = read('src/services/priceServer.js')
  assert(/pickRiftboundPcCandidate/.test(priceServer),
    'priceServer must use strict Riftbound candidate picker for graded')
  assert(/isRiftbound && isGraded/.test(priceServer) ||
    /isRiftbound &&[\s\S]{0,40}isGraded/.test(priceServer),
    'strict path must be gated to Riftbound graded only')
  assert(/extractCollectorNumber\(q\)/.test(priceServer),
    'graded Riftbound path must require collector # in query')

  const add = read('src/components/AddItemModal.vue')
  assert(/riftboundGradedFetchGuard|RIFTBOUND_GRADED_NO_NUMBER_MSG|riftboundGradedBlockReason/.test(add),
    'AddItemModal must block no-number Riftbound graded fetch')
  assert(/collector number|Collector #/i.test(add),
    'AddItemModal must surface collector number for manual graded entry')

  ok('no-number Riftbound graded auto-fetch rejected with clear copy')
})

runEval('imported Signature identity and value retained on resolve', () => {
  const item = {
    type: 'graded',
    game: 'riftbound',
    currentValue: 85.5,
    cardData: {
      name: 'Ahri (Signature)',
      number: '299',
      set: { name: 'Origin' },
    },
  }
  const plainMatch = { id: 'x', name: 'Ahri', number: '001', set: 'Origin', price: 12 }
  const sigWrongNum = {
    id: 'rift-ahri-sig-303',
    name: 'Ahri (Signature)',
    number: '303',
    set: 'Origin',
    price: 99,
  }
  const sigMatch = {
    id: 'rift-ahri-sig-299',
    name: 'Ahri (Signature)',
    number: '299',
    set: 'Origin',
    image: 'https://example.invalid/ahri.png',
    rarity: 'Signature',
    price: 12, // raw — must never become currentValue
  }

  assert(!isSafeRiftboundGradedMatch(item, plainMatch, 'riftbound'),
    'plain multiSearch hit is unsafe for imported Signature')
  assert(isSafeRiftboundGradedMatch(item, sigMatch, 'riftbound'),
    'exact Signature+number hit is safe')
  assert(!isSafeRiftboundGradedMatch(item, sigWrongNum, 'riftbound'),
    'Signature with wrong number is unsafe')

  // Candidate scan: first fuzzy plain must not win; exact later candidate does.
  const scanned = findSafeRiftboundGradedMatch(item, [plainMatch, sigWrongNum, sigMatch], 'riftbound')
  assert(scanned === sigMatch, 'scan must pick first safe exact variant+number, not fuzzy first')

  // No-number import: refuse auto-attach
  const noNum = {
    type: 'graded',
    game: 'riftbound',
    cardData: { name: 'Ahri (Signature)', number: '', set: { name: 'Origin' } },
  }
  assert(!isSafeRiftboundGradedMatch(noNum, sigMatch, 'riftbound'),
    'import without collector # must not auto-attach Riftbound identity')
  assert(findSafeRiftboundGradedMatch(noNum, [sigMatch, plainMatch], 'riftbound') == null,
    'scan returns null when import has no number')

  // Slash number on import matches unpadded candidate
  const slashItem = {
    type: 'graded',
    game: 'riftbound',
    cardData: { name: 'Ahri (Signature)', number: '299/350', set: { name: 'Origin' } },
  }
  assert(isSafeRiftboundGradedMatch(slashItem, sigMatch, 'riftbound'),
    '299/350 import must safely match #299 Signature candidate')

  // Set + base-name hardening (not only number+variant)
  const crossSetSameNum = {
    id: 'rift-ahri-sf',
    name: 'Ahri (Signature)',
    number: '299',
    set: 'Spiritforged',
    price: 12,
  }
  assert(!isSafeRiftboundGradedMatch(item, crossSetSameNum, 'riftbound'),
    'import safe matcher must reject cross-set same-number')

  const wrongNameSameNum = {
    id: 'rift-teemo-299',
    name: 'Teemo (Signature)',
    number: '299',
    set: 'Origin',
    price: 12,
  }
  assert(!isSafeRiftboundGradedMatch(item, wrongNameSameNum, 'riftbound'),
    'import safe matcher must reject wrong-name same-number')

  // Object vs string set shapes still match when compatible
  const objSetItem = {
    type: 'graded',
    game: 'riftbound',
    cardData: {
      name: 'Ahri (Signature)',
      number: '299',
      set: { name: 'Origins' },
    },
  }
  const stringSetMatch = {
    id: 'rift-ahri-sig-299-b',
    name: 'Ahri (Signature)',
    number: '299',
    set: 'Origin',
  }
  assert(isSafeRiftboundGradedMatch(objSetItem, stringSetMatch, 'riftbound'),
    'object/string set shapes + Origin/Origins must be safe when identity matches')

  assert(
    findSafeRiftboundGradedMatch(
      item,
      [plainMatch, crossSetSameNum, wrongNameSameNum, sigWrongNum, sigMatch],
      'riftbound',
    ) === sigMatch,
    'scan must skip cross-set/wrong-name and land on exact identity',
  )

  // Blank import set: fail-closed — do not auto-attach (would stamp wrong set).
  const blankSetImport = {
    type: 'graded',
    game: 'riftbound',
    currentValue: 40,
    cardData: {
      name: 'Ahri (Signature)',
      number: '299',
      set: { name: '' },
    },
  }
  assert(!isSafeRiftboundGradedMatch(blankSetImport, sigMatch, 'riftbound'),
    'blank import set must reject otherwise same name/number/variant candidate')
  assert(
    findSafeRiftboundGradedMatch(blankSetImport, [sigMatch, plainMatch], 'riftbound') == null,
    'blank-set import scan must retain manual identity (no auto-attach)',
  )
  const blankSetMissingField = {
    type: 'graded',
    game: 'riftbound',
    cardData: { name: 'Ahri (Signature)', number: '299' },
  }
  assert(!isSafeRiftboundGradedMatch(blankSetMissingField, sigMatch, 'riftbound'),
    'missing import set field must reject auto-attach')

  // Import set present, candidate set missing → reject
  const noSetCandidate = {
    id: 'rift-ahri-noset',
    name: 'Ahri (Signature)',
    number: '299',
    price: 12,
  }
  assert(!isSafeRiftboundGradedMatch(item, noSetCandidate, 'riftbound'),
    'import set present but candidate set missing must reject')
  assert(
    findSafeRiftboundGradedMatch(item, [noSetCandidate, plainMatch], 'riftbound') == null,
    'scan must not attach when only blank-set candidates remain',
  )

  // Multiword card name correct match
  const missFortuneItem = {
    type: 'graded',
    game: 'riftbound',
    cardData: {
      name: 'Miss Fortune',
      number: '42',
      set: { name: 'Origin' },
    },
  }
  const missFortuneMatch = {
    id: 'rift-mf-42',
    name: 'Miss Fortune',
    number: '42',
    set: 'Origin',
  }
  const missFortuneWrong = {
    id: 'rift-mf-wrong',
    name: 'Miss Fortune',
    number: '42',
    set: 'Spiritforged',
  }
  assert(isSafeRiftboundGradedMatch(missFortuneItem, missFortuneMatch, 'riftbound'),
    'multiword Miss Fortune must match same set/number')
  assert(!isSafeRiftboundGradedMatch(missFortuneItem, missFortuneWrong, 'riftbound'),
    'multiword Miss Fortune must reject cross-set same number')

  // Subtitle compatibility both directions (import short ↔ candidate subtitle)
  const subtitleCand = {
    id: 'rift-ahri-sub',
    name: 'Ahri - Loose Cannon',
    number: '001',
    set: 'Origin',
  }
  const shortAhriItem = {
    type: 'graded',
    game: 'riftbound',
    cardData: { name: 'Ahri', number: '001', set: { name: 'Origin' } },
  }
  assert(isSafeRiftboundGradedMatch(shortAhriItem, subtitleCand, 'riftbound'),
    'short import name must accept subtitle candidate')
  const subtitleItem = {
    type: 'graded',
    game: 'riftbound',
    cardData: { name: 'Ahri - Loose Cannon', number: '001', set: { name: 'Origin' } },
  }
  const shortCand = { id: 'rift-ahri-short', name: 'Ahri', number: '001', set: 'Origin' }
  assert(isSafeRiftboundGradedMatch(subtitleItem, shortCand, 'riftbound'),
    'subtitle import name must accept short candidate')

  // Promo alias compatibility both directions (Promo ↔ Promotional Cards)
  const promoItem = {
    type: 'graded',
    game: 'riftbound',
    cardData: {
      name: 'Ahri',
      number: '001',
      set: { name: 'Promo' },
    },
  }
  const promoLongCand = {
    id: 'rift-promo-long',
    name: 'Ahri',
    number: '001',
    set: 'Riftbound Promotional Cards',
  }
  assert(isSafeRiftboundGradedMatch(promoItem, promoLongCand, 'riftbound'),
    'Promo import must accept Promotional Cards candidate')
  const promoLongItem = {
    type: 'graded',
    game: 'riftbound',
    cardData: {
      name: 'Ahri',
      number: '001',
      set: { name: 'Riftbound Promotional Cards' },
    },
  }
  const promoShortCand = { id: 'rift-promo-short', name: 'Ahri', number: '001', set: 'Promo' }
  assert(isSafeRiftboundGradedMatch(promoLongItem, promoShortCand, 'riftbound'),
    'Promotional Cards import must accept Promo candidate')

  // Collectr Variance/Rarity → canonical graded name
  assert(canonicalRiftboundGradedName('Ahri', 'Signature', '') === 'Ahri (Signature)',
    'Variance Signature folds into graded name')
  assert(canonicalRiftboundGradedName('Ahri', '', 'Signature') === 'Ahri (Signature)',
    'Rarity Signature folds into graded name')
  assert(canonicalRiftboundGradedName('Ahri (Signature)', 'Normal', '') === 'Ahri (Signature)',
    'existing Signature name is not double-wrapped')
  assert(canonicalRiftboundGradedName('Jinx', 'Alternate Art', '') === 'Jinx (Alternate Art)',
    'alt-art variance folds into graded name')

  const store = read('src/stores/portfolio.js')
  assert(/findSafeRiftboundGradedMatch/.test(store),
    'resolveImportedItems must scan candidates via findSafeRiftboundGradedMatch')
  assert(/Never overwrite[\s\S]{0,80}currentValue|currentValue with raw/i.test(store) ||
    /Graded slabs: resolve identity/.test(store),
    'resolve must document no currentValue overwrite from raw')
  // Graded branch must preserve prev.name / not assign match.name unconditionally
  assert(/prev\.name \|\| match\.name|name: prev\.name/.test(store),
    'graded resolve must preserve existing name over match.name')
  assert(/prev\.number \|\| match\.number|number: prev\.number/.test(store),
    'graded resolve must preserve existing collector number')
  // Extract graded resolve branch only (before the raw `} else {`)
  const gradedResolve = store.match(
    /if \(item\.type === 'graded'\) \{([\s\S]*?)\n\s*\} else \{\n\s*const match = scoreMatch/,
  )
  assert(gradedResolve, 'graded resolve branch must be separable from raw else')
  const gradedBody = gradedResolve[1]
  assert(!/currentMarketPrice/.test(gradedBody),
    'graded resolve must not set currentMarketPrice')
  assert(!/currentValue/.test(gradedBody),
    'graded resolve must not touch currentValue (retain imported)')
  assert(!/match\.price/.test(gradedBody),
    'graded resolve must not read match.price')
  // Blank-set attach would stamp match.set via prev.set?.name || match.set
  assert(/name:\s*prev\.set\?\.name \|\| match\.set/.test(gradedBody),
    'graded resolve stamps set from match when prev set blank — matcher must block that path')

  // Collectr import source guards
  const collectr = read('src/utils/collectrImport.js')
  assert(/canonicalRiftboundGradedName/.test(collectr),
    'Collectr import must fold Variance/Rarity into Riftbound graded name')
  assert(/normalizeCollectorNumber/.test(collectr),
    'Collectr import must normalize collector numbers')
  assert(/parseOptionalPrice/.test(collectr),
    'Collectr import must parse market prices with $0-preserving helper')
  assert(!/currentValue = marketPrice \|\| null/.test(collectr),
    'Collectr graded currentValue must not collapse $0 via || null')

  ok('imported Signature identity/value retention guards hold')
})

runEval('Riftbound graded fail-closed set + ambiguous PC survivors', () => {
  // PC query with missing set fails closed (manual behavior)
  const noSetQ = pickRiftboundPcCandidate('Riftbound Ahri #001', [
    { productName: 'Ahri #001', consoleName: 'Riftbound Origin' },
  ])
  assert(!noSetQ.ok && noSetQ.reason === 'no_results',
    'PC query missing set must fail closed explicitly', JSON.stringify(noSetQ))

  const bareNameQ = pickRiftboundPcCandidate('Riftbound Ahri (Signature) #299', [
    { productName: 'Ahri [Signature] #299', consoleName: 'Riftbound Origin' },
  ])
  assert(!bareNameQ.ok, 'PC query without set token must not auto-pick')

  // Ambiguous survivors with different incompatible bases → reject
  const ambig = pickRiftboundPcCandidate('Riftbound Origin Ahri #001', [
    { productName: 'Ahri Loose Cannon #001', consoleName: 'Riftbound Origin' },
    { productName: 'Ahri Nine-Tailed Fox #001', consoleName: 'Riftbound Origin' },
  ])
  assert(!ambig.ok && ambig.reason === 'no_results',
    'equal-score incompatible base survivors must reject', JSON.stringify(ambig))

  // Multiword PC pick
  const mf = pickRiftboundPcCandidate('Riftbound Origin Miss Fortune #42', [
    { productName: 'Miss Fortune #42', consoleName: 'Riftbound Origin' },
    { productName: 'Teemo #42', consoleName: 'Riftbound Origin' },
  ])
  assert(mf.ok && mf.product.productName === 'Miss Fortune #42',
    'multiword Miss Fortune PC pick must win', JSON.stringify(mf))

  // Subtitle both directions on PC path
  const subPc = pickRiftboundPcCandidate('Riftbound Origin Ahri #001', [
    { productName: 'Ahri - Loose Cannon #001', consoleName: 'Riftbound Origin' },
  ])
  assert(subPc.ok, 'PC short→subtitle must accept')
  const subPcRev = pickRiftboundPcCandidate('Riftbound Origin Ahri Loose Cannon #001', [
    { productName: 'Ahri #001', consoleName: 'Riftbound Origin' },
  ])
  assert(subPcRev.ok, 'PC subtitle→short must accept')

  // Promo alias both directions on PC path
  const promoPc = pickRiftboundPcCandidate('Riftbound Promo Ahri #001', [
    { productName: 'Ahri #001', consoleName: 'Riftbound Promo' },
  ])
  assert(promoPc.ok, 'Promo query/console must match')
  const promoPcAlias = pickRiftboundPcCandidate(
    'Riftbound Riftbound Promotional Cards Ahri #001',
    [{ productName: 'Ahri #001', consoleName: 'Riftbound Promo' }],
  )
  assert(promoPcAlias.ok, 'Promotional Cards query must alias to Promo console')
  const promoPcRev = pickRiftboundPcCandidate('Riftbound Promo Ahri #001', [
    { productName: 'Ahri #001', consoleName: 'Riftbound Promotional Cards' },
  ])
  assert(promoPcRev.ok, 'Promo query must accept Promotional Cards console')

  // Candidate missing console still rejected when query has set
  const missConsole = pickRiftboundPcCandidate('Riftbound Origin Ahri #001', [
    { productName: 'Ahri #001', set: '' },
  ])
  assert(!missConsole.ok, 'PC candidate with blank set must reject')

  ok('fail-closed set + ambiguous PC survivor rules hold')
})

runEval('sealed→graded mode race: submit precedence + clear on switch', () => {
  // Executable truth table (production helper) — reproduces the race:
  // user picks sealed (selectedIsSealed=true) then switches to graded tab.
  assert(resolveNonPokemonSubmitType('graded', true) === 'graded',
    'stale selectedIsSealed must not win over explicit graded')
  assert(resolveNonPokemonSubmitType('graded', false) === 'graded',
    'graded with no sealed flag stays graded')
  assert(resolveNonPokemonSubmitType('sealed', false) === 'sealed',
    'sealed tab without flag still saves sealed (manual entry)')
  assert(resolveNonPokemonSubmitType('sealed', true) === 'sealed',
    'sealed tab with selection stays sealed')
  assert(resolveNonPokemonSubmitType('card', true) === 'sealed',
    'card tab + sealed product selection still saves sealed')
  assert(resolveNonPokemonSubmitType('card', false) === 'card',
    'card tab + single selection stays card')

  // Riftbound slab after sealed pick must never resolve sealed
  assert(resolveNonPokemonSubmitType('graded', true) !== 'sealed',
    'Riftbound/non-Pokémon slab after sealed pick must not be sealed')

  const add = read('src/components/AddItemModal.vue')
  const helper = read('src/utils/addItemSubmitType.js')

  assert(/export function resolveNonPokemonSubmitType/.test(helper),
    'submit-type helper must be exported for eval + modal use')
  assert(/itemType === 'graded'/.test(helper) &&
    /itemType === 'sealed' \|\| selectedIsSealed/.test(helper),
    'helper must check graded before sealed/selectedIsSealed')
  // graded branch must appear before sealed branch in helper source order
  const gradedIdx = helper.indexOf("itemType === 'graded'")
  const sealedIdx = helper.indexOf("itemType === 'sealed' || selectedIsSealed")
  assert(gradedIdx !== -1 && sealedIdx !== -1 && gradedIdx < sealedIdx,
    'helper source order: graded before sealed/selectedIsSealed')

  assert(/resolveNonPokemonSubmitType/.test(add),
    'AddItemModal submit must use resolveNonPokemonSubmitType')
  assert(/const kind = resolveNonPokemonSubmitType\(itemType\.value,\s*selectedIsSealed\.value\)/.test(add),
    'submit must pass itemType + selectedIsSealed into helper')
  // Non-Pokémon submit must branch graded before sealed via kind
  const submitStart = add.indexOf('function submit()')
  const submitEnd = add.indexOf('store.addItem', submitStart)
  assert(submitStart !== -1 && submitEnd !== -1, 'submit function must be locatable')
  const submitBody = add.slice(submitStart, submitEnd)
  const kindGraded = submitBody.indexOf("kind === 'graded'")
  const kindSealed = submitBody.indexOf("kind === 'sealed'")
  assert(kindGraded !== -1 && kindSealed !== -1 && kindGraded < kindSealed,
    'submit must handle kind graded before kind sealed')
  // Old race: selectedIsSealed first then else-if graded — must be gone
  assert(!/if \(selectedIsSealed\.value\) \{[\s\S]{0,120}type:\s*'sealed'[\s\S]{0,200}else if \(itemType\.value === 'graded'\)/.test(submitBody),
    'must not prioritize selectedIsSealed over itemType graded')

  // Mode switch: graded clears selectedIsSealed + sealed selection state
  const watchStart = add.indexOf('watch(itemType')
  assert(watchStart !== -1, 'itemType watch must exist')
  const watchSlice = add.slice(watchStart, watchStart + 1200)
  assert(/if \(t === 'graded'\)/.test(watchSlice), 'watch must handle switch to graded')
  assert(/selectedIsSealed\.value = false/.test(watchSlice),
    'switching to graded must clear selectedIsSealed')
  assert(/sealedResults\.value = \[\]/.test(watchSlice),
    'switching to graded must clear sealed results')
  assert(/sealedQuery\.value = ''/.test(watchSlice),
    'switching to graded must clear sealed query')
  assert(/hadSealedSelection/.test(watchSlice),
    'graded switch must detect prior sealed selection to drop product pick')

  // clearSealed must also drop the flag (manual clear path)
  assert(/function clearSealed\(\) \{[\s\S]{0,200}selectedIsSealed\.value = false/.test(add),
    'clearSealed must reset selectedIsSealed')

  ok('sealed→graded race: helper precedence + modal clear/submit guards hold')
})

runEval('AddItemModal exposes Riftbound graded + grade-aware payload path', () => {
  const add = read('src/components/AddItemModal.vue')

  assert(!/game\.value === 'riftbound'[\s\S]{0,120}filter\(t => t\.value !== 'graded'\)/.test(add),
    'AddItemModal must not hide graded type for Riftbound')
  assert(!/itemType === 'graded' && game !== 'riftbound'/.test(add),
    'grading company/grade fields must show for Riftbound graded')
  assert(/visibleTypes = computed\(\(\) => types\)/.test(add) ||
    !/return types\.filter\(t => t\.value !== 'graded'\)/.test(add),
    'visibleTypes must include graded for all games including Riftbound')

  assert(/buildGradedPcQuery/.test(add), 'AddItemModal must build identity-aware graded PC queries')
  assert(/pcGradeForItem/.test(add), 'AddItem graded fetch must use pcGradeForItem token')
  assert(/fetchPrice\(gradingPcQuery\.value,\s*gradeToken\)/.test(add) ||
    /fetchPrice\(gradingPcQuery\.value,\s*pcGradeForItem/.test(add),
    'graded fetch must call fetchPrice(query, pcGrade token)')
  assert(/isFiniteGradedPrice/.test(add), 'graded apply path must require finite graded price')
  assert(/Raw market is never used/.test(add) || /never used for slabs/.test(add),
    'missing graded data must show clear manual-value copy')

  // Graded Riftbound must not use the raw non-Pokémon searchProducts section
  assert(/itemType === 'sealed' \|\| \(!isPokemon && itemType !== 'graded'\)/.test(add),
    'raw non-Pokémon search section must exclude graded items')

  // Payload fields for non-Pokémon graded
  assert(/type:\s*'graded'/.test(add), 'submit payload includes type graded')
  assert(/gradingCompany:\s*form\.value\.gradingCompany/.test(add), 'payload includes gradingCompany')
  assert(/grade:\s*form\.value\.grade/.test(add), 'payload includes grade')
  assert(/currentValue:\s*value/.test(add), 'payload includes currentValue')
  assert(/game:\s*game\.value/.test(add), 'payload includes game')
  assert(/cardData:\s*\{/.test(add), 'payload includes cardData identity')

  // Must not seed graded currentValue from raw tcgCard.price
  assert(/itemType\.value !== 'graded' && props\.tcgCard\.price != null/.test(add) ||
    /itemType\.value !== 'graded'[\s\S]{0,80}tcgCard\.price/.test(add),
    'raw tcgCard.price must not seed graded currentValue on mount')

  // $0 submit: graded paths must use nullish/finite, not || collapse
  assert(/num\(form\.value\.currentValue\) \?\? num\(form\.value\.purchasePrice\) \?\? 0/.test(add),
    'graded submit must preserve explicit $0 via nullish coalescing')
  assert(!/currentValue:\s*form\.value\.currentValue \|\| form\.value\.purchasePrice \|\| 0/.test(add),
    'Pokémon graded submit must not collapse $0 with ||')

  // Tactile touch targets ≥44px for type tabs + Fetch/Apply (no hardcoded hex)
  assert(/\.type-tab[\s\S]{0,200}min-height:\s*44px/.test(add),
    'type-tab must have min-height 44px touch target')
  assert(/pc-fetch-btn[\s\S]{0,120}min-height:\s*44px/.test(add) ||
    /\.pc-fetch-btn[\s\S]{0,80}min-height:\s*44px/.test(add),
    'Fetch control must have min-height 44px touch target')
  assert(/pc-apply-btn[\s\S]{0,120}min-height:\s*44px/.test(add) ||
    /\.pc-apply-btn[\s\S]{0,80}min-height:\s*44px/.test(add),
    'Apply control must have min-height 44px touch target')
  assert(/class="btn btn-primary pc-apply-btn/.test(add),
    'Apply Price button must use scoped pc-apply-btn class')
  // Price text uses accent-text token (readable on surface), not accent fill
  assert(/pc-result-price-main[\s\S]{0,80}var\(--accent-text\)/.test(add),
    'graded price text must use --accent-text token')
  assert(!/pc-result-price-main[\s\S]{0,80}color:\s*var\(--accent\)\s*;/.test(add),
    'graded price text must not use accent fill color')
  assert(!/#[0-9a-fA-F]{3,8}/.test(add.match(/<style scoped>[\s\S]*<\/style>/)?.[0] || ''),
    'AddItemModal scoped styles must not hardcode hex colors')
  // Stale Pokémon-only graded comments must not remain
  assert(!/Graded PriceCharting fetch \(Pokémon only/.test(add),
    'must not claim graded PC fetch is Pokémon-only')
  assert(!/sealed only for Pokémon/.test(add),
    'must not claim sealed type is Pokémon-only')

  ok('AddItemModal graded visibility, query, and payload guards hold')
})

runEval('portfolio refresh never routes graded non-Pokémon through raw getTcgPrice', () => {
  const view = read('src/views/PortfolioView.vue')
  const store = read('src/stores/portfolio.js')
  const priceServer = read('src/services/priceServer.js')

  assert(/otherTcgGradedItems/.test(view) || /type === 'graded'/.test(view),
    'PortfolioView must classify graded non-Pokémon separately')
  assert(/otherTcgRawItems/.test(view),
    'PortfolioView must keep a raw-only non-Pokémon bucket')

  // Raw bucket must exclude graded
  assert(/i\.type !== 'graded'/.test(view),
    'raw non-Pokémon refresh filter must exclude type graded')

  // Graded path uses fetchPrice with grade
  assert(/fetchPrice\(query,\s*grade\)/.test(view),
    'graded refresh must call fetchPrice(query, grade)')
  assert(/buildGradedPcQuery/.test(view),
    'graded refresh must build identity-aware PC queries')
  assert(/pcGradeForItem/.test(view),
    'graded refresh must pass grade token')
  assert(/riftboundGradedFetchGuard/.test(view),
    'graded refresh must refuse no-number Riftbound auto-fetch')

  // getTcgPrice must not be called in a path that includes graded items.
  // The raw mapPool should only iterate otherTcgRawItems.
  assert(/mapPool\(otherTcgRawItems/.test(view),
    'getTcgPrice path must only iterate otherTcgRawItems')
  assert(/mapPool\(otherTcgGradedItems/.test(view),
    'graded non-Pokémon must have its own mapPool')

  // On missing graded data, retain stale — no raw fallback assignment nearby
  assert(/no_graded_data|retain Collectr|never raw fallback|isFiniteGradedPrice\(result\)/.test(view),
    'missing graded data must retain stale/manual value')

  // Concurrency bounded 3–5
  assert(/REFRESH_CONCURRENCY\s*=\s*[345]/.test(view),
    'refresh concurrency must be 3–5')

  // priceServer refuses raw fallback for graded
  assert(/no_graded_data/.test(priceServer), 'priceServer throws no_graded_data when graded missing')
  assert(/never the\s*\n?\s*raw price|never the raw price/i.test(priceServer) ||
    /Quoting raw as/.test(priceServer),
    'priceServer documents no raw fallback for graded')
  assert(/if \(price == null\)/.test(priceServer),
    'priceServer must treat only null as missing (preserve $0)')

  // Collectr resolve must not overwrite graded currentValue with raw
  assert(/item\.type === 'graded'/.test(store),
    'resolveImportedItems must special-case graded items')
  assert(/Graded slabs: resolve identity/.test(store) ||
    /Never overwrite[\s\S]{0,40}currentValue/.test(store),
    'resolveImportedItems must preserve graded imported values')

  // Ensure graded branch does not assign currentMarketPrice from match.price
  assert(/if \(item\.type === 'graded'\) \{/.test(store),
    'graded resolve branch must exist')
  const gradedResolve = store.match(
    /if \(item\.type === 'graded'\) \{([\s\S]*?)\n\s*\} else \{\n\s*const match = scoreMatch/,
  )
  assert(gradedResolve && !/currentMarketPrice|match\.price|currentValue/.test(gradedResolve[1]),
    'graded resolve branch must not write price fields from match')

  // Shelf totals / read helpers: nullish/finite, not ||
  assert(/itemShelfValue|finiteMoney/.test(store),
    'portfolio store must use finite/nullish shelf value helpers')
  assert(!/item\.currentValue \|\| item\.purchasePrice \|\| 0/.test(store),
    'store must not collapse graded $0 with || purchasePrice')
  assert(!/item\.currentMarketPrice \|\| item\.purchasePrice \|\| 0/.test(store),
    'store must not collapse card $0 with || purchasePrice')

  assert(/finiteMoney|Number\.isFinite/.test(view),
    'PortfolioView getCurrentValue must use finite/nullish semantics')
  assert(!/item\.currentValue \|\| item\.purchasePrice \|\| 0/.test(view),
    'PortfolioView must not collapse graded $0 with ||')

  // Dashboard shelf cards + Excel export: same finite/nullish $0 semantics
  const dash = read('src/views/DashboardView.vue')
  assert(/function finiteMoney|Number\.isFinite/.test(dash),
    'DashboardView getPortfolioValue must use finite/nullish semantics')
  assert(/finiteMoney\(item\.currentMarketPrice\)\s*\?\?\s*finiteMoney\(item\.purchasePrice\)/.test(dash),
    'DashboardView must preserve explicit card $0 (no || purchase fallback)')
  assert(/finiteMoney\(item\.currentValue\)\s*\?\?\s*finiteMoney\(item\.purchasePrice\)/.test(dash),
    'DashboardView must preserve explicit graded/sealed $0')
  assert(!/item\.currentMarketPrice \|\| item\.purchasePrice \|\| 0/.test(dash),
    'DashboardView must not collapse card $0 with || purchasePrice')
  assert(!/item\.currentValue \|\| item\.purchasePrice \|\| 0/.test(dash),
    'DashboardView must not collapse graded $0 with || purchasePrice')

  const excel = read('src/utils/excel.js')
  assert(/function finiteMoney|Number\.isFinite/.test(excel),
    'excel getCurrentValue must use finite/nullish semantics')
  assert(/finiteMoney\(item\.currentMarketPrice\)\s*\?\?\s*finiteMoney\(item\.purchasePrice\)/.test(excel),
    'excel must preserve explicit card $0 (no || purchase fallback)')
  assert(/finiteMoney\(item\.currentValue\)\s*\?\?\s*finiteMoney\(item\.purchasePrice\)/.test(excel),
    'excel must preserve explicit graded/sealed $0')
  assert(!/item\.currentMarketPrice \|\| item\.purchasePrice \|\| 0/.test(excel),
    'excel must not collapse card $0 with || purchasePrice')
  assert(!/item\.currentValue \|\| item\.purchasePrice \|\| 0/.test(excel),
    'excel must not collapse graded $0 with || purchasePrice')

  // PortfolioView graded Fetch/Apply touch targets ≥44px (scoped, not global btn-sm)
  assert(/pc-fetch-btn/.test(view) && /min-height:\s*44px/.test(view),
    'PortfolioView Fetch control must have min-height 44px')
  assert(/pc-apply-btn/.test(view) && /pc-apply-btn[\s\S]{0,120}min-height:\s*44px|\.pc-fetch-btn,\s*\n?\s*\.pc-apply-btn[\s\S]{0,80}min-height:\s*44px/.test(view),
    'PortfolioView Apply control must have min-height 44px')
  assert(/class="btn btn-secondary pc-fetch-btn"/.test(view),
    'PortfolioView Fetch must use scoped pc-fetch-btn')
  assert(/class="btn btn-primary pc-apply-btn/.test(view),
    'PortfolioView Apply must use scoped pc-apply-btn')
  assert(/riftbound:\s*['"]Riftbound['"]/.test(view),
    'PortfolioView GAME_LABELS must include riftbound')

  // Raw PC fallback map: shared detect + normalize + $0
  const providers = read('src/services/tcg/providers.js')
  assert(/detectRiftboundVariant/.test(providers),
    'raw Riftbound PC fallback must use shared detectRiftboundVariant')
  assert(/normalizeCollectorNumber/.test(providers),
    'raw Riftbound PC fallback must use shared normalizeCollectorNumber')
  assert(/price == null/.test(providers) || /vp != null/.test(providers),
    'raw PC fallback must preserve valid $0 (null-only miss)')
  assert(!/if\s*\(\s*!\s*p\.price1\s*\)/.test(providers),
    'raw PC fallback must not skip price1 with truthiness (drops $0)')
  assert(!/!\(price > 0\)/.test(providers),
    'raw PC fallback must not reject price with !(price > 0)')

  ok('refresh classification + import preservation + no raw graded fallback')
})
