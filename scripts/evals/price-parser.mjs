import { assert, ok, read, runEval } from './lib.mjs'

function parsePrice(v) {
  if (v == null || v === '') return null
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : null
  const n = parseFloat(String(v).replace(/[$,]/g, '').trim())
  return Number.isFinite(n) && n >= 0 ? n : null
}

runEval('price parser semantics', () => {
  const cases = [
    ['$1,234.56', 1234.56],
    ['$0', 0],
    [0, 0],
    ['0.00', 0],
    ['', null],
    [null, null],
    ['not a price', null],
  ]
  for (const [input, expected] of cases) {
    const actual = parsePrice(input)
    assert(Object.is(actual, expected), `parsePrice(${JSON.stringify(input)})`, `expected ${expected}, got ${actual}`)
  }
  ok('fixture parser keeps $0 as a valid numeric price')
})

runEval('source parsers do not collapse zero to null', () => {
  const files = [
    'src/services/tcg/providers.js',
    'src/services/tcg/multiSearch.js',
    'src/services/priceFeedService.js',
    'src/services/priceServer.js',
    'src/services/nameSearch.js',
  ]
  const offenders = []
  for (const file of files) {
    const src = read(file)
    const patterns = [
      /Number\.isFinite\([^\n]+&&\s*[^\n]+>\s*0\s*\?\s*[^\n]+:\s*null/g,
      /return\s+[^\n?]+>\s*0\s*\?\s*[^\n]+:\s*null/g,
      /return\s+num\s*>\s*0\s*\?\s*num\s*:\s*null/g,
    ]
    for (const pattern of patterns) {
      const matches = src.match(pattern) || []
      for (const m of matches) offenders.push(`${file}: ${m.trim()}`)
    }
  }
  assert(!offenders.length, 'Price parser source still treats zero as null', offenders.join('\n'))
  ok('price parsing sources use >= 0 semantics where zero is valid')
})
