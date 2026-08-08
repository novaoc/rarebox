import { spawnSync } from 'node:child_process'

const evals = [
  ['python3', 'scripts/evals/meta-deck-resolver.py'],
  'scripts/evals/provider-shape.mjs',
  'scripts/evals/provider-normalization.mjs',
  'scripts/evals/sealed-filter.mjs',
  'scripts/evals/search-fallback.mjs',
  'scripts/evals/price-parser.mjs',
  'scripts/evals/en-prices-fallback.mjs',
  'scripts/evals/route-safety.mjs',
  'scripts/evals/shelf-link.mjs',
  'scripts/evals/master-set-compact-mode.mjs',
  'scripts/evals/backup-roundtrip.mjs',
  'scripts/evals/riftbound-graded.mjs',
  'scripts/evals/pricecharting-full-grades.mjs',
  'scripts/evals/sealed-sku-scoring.mjs',
  'scripts/evals/jp-secret-heal.mjs',
  ['python3', 'scripts/evals/pricecharting_full_grades.py'],
]

let failed = false
for (const file of evals) {
  const [command, path] = Array.isArray(file) ? file : [process.execPath, file]
  console.log(`\n=== ${path} ===`)
  const result = spawnSync(command, [path], { stdio: 'inherit' })
  if (result.status !== 0) failed = true
}

if (failed) {
  console.error('\nRarebox harness evals failed')
  process.exit(1)
}

console.log('\nAll Rarebox harness evals passed')
