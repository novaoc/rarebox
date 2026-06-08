import Tesseract from 'tesseract.js'

export interface OcrResult {
  text: string
  confidence: number
  cardName: string | null
  cardNumber: string | null
}

export async function recognizeCard(imageData: string): Promise<OcrResult> {
  const { data } = await Tesseract.recognize(imageData, 'eng', {
    // PSM 6 assumes a uniform block of text (good for card layouts)
    // PSM 3 is fully automatic — let Tesseract decide
    // PSM 7 treats image as a single text line
    // For trading cards, PSM 3 works well.
  })

  const text = data.text.trim()
  const confidence = data.confidence
  const cardName = extractCardName(text)
  const cardNumber = extractCardNumber(text)

  return { text, confidence, cardName, cardNumber }
}

function extractCardName(text: string): string | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return null

  // Try lines that look like card names (not numbers, not set codes)
  for (const line of lines) {
    const stripped = line.replace(/[«»"„“^°]/g, '').trim()
    if (
      stripped.length >= 3 &&
      !/^\d/.test(stripped) &&
      !/^\d{1,4}\/\d{1,4}$/.test(stripped) &&
      !/^(energy|trainer|supporter|item|stadium|tool|pokemon)\b/i.test(stripped) &&
      !/^(hp|type|stage|weakness|retreat)/i.test(stripped) &&
      !/^[A-Z]{2,5}\s*$/.test(stripped)
    ) {
      return stripped
    }
  }

  // Fallback: return the longest line (often the card name is prominent)
  const longest = lines.reduce((a, b) => a.length >= b.length ? a : b, '')
  return longest.length >= 3 ? longest.replace(/[«»"„“^°]/g, '').trim() : null
}

function extractCardNumber(text: string): string | null {
  const match = text.match(/(\d{1,4})\s*\/\s*(\d{1,4})/)
  if (match) return `${match[1]}/${match[2]}`
  return null
}
