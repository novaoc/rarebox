/**
 * ISO wantlist — the cards & sealed products you're hunting, matched
 * against booths the moment you scan them.
 *
 * The table-show reality this serves: the good stuff is often NOT on
 * display (binders too risky to leave out, $1–50 cards impractical to
 * spread), so walking up and asking is the only way to know. With a
 * wantlist, scanning a booth QR answers it instantly — including for
 * hidden stock, because the QR carries the whole inventory.
 *
 * Matching is exact-first: entries added from search carry the same
 * canonical ids booth listings do (card ids per game; TCGplayer product
 * ids for sealed), so `type:game:id` equality nails it. Hand-typed booth
 * listings fall back to token name matching, gated on card number when
 * both sides have one — loose enough to catch "Ahri - Inquisitive" vs
 * "ahri inquisitive", strict enough not to light up every Pikachu.
 */
import { tokenMatch } from './search'

const WANTLIST_KEY = 'rarebox_wantlist'

export function loadWantlist() {
  try { return JSON.parse(localStorage.getItem(WANTLIST_KEY)) || [] } catch { return [] }
}

export function saveWantlist(wants) {
  try { localStorage.setItem(WANTLIST_KEY, JSON.stringify(wants)) } catch { /* quota */ }
}

export function generateWantId() {
  return 'want-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

/** Canonical identity for exact matching. Empty when the entry has no id. */
export function wantKey(e) {
  return e.cardId ? `${e.type || 'card'}:${e.game || ''}:${e.cardId}` : ''
}

function normNumber(n) {
  // "015" and "15" are the same card; "TG15" stays "tg15"
  return String(n || '').trim().toLowerCase().replace(/^0+(?=\d)/, '')
}

/** Does a single booth item satisfy a single want? */
export function itemMatchesWant(item, want) {
  const ik = item.cardId ? `${item.type || 'card'}:${item.game || ''}:${item.cardId}` : ''
  const wk = wantKey(want)
  if (wk && ik) return wk === ik
  // Fallback for hand-typed listings: same game (when both declare one),
  // every word of the wanted name present, and numbers agree if both exist.
  if (want.game && item.game && want.game !== item.game) return false
  if (!tokenMatch(want.name, item.name, item.setName)) return false
  const wn = normNumber(want.number)
  const inum = normNumber(item.number)
  if (wn && inum && wn !== inum) return false
  return true
}

/**
 * Match a booth's items against the wantlist.
 * Returns { hits: [{ index, item, want }], wantIds: Set } — index keys the
 * highlight in the booth grid, wantIds drives "N of your wants are here".
 */
export function matchBooth(booth, wants) {
  const hits = []
  const wantIds = new Set()
  const items = booth?.items || []
  for (let i = 0; i < items.length; i++) {
    for (const w of wants) {
      if (itemMatchesWant(items[i], w)) {
        hits.push({ index: i, item: items[i], want: w })
        wantIds.add(w.id)
        break // one want per listing is enough to light it up
      }
    }
  }
  return { hits, wantIds }
}

/** Match every saved shop at once — "which tables at this show have my cards". */
export function matchShops(shops, wants) {
  const out = new Map() // shopId → { count, wantIds }
  if (!wants.length) return out
  for (const s of shops) {
    const { hits, wantIds } = matchBooth(s.booth, wants)
    if (hits.length) out.set(s.id, { count: hits.length, wantIds })
  }
  return out
}
