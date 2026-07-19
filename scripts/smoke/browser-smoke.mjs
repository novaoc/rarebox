import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import puppeteer from 'puppeteer-core'

const HOST = '127.0.0.1'
const PORT = Number(process.env.RAREBOX_SMOKE_PORT || 4173)
const BASE = `http://${HOST}:${PORT}`

const ROUTES = [
  '/',
  '/search',
  '/sets',
  '/sets/pokemon',
  '/sets/one-piece',
  '/sets/yugioh',
  '/settings',
  '/trade',
]

function findChrome() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    // Common paths in GitHub Actions / Linux CI
    '/opt/google/chrome/chrome',
    '/opt/chromium/chrome',
  ].filter(Boolean)
  return candidates.find(p => fs.existsSync(p))
}

function waitForHttp(url, timeoutMs = 20_000) {
  const started = Date.now()
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, res => {
        res.resume()
        if (res.statusCode && res.statusCode < 500) return resolve()
        retry()
      })
      req.on('error', retry)
      req.setTimeout(1000, () => { req.destroy(); retry() })
    }
    const retry = () => {
      if (Date.now() - started > timeoutMs) return reject(new Error(`Timed out waiting for ${url}`))
      setTimeout(tick, 250)
    }
    tick()
  })
}

function startPreview() {
  const child = spawn('npx', ['vite', 'preview', '--host', HOST, '--port', String(PORT), '--strictPort'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, BROWSER: 'none' },
    detached: true,
  })
  child.stdout.on('data', d => process.stdout.write(`[preview] ${d}`))
  child.stderr.on('data', d => process.stderr.write(`[preview] ${d}`))
  return child
}

async function stopPreview(child) {
  if (!child || child.exitCode != null || child.signalCode != null) return

  const exited = new Promise(resolve => child.once('exit', resolve))
  try {
    // `npx vite preview` can leave the actual Vite node process alive after the
    // wrapper exits. Start it in its own process group and terminate the group
    // so CI does not sit around until the job timeout after tests already pass.
    process.kill(-child.pid, 'SIGTERM')
  } catch {
    try { child.kill('SIGTERM') } catch {}
  }

  const timedOut = await Promise.race([
    exited.then(() => false),
    new Promise(resolve => setTimeout(() => resolve(true), 3000)),
  ])
  if (timedOut) {
    try { process.kill(-child.pid, 'SIGKILL') } catch {
      try { child.kill('SIGKILL') } catch {}
    }
  }
}

async function assertPage(page, route) {
  // Rarebox intentionally starts background data work from first render; waiting
  // for network-idle turns a healthy app into a flaky smoke test. The smoke
  // contract is app-shell render + route resolution + no mobile overflow.
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForSelector('#app', { timeout: 10_000 })
  await page.waitForFunction(() => (document.body.innerText || '').trim().length > 20, { timeout: 10_000 })
  const result = await page.evaluate(() => {
    const app = document.querySelector('#app')
    const rect = app?.getBoundingClientRect()
    const text = document.body.innerText || ''
    return {
      title: document.title,
      textLength: text.trim().length,
      appHeight: rect?.height || 0,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      bodySnippet: text.trim().slice(0, 120),
    }
  })
  if (!result.title.includes('Rarebox')) throw new Error(`${route}: title does not include Rarebox (${result.title})`)
  if (result.textLength < 20 || result.appHeight < 100) throw new Error(`${route}: app looks blank (${JSON.stringify(result)})`)
  if (result.horizontalOverflow) throw new Error(`${route}: horizontal overflow at current viewport`)
  console.log(`✓ ${route} rendered (${result.title})`)
}

/** Unknown shelf id after local store init — no IDB seed required. */
async function assertMissingShelf(page, route) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForSelector('#app', { timeout: 10_000 })
  // Wait until init finishes and the explicit not-found gate renders (not the loading gate).
  await page.waitForFunction(() => {
    const text = document.body.innerText || ''
    return text.includes('Shelf not found')
  }, { timeout: 15_000 })
  const result = await page.evaluate(() => {
    const text = document.body.innerText || ''
    return {
      text,
      hasNotFound: text.includes('Shelf not found'),
      hasDashboard: /Dashboard/i.test(text),
      stillLoading: text.includes('Loading shelf'),
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      marked: !!document.querySelector('[data-shelf-not-found]'),
    }
  })
  if (!result.hasNotFound) throw new Error(`${route}: expected "Shelf not found" after init`)
  if (result.stillLoading) throw new Error(`${route}: still showing loading gate after not-found`)
  if (!result.hasDashboard) throw new Error(`${route}: expected Dashboard CTA on missing shelf`)
  if (!result.marked) throw new Error(`${route}: missing data-shelf-not-found marker`)
  if (result.horizontalOverflow) throw new Error(`${route}: horizontal overflow on missing shelf`)
  console.log(`✓ ${route} shows Shelf not found after init`)
}

/**
 * Resolve the live Pinia portfolio store from the mounted Vue app.
 * Prefer this over raw IDB writes — debounced persist would otherwise clobber seeds.
 */
async function getPortfolioStoreHandle(page) {
  return page.evaluate(() => {
    const app = document.querySelector('#app')?.__vue_app__
    const pinia = app?.config?.globalProperties?.$pinia
    if (!pinia?._s?.has?.('portfolio')) return { ok: false, reason: 'no portfolio store' }
    const s = pinia._s.get('portfolio')
    return {
      ok: true,
      initialized: !!s.initialized,
      count: Array.isArray(s.portfolios) ? s.portfolios.length : 0,
    }
  })
}

/** Seed two local shelves via the live store, then persistNow so hard-reload sees them. */
async function seedTwoShelves(page) {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForSelector('#app', { timeout: 10_000 })
  await page.waitForFunction(() => (document.body.innerText || '').trim().length > 20, { timeout: 15_000 })
  // Wait until portfolio store finished init
  await page.waitForFunction(() => {
    const app = document.querySelector('#app')?.__vue_app__
    const pinia = app?.config?.globalProperties?.$pinia
    const s = pinia?._s?.get?.('portfolio')
    return !!(s && s.initialized)
  }, { timeout: 15_000 })

  const probe = await getPortfolioStoreHandle(page)
  if (!probe.ok) throw new Error(`seed: ${probe.reason}`)

  return page.evaluate(async () => {
    const app = document.querySelector('#app')?.__vue_app__
    const pinia = app?.config?.globalProperties?.$pinia
    const store = pinia._s.get('portfolio')
    const stamp = Date.now()
    const nameA = `Smoke Alpha ${stamp}`
    const nameB = `Smoke Beta ${stamp}`

    // Drop any leftover smoke shelves from prior runs
    for (const p of [...(store.portfolios || [])]) {
      if (/^Smoke (Alpha|Beta) /.test(String(p?.name || ''))) {
        store.deletePortfolio(p.id)
      }
    }

    const a = store.createPortfolio(nameA, '#f5a623')
    const b = store.createPortfolio(nameB, '#58a6ff')
    store.addItem(a.id, {
      type: 'card',
      name: 'Alpha Smoke Card',
      quantity: 1,
      purchasePrice: 1,
    })
    store.addItem(b.id, {
      type: 'card',
      name: 'Beta Smoke Card',
      quantity: 1,
      purchasePrice: 2,
    })
    if (typeof store.persistNow === 'function') await store.persistNow()
    return { idA: a.id, idB: b.id, nameA, nameB }
  })
}

/** Remove smoke-seeded shelves via live store + persist (best-effort cleanup). */
async function cleanupSmokeShelves(page, shelves) {
  try {
    // Prefer deleting known ids; also sweep by name prefix
    await page.evaluate(async (ids) => {
      const app = document.querySelector('#app')?.__vue_app__
      const pinia = app?.config?.globalProperties?.$pinia
      const store = pinia?._s?.get?.('portfolio')
      if (!store) return
      const idSet = new Set((ids || []).filter(Boolean))
      for (const p of [...(store.portfolios || [])]) {
        const name = String(p?.name || '')
        if (idSet.has(p.id) || /^Smoke (Alpha|Beta) /.test(name)) {
          store.deletePortfolio(p.id)
        }
      }
      if (typeof store.persistNow === 'function') await store.persistNow()
    }, shelves ? [shelves.idA, shelves.idB] : [])
  } catch {
    // Cleanup is best-effort; do not fail the suite on teardown
  }
}

/**
 * Hard-load a seeded shelf (no false not-found), then SPA-navigate A→B during the
 * leave transition and assert B title/content with no A identity bleed.
 */
async function assertShelfABTransition(page, shelves) {
  const { idA, idB, nameA, nameB } = shelves
  // Hard load A — store re-reads IDB; must not flash false not-found
  await page.goto(`${BASE}/portfolio/${encodeURIComponent(idA)}`, {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  })
  await page.waitForSelector('#app', { timeout: 10_000 })
  await page.waitForFunction((expected) => {
    const text = document.body.innerText || ''
    if (text.includes('Shelf not found')) return true // resolve so we can fail explicitly
    const names = [...document.querySelectorAll('.portfolio-name')].map(el => (el.textContent || '').trim())
    return names.some(n => n.includes(expected))
  }, { timeout: 15_000 }, nameA)

  const onA = await page.evaluate((expected, card) => {
    const text = document.body.innerText || ''
    const names = [...document.querySelectorAll('.portfolio-name')].map(el => (el.textContent || '').trim())
    return {
      hasName: names.some(n => n.includes(expected)),
      hasCard: text.includes(card),
      notFound: text.includes('Shelf not found'),
    }
  }, nameA, 'Alpha Smoke Card')
  if (onA.notFound) throw new Error(`hard-load A showed Shelf not found for ${idA}`)
  if (!onA.hasName) throw new Error(`hard-load A never showed title ${nameA}`)

  // Client-side A→B (keeps leave transition; fullPath key mounts new instance)
  await page.evaluate(async (path) => {
    const app = document.querySelector('#app')?.__vue_app__
    const router = app?.config?.globalProperties?.$router
    if (!router) throw new Error('Vue router not available for SPA navigation')
    await router.push(path)
  }, `/portfolio/${encodeURIComponent(idB)}`)

  // Mid-transition (~leave duration 300ms): leaving A must not rebind to B
  await new Promise(r => setTimeout(r, 80))
  const mid = await page.evaluate((aName, bName) => {
    const names = [...document.querySelectorAll('.portfolio-name')].map(el => (el.textContent || '').trim())
    const onlyBDupes = names.length >= 2 && names.every(n => n.includes(bName)) && !names.some(n => n.includes(aName))
    return { names, onlyBDupes }
  }, nameA, nameB)
  if (mid.onlyBDupes) {
    throw new Error(`A→B leave bleed: multiple titles all show B (${JSON.stringify(mid.names)})`)
  }

  // Settled B: B title/content, no A title left, no not-found
  await page.waitForFunction((expected) => {
    const names = [...document.querySelectorAll('.portfolio-name')].map(el => (el.textContent || '').trim())
    return names.some(n => n.includes(expected))
  }, { timeout: 10_000 }, nameB)
  await new Promise(r => setTimeout(r, 350)) // past leave transition
  const settled = await page.evaluate((aName, bName, bCard) => {
    const text = document.body.innerText || ''
    const names = [...document.querySelectorAll('.portfolio-name')].map(el => (el.textContent || '').trim())
    return {
      names,
      hasB: names.some(n => n.includes(bName)),
      hasA: names.some(n => n.includes(aName)),
      hasBCard: text.includes(bCard),
      notFound: text.includes('Shelf not found'),
      stillLoading: text.includes('Loading shelf'),
    }
  }, nameA, nameB, 'Beta Smoke Card')
  if (settled.notFound) throw new Error('A→B settled on Shelf not found')
  if (settled.stillLoading) throw new Error('A→B still showing loading gate after settle')
  if (!settled.hasB) throw new Error(`A→B missing B title ${nameB} (names=${JSON.stringify(settled.names)})`)
  if (settled.hasA) throw new Error(`A→B A title still visible after settle (bleed): ${JSON.stringify(settled.names)}`)
  if (!settled.hasBCard) throw new Error('A→B missing B item content after settle')
  console.log(`✓ shelf A→B transition (${nameA} → ${nameB})`)
}

async function main() {
  const executablePath = findChrome()
  if (!executablePath) {
    console.log('⚠ No Chrome found — skipping browser smoke test (common in some CI environments)')
    return
  }

  const server = startPreview()
  try {
    await waitForHttp(`${BASE}/`)
    let browser
    try {
      browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      })
    } catch (e) {
      console.log('⚠ Failed to launch Chrome in this environment — skipping browser smoke test')
      return
    }
    try {
      const page = await browser.newPage()

      await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 })
      for (const route of ROUTES) await assertPage(page, route)

      // Missing shelf: after store init, both route shapes show explicit not-found
      // (no IDB seeding — unknown ids are never in local collection).
      for (const route of ['/portfolio/smoke-missing-shelf-id', '/shelf/smoke-missing-shelf-id']) {
        await assertMissingShelf(page, route)
      }

      // Seeded A→B: hard-load valid shelf, SPA navigate during leave, no A bleed
      let seeded = null
      try {
        seeded = await seedTwoShelves(page)
        await assertShelfABTransition(page, seeded)
      } finally {
        await cleanupSmokeShelves(page, seeded)
      }

      await page.setViewport({ width: 280, height: 700, isMobile: true, deviceScaleFactor: 2 })
      for (const route of ['/', '/search', '/sets', '/settings']) await assertPage(page, route)
      await assertMissingShelf(page, '/portfolio/smoke-missing-shelf-id')

      console.log('\nBrowser smoke tests passed')
    } finally {
      await browser.close()
    }
  } finally {
    await stopPreview(server)
  }
}

main()
  .then(() => {
    // In CI, browser/preview wrappers can leave open handles even after the
    // smoke contract has passed. Exit explicitly so the job cannot burn the
    // full workflow timeout after printing "Browser smoke tests passed".
    process.exit(0)
  })
  .catch(err => {
    console.error(err?.stack || err)
    process.exit(1)
  })
