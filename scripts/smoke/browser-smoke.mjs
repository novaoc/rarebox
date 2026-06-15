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

async function main() {
  const executablePath = findChrome()
  if (!executablePath) {
    throw new Error('No Chrome/Chromium executable found. Set PUPPETEER_EXECUTABLE_PATH or install Chromium.')
  }

  const server = startPreview()
  try {
    await waitForHttp(`${BASE}/`)
    const browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    try {
      const page = await browser.newPage()

      await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 })
      for (const route of ROUTES) await assertPage(page, route)

      await page.setViewport({ width: 280, height: 700, isMobile: true, deviceScaleFactor: 2 })
      for (const route of ['/', '/search', '/sets', '/settings']) await assertPage(page, route)

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
