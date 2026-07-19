/**
 * Graded PriceCharting query helpers.
 *
 * Graded slabs must never be priced from raw/TCGplayer feeds or multipliers.
 * Queries keep full identity — especially Riftbound Signature / alternate-art
 * text in the card name — so a variant cannot silently match a plain printing.
 */

import {
  extractCollectorNumber,
  normalizeCollectorNumber,
  riftboundGradedMissingNumber,
  RIFTBOUND_GRADED_NO_NUMBER_MSG,
  pickRiftboundPcCandidate,
  detectRiftboundVariant,
  isSafeRiftboundGradedMatch,
} from './riftboundVariant.js'

export {
  extractCollectorNumber,
  normalizeCollectorNumber,
  riftboundGradedMissingNumber,
  RIFTBOUND_GRADED_NO_NUMBER_MSG,
  pickRiftboundPcCandidate,
  detectRiftboundVariant,
  isSafeRiftboundGradedMatch,
}

/**
 * @param {object} src
 * @param {string} [src.game]
 * @param {string} [src.name]
 * @param {string} [src.setName]
 * @param {string|number} [src.number]
 * @param {object} [src.cardData]
 * @returns {string}
 */
export function buildGradedPcQuery(src = {}) {
  const name = String(src.name || src.cardData?.name || '').trim()
  const setName = String(src.setName || src.cardData?.set?.name || '').trim()
  const rawNum = src.number ?? src.cardData?.number ?? ''
  const number = String(rawNum || '').trim().replace(/^#/, '')
  const game = String(src.game || src.cardData?.game || '').toLowerCase()

  if (!name && !setName && !number) return ''

  if (game === 'riftbound') {
    // Full name keeps "(Signature)" / variant suffixes — never strip them.
    const parts = ['Riftbound']
    if (setName) parts.push(setName)
    if (name) parts.push(name)
    if (number) parts.push(`#${number}`)
    return parts.join(' ').replace(/\s+/g, ' ').trim()
  }

  const parts = []
  if (name) parts.push(name)
  if (setName) parts.push(setName)
  if (number) parts.push(`#${number}`)
  return parts.join(' ').replace(/\s+/g, ' ').trim()
}

/**
 * Grade token for priceServer.fetchPrice (psa10 / 9 / …).
 * @param {{ type?: string, gradingCompany?: string, grade?: string|number }} item
 * @returns {string}
 */
export function pcGradeForItem(item) {
  if (!item || item.type !== 'graded') return 'ungraded'
  const company = String(item.gradingCompany || 'PSA').toLowerCase()
  const grade = String(item.grade || '10')
  if (grade !== '10') return `grade${grade.replace('.', '_')}`
  if (company === 'psa') return 'psa10'
  if (company === 'bgs') return 'bgs10'
  if (company === 'bgs black') return 'bgs10_black'
  if (company === 'cgc') return 'cgc10'
  if (company === 'cgc pristine') return 'cgc10_pristine'
  if (company === 'sgc') return 'sgc10'
  if (company === 'ace') return 'ace10'
  if (company === 'tag') return 'tag10'
  return 'unsupported10'
}

/**
 * True when a fetchPrice result is a usable graded market number.
 * $0 is valid; null/NaN/undefined are not.
 * @param {unknown} result
 * @returns {boolean}
 */
export function isFiniteGradedPrice(result) {
  const p = result && typeof result === 'object' ? result.price : result
  return typeof p === 'number' && Number.isFinite(p)
}

/**
 * Whether Riftbound graded auto-fetch is allowed for this identity.
 * Requires a collector number (from field or `#n` in query).
 * @param {object} [src]
 * @param {string} [query]
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function riftboundGradedFetchGuard(src = {}, query = '') {
  const game = String(src.game || src.cardData?.game || '').toLowerCase()
  if (game !== 'riftbound') return { ok: true }
  const number = src.number ?? src.cardData?.number ?? ''
  if (riftboundGradedMissingNumber(game, number, query)) {
    return { ok: false, message: RIFTBOUND_GRADED_NO_NUMBER_MSG }
  }
  return { ok: true }
}
