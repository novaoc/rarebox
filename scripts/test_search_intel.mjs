#!/usr/bin/env node
// Search-intelligence test — parseQuery/smartSearch in real Chrome against live APIs + the real jp-index.
//
// Drives the system Chrome (headless) via puppeteer-core, serves the repo
// over a throwaway local HTTP server so src modules load as ES modules,
// and connects phonePeer ↔ displayPeer through an IN-PAGE signaling bus
// (publishSig is bypassed — zero network traffic, zero ntfy publishes).
//
// Asserts: channel connects via host candidates, sealed states cross and
// decrypt, tampered/oversized/wrong-key packets are dropped, ping/pong
// heartbeat works, and channel death is detected (onDown fires).
//
//   node scripts/test_p2p_browser.mjs

import http from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import puppeteer from 'puppeteer-core'

const ROOT = new URL('..', import.meta.url).pathname
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.html': 'text/html', '.json': 'application/json' }
const PAGE_FILE = 'scripts/search_intel_page.html'


const server = http.createServer(async (req, res) => {
  const clean = req.url.split('?')[0]
  const path = clean === '/test'
    ? join(ROOT, PAGE_FILE)
    : join(ROOT, clean)
  if (clean === '/test') res.setHeader('content-type', 'text/html')
  try {
    let data
    try { data = await readFile(path) }
    catch { data = await readFile(join(ROOT, 'public', clean)) }  // /jp-index.json, /sealed-index/*
    res.setHeader('content-type', MIME[extname(path)] || 'application/octet-stream')
    res.end(data)
  } catch { res.statusCode = 404; res.end('nope') }
})
await new Promise(r => server.listen(0, '127.0.0.1', r))
const port = server.address().port

const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' })
const page = await browser.newPage()
page.on('console', m => /FAIL|EXCEPTION/.test(m.text()) && console.log('[page]', m.text()))
page.on('pageerror', e => console.log('[pageerror]', e.message))
await page.goto(`http://127.0.0.1:${port}/test`)
await page.waitForFunction('window.__R && window.__R.done', { timeout: 120000 })
const { checks } = await page.evaluate('window.__R')

let failures = 0
for (const c of checks) {
  console.log(`${c.ok ? '✓' : '✗ FAIL'} ${c.label}`)
  if (!c.ok) failures++
}
await browser.close()
server.close()
console.log(failures ? `\n✗ ${failures} failure(s)` : '\n✓ search intelligence: all checks passed')
process.exit(failures ? 1 : 0)
