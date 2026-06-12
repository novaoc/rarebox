/**
 * Copy tesseract.js's worker + WASM core into public/ocr/ so OCR runs
 * same-origin.
 *
 * Why: the app's CSP (script-src 'self', worker-src 'self' blob:) blocks
 * tesseract.js's default behavior of importScripts-ing its worker and core
 * from jsDelivr — which silently killed the whole OCR fallback in the card
 * scanner. Serving the exact files from our own origin satisfies the CSP
 * with no policy loosening; traineddata still streams from
 * tessdata.projectnaptha.com, which is a fetch() and already allowed by
 * connect-src https:.
 *
 * Runs from package.json pre-dev/pre-build hooks, so public/ocr/ is always
 * version-synced with the installed tesseract.js (it's gitignored — never
 * commit these; a stale copy + upgraded package = subtle worker/core
 * mismatch bugs).
 *
 * Only the simd-lstm core ships: we run OEM 1 (LSTM) exclusively, and every
 * 2026 browser has WASM SIMD. ocrService passes corePath as this explicit
 * file, which tesseract uses verbatim (directory-style corePath would probe
 * for relaxed-SIMD variants we don't ship).
 */
import { copyFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'public', 'ocr')
mkdirSync(out, { recursive: true })

const FILES = [
  ['node_modules/tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'],
]

for (const [src, dst] of FILES) {
  copyFileSync(join(root, src), join(out, dst))
  console.log(`ocr-assets: ${dst}`)
}
