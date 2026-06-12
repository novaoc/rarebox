/**
 * Booth day journal — the table's ledger.
 *
 * Every movement at the table is one entry:
 *   sale       — a listing left for cash            (cash in)
 *   trade-out  — a listing left in a trade          (± cash on top)
 *   trade-in   — an item arrived via a trade
 *   buy        — an item arrived for cash           (cash out)
 *
 * `cash` is the signed money movement of the entry (+ into your pocket,
 * − out of it); `price` is the item's value (asking price for outgoing,
 * agreed value for incoming). One trade can produce several entries —
 * they share a `tradeId` so "151 box + $20 for an OP5 box" reads as one
 * deal in the log and the export.
 *
 * Totals are a fold over entries, so the same function prices "today at
 * this booth" and "this booth all-time" — the Excel export uses both.
 */

const JOURNAL_KEY = 'rarebox_booth_journal'

// Plenty for a show season; keeps localStorage far from quota.
const MAX_ENTRIES = 2000

export const KINDS = {
  sale: { label: 'Sold', emoji: '💵' },
  'trade-out': { label: 'Traded away', emoji: '🔁' },
  'trade-in': { label: 'Traded in', emoji: '📥' },
  buy: { label: 'Bought', emoji: '💰' },
}

export function loadJournal() {
  try {
    const entries = JSON.parse(localStorage.getItem(JOURNAL_KEY)) || []
    // v1 entries carried mode: 'cash' | 'trade' and no cash field
    for (const e of entries) {
      if (e.kind) continue
      e.kind = e.mode === 'trade' ? 'trade-out' : 'sale'
      e.cash = e.kind === 'sale' ? (e.price || 0) : 0
      delete e.mode
    }
    return entries
  } catch { return [] }
}

export function saveJournal(entries) {
  try { localStorage.setItem(JOURNAL_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES))) } catch { /* quota */ }
}

export function generateJournalId() {
  return 'jr-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

/** Newest first. One entry = one movement (a single unit or incoming item). */
export function addEntry(entries, { boothId, boothName, kind, name, setName, price, cash, game, type, cardId, tradeId }) {
  entries.unshift({
    id: generateJournalId(),
    ts: Date.now(),
    boothId, boothName: boothName || '',
    kind: KINDS[kind] ? kind : 'sale',
    name: name || '', setName: setName || '',
    price: price || 0,
    cash: cash || 0,
    game: game || '', type: type || 'card', cardId: cardId || '',
    ...(tradeId ? { tradeId } : {}),
  })
  saveJournal(entries)
  return entries[0]
}

export function removeEntry(entries, id) {
  const i = entries.findIndex(e => e.id === id)
  if (i !== -1) { entries.splice(i, 1); saveJournal(entries) }
}

export function boothEntries(entries, boothId) {
  return entries.filter(e => e.boothId === boothId)
}

export function todayEntries(entries, boothId = null) {
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0)
  const t0 = dayStart.getTime()
  return entries.filter(e => e.ts >= t0 && (!boothId || e.boothId === boothId))
}

export function journalTotals(entries) {
  const t = {
    sales: { count: 0, cash: 0 },
    buys: { count: 0, cost: 0 },
    tradesOut: { count: 0, value: 0 },
    tradesIn: { count: 0, value: 0 },
    tradeCash: 0, // net cash that rode on top of trades
    cashNet: 0,   // everything in − everything out
  }
  for (const e of entries) {
    const cash = e.cash || 0
    t.cashNet += cash
    if (e.kind === 'sale') { t.sales.count++; t.sales.cash += cash }
    else if (e.kind === 'buy') { t.buys.count++; t.buys.cost += -cash }
    else if (e.kind === 'trade-out') { t.tradesOut.count++; t.tradesOut.value += e.price || 0; t.tradeCash += cash }
    else if (e.kind === 'trade-in') { t.tradesIn.count++; t.tradesIn.value += e.price || 0; t.tradeCash += cash }
  }
  return t
}
