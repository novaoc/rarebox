import Tesseract from 'tesseract.js'

export interface OcrResult {
  text: string
  confidence: number
  searchQuery: string | null
  cardNumber: string | null
}

export async function recognizeCard(imageData: string): Promise<OcrResult> {
  const { data } = await Tesseract.recognize(
    imageData,
    'eng',
    { logger: () => {} },
  )

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
  const words = text.split(/\s+/).map(cleanWord).filter(Boolean)

  // Find lines that contain capitalized words (likely card names)
  const nameLines = lines.filter(line => {
    const cleaned = line.replace(/[^a-zA-Z\s]/g, '').trim()
    const capWords = cleaned.split(/\s+/).filter(w =>
      /^[A-Z][a-z]/.test(w) && w.length >= 3
    )
    return capWords.length >= 1 && cleaned.length >= 4
  })

  // Score each line: prefer longer, more capitalized words
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
    // Take the capitalized words as the query
    const query = best.capWords.join(' ')
    if (query.length >= 3) return query
  }

  // Fallback: remove non-alpha chars, find longest meaningful fragment
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
