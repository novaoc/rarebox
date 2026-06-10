/**
 * Multi-frame QR transfer protocol ("RBX2").
 *
 * A single QR code tops out at ~2.9 KB, so any real shelf overflows it.
 * Instead the sender splits the gzipped backup into chunks and cycles
 * them as an animated QR; the receiver's camera collects frames in any
 * order (the loop wraps) until the set is complete — the same approach
 * air-gapped wallets use.
 *
 * Frame layout (binary, QR byte mode):
 *   bytes 0-3  magic "RBX2"
 *   bytes 4-5  chunk index, uint16 LE
 *   bytes 6-7  chunk count, uint16 LE
 *   bytes 8+   payload chunk
 */

const MAGIC = [0x52, 0x42, 0x58, 0x32] // "RBX2"
const HEADER_SIZE = 8

/** Default payload bytes per frame — small enough to scan reliably at
 *  arm's length on a mid phone camera, with medium error correction. */
export const CHUNK_SIZE = 700

export function buildFrames(bytes, chunkSize = CHUNK_SIZE) {
  const total = Math.max(1, Math.ceil(bytes.length / chunkSize))
  if (total > 0xffff) throw new Error('Payload too large to frame')
  const frames = []
  for (let i = 0; i < total; i++) {
    const chunk = bytes.subarray(i * chunkSize, (i + 1) * chunkSize)
    const frame = new Uint8Array(HEADER_SIZE + chunk.length)
    frame.set(MAGIC, 0)
    frame[4] = i & 0xff
    frame[5] = (i >> 8) & 0xff
    frame[6] = total & 0xff
    frame[7] = (total >> 8) & 0xff
    frame.set(chunk, HEADER_SIZE)
    frames.push(frame)
  }
  return frames
}

export function isFrame(bytes) {
  return (
    bytes &&
    bytes.length > HEADER_SIZE &&
    MAGIC.every((b, i) => bytes[i] === b)
  )
}

/** Collects RBX2 frames in any order; tells you when the set is complete. */
export class FrameCollector {
  constructor() {
    this.total = null
    this.chunks = new Map()
  }

  /** @returns true if this frame was new */
  feed(bytes) {
    if (!isFrame(bytes)) return false
    const u8 = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes)
    const seq = u8[4] | (u8[5] << 8)
    const total = u8[6] | (u8[7] << 8)
    if (this.total === null) this.total = total
    if (total !== this.total || seq >= total) return false // different transfer
    if (this.chunks.has(seq)) return false
    this.chunks.set(seq, u8.subarray(HEADER_SIZE))
    return true
  }

  get received() {
    return this.chunks.size
  }

  get done() {
    return this.total !== null && this.chunks.size === this.total
  }

  assemble() {
    if (!this.done) throw new Error('Transfer incomplete')
    let len = 0
    for (let i = 0; i < this.total; i++) len += this.chunks.get(i).length
    const out = new Uint8Array(len)
    let off = 0
    for (let i = 0; i < this.total; i++) {
      out.set(this.chunks.get(i), off)
      off += this.chunks.get(i).length
    }
    return out
  }
}

// ── gzip helpers (shared by sync + scan paths) ────────────────────────

export async function gzip(str) {
  const cs = new CompressionStream('gzip')
  const writer = cs.writable.getWriter()
  writer.write(new TextEncoder().encode(str))
  writer.close()
  return new Uint8Array(await new Response(cs.readable).arrayBuffer())
}

export async function gunzip(bytes) {
  const ds = new DecompressionStream('gzip')
  const writer = ds.writable.getWriter()
  writer.write(bytes)
  writer.close()
  return new TextDecoder().decode(await new Response(ds.readable).arrayBuffer())
}

export function bytesToBase64(bytes) {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

export function base64ToBytes(b64) {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}
