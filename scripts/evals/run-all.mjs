import { spawnSync } from 'node:child_process'

const evals = [
  'scripts/evals/provider-shape.mjs',
  'scripts/evals/price-parser.mjs',
  'scripts/evals/route-safety.mjs',
  'scripts/evals/backup-roundtrip.mjs',
]

let failed = false
for (const file of evals) {
  console.log(`\n=== ${file} ===`)
  const result = spawnSync(process.execPath, [file], { stdio: 'inherit' })
  if (result.status !== 0) failed = true
}

if (failed) {
  console.error('\nRarebox harness evals failed')
  process.exit(1)
}

console.log('\nAll Rarebox harness evals passed')
