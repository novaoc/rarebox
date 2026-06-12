/**
 * Card localization + perspective rectification — pure canvas JS.
 *
 * The same classical-CV pipeline every verified card scanner uses before
 * hashing (Sobel edges → Hough lines → corner intersection → perspective
 * warp). Perceptual hashes have no tolerance for tilt or background, so
 * flattening the card first is what makes phone photos match reference
 * scans.
 *
 * findCard(img) → array of 252x352 rectified-card canvases (one per
 * plausible quad hypothesis) or null (caller falls back to plain crops).
 */

const DOWNSCALE_W = 360
const OUT_W = 252
const OUT_H = 352

function toGray(img, w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(img, 0, 0, w, h)
  const { data } = ctx.getImageData(0, 0, w, h)
  const g = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) {
    g[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2]
  }
  return g
}

// Sobel gradient magnitude → thresholded edge points
function edgePoints(g, w, h, multiplier = 2.2) {
  const mag = new Float32Array(w * h)
  let sum = 0
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x
      const gx =
        -g[i - w - 1] - 2 * g[i - 1] - g[i + w - 1] +
        g[i - w + 1] + 2 * g[i + 1] + g[i + w + 1]
      const gy =
        -g[i - w - 1] - 2 * g[i - w] - g[i - w + 1] +
        g[i + w - 1] + 2 * g[i + w] + g[i + w + 1]
      const m = Math.sqrt(gx * gx + gy * gy)
      mag[i] = m
      sum += m
    }
  }
  const mean = sum / ((w - 2) * (h - 2))
  const thresh = Math.max(24, mean * multiplier)
  const pts = []
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      if (mag[y * w + x] > thresh) pts.push(x, y)
    }
  }
  return pts
}

// Hough transform: x cosθ + y sinθ = ρ. Returns the best line per zone:
// left/right (near-vertical) and top/bottom (near-horizontal).
function houghQuad(pts, w, h) {
  const THETAS = []
  // near-vertical: θ ∈ [-28°, 28°]; near-horizontal: θ ∈ [62°, 118°]
  for (let t = -28; t <= 28; t += 1) THETAS.push((t * Math.PI) / 180)
  for (let t = 62; t <= 118; t += 1) THETAS.push((t * Math.PI) / 180)
  const cosT = THETAS.map(Math.cos)
  const sinT = THETAS.map(Math.sin)
  const diag = Math.ceil(Math.sqrt(w * w + h * h))
  const nTheta = THETAS.length
  const acc = new Int32Array(nTheta * (2 * diag + 1))

  for (let p = 0; p < pts.length; p += 2) {
    const x = pts[p]
    const y = pts[p + 1]
    for (let t = 0; t < nTheta; t++) {
      const rho = Math.round(x * cosT[t] + y * sinT[t]) + diag
      acc[t * (2 * diag + 1) + rho]++
    }
  }

  // Collect candidate lines per zone, then pick the OUTERMOST strong line —
  // busy card art produces strong interior lines, but the card's border is
  // the outermost long edge before the background.
  const cand = { left: [], right: [], top: [], bottom: [] }
  const midX = w / 2
  const midY = h / 2
  for (let t = 0; t < nTheta; t++) {
    const vertical = Math.abs(THETAS[t]) <= (30 * Math.PI) / 180
    for (let r = 0; r <= 2 * diag; r++) {
      const votes = acc[t * (2 * diag + 1) + r]
      if (votes < 25) continue
      const rho = r - diag
      if (vertical) {
        const x = (rho - midY * sinT[t]) / cosT[t]
        if (x >= -10 && x < w * 0.47) cand.left.push({ theta: THETAS[t], rho, votes, pos: x })
        else if (x > w * 0.53 && x <= w + 10) cand.right.push({ theta: THETAS[t], rho, votes, pos: x })
      } else {
        const y = (rho - midX * cosT[t]) / sinT[t]
        if (y >= -10 && y < h * 0.47) cand.top.push({ theta: THETAS[t], rho, votes, pos: y })
        else if (y > h * 0.53 && y <= h + 10) cand.bottom.push({ theta: THETAS[t], rho, votes, pos: y })
      }
    }
  }
  function pick(list, mode, dir) {
    if (list.length === 0) return null
    if (mode === 'strongest') return list.reduce((a, b) => (b.votes > a.votes ? b : a))
    const maxVotes = Math.max(...list.map(l => l.votes))
    const strong = list.filter(l => l.votes >= maxVotes * 0.55)
    strong.sort((a, b) => (dir === 'min' ? a.pos - b.pos : b.pos - a.pos))
    return strong[0]
  }
  // Two hypotheses: strongest lines (clean borders win) and outermost strong
  // lines (busy full-art interiors lose). The caller rectifies both and the
  // index match distance decides which framing was right.
  const out = []
  for (const mode of ['strongest', 'outermost']) {
    const zones = {
      left: pick(cand.left, mode, 'min'),
      right: pick(cand.right, mode, 'max'),
      top: pick(cand.top, mode, 'min'),
      bottom: pick(cand.bottom, mode, 'max'),
    }
    if (zones.left && zones.right && zones.top && zones.bottom) out.push(zones)
  }
  return out.length ? out : null
}

function intersect(l1, l2) {
  // x cosθ1 + y sinθ1 = ρ1 ; x cosθ2 + y sinθ2 = ρ2
  const a1 = Math.cos(l1.theta), b1 = Math.sin(l1.theta)
  const a2 = Math.cos(l2.theta), b2 = Math.sin(l2.theta)
  const det = a1 * b2 - a2 * b1
  if (Math.abs(det) < 1e-9) return null
  return {
    x: (l1.rho * b2 - l2.rho * b1) / det,
    y: (a1 * l2.rho - a2 * l1.rho) / det,
  }
}

function quadArea(c) {
  // shoelace over tl,tr,br,bl
  const p = [c.tl, c.tr, c.br, c.bl]
  let a = 0
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4
    a += p[i].x * p[j].y - p[j].x * p[i].y
  }
  return Math.abs(a) / 2
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

// Solve the 8-dof homography mapping dest corners → src corners (Gaussian elim)
function homography(srcCorners, outW = OUT_W, outH = OUT_H) {
  const dst = [[0, 0], [outW, 0], [outW, outH], [0, outH]]
  const src = [srcCorners.tl, srcCorners.tr, srcCorners.br, srcCorners.bl]
  const A = []
  const B = []
  for (let i = 0; i < 4; i++) {
    const [dx, dy] = dst[i]
    const { x: sx, y: sy } = src[i]
    A.push([dx, dy, 1, 0, 0, 0, -sx * dx, -sx * dy]); B.push(sx)
    A.push([0, 0, 0, dx, dy, 1, -sy * dx, -sy * dy]); B.push(sy)
  }
  // gaussian elimination
  for (let col = 0; col < 8; col++) {
    let piv = col
    for (let r = col + 1; r < 8; r++) if (Math.abs(A[r][col]) > Math.abs(A[piv][col])) piv = r
    if (Math.abs(A[piv][col]) < 1e-9) return null
    ;[A[col], A[piv]] = [A[piv], A[col]]
    ;[B[col], B[piv]] = [B[piv], B[col]]
    for (let r = 0; r < 8; r++) {
      if (r === col) continue
      const f = A[r][col] / A[col][col]
      for (let c = col; c < 8; c++) A[r][c] -= f * A[col][c]
      B[r] -= f * B[col]
    }
  }
  const hm = []
  for (let i = 0; i < 8; i++) hm.push(B[i] / A[i][i])
  return hm // [a,b,c,d,e,f,g,h]: srcX=(a x + b y + c)/(g x + h y + 1)
}

function warp(img, corners, outW = OUT_W, outH = OUT_H) {
  const hm = homography(corners, outW, outH)
  if (!hm) return null
  const [a, b, c, d, e, f, g2, h2] = hm

  const srcC = document.createElement('canvas')
  srcC.width = img.width
  srcC.height = img.height
  const sctx = srcC.getContext('2d', { willReadFrequently: true })
  sctx.drawImage(img, 0, 0)
  const sdata = sctx.getImageData(0, 0, img.width, img.height).data
  const sw = img.width
  const sh = img.height

  const out = document.createElement('canvas')
  out.width = outW
  out.height = outH
  const octx = out.getContext('2d')
  const oimg = octx.createImageData(outW, outH)
  const od = oimg.data

  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const den = g2 * x + h2 * y + 1
      const sx = (a * x + b * y + c) / den
      const sy = (d * x + e * y + f) / den
      const oi = (y * outW + x) * 4
      if (sx < 0 || sy < 0 || sx >= sw - 1 || sy >= sh - 1) {
        od[oi + 3] = 255
        continue
      }
      const x0 = sx | 0, y0 = sy | 0
      const fx = sx - x0, fy = sy - y0
      const i00 = (y0 * sw + x0) * 4
      const i10 = i00 + 4
      const i01 = i00 + sw * 4
      const i11 = i01 + 4
      for (let ch = 0; ch < 3; ch++) {
        od[oi + ch] =
          sdata[i00 + ch] * (1 - fx) * (1 - fy) +
          sdata[i10 + ch] * fx * (1 - fy) +
          sdata[i01 + ch] * (1 - fx) * fy +
          sdata[i11 + ch] * fx * fy
      }
      od[oi + 3] = 255
    }
  }
  octx.putImageData(oimg, 0, 0)
  return out
}

/**
 * Find and rectify the card in a photo.
 * Returns an array of flattened-card canvases (252x352 × `outScale`), or
 * null. Landscape quads yield BOTH 90° rotations — we can't know which way
 * the card lies, and the wrong one just won't match downstream.
 */
export function findCard(img, outScale = 1) {
  const scale = DOWNSCALE_W / img.width
  const w = DOWNSCALE_W
  const h = Math.round(img.height * scale)
  const g = toGray(img, w, h)

  // Collect valid quad hypotheses across edge thresholds (dark cards on dark
  // tables need lower thresholds) and both line-selection modes, dedupe, and
  // rectify each — the caller picks the winner by match distance.
  const quads = []
  for (const mult of [2.2, 1.5, 1.0]) {
    const pts = edgePoints(g, w, h, mult)
    if (pts.length < 200 || pts.length > w * h * 0.5) continue
    const zoneSets = houghQuad(pts, w, h)
    if (!zoneSets) continue
    for (const zones of zoneSets) {
      const tl = intersect(zones.top, zones.left)
      const tr = intersect(zones.top, zones.right)
      const br = intersect(zones.bottom, zones.right)
      const bl = intersect(zones.bottom, zones.left)
      if (!tl || !tr || !br || !bl) continue
      const c = { tl, tr, br, bl }
      if (!validQuad(c, w, h)) continue
      const dup = quads.some(q =>
        dist(q.tl, tl) < 8 && dist(q.tr, tr) < 8 && dist(q.br, br) < 8 && dist(q.bl, bl) < 8)
      if (!dup) quads.push(c)
      if (quads.length >= 4) break
    }
    if (quads.length >= 4) break
  }

  const warps = []
  const ow = Math.round(OUT_W * outScale)
  const oh = Math.round(OUT_H * outScale)
  for (const c of quads) {
    const full = {
      tl: { x: c.tl.x / scale, y: c.tl.y / scale },
      tr: { x: c.tr.x / scale, y: c.tr.y / scale },
      br: { x: c.br.x / scale, y: c.br.y / scale },
      bl: { x: c.bl.x / scale, y: c.bl.y / scale },
    }
    if (c.landscape) {
      // Cycling the source-corner assignment rotates the output 90°: the
      // quad's long edges land on the portrait dest's vertical sides. Both
      // cycles cover the two ways a card can lie.
      const cw = warp(img, { tl: full.tr, tr: full.br, br: full.bl, bl: full.tl }, ow, oh)
      const ccw = warp(img, { tl: full.bl, tr: full.tl, br: full.tr, bl: full.br }, ow, oh)
      if (cw) warps.push(cw)
      if (ccw) warps.push(ccw)
    } else {
      const wp = warp(img, full, ow, oh)
      if (wp) warps.push(wp)
    }
  }
  return warps.length ? warps : null
}

// sanity: size, edge balance, card-like aspect — portrait OR landscape
// (cards lie sideways in plenty of real photos; the caller warps landscape
// quads with rotated corner assignments so the output is still upright)
function validQuad(c, w, h) {
  const area = quadArea(c)
  if (area < w * h * 0.12 || area > w * h * 0.98) return false
  const wTop = dist(c.tl, c.tr), wBot = dist(c.bl, c.br)
  const hL = dist(c.tl, c.bl), hR = dist(c.tr, c.br)
  if (Math.min(wTop, wBot) / Math.max(wTop, wBot) < 0.6) return false
  if (Math.min(hL, hR) / Math.max(hL, hR) < 0.6) return false
  const aspect = ((wTop + wBot) / 2) / ((hL + hR) / 2)
  const portrait = aspect >= 0.5 && aspect <= 1.05
  const landscape = aspect >= 1.15 && aspect <= 2.0
  if (!portrait && !landscape) return false
  c.landscape = landscape
  return true
}
