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
  confidence: number
}

export async function scanCard(imageData: string): Promise<ScannedCard | null> {
  const ocr = await recognizeCard(imageData)
  if (!ocr.text || ocr.confidence < 10) return null

  const query = ocr.cardName || ocr.text.slice(0, 80)

  const res = await multiSearch(query, { page: 1, pageSize: 20 })
  const cards = res.cards || []
  if (cards.length === 0) return null

  const matched = pickBestMatch(cards, ocr.cardName, ocr.cardNumber)
  if (!matched) return null

  return {
    id: matched.id,
    name: matched.name,
    setName: matched.set,
    number: matched.number,
    image: matched.image,
    price: matched.price,
    game: matched.game,
    confidence: ocr.confidence,
  }
}

function pickBestMatch(
  cards: any[],
  cardName: string | null,
  cardNumber: string | null,
): any {
  if (!cardNumber && !cardName) return cards[0]

  let candidates = cards

  if (cardNumber) {
    const num = cardNumber.split('/')[0]
    const exact = candidates.filter(
      (c: any) => String(c.number).split('/')[0] === num || c.number === cardNumber,
    )
    if (exact.length > 0) candidates = exact
  }

  if (cardName && candidates.length > 1) {
    const q = cardName.toLowerCase()
    const exact = candidates.filter(
      (c: any) => c.name.toLowerCase() === q,
    )
    if (exact.length === 1) return exact[0]
    const starts = candidates.filter((c: any) =>
      c.name.toLowerCase().startsWith(q),
    )
    if (starts.length === 1) return starts[0]
  }

  return candidates[0]
}
