import { createWorker } from 'tesseract.js'

export interface OcrResult {
  text: string
  confidence: number
  /** candidate search queries, best first (name-band read, then full-frame read) */
  queries: string[]
  cardNumber: string | null
}

// tesseract.js v7 notes:
// - the logger must be configured at createWorker() time; recognize() args are
//   postMessage'd to the Web Worker, so passing a function there throws
//   DataCloneError and kills every scan.
// - mixing eng+jpn in one worker degrades both scripts, so we keep two
//   single-language workers; the jpn one is only created when needed.
let _engPromise: Promise<any> | null = null
let _jpnPromise: Promise<any> | null = null
let _progressCb: ((pct: number) => void) | null = null

const JP_CHARS = /[぀-ヿ一-鿿]/g
// ー and punctuation-like kana don't count toward "is this Japanese" evidence
const JP_SOLID_CHARS = /[぀-ゖァ-ヺ一-鿿]/g

function makeWorker(lang: string): Promise<any> {
  return createWorker(lang, 1, {
    // Same-origin worker + core (synced into public/ocr/ by
    // scripts/sync-ocr-assets.mjs) — the CSP blocks tesseract's default
    // jsDelivr importScripts, which killed every OCR fallback. corePath is
    // the explicit simd-lstm file: a directory would make the worker probe
    // for relaxed-SIMD variants we don't ship. Absolute URLs because the
    // bootstrap runs in a blob: worker, where relative paths resolve against
    // the blob, not the app.
    workerPath: new URL('/ocr/worker.min.js', window.location.origin).href,
    corePath: new URL('/ocr/tesseract-core-simd-lstm.wasm.js', window.location.origin).href,
    logger: (m: any) => {
      if (m.status === 'recognizing text' && _progressCb) {
        _progressCb(Math.round((m.progress || 0) * 100))
      }
    },
  })
}

function getEngWorker(): Promise<any> {
  if (!_engPromise) {
    _engPromise = makeWorker('eng')
    _engPromise.catch(() => { _engPromise = null })
  }
  return _engPromise
}

function getJpnWorker(): Promise<any> {
  if (!_jpnPromise) {
    _jpnPromise = makeWorker('jpn')
    _jpnPromise.catch(() => { _jpnPromise = null })
  }
  return _jpnPromise
}

export async function preloadOcrWorker() {
  await getEngWorker()
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = dataUrl
  })
}

// Crop a relative region of the card, upscale it and preprocess — tesseract
// reads isolated, enlarged bands (card name / collector number) far better
// than a full frame. `filter` is a canvas filter string; `threshold` (0-255)
// binarizes after drawing, which helps on foil/holo card stock.
function cropBand(
  img: HTMLImageElement,
  region: [number, number, number, number],
  scale = 3,
  filter = 'grayscale(1) contrast(2)',
  threshold: number | null = null,
): string {
  const [x0, y0, x1, y1] = region
  const sx = Math.round(img.width * x0)
  const sy = Math.round(img.height * y0)
  const sw = Math.round(img.width * (x1 - x0))
  const sh = Math.round(img.height * (y1 - y0))
  const c = document.createElement('canvas')
  c.width = sw * scale
  c.height = sh * scale
  const ctx = c.getContext('2d')!
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  try { ctx.filter = filter } catch { /* old Safari */ }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height)
  if (threshold != null) {
    const id = ctx.getImageData(0, 0, c.width, c.height)
    const px = id.data
    for (let i = 0; i < px.length; i += 4) {
      const v = (px[i] + px[i + 1] + px[i + 2]) / 3 < threshold ? 0 : 255
      px[i] = px[i + 1] = px[i + 2] = v
    }
    ctx.putImageData(id, 0, 0)
  }
  return c.toDataURL('image/png')
}

// Name band: below the top edge, clear of the left evolution icon and right HP
const NAME_BAND: [number, number, number, number] = [0.10, 0.025, 0.72, 0.095]
// Collector number: bottom-left corner strip
const NUM_BAND: [number, number, number, number] = [0, 0.92, 0.45, 1.0]

async function ocrPass(worker: any, image: string, params: Record<string, string>): Promise<{ text: string, confidence: number }> {
  await worker.setParameters(params)
  try {
    const { data } = await worker.recognize(image)
    return { text: data.text || '', confidence: data.confidence || 0 }
  } finally {
    await worker.setParameters({ tessedit_pageseg_mode: '3', tessedit_char_whitelist: '' })
  }
}

export async function recognizeCard(imageData: string, onProgress?: (pct: number) => void): Promise<OcrResult> {
  const worker = await getEngWorker()
  const cb = onProgress || null
  _progressCb = cb
  try {
    const full = await ocrPass(worker, imageData, { tessedit_pageseg_mode: '3' })
    let cardNumber = extractCardNumber(full.text)
    const queries: string[] = []

    if (typeof document !== 'undefined') {
      try {
        const img = await loadImage(imageData)
        const nameRead = await ocrPass(worker, cropBand(img, NAME_BAND), { tessedit_pageseg_mode: '6' })
        const bandQuery = buildEnQuery(nameRead.text)
        if (bandQuery) queries.push(bandQuery)
        if (!cardNumber) {
          const numRead = await ocrPass(worker, cropBand(img, NUM_BAND, 4), {
            tessedit_pageseg_mode: '6',
            tessedit_char_whitelist: '0123456789/ ',
          })
          cardNumber = extractCardNumber(numRead.text)
        }
      } catch { /* band passes are best-effort */ }
    }

    const fullQuery = buildEnQuery(full.text)
    if (fullQuery && !queries.includes(fullQuery)) queries.push(fullQuery)

    return { text: full.text, confidence: full.confidence, queries, cardNumber }
  } finally {
    // don't stomp a newer scan's callback if two scans overlap
    if (_progressCb === cb) _progressCb = null
  }
}

/**
 * Japanese fallback — re-reads the name band with a jpn-only worker (the eng
 * model shreds kana/kanji, and mixing langs in one worker degrades both).
 * Foil/holo card stock makes single reads unstable, so we OCR three
 * preprocessing variants and return every distinct candidate, best first.
 * Called by the scan pipeline only when English search produced nothing, so
 * the ~12MB jpn traineddata is fetched lazily.
 */
export async function recognizeJapaneseName(imageData: string): Promise<string[]> {
  if (typeof document === 'undefined') return []
  const worker = await getJpnWorker()
  try {
    const img = await loadImage(imageData)
    const variants = [
      cropBand(img, NAME_BAND, 3, 'grayscale(1) contrast(2)'),
      cropBand(img, NAME_BAND, 3, 'grayscale(1) blur(0.6px) contrast(2)'),
      cropBand(img, NAME_BAND, 3, 'grayscale(1) contrast(2)', 110),
    ]
    const found: { q: string, solid: number }[] = []
    for (const band of variants) {
      const read = await ocrPass(worker, band, { tessedit_pageseg_mode: '7' })
      const q = buildJpQuery(read.text)
      if (q && !found.some(f => f.q === q)) {
        found.push({ q, solid: (q.match(JP_SOLID_CHARS) || []).length })
      }
    }
    found.sort((a, b) => b.solid - a.solid)
    return found.map(f => f.q)
  } catch {
    return []
  }
}

function buildJpQuery(text: string): string | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const jpLines = lines
    .map(line => ({ line, solid: (line.match(JP_SOLID_CHARS) || []).length }))
    .filter(l => l.solid >= 3)
  if (jpLines.length === 0) return null
  jpLines.sort((a, b) => b.solid - a.solid)
  // OCR sprinkles spaces between glyphs — keep only JP chars, joined
  const cleaned = (jpLines[0].line.match(JP_CHARS) || []).join('')
  return cleaned.length >= 3 ? cleaned : null
}

function buildEnQuery(text: string): string | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const nameLines = lines.filter(line => {
    const cleaned = line.replace(/[^a-zA-Z\s]/g, '').trim()
    const capWords = cleaned.split(/\s+/).filter(w =>
      /^[A-Z][a-z]/.test(w) && w.length >= 3
    )
    return capWords.length >= 1 && cleaned.length >= 4
  })

  const scored = nameLines.map((line, idx) => {
    const cleaned = line.replace(/[^a-zA-Z\s]/g, '').trim()
    const capWords = cleaned.split(/\s+/).filter(w =>
      /^[A-Z]/.test(w) && w.length >= 3
    )
    // earlier lines get a bonus — card names sit at the top of the frame
    const score = capWords.length * 10 + cleaned.length + Math.max(0, 12 - idx * 3)
    return { line, score, capWords }
  })

  scored.sort((a, b) => b.score - a.score)

  if (scored.length > 0) {
    const best = scored[0]
    const query = best.capWords.join(' ')
    if (query.length >= 3) return query
  }

  const fragments = text
    .split(/[^a-zA-Z\s]/)
    .map(s => s.trim())
    .filter(s => s.split(/\s+/).filter(w => w.length >= 3).length >= 1)
    .sort((a, b) => b.length - a.length)

  if (fragments.length > 0) {
    const meaningful = fragments[0].split(/\s+/).filter(w => /^[A-Z][a-z]/.test(w) && w.length >= 3)
    if (meaningful.length > 0) return meaningful.join(' ')
  }

  return null
}

function extractCardNumber(text: string): string | null {
  // OCR often splits digit runs with spaces ("1 10/080") — join before validating.
  // Numerators run 1-3 digits (up to ~300 with secret rares), denominators 2-3.
  const m = text.match(/(\d(?:[\d ]{0,3}\d)?)\s*\/\s*(\d(?:[\d ]{0,2}\d)?)/)
  if (!m) return null
  const a = m[1].replace(/\s+/g, '')
  const b = m[2].replace(/\s+/g, '')
  if (!a || !b || a.length > 3 || b.length > 3 || b.length < 2) return null
  return `${a}/${b}`
}
