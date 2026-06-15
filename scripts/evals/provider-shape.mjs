import { assert, extractExportedArrayObjects, extractObjectKeys, ok, read, runEval } from './lib.mjs'

runEval('provider shape registry', () => {
  const providers = read('src/services/tcg/providers.js')
  const multiSearch = read('src/services/tcg/multiSearch.js')

  const tcgs = extractExportedArrayObjects(providers, 'TCGS')
  assert(tcgs.length >= 6, 'TCGS registry should list all supported games')

  const available = tcgs.filter(t => t.available).map(t => t.id)
  const providerKeys = extractObjectKeys(providers, 'PROVIDERS')
  const searchKeys = extractObjectKeys(multiSearch, 'ALL_PROVIDERS')

  const browseGames = available.filter(id => id !== 'pokemon')
  const missingBrowse = browseGames.filter(id => !providerKeys.includes(id))
  assert(!missingBrowse.length, 'Every non-Pokémon available TCG needs a browse provider', missingBrowse.join(', '))

  const missingSearch = available.filter(id => !searchKeys.includes(id))
  assert(!missingSearch.length, 'Every available TCG needs a multiSearch provider', missingSearch.join(', '))

  for (const id of browseGames) {
    const variable = id === 'one-piece' ? 'onePiece' : id === 'yu-gi-oh' ? 'yugioh' : id
    const alias = id === 'yugioh' ? 'yugioh' : variable
    const marker = `const ${alias} = {`
    const start = providers.indexOf(marker)
    assert(start !== -1, `Provider object not found for ${id}`, marker)
    const nextSection = providers.indexOf('// ──', start + marker.length)
    const block = providers.slice(start, nextSection === -1 ? providers.length : nextSection)
    assert(/async\s+getSets\s*\(/.test(block), `${id} provider must expose async getSets()`)
    assert(/async\s+getSetCards\s*\(/.test(block), `${id} provider must expose async getSetCards()`)
    for (const field of ['id', 'name', 'number', 'image', 'price', 'rarity']) {
      assert(new RegExp(`${field}\\s*:`).test(block), `${id} getSetCards should normalize card field: ${field}`)
    }
  }

  for (const t of tcgs) {
    if (!t.available) continue
    const expectedRoute = t.id === 'pokemon' ? '/sets/pokemon' : `/sets/${t.id}`
    assert(t.route === expectedRoute, `TCGS route mismatch for ${t.id}`, `expected ${expectedRoute}, got ${t.route}`)
  }

  ok(`available TCGs covered: ${available.join(', ')}`)
  ok(`browse providers: ${providerKeys.filter(k => browseGames.includes(k)).join(', ')}`)
  ok(`search providers: ${searchKeys.filter(k => available.includes(k)).join(', ')}`)
})
