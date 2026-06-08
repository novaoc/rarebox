import { createWorker } from 'tesseract.js'

export interface OcrResult {
  text: string
  confidence: number
  searchQuery: string | null
  cardNumber: string | null
}

let _worker: any = null
let _preloaded = false

export async function preloadOcrWorker() {
  if (_preloaded) return
  _worker = await createWorker('eng')
  _preloaded = true
}

export async function recognizeCard(imageData: string, onProgress?: (pct: number) => void): Promise<OcrResult> {
  if (!_worker) {
    _worker = await createWorker('eng')
    _preloaded = true
  }

  const { data } = await _worker.recognize(imageData, undefined, {
    logger: (m: any) => {
      if (m.status === 'recognizing text' && onProgress) {
        const pct = Math.round((m.progress || 0) * 100)
        onProgress(pct)
      }
    },
  })

  const text = data.text || ''
  const confidence = data.confidence

  return {
    text,
    confidence,
    searchQuery: buildQuery(text),
    cardNumber: extractCardNumber(text),
  }
}

function cleanWord(w: string): string {
  return w.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '')
}

function buildQuery(text: string): string | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  const nameLines = lines.filter(line => {
    const cleaned = line.replace(/[^a-zA-Z\s]/g, '').trim()
    const capWords = cleaned.split(/\s+/).filter(w =>
      /^[A-Z][a-z]/.test(w) && w.length >= 3
    )
    return capWords.length >= 1 && cleaned.length >= 4
  })

  const scored = nameLines.map(line => {
    const cleaned = line.replace(/[^a-zA-Z\s]/g, '').trim()
    const capWords = cleaned.split(/\s+/).filter(w =>
      /^[A-Z]/.test(w) && w.length >= 3
    )
    const score = capWords.length * 10 + cleaned.length
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
    .filter(s => {
      const words = s.split(/\s+/).filter(w => w.length >= 3)
      return words.length >= 1
    })
    .sort((a, b) => b.length - a.length)

  if (fragments.length > 0) {
    const frag = fragments[0]
    const meaningful = frag.split(/\s+/).filter(w => /^[A-Z][a-z]/.test(w) && w.length >= 3)
    if (meaningful.length > 0) return meaningful.join(' ')
    return frag.slice(0, 60)
  }

  return null
}

function extractCardNumber(text: string): string | null {
  const match = text.match(/(\d{1,4})\s*\/\s*(\d{1,4})/)
  if (match) return `${match[1]}/${match[2]}`
  return null
}
