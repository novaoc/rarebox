import { spawnSync } from 'node:child_process'

const DANGER_RULES = [
  {
    pattern: /^src\/stores\/portfolio\.js$/,
    check: 'npm run eval:harness + user-data compatibility review',
  },
  {
    pattern: /^src\/db\.js$/,
    check: 'npm run eval:harness + IndexedDB migration review',
  },
  {
    pattern: /^src\/utils\/backup\.js$/,
    check: 'backup-roundtrip behavioral eval',
  },
  {
    pattern: /^src\/utils\/collectrImport\.js$/,
    check: 'import fixture/compatibility review',
  },
  {
    pattern: /^src\/services\/tcg\/(providers|multiSearch|cardCache|cardPreloader)\.js$/,
    check: 'provider/search/preload harness evals',
  },
  {
    pattern: /^src\/utils\/qrTransfer\.js$|^src\/components\/LocalSyncModal\.vue$/,
    check: 'payload size, hostile input, and QR/local-transfer review',
  },
  {
    pattern: /^src\/services\/price|^src\/services\/priceFeedService\.js$/,
    check: 'price parser and zero-price evals',
  },
]

function git(args) {
  const r = spawnSync('git', args, { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(r.stderr || r.stdout || `git ${args.join(' ')} failed`)
  return r.stdout.trim()
}

function changedFiles() {
  const base = process.env.DANGER_BASE
  if (base) return git(['diff', '--name-only', `${base}...HEAD`]).split('\n').filter(Boolean)

  const status = git(['status', '--short']).split('\n').filter(Boolean).map(line => line.slice(3).trim()).filter(Boolean)
  if (status.length) return status

  try {
    return git(['diff', '--name-only', 'HEAD~1..HEAD']).split('\n').filter(Boolean)
  } catch {
    return []
  }
}

const files = changedFiles()
const hits = []
for (const file of files) {
  for (const rule of DANGER_RULES) {
    if (rule.pattern.test(file)) hits.push({ file, check: rule.check })
  }
}

if (!hits.length) {
  console.log('✓ no danger-zone files touched')
  process.exit(0)
}

console.log('Danger-zone files touched; required focused review:')
for (const hit of hits) console.log(`- ${hit.file}: ${hit.check}`)

console.log('\nThis script is a tripwire, not a replacement for tests. It should run beside eval:harness/build/smoke and make reviewers look at the risky paths.')
