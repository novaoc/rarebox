#!/usr/bin/env node
// Booth ⇄ shelf sync test — exercises the REAL pinia store + boothShelf.js
// inside the running app (vite dev server + headless Chrome), no UI clicking:
// list-from-shelf moves, sales, trades, buys, delists, undo reclaim.
//
//   node scripts/test_booth_shelf.mjs

import { spawn } from 'node:child_process'
import puppeteer from 'puppeteer-core'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 5199

const vite = spawn('npx', ['vite', '--port', String(PORT), '--strictPort'], { stdio: 'pipe', shell: true })
vite.stderr.on('data', d => process.env.DEBUG_VITE && console.log('[vite]', String(d)))
await new Promise((res, rej) => {
  const t = setTimeout(() => rej(new Error('vite did not start')), 30000)
  vite.stdout.on('data', (d) => { if (String(d).includes('Local:')) { clearTimeout(t); res() } })
  let errBuf = ''
  vite.stderr.on('data', d => { errBuf += d })
  vite.on('exit', () => rej(new Error('vite exited: ' + errBuf.slice(0, 300))))
})

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' })
const page = await browser.newPage()
page.on('pageerror', e => console.log('[pageerror]', e.message))
for (let i = 0; ; i++) {
  try {
    await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'networkidle2', timeout: 60000 })
    break
  } catch (e) {
    if (i >= 5) throw e
    await new Promise(r => setTimeout(r, 1000))
  }
}

const result = await page.evaluate(async () => {
  const checks = []
  const ok = (cond, label) => checks.push({ ok: !!cond, label })
  try {
    const { usePortfolioStore } = await import('/src/stores/portfolio.js')
    const sync = await import('/src/utils/boothShelf.js')
    const store = usePortfolioStore()

    // ── stage: a curated shelf with two items ──
    const curated = store.createPortfolio('Test Curated', '#58a6ff')
    const zard = store.addItem(curated.id, {
      type: 'card', quantity: 3, purchasePrice: 100, purchaseDate: '2024-01-01', notes: '',
      cardId: 'base1-4', cardData: { name: 'Charizard', number: '4', set: { name: 'Base' }, images: {} },
      currentMarketPrice: 600,
    })
    const booth = { id: 'booth-test', name: 'Test Booth', items: [], syncShelf: true }

    // 1. list 2 of 3 Charizards → MOVE curated → booth shelf
    const listing = { type: 'card', cardId: 'base1-4', name: 'Charizard', setName: 'Base', number: '4', qty: 2, price: 650, img: '' }
    booth.items.push(listing)
    const moved = sync.moveFromCurated(booth, curated.id, zard, 2)
    listing.shelfItemId = moved.shelfItemId; listing.srcShelfId = moved.srcShelfId
    const boothShelf = store.portfolios.find(p => p.id === booth.shelfId)
    ok(!!boothShelf && boothShelf.name === 'Booth: Test Booth', 'booth shelf auto-created with booth name')
    ok(store.portfolios.find(p => p.id === curated.id).items[0].quantity === 1, 'curated shelf decremented 3→1')
    const mirror = boothShelf.items.find(i => i.cardId === 'base1-4')
    ok(mirror?.quantity === 2 && mirror.purchasePrice === 100, 'booth shelf holds 2, original cost basis kept')

    // 2. sale of one → booth shelf decrements
    sync.shelfRemove(booth, listing, 1)
    ok(boothShelf.items.find(i => i.cardId === 'base1-4')?.quantity === 1, 'sale: booth shelf 2→1')

    // 3. trade-in joins the shelf with its value as cost basis
    const inc = { type: 'card', cardId: 'sv8-219', name: 'Pikachu ex', setName: 'Surging Sparks', qty: 1, price: 80 }
    sync.shelfAdd(booth, inc, { qty: 1, purchasePrice: 80 })
    const pika = boothShelf.items.find(i => i.cardId === 'sv8-219')
    ok(pika?.quantity === 1 && pika.purchasePrice === 80, 'trade-in: added with given-up value as cost')

    // 4. buy merges into an existing mirror (same card again)
    sync.shelfAdd(booth, { ...inc }, { qty: 1, purchasePrice: 60 })
    ok(boothShelf.items.find(i => i.cardId === 'sv8-219')?.quantity === 2, 'second copy merges qty 1→2')

    // 5. delist the Charizard → goes BACK to the curated shelf
    sync.returnToSource(booth, { ...listing, qty: 1 })
    ok(store.portfolios.find(p => p.id === curated.id).items[0]?.quantity === 2, 'delist: curated 1→2')
    ok(!boothShelf.items.some(i => i.cardId === 'base1-4'), 'delist: booth shelf mirror gone')

    // 6. undo that delist → reclaimed from curated, mirrored again
    sync.reclaimFromSource(booth, { ...listing, qty: 1 }, 1)
    sync.shelfAdd(booth, { ...listing, qty: 1 }, { qty: 1 })
    ok(store.portfolios.find(p => p.id === curated.id).items[0]?.quantity === 1, 'undo delist: curated 2→1')
    ok(boothShelf.items.find(i => i.cardId === 'base1-4')?.quantity === 1, 'undo delist: mirror restored')

    // 7. sync OFF booths never touch shelves
    const offBooth = { id: 'b2', name: 'Off', items: [], syncShelf: false }
    sync.shelfAdd(offBooth, { type: 'card', cardId: 'x', name: 'X', qty: 1 })
    ok(!offBooth.shelfId && !store.portfolios.some(p => p.name === 'Booth: Off'), 'sync off: no shelf created')

    // 8. buyer-side: moveItem relocates between shelves intact
    const pickups = store.createPortfolio('Pickups: Test Event', '#2fbf71')
    const bought = store.addItem(pickups.id, {
      type: 'card', quantity: 1, purchasePrice: 50, purchaseDate: '2026-06-11', notes: 'Bought at Test Booth',
      cardId: 'sv8-238', cardData: { name: 'Pikachu ex', number: '238', set: { name: 'Surging Sparks' }, images: {} },
      currentMarketPrice: 60,
    })
    const okMove = store.moveItem(pickups.id, bought.id, curated.id)
    const movedItem = store.portfolios.find(p => p.id === curated.id).items.find(i => i.id === bought.id)
    ok(okMove && movedItem?.purchasePrice === 50 && movedItem?.notes.includes('Test Booth'), 'moveItem: relocated with fields intact')
    ok(!store.portfolios.find(p => p.id === pickups.id).items.length, 'moveItem: source emptied')
    ok(store.moveItem(pickups.id, 'nope', curated.id) === false, 'moveItem: missing item returns false')

    // cleanup
    store.deletePortfolio(curated.id)
    store.deletePortfolio(booth.shelfId)
    store.deletePortfolio(pickups.id)
  } catch (e) {
    checks.push({ ok: false, label: 'EXCEPTION: ' + (e?.message || e) })
  }
  return checks
})

let failures = 0
for (const c of result) {
  console.log(`${c.ok ? '✓' : '✗ FAIL'} ${c.label}`)
  if (!c.ok) failures++
}
await browser.close()
vite.kill(); spawn('bash', ['-c', `lsof -ti:${PORT} | xargs kill -9 2>/dev/null`])
console.log(failures ? `\n✗ ${failures} failure(s)` : '\n✓ booth⇄shelf sync: all checks passed')
process.exit(failures ? 1 : 0)
