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

export async function scanCard(imageData: string): Promise<ScanResult> {
  const ocr = await recognizeCard(imageData)
  const result: ScanResult = {
    card: null,
    candidates: [],
    ocrText: ocr.text,
    ocrConfidence: ocr.confidence,
  }

  // Try to search with the extracted query
  let allCards: any[] = []
  if (ocr.searchQuery) {
    try {
      const res = await multiSearch(ocr.searchQuery, { page: 1, pageSize: 15 })
      allCards = (res.cards || [])
    } catch {}
  }

  // If no results from the clean query, try the raw text as a last resort
  if (allCards.length === 0 && ocr.text.length >= 5) {
    const rawQuery = ocr.text
      .replace(/[^a-zA-Z\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80)
    if (rawQuery.length >= 5) {
      try {
        const res = await multiSearch(rawQuery, { page: 1, pageSize: 10 })
        allCards = (res.cards || [])
      } catch {}
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
    // Exact name match
    const exact = filtered.filter(
      (c: any) => c.name.toLowerCase() === q,
    )
    if (exact.length === 1) return exact[0]
    // Name starts with query
    const starts = filtered.filter((c: any) =>
      c.name.toLowerCase().startsWith(q),
    )
    if (starts.length === 1) return starts[0]
    // All words in query appear in name
    const qWords = q.split(/\s+/)
    const allMatch = filtered.filter((c: any) =>
      qWords.every(w => c.name.toLowerCase().includes(w)),
    )
    if (allMatch.length === 1) return allMatch[0]
    if (allMatch.length > 1) filtered = allMatch
  }

  return filtered[0]
}
