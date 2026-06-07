import { performOCR, parseCardText } from './ocrWorker.js';
import { searchCards } from './pokemonApi.js';

/**
 * Full Pipeline: Image -> OCR -> API Match -> Card Data
 * @param {string} imageDataUrl 
 * @returns {Promise<{success: boolean, card?: any, error?: string}>}
 */
export async function identifyCard(imageDataUrl) {
  try {
    // 1. OCR
    const rawText = await performOCR(imageDataUrl);
    const { name, number } = parseCardText(rawText);

    if (!name && !number) {
      return { success: false, error: 'Could not detect card text.' };
    }

    // 2. Query API
    // We try to search by Name first. The TCG API query format: `name:"charizard" number:108`
    let query = '';
    if (name) query += `name:"${name}" `;
    if (number) {
      const num = number.split('/')[0]; // Extract "108" from "108/106"
      query += `number:${num}`;
    }

    const results = await searchCards(query.trim());
    
    if (results.data && results.data.length > 0) {
      // Use the first result as the best match
      return { success: true, card: results.data[0] };
    }

    return { 
      success: false, 
      error: 'Card found in text but not matched in database.',
      detected: { name, number } 
    };
  } catch (err) {
    console.error('Identification pipeline error:', err);
    return { success: false, error: 'Failed to process image.' };
  }
}
