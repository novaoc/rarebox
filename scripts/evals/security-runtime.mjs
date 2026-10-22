import assert from 'node:assert/strict'
import fs from 'node:fs'
import { isSupportedNode as supported } from '../check-node-runtime.mjs'

// Test the actual predev/prebuild guard, including rejection of other majors.
for (const v of ['20.20.0', '22.22.0', '22.23.0', '22.23.3', '24.22.0', '26.12.0', '22.23.4-rc.1']) {
  assert.equal(supported(v), false, `${v} must not satisfy the project's security floor`)
}
for (const v of ['22.23.4', '22.23.5', '22.24.0']) assert.equal(supported(v), true)
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'))
assert.equal(pkg.engines.node, '>=22.23.4 <23')
assert.equal(lock.packages[''].engines.node, pkg.engines.node)
assert.ok(supported(fs.readFileSync('.nvmrc', 'utf8').trim()), '.nvmrc must select patched Node 22')
assert.ok(supported(process.version), `Run the harness on patched Node 22 (current ${process.version}); use nvm use`)
assert.match(fs.readFileSync('.github/workflows/harness.yml', 'utf8'), /node-version-file:\s*\.nvmrc/)
for (const p of Object.values(lock.packages)) {
  if (!p.resolved) continue
  const host = new URL(p.resolved).hostname
  assert.ok(['registry.npmjs.org', 'cdn.sheetjs.com'].includes(host), `Unexpected package source: ${host}`)
  assert.ok(p.integrity, 'Every downloaded package must have a lockfile integrity hash')
}
for (const name of ['braces', 'micromatch', 'chokidar', 'postcss-nested']) {
  assert.ok(!lock.packages[`node_modules/${name}`], `Removed vulnerable Tailwind 3 chain returned: ${name}`)
}
console.log('PASS patched runtime, CI version selection, lock integrity/sources and removed Tailwind 3 chain')
