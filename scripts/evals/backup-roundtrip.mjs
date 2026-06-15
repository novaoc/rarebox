import fs from 'node:fs'
import path from 'node:path'
import { assert, ok, root, runEval } from './lib.mjs'
import { restoreBackupData, sanitizeBackupData, validateBackup } from '../../src/utils/backup.js'

const fixturePath = path.join(root, 'scripts/evals/fixtures/backup-roundtrip.json')

function createFakeStorage(seed = {}) {
  const store = new Map(Object.entries(seed).map(([k, v]) => [k, String(v)]))
  return {
    get length() { return store.size },
    key(i) { return [...store.keys()][i] || null },
    getItem(k) { return store.has(k) ? store.get(k) : null },
    setItem(k, v) { store.set(k, String(v)) },
    removeItem(k) { store.delete(k) },
    clear() { store.clear() },
    dump() { return Object.fromEntries(store.entries()) },
  }
}

function readFixtureWithPollution() {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
  fixture.data.portfolios.portfolios[0].items[0].__proto__ = { polluted: true }
  fixture.data.portfolios.portfolios[0].items[0].constructor = { polluted: true }
  fixture.data.priceCache.evil_key_should_not_import = 'blocked'
  return fixture
}

await runEval('backup fixture round-trip invariants', () => {
  const plain = sanitizeBackupData(readFixtureWithPollution())
  const error = validateBackup(plain)
  assert(error === null, 'Fixture backup should validate', error || '')

  const shelves = plain.data.portfolios.portfolios
  const items = shelves.flatMap(p => p.items || [])
  const snapshots = plain.data.portfolios.snapshots || {}
  const snapshotValues = Object.values(snapshots).flatMap(arr => arr || []).flatMap(s => Object.keys(s.values || {}))

  assert(shelves.length === 1, 'Fixture should preserve shelf count')
  assert(items.length === 2, 'Fixture should preserve item count')
  assert(items.some(i => i.currentMarketPrice === 0), 'Fixture should preserve zero currentMarketPrice')
  assert(snapshotValues.includes('item-card-zero'), 'Fixture should preserve snapshot item IDs')
  assert(!Object.prototype.hasOwnProperty.call(items[0], '__proto__'), 'Prototype pollution key should be stripped')
  assert(!Object.prototype.hasOwnProperty.call(items[0], 'constructor'), 'Constructor pollution key should be stripped')

  const restoredPriceCacheKeys = Object.keys(plain.data.priceCache || {}).filter(k => k.startsWith('ph_cache_'))
  assert(restoredPriceCacheKeys.length === 1 && restoredPriceCacheKeys[0] === 'ph_cache_sample', 'Only ph_cache_* keys should be restorable')

  ok('fixture preserves shelves/items/snapshots and strips pollution keys')
})

await runEval('backup restore behavior', async () => {
  const plain = sanitizeBackupData(readFixtureWithPollution())
  const storage = createFakeStorage({
    rarebox_portfolios: 'stale-portfolios',
    rarebox_settings: 'stale-settings',
    rarebox_snapshots: 'stale-snapshots',
    ph_cache_old: JSON.stringify({ price: 999 }),
    unrelated_user_key: 'keep-me',
  })
  let savedState = null
  let savedTrade = null
  let reloads = 0

  const result = await restoreBackupData(plain, {
    storage,
    saveAppState: async state => { savedState = structuredClone(state); return true },
    saveImportedTradeState: async trade => { savedTrade = structuredClone(trade); return true },
    reload: () => { reloads++ },
  })

  const stored = storage.dump()
  assert(result.portfolios === 1, 'Restore should report restored shelf count', JSON.stringify(result))
  assert(result.snapshots === 1, 'Restore should count restored snapshots', JSON.stringify(result))
  assert(result.decks === 1, 'Restore should report restored deck count', JSON.stringify(result))
  assert(result.caches === 1, 'Restore should restore only namespaced price-cache entries', JSON.stringify(result))

  assert(savedState?.portfolios?.[0]?.id === 'shelf-main', 'Restore should persist imported app state')
  assert(savedState.portfolios[0].items.some(i => i.currentMarketPrice === 0), 'Restore should preserve zero prices in saved state')
  assert(savedState.snapshots?.['shelf-main']?.[0]?.values?.['item-card-zero'] === 0, 'Restore should preserve snapshot zero values')
  assert(savedTrade?.sideA?.items?.length === 0 && savedTrade?.sideB?.items?.length === 0, 'Restore should persist trade state')

  assert(!('rarebox_portfolios' in stored), 'Restore should clear legacy localStorage portfolio mirror')
  assert(!('rarebox_settings' in stored), 'Restore should clear legacy localStorage settings mirror')
  assert(!('rarebox_snapshots' in stored), 'Restore should clear legacy localStorage snapshots mirror')
  assert(!('ph_cache_old' in stored), 'Restore should clear stale existing price-cache entries')
  assert('ph_cache_sample' in stored, 'Restore should write imported price-cache entries')
  assert(!('evil_key_should_not_import' in stored), 'Restore should not import arbitrary localStorage keys from priceCache')
  assert(stored.unrelated_user_key === 'keep-me', 'Restore should leave unrelated localStorage keys alone')
  assert(JSON.parse(stored.rarebox_decks)[0].id === 'deck-main', 'Restore should write imported decks')
  assert(reloads === 1, 'Restore should trigger exactly one reload hook')

  ok('restore helper writes state/decks/cache safely and reloads once')
})

await runEval('backup source keeps import safety guards', () => {
  const backup = fs.readFileSync(path.join(root, 'src/utils/backup.js'), 'utf8')
  assert(backup.includes('window.__rareboxImporting = true'), 'importBackup should freeze persistence during restore')
  assert(backup.includes("key === '__proto__'") && backup.includes("key === 'constructor'") && backup.includes("key === 'prototype'"), 'importBackup should strip prototype-pollution keys')
  assert(backup.includes("key.startsWith('ph_cache_')"), 'importBackup should restore only price-cache localStorage keys')
  assert(backup.includes('await saveAppState(state)'), 'restoreBackupData should write imported state directly to IndexedDB')
  ok('backup.js contains restore safety guards')
})
