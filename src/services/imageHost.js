/**
 * Booth-logo upload — browser → Imgur → https URL.
 *
 * The branding codec stores logos as plain https URLs (a QR can't carry
 * image bytes), which used to mean "host it yourself and paste a link".
 * This closes that gap: pick a file, it's downscaled on-device and posted
 * straight to Imgur's anonymous-upload API (CORS `*`, verified), and the
 * returned URL drops into the same `lg` field. Rarebox never proxies or
 * stores the image — same direct-from-device pattern as TinyURL links.
 *
 * IMGUR_CLIENT_ID is a publishable identifier (that's how Imgur's API is
 * designed for client apps — it only permits anonymous uploads, ~1,250/day
 * across all users of the app). Empty string = feature hidden in the UI.
 *
 * Caveat surfaced in the editor: anonymous Imgur images can be removed
 * after long periods without views — fine for a show banner, not an
 * archival store.
 */

export const IMGUR_CLIENT_ID = '' // set to enable logo uploads

export function logoUploadAvailable() {
  return Boolean(IMGUR_CLIENT_ID)
}

/** Downscale + recompress on-device so a phone photo doesn't ship 8MB. */
async function shrink(file, maxEdge = 512) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const w = Math.max(1, Math.round(bitmap.width * scale))
  const h = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w; canvas.height = h
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h)
  bitmap.close?.()
  // PNG keeps transparency for logo marks; most logos compress small anyway
  const blob = await new Promise(res => canvas.toBlob(res, 'image/png'))
  if (!blob) throw new Error('Could not read that image')
  return blob
}

/** file → https URL on Imgur. Throws with a user-facing message. */
export async function uploadLogo(file) {
  if (!IMGUR_CLIENT_ID) throw new Error('Logo upload is not configured')
  if (!/^image\//.test(file.type)) throw new Error('That file is not an image')
  const blob = await shrink(file)
  const form = new FormData()
  form.append('image', blob, 'logo.png')
  form.append('type', 'file')
  const resp = await fetch('https://api.imgur.com/3/image', {
    method: 'POST',
    headers: { Authorization: `Client-ID ${IMGUR_CLIENT_ID}` },
    body: form,
  })
  const data = await resp.json().catch(() => null)
  const link = data?.data?.link
  if (!resp.ok || !link || !/^https:\/\//.test(link)) {
    throw new Error(data?.data?.error || 'Upload failed — try again or paste a link instead')
  }
  return link
}
