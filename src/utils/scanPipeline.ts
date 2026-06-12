import { recognizeCard, recognizeJapaneseName } from './ocrService'
import { multiSearch, resolveCard } from '../services/tcg/multiSearch'
import { getJapaneseCardDetail } from '../services/pokemonApi'
import { getCachedCardById } from '../services/tcg/cardCache'
import {
  identifyCard, CONFIDENT_DIST, CANDIDATE_DIST, RECALL_DIST,
  grayVec, nameVec, nccDot,
  NCC_ART_WEIGHT, NCC_NAME_WEIGHT, NCC_CONFIDENT, NCC_MARGIN, NCC_FLOOR,
} from './scanMatch'
import { findCard } from './cardRectify'

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

// Resolve a hash match (id+game) to a displayable card via the local cache
// first, then the per-game APIs.
async function resolveMatch(m: { id: string, game: string, lang: string }): Promise<ScannedCard | null> {
  try {
    if (m.game === 'pokemon' && m.lang === 'ja') {
      const d: any = await getJapaneseCardDetail(m.id)
      if (!d) return null
      return {
        id: d.id, name: d.name, setName: d.set?.name || '', number: d.number || '',
        image: d.images?.small || '', price: d.tcgplayer?.prices?.normal?.market ?? null,
        game: 'pokemon',
      }
    }
    const cached: any = getCachedCardById(m.game, m.id)
    if (cached) {
      return {
        id: cached.id, name: cached.name, setName: cached.set || '', number: cached.number || '',
        image: cached.image || '', price: cached.price ?? null, game: m.game,
      }
    }
    const r: any = await resolveCard(m.id, m.game)
    if (!r) return null
    return {
      id: r.id, name: r.name, setName: r.set || r.setName || '', number: r.number || '',
      image: r.image || '', price: r.price ?? null, game: m.game,
    }
  } catch (e) {
    console.warn('[scan] resolveMatch failed for', m.id, e)
    return null
  }
}

// Transient API hiccups (rate limits, blips) must not silently drop the one
// match that was actually right — retry each failed resolution once. Order
// is preserved so hash ranking survives resolution.
async function resolveAll(list: { id: string, game: string, lang: string }[]): Promise<ScannedCard[]> {
  const out = await Promise.all(list.map(resolveMatch))
  if (out.some(r => !r)) {
    await new Promise(r => setTimeout(r, 700))
    await Promise.all(list.map(async (m, i) => {
      if (!out[i]) out[i] = await resolveMatch(m)
    }))
  }
  return out.filter(Boolean) as ScannedCard[]
}

function loadImg(src: string, cors = false): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image()
    if (cors) i.crossOrigin = 'anonymous'
    i.onload = () => res(i)
    i.onerror = rej
    i.src = src
  })
}

export async function scanCard(imageData: string, onProgress?: (pct: number) => void): Promise<ScanResult> {
  // Rectify ONCE at hi-res (×3 ≈ 756px wide) — the warps feed hashing (they
  // downscale internally), the NCC re-rank, and the OCR fallback.
  let flats: HTMLCanvasElement[] | null = null
  try {
    flats = findCard(await loadImg(imageData), 3)
    if (flats) console.info('[scan] rectified', flats.length, 'card candidate(s)')
  } catch { /* rectifier is best-effort */ }

  // ── Primary: perceptual-hash image matching (how real card scanners work).
  // The match IS the identification — name/set/number come from the database.
  try {
    onProgress?.(10)
    const matches = await identifyCard(imageData, 8, { flats: flats || undefined })
    console.info('[scan] image match:', matches.slice(0, 5).map(m => `${m.id}@${m.dist}`))

    // A confident hit with clear separation auto-adds straight away.
    const confident = matches.length > 0 && matches[0].dist <= CONFIDENT_DIST
      && (matches.length === 1 || matches[1].dist - matches[0].dist >= 8)
    if (confident) {
      const one = await resolveAll([matches[0]])
      if (one.length === 1) {
        onProgress?.(100)
        return { card: one[0], candidates: one, ocrText: 'image-match', ocrConfidence: 100, usedQuery: one[0].name }
      }
    }

    // Ambiguous zone. Dim, sleeved, off-angle photos land their TRUE card at
    // hash distance ~23-30 — right where impostors also live, so the hash
    // alone can't decide. With a rectified card in hand, recall loosely and
    // let normalized cross-correlation against the actual reference images
    // pick the winner (NCC is invariant to the brightness/contrast shifts
    // that bend the hashes).
    const recallDist = flats?.length ? RECALL_DIST : CANDIDATE_DIST
    const plausible = matches.filter(m => m.dist <= recallDist)
    if (plausible.length > 0) {
      onProgress?.(50)
      const resolved = await resolveAll(plausible)
      console.info('[scan] resolved', resolved.length, 'of', plausible.length, 'matches')
      if (resolved.length > 0) {
        let ranked = resolved
        let nccBest: number | null = null
        if (flats?.length) {
          // Blend whole-card art correlation with a name-band correlation:
          // art finds the card, the name band splits language twins (EN and
          // JP printings share their artwork pixel for pixel).
          const warpArt = flats.slice(0, 4).map(f => grayVec(f))
          const warpName = flats.slice(0, 4).map(f => nameVec(f))
          const scored = await Promise.all(resolved.map(async c => {
            if (!c.image) return { c, art: null as number | null, ncc: null as number | null }
            try {
              const ref = await loadImg(c.image, true)
              const refArt = grayVec(ref)
              const refName = nameVec(ref)
              const art = Math.max(...warpArt.map(v => nccDot(v, refArt)))
              const name = Math.max(...warpName.map(v => nccDot(v, refName)))
              return { c, art, ncc: NCC_ART_WEIGHT * art + NCC_NAME_WEIGHT * name }
            } catch { return { c, art: null, ncc: null } }
          }))
          scored.sort((a, b) => (b.ncc ?? -2) - (a.ncc ?? -2))
          console.info('[scan] NCC re-rank:', scored.map(s => `${s.c.id}@${s.ncc?.toFixed(2) ?? '—'}`))
          const withNcc = scored.filter(s => s.ncc != null)
          if (withNcc.length > 0) {
            nccBest = withNcc[0].ncc
            const second = withNcc[1]?.ncc ?? -1
            if (nccBest! >= NCC_CONFIDENT && nccBest! - second >= NCC_MARGIN) {
              onProgress?.(100)
              const c = withNcc[0].c
              return { card: c, candidates: [c], ocrText: 'image-match', ocrConfidence: 100, usedQuery: c.name }
            }
            // keep candidates whose ART at least vaguely matches the photo
            const kept = scored.filter(s => s.art == null || s.art >= NCC_FLOOR)
            ranked = (kept.length ? kept : scored).map(s => s.c)
          }
        } else {
          // no rectified card → original behavior: tight threshold, hash order
          ranked = resolved
        }
        onProgress?.(100)
        // Without NCC separation, never auto-add from the ambiguous zone —
        // honest candidates beat a confidently wrong card.
        if (nccBest != null || plausible[0].dist <= CANDIDATE_DIST) {
          return {
            card: null,
            candidates: ranked,
            ocrText: 'image-match',
            ocrConfidence: 100,
            usedQuery: ranked[0].name,
          }
        }
      }
    }
  } catch (e) {
    console.warn('[scan] image match failed, falling back to OCR:', e)
  }

  // ── Fallback: OCR pipeline (older path — also covers games with no index)
  // The band crops assume an upright card filling the frame — true for the
  // raw capture only when the user framed perfectly. When the rectifier
  // found the card, OCR the flattened hi-res warps instead (×3 ≈ 756px wide,
  // what tesseract needs); a landscape quad yields both rotations and the
  // upside-down one just reads garbage and gets skipped. Raw frame last.
  let ocrImages: string[] = [imageData]
  if (flats?.length) {
    ocrImages = [...flats.slice(0, 2).map(c => c.toDataURL('image/jpeg', 0.92)), imageData]
    console.info('[scan] OCR reading rectified card first')
  }

  let ocr = null as Awaited<ReturnType<typeof recognizeCard>> | null
  let ocrImage = imageData
  for (const im of ocrImages) {
    ocr = await recognizeCard(im, onProgress)
    ocrImage = im
    if (ocr.queries.length > 0 || ocr.cardNumber) break
  }
  ocr = ocr!
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
  // English query hit anything, re-read the name band with the jpn model
  // (on the same image the English pass settled on — rectified when found).
  if (allCards.length === 0) {
    const jpQueries = await recognizeJapaneseName(ocrImage)
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
