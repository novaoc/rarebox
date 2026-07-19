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

/** Fixture set id + cards for master-set compact gallery smoke (deterministic). */
const SMOKE_MS_SET_ID = 'smoke-ms-base'
const SMOKE_MS_CARDS = [
  {
    id: `${SMOKE_MS_SET_ID}-1`,
    name: 'Smoke Bulbasaur',
    number: '1',
    set: { id: SMOKE_MS_SET_ID, name: 'Smoke Master Set' },
    rarity: 'Common',
    supertype: 'Pokémon',
    images: { small: '', large: '' },
  },
  {
    id: `${SMOKE_MS_SET_ID}-4`,
    name: 'Smoke Charmander With A Very Long Collector Display Name That Should Clamp',
    number: '4',
    set: { id: SMOKE_MS_SET_ID, name: 'Smoke Master Set' },
    rarity: 'Common',
    supertype: 'Pokémon',
    images: { small: '', large: '' },
  },
  {
    id: `${SMOKE_MS_SET_ID}-99`,
    name: 'Smoke Missing Rare',
    number: '99',
    set: { id: SMOKE_MS_SET_ID, name: 'Smoke Master Set' },
    rarity: 'Rare',
    supertype: 'Pokémon',
    images: { small: '', large: '' },
  },
  {
    id: `${SMOKE_MS_SET_ID}-tg`,
    name: 'Smoke Long Number',
    // Long collector number — must not overflow compact cell
    number: 'TG12/TG30-EXTRA-LONG-COLLECTOR',
    set: { id: SMOKE_MS_SET_ID, name: 'Smoke Master Set' },
    rarity: 'Trainer Gallery',
    supertype: 'Pokémon',
    images: { small: '', large: '' },
  },
  {
    id: `${SMOKE_MS_SET_ID}-owned-stale`,
    name: 'Smoke Owned Stale Mark',
    number: '7',
    set: { id: SMOKE_MS_SET_ID, name: 'Smoke Master Set' },
    rarity: 'Uncommon',
    supertype: 'Pokémon',
    images: { small: '', large: '' },
  },
  {
    id: `${SMOKE_MS_SET_ID}-need2`,
    name: 'Smoke Need Two',
    number: '12',
    set: { id: SMOKE_MS_SET_ID, name: 'Smoke Master Set' },
    rarity: 'Common',
    supertype: 'Pokémon',
    images: { small: '', large: '' },
  },
]

/**
 * Seed one local shelf with a showcased master set + owned cards via Pinia.
 * Includes a stale hunt mark on an already-owned card id.
 */
async function seedMasterSetShelf(page) {
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
  await page.waitForSelector('#app', { timeout: 10_000 })
  await page.waitForFunction(() => {
    const app = document.querySelector('#app')?.__vue_app__
    const pinia = app?.config?.globalProperties?.$pinia
    const s = pinia?._s?.get?.('portfolio')
    return !!(s && s.initialized)
  }, { timeout: 15_000 })
  // Persist TCG prefs so the first-run loader does not cover later shelf clicks
  await dismissTcgLoaderIfPresent(page)

  return page.evaluate(async (setId, fixtureCards) => {
    const app = document.querySelector('#app')?.__vue_app__
    const pinia = app?.config?.globalProperties?.$pinia
    const store = pinia._s.get('portfolio')
    const stamp = Date.now()
    const name = `Smoke MS Compact ${stamp}`

    for (const p of [...(store.portfolios || [])]) {
      if (/^Smoke MS Compact /.test(String(p?.name || ''))) store.deletePortfolio(p.id)
    }

    const shelf = store.createPortfolio(name, '#7c3aed')
    const owned = fixtureCards.filter(c =>
      c.id.endsWith('-1') || c.id.endsWith('-owned-stale') || c.id.endsWith('-4'),
    )
    for (const c of owned) {
      store.addItem(shelf.id, {
        type: 'card',
        quantity: 1,
        purchasePrice: 0,
        purchaseDate: '',
        notes: '',
        cardId: c.id,
        cardData: {
          name: c.name,
          number: c.number,
          images: c.images || { small: '', large: '' },
          set: { id: setId, name: 'Smoke Master Set' },
          rarity: c.rarity,
          supertype: c.supertype,
        },
        currentMarketPrice: 0,
      })
    }

    const msKey = `pokemon:${String(setId).toLowerCase()}`
    const staleOwnedId = fixtureCards.find(c => c.id.endsWith('-owned-stale'))?.id
    store.showcaseMasterSet(shelf.id, msKey, {
      name: 'Smoke Master Set',
      game: 'pokemon',
      total: fixtureCards.length,
      setId,
      lang: null,
      // Stale mark on an owned card — gallery must exclude it from found/add-found
      hunt: staleOwnedId ? { [staleOwnedId]: Date.now() } : {},
    })
    if (typeof store.persistNow === 'function') await store.persistNow()
    return { id: shelf.id, name, msKey, setId, ownedCount: owned.length, total: fixtureCards.length }
  }, SMOKE_MS_SET_ID, SMOKE_MS_CARDS)
}

/** Remove smoke fixture durable browse:url cache rows (and optional shelf). */
async function cleanupMasterSetShelf(page, seeded) {
  try {
    await page.evaluate(async (id, setId) => {
      const app = document.querySelector('#app')?.__vue_app__
      const pinia = app?.config?.globalProperties?.$pinia
      const store = pinia?._s?.get?.('portfolio')
      if (store) {
        for (const p of [...(store.portfolios || [])]) {
          if (p.id === id || /^Smoke MS Compact /.test(String(p?.name || ''))) {
            store.deletePortfolio(p.id)
          }
        }
        if (typeof store.persistNow === 'function') await store.persistNow()
      }

      // Drop fake card-list durable cache so smoke never poisons offline browse
      await new Promise((resolve) => {
        const req = indexedDB.open('Rarebox')
        req.onerror = () => resolve()
        req.onsuccess = () => {
          const idb = req.result
          if (!idb.objectStoreNames.contains('state')) {
            idb.close()
            return resolve()
          }
          const tx = idb.transaction('state', 'readwrite')
          const os = tx.objectStore('state')
          const keysReq = os.getAllKeys()
          keysReq.onsuccess = () => {
            for (const key of keysReq.result || []) {
              const k = String(key || '')
              if (k.startsWith('browse:url:') && k.includes(setId)) os.delete(key)
            }
          }
          tx.oncomplete = () => { idb.close(); resolve() }
          tx.onerror = () => { idb.close(); resolve() }
        }
      })
    }, seeded?.id, SMOKE_MS_SET_ID)
  } catch {
    // best-effort
  }
}

/**
 * Install request interception for the smoke master-set card list.
 * Returns { dispose, getHits } — hits count fixture card-list responses.
 */
async function installMasterSetCardIntercept(page) {
  let hits = 0
  const handler = (req) => {
    try {
      const url = req.url()
      // pokemontcg.io set cards: q=set.id:…
      if (
        url.includes('api.pokemontcg.io')
        && url.includes('/cards')
        && (url.includes(`set.id:${SMOKE_MS_SET_ID}`) || url.includes(`set.id%3A${SMOKE_MS_SET_ID}`))
      ) {
        hits += 1
        const body = JSON.stringify({
          data: SMOKE_MS_CARDS,
          page: 1,
          pageSize: 250,
          count: SMOKE_MS_CARDS.length,
          totalCount: SMOKE_MS_CARDS.length,
        })
        req.respond({
          status: 200,
          contentType: 'application/json',
          headers: { 'access-control-allow-origin': '*' },
          body,
        })
        return
      }
      // Do not stub /sets — empty responses would poison rarebox_en_sets localStorage.
      // Card-list intercept above is enough for the gallery fetch path.
      req.continue()
    } catch {
      try { req.continue() } catch {}
    }
  }
  await page.setRequestInterception(true)
  page.on('request', handler)
  return {
    getHits: () => hits,
    dispose: async () => {
      page.off('request', handler)
      try { await page.setRequestInterception(false) } catch {}
    },
  }
}

/**
 * Master-set compact gallery at 280px: All-cards long fixtures, owned stale
 * status + preview, Add-found E2E, ≥44px targets, no overflow, reopen resets.
 */
/** Dismiss first-run TCG picker if present (blocks pointer events at z-index 9999). */
async function dismissTcgLoaderIfPresent(page) {
  const dismissed = await page.evaluate(() => {
    const overlay = document.querySelector('.loader-overlay')
    if (!overlay) return false
    const start = [...overlay.querySelectorAll('button')].find(b =>
      /Load \d+ TCG/i.test(b.textContent || '') && !b.disabled,
    )
    if (start) {
      start.click()
      return true
    }
    // Fallback: click overlay backdrop (emits ready)
    overlay.click()
    return true
  })
  if (dismissed) {
    await page.waitForFunction(() => !document.querySelector('.loader-overlay'), { timeout: 5_000 })
  }
}

/** Probe compact grid geometry / overflow (shared by need + All cards views). */
function probeCompactGridDom() {
  const items = [...document.querySelectorAll('.msg-compact-item')]
  const primaries = [...document.querySelectorAll('.msg-compact-primary')]
  const previews = [...document.querySelectorAll('.msg-compact-preview')]
  const nums = [...document.querySelectorAll('.msg-compact-num')]
  const names = [...document.querySelectorAll('.msg-compact-name')]

  const rectOk = (el) => {
    const r = el.getBoundingClientRect()
    return r.width + 0.5 >= 44 && r.height + 0.5 >= 44
  }
  const overflowsCell = (el, cell) => {
    if (!el || !cell) return false
    const er = el.getBoundingClientRect()
    const cr = cell.getBoundingClientRect()
    // Allow 1px subpixel slack
    return er.right > cr.right + 1 || er.left < cr.left - 1
  }

  let cellOverflow = false
  for (const item of items) {
    const num = item.querySelector('.msg-compact-num')
    const name = item.querySelector('.msg-compact-name')
    const primary = item.querySelector('.msg-compact-primary')
    const preview = item.querySelector('.msg-compact-preview')
    if (overflowsCell(num, primary) || overflowsCell(name, primary)) cellOverflow = true
    if (preview) {
      const pr = preview.getBoundingClientRect()
      const ir = item.getBoundingClientRect()
      if (pr.right > ir.right + 1 || pr.left < ir.left - 1) cellOverflow = true
    }
  }

  const pageOverflow = document.documentElement.scrollWidth > window.innerWidth + 2
  const toggle = document.querySelector('.msg-density-toggle')
  const foundNote = document.querySelector('.msg-footer-note')?.textContent || ''
  const addFound = document.querySelector('.msg-add-found-btn')?.textContent || ''
  // Stale owned mark must not create a "found" footer by itself
  const staleFoundLeak = /1 found|Add 1 to shelf/i.test(foundNote + ' ' + addFound)
    && items.every(it => !it.classList.contains('got'))

  let cols = 0
  if (items.length) {
    const top0 = items[0].getBoundingClientRect().top
    cols = items.filter(it => Math.abs(it.getBoundingClientRect().top - top0) < 4).length
  }

  // Stale-owned fixture: must render Owned, never Found/.got
  const staleItem = items.find((it) => {
    const n = it.querySelector('.msg-compact-name')?.textContent || ''
    return /Smoke Owned Stale Mark/i.test(n)
  })
  const staleStatus = (staleItem?.querySelector('.msg-compact-status')?.textContent || '').trim()
  const staleClasses = staleItem ? [...staleItem.classList] : []

  return {
    compactCount: items.length,
    primaryCount: primaries.length,
    previewCount: previews.length,
    allPrimary44: primaries.length > 0 && primaries.every(rectOk),
    allPreview44: previews.length === 0 || previews.every(rectOk),
    toggle44: toggle ? rectOk(toggle) : false,
    cellOverflow,
    pageOverflow,
    cols,
    hasLongNum: nums.some(n => /TG12|EXTRA-LONG/i.test(n.textContent || '')),
    hasLongName: names.some(n => /Very Long Collector/i.test(n.textContent || '')),
    staleFoundLeak,
    stalePresent: !!staleItem,
    staleStatus,
    staleIsOwned: staleClasses.includes('owned'),
    staleIsGot: staleClasses.includes('got'),
    staleIsNeed: staleClasses.includes('need'),
    ariaPressed: toggle?.getAttribute('aria-pressed') || '',
    viewport: window.innerWidth,
  }
}

/** Probe lightbox scrim/meta luminance + contrast (runs in page). */
function probeLightboxContrastDom() {
  const parse = (str) => {
    const m = String(str || '').match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)/i)
    if (!m) return null
    return { r: +m[1], g: +m[2], b: +m[3], a: m[4] != null ? +m[4] : 1 }
  }
  const lin = (c) => {
    const x = c / 255
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
  }
  const lum = ({ r, g, b }) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  const composite = (fg, bg) => {
    const a = Math.min(1, Math.max(0, fg.a ?? 1))
    return {
      r: Math.round(fg.r * a + bg.r * (1 - a)),
      g: Math.round(fg.g * a + bg.g * (1 - a)),
      b: Math.round(fg.b * a + bg.b * (1 - a)),
    }
  }
  const contrast = (l1, l2) => {
    const hi = Math.max(l1, l2)
    const lo = Math.min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)
  }

  const preview = document.querySelector('.msg-preview')
  const meta = document.querySelector('.msg-preview-meta')
  if (!preview || !meta) return { ok: false, reason: 'preview/meta missing' }

  const scrimRaw = getComputedStyle(preview).backgroundColor
  const metaRaw = getComputedStyle(meta).color
  const pageBgRaw = getComputedStyle(document.documentElement).backgroundColor
    || getComputedStyle(document.body).backgroundColor
    || 'rgb(250, 246, 239)'

  const scrim = parse(scrimRaw)
  const metaC = parse(metaRaw)
  const pageBg = parse(pageBgRaw) || { r: 250, g: 246, b: 239, a: 1 }
  if (!scrim || !metaC) {
    return { ok: false, reason: `unparsed colors scrim=${scrimRaw} meta=${metaRaw}` }
  }

  const scrimSolid = composite(scrim, pageBg)
  const scrimL = lum(scrimSolid)
  const metaL = lum(metaC)
  const ratio = contrast(metaL, scrimL)
  const theme = document.documentElement.dataset.theme || 'light'

  return {
    ok: true,
    theme,
    scrimRaw,
    metaRaw,
    scrimL,
    metaL,
    ratio,
    // Scrim must stay dark (not cream/light) in both themes
    scrimDark: scrimL < 0.35,
    // Meta text must stay light on the dark scrim
    metaLight: metaL > 0.55,
    // WCAG AA-ish for large/bold UI text; require solid readability
    contrastOk: ratio >= 4.5,
  }
}

async function assertMasterSetCompactGallery(page, seeded) {
  const intercept = await installMasterSetCardIntercept(page)
  const addFoundCardId = `${SMOKE_MS_SET_ID}-need2`
  const addFoundName = 'Smoke Need Two'
  // Need-filter baseline: total − seeded owned. After one Add-found, need drops by 1.
  const needBaseline = seeded.total - seeded.ownedCount
  const needAfterAdd = needBaseline - 1
  let themeRestore = null

  try {
    await page.setViewport({ width: 280, height: 900, isMobile: true, deviceScaleFactor: 2 })
    await page.goto(`${BASE}/portfolio/${encodeURIComponent(seeded.id)}`, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000,
    })
    await page.waitForSelector('#app', { timeout: 10_000 })
    await page.waitForFunction((expected) => {
      const text = document.body.innerText || ''
      if (text.includes('Shelf not found')) return true
      return text.includes(expected) || text.includes('Smoke Master Set')
    }, { timeout: 15_000 }, seeded.name)

    // First-run loader sits above the shelf and steals pointer events
    await dismissTcgLoaderIfPresent(page)

    const gate = await page.evaluate((expected) => {
      const text = document.body.innerText || ''
      return {
        notFound: text.includes('Shelf not found'),
        hasShelf: text.includes(expected) || text.includes('Smoke Master Set'),
      }
    }, seeded.name)
    if (gate.notFound) throw new Error('master-set compact: shelf not found after seed')
    if (!gate.hasShelf) throw new Error('master-set compact: seeded shelf title missing')

    // Open gallery via stack control (DOM click — avoids overlay/coordinate flakiness)
    await page.waitForFunction(() => {
      const btns = [...document.querySelectorAll('button')]
      return btns.some(b => /Show cards/i.test(b.textContent || ''))
    }, { timeout: 10_000 })
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('button')].find(b => /Show cards/i.test(b.textContent || ''))
      if (!btn) throw new Error('Show cards button missing')
      btn.click()
    })

    await page.waitForSelector('.msg-panel', { timeout: 15_000 })
    await page.waitForFunction(() => {
      const loading = document.querySelector('.msg-loading')
      const grid = document.querySelector('.msg-grid')
      const err = document.querySelector('.msg-error')
      return (!loading || loading.offsetParent === null) && (!!grid || !!err)
    }, { timeout: 20_000 })

    const errText = await page.evaluate(() => document.querySelector('.msg-error')?.textContent || '')
    if (errText) throw new Error(`master-set compact: gallery error ${errText}`)

    // Fixture card-list must come from our intercept (not live network / stale cache alone)
    if (intercept.getHits() < 1) {
      throw new Error('master-set compact: card API intercept never fired for smoke fixture set')
    }

    // Comfortable visible count (defaults to Not owned when set is incomplete)
    const comfortableCount = await page.evaluate(() =>
      document.querySelectorAll('.msg-grid:not(.msg-grid-compact) .msg-card').length,
    )
    if (comfortableCount < 1) throw new Error('master-set compact: comfortable grid empty')
    if (comfortableCount !== needBaseline) {
      throw new Error(
        `master-set compact: comfortable need count expected ${needBaseline}, got ${comfortableCount}`,
      )
    }

    // Toggle Compact via DOM click (Vue @click on the density control)
    await page.waitForSelector('.msg-density-toggle', { timeout: 5_000 })
    await page.evaluate(() => {
      const t = document.querySelector('.msg-density-toggle')
      if (!t || t.disabled) throw new Error('density toggle missing or disabled')
      t.click()
    })
    await page.waitForSelector('[data-msg-compact-grid], .msg-grid-compact', { timeout: 5_000 })

    const needProbe = await page.evaluate(probeCompactGridDom)

    if (needProbe.compactCount !== comfortableCount) {
      throw new Error(
        `master-set compact: visible count mismatch comfortable=${comfortableCount} compact=${needProbe.compactCount}`,
      )
    }
    if (needProbe.ariaPressed !== 'true') {
      throw new Error('master-set compact: density toggle aria-pressed not true after Compact')
    }
    if (!needProbe.allPrimary44 || !needProbe.allPreview44 || !needProbe.toggle44) {
      throw new Error(`master-set compact: target <44px (${JSON.stringify(needProbe)})`)
    }
    if (needProbe.cellOverflow) throw new Error('master-set compact: cell content overflow at 280px (need filter)')
    if (needProbe.pageOverflow) throw new Error('master-set compact: page horizontal overflow at 280px')
    if (needProbe.cols < 3 || needProbe.cols > 4) {
      throw new Error(`master-set compact: expected 3–4 columns at 280px, got ${needProbe.cols}`)
    }
    if (needProbe.staleFoundLeak) {
      throw new Error('master-set compact: stale owned hunt mark leaked into found/add-found count')
    }
    if (needProbe.previewCount < 1) {
      throw new Error('master-set compact: expected separate preview controls on missing cards')
    }

    // ── All cards: long-name + long-number fixtures must be present, no overflow ──
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll('.msg-filter-btn')].find(b =>
        /All cards/i.test(b.textContent || ''),
      )
      if (!btn) throw new Error('All cards filter missing')
      btn.click()
    })
    await page.waitForFunction((total) => {
      return document.querySelectorAll('.msg-compact-item').length === total
    }, { timeout: 5_000 }, seeded.total)

    const allProbe = await page.evaluate(probeCompactGridDom)
    if (allProbe.compactCount !== seeded.total) {
      throw new Error(
        `master-set compact All cards: expected ${seeded.total} items, got ${allProbe.compactCount}`,
      )
    }
    if (!allProbe.hasLongNum) {
      throw new Error('master-set compact All cards: long collector number fixture missing from DOM')
    }
    if (!allProbe.hasLongName) {
      throw new Error('master-set compact All cards: long display name fixture missing from DOM')
    }
    if (allProbe.cellOverflow) {
      throw new Error('master-set compact All cards: cell content overflow (long name/number)')
    }
    if (allProbe.pageOverflow) {
      throw new Error('master-set compact All cards: page horizontal overflow at 280px')
    }
    if (!allProbe.allPrimary44 || !allProbe.allPreview44) {
      throw new Error(`master-set compact All cards: target <44px (${JSON.stringify(allProbe)})`)
    }

    // Stale-marked owned fixture: Owned label, not Found/.got
    if (!allProbe.stalePresent) {
      throw new Error('master-set compact: stale-owned fixture not present on All cards')
    }
    if (!allProbe.staleIsOwned || allProbe.staleIsGot || allProbe.staleIsNeed) {
      throw new Error(
        `master-set compact: stale-owned must be .owned only (got classes owned=${allProbe.staleIsOwned} got=${allProbe.staleIsGot} need=${allProbe.staleIsNeed})`,
      )
    }
    if (!/^Owned$/i.test(allProbe.staleStatus) || /Found|Need/i.test(allProbe.staleStatus)) {
      throw new Error(
        `master-set compact: stale-owned status must be "Owned", got "${allProbe.staleStatus}"`,
      )
    }

    // Owned primary opens/closes preview (stale-owned fixture)
    await page.evaluate(() => {
      const items = [...document.querySelectorAll('.msg-compact-item')]
      const stale = items.find((it) =>
        /Smoke Owned Stale Mark/i.test(it.querySelector('.msg-compact-name')?.textContent || ''),
      )
      const primary = stale?.querySelector('.msg-compact-primary')
      if (!primary) throw new Error('stale-owned primary missing')
      primary.click()
    })
    await page.waitForSelector('.msg-preview', { timeout: 5_000 })
    const ownedPreviewMeta = await page.evaluate(() => {
      const name = document.querySelector('.msg-preview-name')?.textContent || ''
      return { name }
    })
    if (!/Smoke Owned Stale Mark/i.test(ownedPreviewMeta.name)) {
      throw new Error(`master-set compact: owned primary preview wrong card (${ownedPreviewMeta.name})`)
    }

    // Light-theme lightbox: dark scrim + light meta
    const lightLb = await page.evaluate(probeLightboxContrastDom)
    if (!lightLb.ok) throw new Error(`master-set compact lightbox light: ${lightLb.reason}`)
    if (!lightLb.scrimDark || !lightLb.metaLight || !lightLb.contrastOk) {
      throw new Error(`master-set compact lightbox light contrast fail (${JSON.stringify(lightLb)})`)
    }

    // Dark theme must keep the same always-dark scrim / always-light meta (no invert)
    themeRestore = await page.evaluate(() => {
      const prev = {
        pref: (() => { try { return localStorage.getItem('rarebox_theme') } catch { return null } })(),
        theme: document.documentElement.dataset.theme || 'light',
      }
      try { localStorage.setItem('rarebox_theme', 'dark') } catch { /* private */ }
      document.documentElement.dataset.theme = 'dark'
      const meta = document.querySelector('meta[name="theme-color"]')
      if (meta) meta.setAttribute('content', '#16140e')
      window.dispatchEvent(new CustomEvent('rarebox-theme', { detail: 'dark' }))
      return prev
    })
    await page.waitForFunction(() => document.documentElement.dataset.theme === 'dark', { timeout: 3_000 })

    const darkLb = await page.evaluate(probeLightboxContrastDom)
    if (!darkLb.ok) throw new Error(`master-set compact lightbox dark: ${darkLb.reason}`)
    if (!darkLb.scrimDark || !darkLb.metaLight || !darkLb.contrastOk) {
      throw new Error(`master-set compact lightbox dark contrast fail (${JSON.stringify(darkLb)})`)
    }
    // Guard the exact regression: scrim must not become light when --ink flips cream
    if (darkLb.scrimL > 0.35) {
      throw new Error(`master-set compact: dark-theme scrim too light (L=${darkLb.scrimL})`)
    }
    if (darkLb.metaL < 0.55) {
      throw new Error(`master-set compact: dark-theme meta too dark (L=${darkLb.metaL})`)
    }

    // Restore prior theme before closing preview
    await page.evaluate((prev) => {
      const pref = prev?.pref
      if (pref == null) {
        try { localStorage.removeItem('rarebox_theme') } catch { /* private */ }
      } else {
        try { localStorage.setItem('rarebox_theme', pref) } catch { /* private */ }
      }
      const t = prev?.theme === 'dark' ? 'dark' : 'light'
      document.documentElement.dataset.theme = t
      const meta = document.querySelector('meta[name="theme-color"]')
      if (meta) meta.setAttribute('content', t === 'dark' ? '#16140e' : '#faf6ef')
      window.dispatchEvent(new CustomEvent('rarebox-theme', { detail: t }))
    }, themeRestore)
    themeRestore = null

    await page.evaluate(() => {
      document.querySelector('.msg-preview-close')?.click()
    })
    await page.waitForFunction(() => !document.querySelector('.msg-preview'), { timeout: 5_000 })

    // Missing-card magnifier preview still works
    await page.evaluate(() => {
      const prev = document.querySelector('.msg-compact-item.need .msg-compact-preview')
      if (!prev) throw new Error('need preview control missing')
      prev.click()
    })
    await page.waitForSelector('.msg-preview', { timeout: 5_000 })
    await page.evaluate(() => {
      document.querySelector('.msg-preview-close')?.click()
    })
    await page.waitForFunction(() => !document.querySelector('.msg-preview'), { timeout: 5_000 })

    // ── Add found E2E: mark one missing card → Add N to shelf → store + UI ──
    const markResult = await page.evaluate((targetName) => {
      const items = [...document.querySelectorAll('.msg-compact-item.need')]
      const target = items.find((it) =>
        (it.querySelector('.msg-compact-name')?.textContent || '').includes(targetName),
      )
      const primary = target?.querySelector('.msg-compact-primary')
      if (!primary) return { ok: false, reason: `need primary for ${targetName} missing` }
      primary.click()
      return { ok: true }
    }, addFoundName)
    if (!markResult.ok) throw new Error(`master-set compact mark: ${markResult.reason}`)
    await page.waitForFunction(() => !!document.querySelector('.msg-compact-item.got'), { timeout: 5_000 })

    const afterMark = await page.evaluate((targetName) => {
      const gotItems = [...document.querySelectorAll('.msg-compact-item.got')]
      const gotTarget = gotItems.find((it) =>
        (it.querySelector('.msg-compact-name')?.textContent || '').includes(targetName),
      )
      const status = (gotTarget?.querySelector('.msg-compact-status')?.textContent || '').trim()
      const footer = document.querySelector('.msg-footer-note')?.textContent || ''
      const addBtn = document.querySelector('.msg-add-found-btn')?.textContent || ''
      return { got: gotItems.length, status, footer, addBtn }
    }, addFoundName)
    if (afterMark.got < 1) throw new Error('master-set compact: mark found did not apply got state')
    if (!/^Found$/i.test(afterMark.status)) {
      throw new Error(`master-set compact: marked card status expected Found, got "${afterMark.status}"`)
    }
    if (!/1 found/i.test(afterMark.footer) || !/Add 1 to shelf/i.test(afterMark.addBtn)) {
      throw new Error(
        `master-set compact: add-found footer missing after mark (footer="${afterMark.footer}" btn="${afterMark.addBtn}")`,
      )
    }

    await page.evaluate(() => {
      const btn = document.querySelector('.msg-add-found-btn')
      if (!btn || btn.disabled) throw new Error('Add N to shelf button missing or disabled')
      btn.click()
    })
    await page.waitForFunction(() => {
      const footer = document.querySelector('.msg-footer')
      const got = document.querySelector('.msg-compact-item.got')
      return !footer && !got
    }, { timeout: 5_000 })

    const afterAdd = await page.evaluate((targetName, cardId, shelfId) => {
      const items = [...document.querySelectorAll('.msg-compact-item')]
      const target = items.find((it) =>
        (it.querySelector('.msg-compact-name')?.textContent || '').includes(targetName),
      )
      const status = (target?.querySelector('.msg-compact-status')?.textContent || '').trim()
      const classes = target ? [...target.classList] : []
      const footer = document.querySelector('.msg-footer-note')?.textContent || ''
      const addBtn = document.querySelector('.msg-add-found-btn')?.textContent || ''
      const head = document.querySelector('.msg-head-sub')?.textContent || ''

      const app = document.querySelector('#app')?.__vue_app__
      const pinia = app?.config?.globalProperties?.$pinia
      const store = pinia?._s?.get?.('portfolio')
      const shelf = (store?.portfolios || []).find(p => p.id === shelfId)
      const ownedIds = (shelf?.items || []).map(i => i.cardId).filter(Boolean)
      const hunt = shelf?.masterSets
        ? Object.values(shelf.masterSets).find(ms => ms?.hunt)?.hunt || {}
        : {}

      return {
        targetPresent: !!target,
        status,
        isOwned: classes.includes('owned'),
        isGot: classes.includes('got'),
        footer,
        addBtn,
        head,
        storeHasCard: ownedIds.includes(cardId),
        storeOwnedCount: ownedIds.length,
        huntStillHasCard: Object.prototype.hasOwnProperty.call(hunt, cardId),
      }
    }, addFoundName, addFoundCardId, seeded.id)

    if (!afterAdd.targetPresent) {
      throw new Error('master-set compact: added card missing from All cards grid')
    }
    if (!afterAdd.isOwned || afterAdd.isGot || !/^Owned$/i.test(afterAdd.status)) {
      throw new Error(
        `master-set compact: after Add found card must be Owned (status="${afterAdd.status}" owned=${afterAdd.isOwned} got=${afterAdd.isGot})`,
      )
    }
    if (afterAdd.footer || afterAdd.addBtn) {
      throw new Error('master-set compact: footer/add-found must clear after Add found')
    }
    if (!afterAdd.storeHasCard) {
      throw new Error(`master-set compact: shelf store missing added cardId ${addFoundCardId}`)
    }
    if (afterAdd.storeOwnedCount !== seeded.ownedCount + 1) {
      throw new Error(
        `master-set compact: store owned count expected ${seeded.ownedCount + 1}, got ${afterAdd.storeOwnedCount}`,
      )
    }
    if (afterAdd.huntStillHasCard) {
      throw new Error('master-set compact: hunt mark for added card was not cleared')
    }
    // Header owned tally should reflect the new card (N/M owned)
    const ownedHeadRe = new RegExp(`${seeded.ownedCount + 1}\\s*/\\s*${seeded.total}\\s*owned`, 'i')
    if (!ownedHeadRe.test(afterAdd.head)) {
      throw new Error(
        `master-set compact: header owned tally not updated after Add found (head="${afterAdd.head}")`,
      )
    }

    // Collapse gallery and reopen — compact must reset to Comfortable; need count −1
    await page.evaluate(() => {
      const hide = [...document.querySelectorAll('button')].find(b => /Hide cards/i.test(b.textContent || ''))
      if (!hide) throw new Error('Hide cards missing')
      hide.click()
    })
    await page.waitForFunction(() => !document.querySelector('.msg-panel'), { timeout: 5_000 })

    await page.evaluate(() => {
      const show = [...document.querySelectorAll('button')].find(b => /Show cards/i.test(b.textContent || ''))
      if (!show) throw new Error('Show cards missing on reopen')
      show.click()
    })
    await page.waitForSelector('.msg-panel', { timeout: 10_000 })
    await page.waitForFunction(() => {
      const loading = document.querySelector('.msg-loading')
      const grid = document.querySelector('.msg-grid')
      return (!loading || loading.offsetParent === null) && !!grid
    }, { timeout: 15_000 })

    const reopened = await page.evaluate(() => {
      const toggle = document.querySelector('.msg-density-toggle')
      const compactGrid = document.querySelector('.msg-grid-compact')
      const comfortGrid = document.querySelector('.msg-grid:not(.msg-grid-compact)')
      const head = document.querySelector('.msg-head-sub')?.textContent || ''
      const footer = document.querySelector('.msg-footer')
      return {
        ariaPressed: toggle?.getAttribute('aria-pressed') || '',
        label: (toggle?.textContent || '').trim(),
        hasCompact: !!compactGrid,
        hasComfort: !!comfortGrid,
        comfortCount: comfortGrid ? comfortGrid.querySelectorAll('.msg-card').length : 0,
        head,
        hasFooter: !!footer,
      }
    })
    if (reopened.ariaPressed === 'true' || reopened.hasCompact) {
      throw new Error(`master-set compact: reopen did not reset to Comfortable (${JSON.stringify(reopened)})`)
    }
    if (!reopened.hasComfort || reopened.comfortCount !== needAfterAdd) {
      throw new Error(
        `master-set compact: reopen need count expected ${needAfterAdd} after Add found (${JSON.stringify(reopened)})`,
      )
    }
    if (reopened.hasFooter) {
      throw new Error('master-set compact: reopen must not resurrect add-found footer')
    }
    if (!ownedHeadRe.test(reopened.head)) {
      throw new Error(
        `master-set compact: reopen header owned tally wrong (head="${reopened.head}")`,
      )
    }

    console.log(
      `✓ master-set compact gallery @280px (${needProbe.cols} cols, need ${comfortableCount}→${needAfterAdd}, all=${seeded.total}, apiHits=${intercept.getHits()})`,
    )
  } finally {
    // Best-effort theme restore if a mid-test failure left dark mode on
    if (themeRestore) {
      try {
        await page.evaluate((prev) => {
          const pref = prev?.pref
          if (pref == null) {
            try { localStorage.removeItem('rarebox_theme') } catch { /* private */ }
          } else {
            try { localStorage.setItem('rarebox_theme', pref) } catch { /* private */ }
          }
          const t = prev?.theme === 'dark' ? 'dark' : 'light'
          document.documentElement.dataset.theme = t
          const meta = document.querySelector('meta[name="theme-color"]')
          if (meta) meta.setAttribute('content', t === 'dark' ? '#16140e' : '#faf6ef')
          window.dispatchEvent(new CustomEvent('rarebox-theme', { detail: t }))
        }, themeRestore)
      } catch { /* ignore */ }
    }
    await intercept.dispose()
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

      // Master-set compact gallery: Pinia-seeded showcase + intercepted set cards
      let msSeeded = null
      try {
        msSeeded = await seedMasterSetShelf(page)
        await assertMasterSetCompactGallery(page, msSeeded)
      } finally {
        await cleanupMasterSetShelf(page, msSeeded)
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
