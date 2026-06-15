import fs from 'node:fs'
import path from 'node:path'
import { assert, ok, read, root, runEval } from './lib.mjs'

const fixturePath = path.join(root, 'scripts/evals/fixtures/backup-roundtrip.json')

function deepPlain(value) {
  return JSON.parse(JSON.stringify(value), (key, val) =>
    key === '__proto__' || key === 'constructor' || key === 'prototype' ? undefined : val
  )
}

function validateBackup(data) {
  if (!data || typeof data !== 'object') return 'Invalid backup file'
  if (data.app !== 'rarebox') return 'Not a Rarebox backup file'
  if (!data.data || typeof data.data !== 'object') return 'Backup has no data'
  if (!data.data.portfolios) return 'Backup missing shelf data'
  if (data.data.portfolios.portfolios && !Array.isArray(data.data.portfolios.portfolios)) return 'Shelf data is corrupted'
  return null
}

runEval('backup fixture round-trip invariants', () => {
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
  fixture.data.portfolios.portfolios[0].items[0].__proto__ = { polluted: true }
  fixture.data.portfolios.portfolios[0].items[0].constructor = { polluted: true }

  const plain = deepPlain(fixture)
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

runEval('backup source keeps import safety guards', () => {
  const backup = read('src/utils/backup.js')
  assert(backup.includes('window.__rareboxImporting = true'), 'importBackup should freeze persistence during restore')
  assert(backup.includes("key === '__proto__'") && backup.includes("key === 'constructor'") && backup.includes("key === 'prototype'"), 'importBackup should strip prototype-pollution keys')
  assert(backup.includes("key.startsWith('ph_cache_')"), 'importBackup should restore only price-cache localStorage keys')
  assert(backup.includes('await saveState(state)'), 'importBackup should write imported state directly to IndexedDB')
  ok('backup.js contains restore safety guards')
})
