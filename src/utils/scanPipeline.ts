import { recognizeCard } from './ocrService'
import { multiSearch } from '../services/tcg/multiSearch'

export interface ScannedCard {
  id: string
  name: string
  setName: string
  number: string
  image: string
  price: number | null
  game: string
}

export interface ScanResult {
  card: ScannedCard | null
  candidates: ScannedCard[]
  ocrText: string
  ocrConfidence: number
}

// Fast providers for scan — skip Riftbound & OnePiece (slow initial loads)
const SCAN_PROVIDERS = ['pokemon', 'mtg', 'lorcana']

async function searchWithTimeout(query: string, size: number): Promise<any[]> {
  const timeout = 25000
  try {
    const res: any = await Promise.race([
      multiSearch(query, { page: 1, pageSize: size, providers: SCAN_PROVIDERS }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), timeout)),
    ])
    return res?.cards || []
  } catch {
    return []
  }
}

export async function scanCard(imageData: string, onProgress?: (pct: number) => void): Promise<ScanResult> {
  const ocr = await recognizeCard(imageData, onProgress)
  const result: ScanResult = {
    card: null,
    candidates: [],
    ocrText: ocr.text,
    ocrConfidence: ocr.confidence,
  }

  let allCards: any[] = []
  if (ocr.searchQuery) {
    allCards = await searchWithTimeout(ocr.searchQuery, 15)
  }

  // Fallback: use raw OCR text
  if (allCards.length === 0 && ocr.text.length >= 5) {
    const rawQuery = ocr.text
      .replace(/[^a-zA-Z\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80)
    if (rawQuery.length >= 5) {
      allCards = await searchWithTimeout(rawQuery, 10)
    }
  }

  result.candidates = allCards as ScannedCard[]
  if (result.candidates.length > 0) {
    result.card = pickBestMatch(result.candidates, ocr.searchQuery, ocr.cardNumber)
  }

  return result
}

function pickBestMatch(
  candidates: ScannedCard[],
  query: string | null,
  cardNumber: string | null,
): ScannedCard {
  if (!query && !cardNumber) return candidates[0]
  let filtered = candidates

  if (cardNumber) {
    const num = cardNumber.split('/')[0]
    const byNum = filtered.filter(
      (c: any) => String(c.number).split('/')[0] === num || c.number === cardNumber,
    )
    if (byNum.length > 0) filtered = byNum
  }

  if (query && filtered.length > 1) {
    const q = query.toLowerCase()
    const exact = filtered.filter((c: any) => c.name.toLowerCase() === q)
    if (exact.length === 1) return exact[0]
    const starts = filtered.filter((c: any) => c.name.toLowerCase().startsWith(q))
    if (starts.length === 1) return starts[0]
    const qWords = q.split(/\s+/)
    const allMatch = filtered.filter((c: any) =>
      qWords.every(w => c.name.toLowerCase().includes(w)),
    )
    if (allMatch.length === 1) return allMatch[0]
    if (allMatch.length > 1) filtered = allMatch
  }

  return filtered[0]
}
