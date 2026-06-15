import { assert, ok, runEval } from './lib.mjs'
import { createMultiSearch } from '../../src/services/tcg/multiSearch.js'

const liveCard = { id: 'live-1', name: 'Fresh New Card', number: '001', set: 'New Set', image: '', price: 4.2, rarity: 'Rare', game: 'pokemon' }
const cachedPriced = { id: 'cache-priced', name: 'Cached Priced Card', number: '002', set: 'Cached Set', image: '', price: 1.5, rarity: 'Common', game: 'pokemon' }
const cachedUnpriced = { id: 'cache-unpriced', name: 'Cached Unpriced Card', number: '003', set: 'Cached Set', image: '', price: null, rarity: 'Common', game: 'pokemon' }

function makeSearch({ cachedCards = [], liveImpl, online = true }) {
  let liveCalls = 0
  const search = createMultiSearch({
    providerFns: {
      pokemon: async (q, page, pageSize) => {
        liveCalls++
        return liveImpl ? liveImpl(q, page, pageSize) : { cards: [liveCard], total: 1, serverPaged: true }
      },
    },
    isGameCachedFn: game => game === 'pokemon',
    searchCacheFn: () => ({ cards: cachedCards, totalCount: cachedCards.length }),
    getOnline: () => online,
  })
  return { search, liveCalls: () => liveCalls }
}

await runEval('search fallback behavior', async () => {
  {
    const { search, liveCalls } = makeSearch({ cachedCards: [] })
    const result = await search('fresh', { providers: ['pokemon'] })
    assert(liveCalls() === 1, 'Cached miss should fall through to live provider')
    assert(result.cards.some(c => c.id === 'live-1'), 'Live result should be returned after cached miss')
  }

  {
    const { search, liveCalls } = makeSearch({ cachedCards: [cachedPriced] })
    const result = await search('cached', { providers: ['pokemon'] })
    assert(liveCalls() === 0, 'Priced cache hit should not call live provider')
    assert(result.cards[0].id === 'cache-priced', 'Priced cache hit should be returned immediately')
  }

  {
    const { search, liveCalls } = makeSearch({ cachedCards: [cachedUnpriced], online: false })
    const result = await search('cached', { providers: ['pokemon'] })
    assert(liveCalls() === 0, 'Offline local hit should not call live provider')
    assert(result.cards[0].id === 'cache-unpriced', 'Offline local hit should beat an empty result')
  }

  {
    const { search, liveCalls } = makeSearch({
      cachedCards: [cachedUnpriced],
      liveImpl: async () => { throw new Error('live_down') },
    })
    const result = await search('cached', { providers: ['pokemon'] })
    assert(liveCalls() === 1, 'Unpriced online cache hit should try live provider for prices')
    assert(result.cards[0].id === 'cache-unpriced', 'Live failure should fall back to local cache hit')
  }

  ok('cached misses fall through, priced hits short-circuit, and offline/live-fail paths keep local results')
})
