import { recognizeCard, recognizeJapaneseName } from './ocrService'
import { multiSearch } from '../services/tcg/multiSearch'
import { getJapaneseCardDetail } from '../services/pokemonApi'

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
  /** the query that produced candidates (or the best read when nothing hit) */
  usedQuery: string | null
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

// Japanese cards live in tcgdex, not pokemontcg.io. OCR'd names are imperfect
// (e.g. "メガリザドンX" or "めメガリザ…" for メガリザードンX), so slide a
// window over each candidate read — substrings of decreasing length, skipping
// up to 2 junk leading chars — until the substring search hits. When the card
// number is known, prefer a hit set that actually contains that number.
async function tcgdexNameSearch(fragment: string): Promise<any[]> {
  try {
    const res = await fetch(`https://api.tcgdex.net/v2/ja/cards?name=${encodeURIComponent(fragment)}`, {
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return []
    const arr = await res.json()
    return Array.isArray(arr) && arr.length <= 100 ? arr : []
  } catch {
    return []
  }
}

async function searchJapanese(queries: string[], cardNumber: string | null): Promise<ScannedCard[]> {
  const num = cardNumber ? parseInt(cardNumber.split('/')[0], 10) : null
  let briefs: any[] = []
  let fallback: any[] = []

  outer:
  for (const query of queries.slice(0, 3)) {
    const q = query.replace(/\s+/g, '')
    for (const offset of [0, 1, 2]) {
      for (const len of [8, 6, 4, 3]) {
        if (offset + len > q.length) continue
        const frag = q.slice(offset, offset + len)
        const arr = await tcgdexNameSearch(frag)
        if (arr.length === 0) continue
        if (num != null && arr.some(b => parseInt(b.localId, 10) === num)) {
          briefs = arr
          break outer
        }
        if (fallback.length === 0) fallback = arr
        break // this offset matched something; try next offset for a number-verified hit
      }
    }
  }
  if (briefs.length === 0) briefs = fallback
  if (briefs.length === 0) return []

  if (num != null && briefs.length > 1) {
    const byNum = briefs.filter(b => parseInt(b.localId, 10) === num)
    if (byNum.length > 0) briefs = byNum
  }

  const detailed = await Promise.all(briefs.slice(0, 8).map(async b => {
    try {
      const d: any = await getJapaneseCardDetail(b.id)
      return {
        id: d.id,
        name: d.name,
        setName: d.set?.name || '',
        number: d.number || b.localId || '',
        image: d.images?.small || '',
        price: d.tcgplayer?.prices?.normal?.market ?? null,
        game: 'pokemon',
      } as ScannedCard
    } catch {
      return null
    }
  }))
  return detailed.filter(Boolean) as ScannedCard[]
}

export async function scanCard(imageData: string, onProgress?: (pct: number) => void): Promise<ScanResult> {
  const ocr = await recognizeCard(imageData, onProgress)
  console.info('[scan] OCR read', {
    queries: ocr.queries,
    number: ocr.cardNumber,
    confidence: ocr.confidence,
    text: ocr.text.slice(0, 160),
  })
  const result: ScanResult = {
    card: null,
    candidates: [],
    ocrText: ocr.text,
    ocrConfidence: ocr.confidence,
    usedQuery: ocr.queries[0] || null,
  }

  // English queries first (name-band read, then full-frame read)
  let allCards: any[] = []
  let usedQuery: string | null = null
  for (const q of ocr.queries) {
    allCards = await searchWithTimeout(q, 15)
    console.info(`[scan] EN search "${q}" → ${allCards.length} hits`)
    if (allCards.length > 0) { usedQuery = q; break }
  }

  // Japanese fallback — the search outcome is the language detector: if no
  // English query hit anything, re-read the name band with the jpn model.
  if (allCards.length === 0) {
    const jpQueries = await recognizeJapaneseName(imageData)
    console.info('[scan] JP fallback reads', jpQueries)
    if (jpQueries.length > 0) {
      allCards = await searchJapanese(jpQueries, ocr.cardNumber)
      console.info(`[scan] JP search → ${allCards.length} hits`)
      if (allCards.length > 0) {
        result.usedQuery = jpQueries[0]
        usedQuery = null // JP reads are too noisy for name ranking
      }
    }
  }

  // Last resort: raw OCR text
  if (allCards.length === 0 && ocr.text.length >= 5) {
    const rawQuery = ocr.text
      .replace(/[^a-zA-Z\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 80)
    if (rawQuery.length >= 5) {
      allCards = await searchWithTimeout(rawQuery, 10)
      console.info(`[scan] raw-text search "${rawQuery}" → ${allCards.length} hits`)
      if (allCards.length > 0) usedQuery = rawQuery
    }
  }

  result.candidates = allCards as ScannedCard[]
  if (result.candidates.length > 0) {
    if (usedQuery) result.usedQuery = usedQuery
    result.card = pickBestMatch(result.candidates, usedQuery, ocr.cardNumber)
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
    const num = parseInt(cardNumber.split('/')[0], 10)
    const byNum = filtered.filter(
      (c: any) => parseInt(String(c.number).split('/')[0], 10) === num,
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
