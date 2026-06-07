import { createWorker } from 'tesseract.js';

/**
 * OCR Worker Service
 * Handles client-side text extraction using Tesseract.js
 */

let worker = null;

async function getWorker() {
  if (worker) return worker;
  worker = await createWorker('eng');
  return worker;
}

/**
 * Perform OCR on an image
 * @param {string|HTMLImageElement|HTMLCanvasElement|File} image 
 * @returns {Promise<string>}
 */
export async function performOCR(image) {
  const w = await getWorker();
  const { data: { text } } = await w.recognize(image);
  return text;
}

/**
 * Parse OCR text to find potential card names and numbers
 * @param {string} text 
 * @returns {{name: string, number: string}}
 */
export function parseCardText(text) {
  // Normalize text: remove extra whitespace, common misreads
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  
  // 1. Look for Set Number pattern: "digits/digits" (e.g., 108/106)
  const numberPattern = /(\d+)\/(\d+)/;
  let cardNumber = '';
  
  for (const line of lines) {
    const match = line.match(numberPattern);
    if (match) {
      cardNumber = match[0];
      break;
    }
  }

  // 2. Extract potential name
  // Usually the largest text or at the top. 
  // We'll take the first line that isn't purely numbers or "HP"
  let cardName = '';
  for (const line of lines) {
    if (!line.match(/^\d+$/) && !line.match(/HP/i) && line.length > 3) {
      // Basic cleaning: remove common junk characters
      cardName = line.replace(/[|] /g, '').trim();
      break;
    }
  }

  return { name: cardName, number: cardNumber };
}
