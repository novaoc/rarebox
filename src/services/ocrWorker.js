/**
 * OCR Worker Service
 * Handles client-side text extraction using Tesseract.js
 * Wrapped in a dynamic import to prevent boot-time crashes if loading fails
 */

let worker = null;

async function getWorker() {
  if (worker) return worker;
  
  try {
    // Dynamic import to handle potential path/worker resolution issues in production
    const { createWorker } = await import('tesseract.js');
    worker = await createWorker('eng', 1, {
      logger: m => console.log('OCR:', m),
      errorHandler: e => console.error('OCR Error:', e),
    });
    return worker;
  } catch (err) {
    console.error('Failed to initialize Tesseract worker:', err);
    throw err;
  }
}

export async function performOCR(image) {
  try {
    const w = await getWorker();
    const { data: { text } } = await w.recognize(image);
    return text;
  } catch (err) {
    console.error('OCR execution failed:', err);
    return '';
  }
}

export function parseCardText(text) {
  if (!text) return { name: '', number: '' };
  
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const numberPattern = /(\d+)\/(\d+)/;
  let cardNumber = '';
  
  for (const line of lines) {
    const match = line.match(numberPattern);
    if (match) {
      cardNumber = match[0];
      break;
    }
  }

  let cardName = '';
  for (const line of lines) {
    if (!line.match(/^\d+$/) && !line.match(/HP/i) && line.length > 3) {
      cardName = line.replace(/[|] /g, '').trim();
      break;
    }
  }

  return { name: cardName, number: cardNumber };
}
