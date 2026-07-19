/**
 * Build an origin-absolute same-device shelf link.
 * Path uses /shelf/ (friendly alias). Does not imply public sharing.
 *
 * @param {string} id shelf id
 * @param {string} [origin] defaults to location.origin when available
 * @returns {string}
 */
export function buildShelfLink(id, origin) {
  const rawOrigin = origin != null
    ? String(origin)
    : (typeof globalThis !== 'undefined' && globalThis.location?.origin) || ''
  const base = rawOrigin.replace(/\/+$/, '')
  const encoded = encodeURIComponent(String(id ?? ''))
  return `${base}/shelf/${encoded}`
}
