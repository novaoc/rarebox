/**
 * Booth day journal — what actually happened at the table.
 *
 * Table mode appends one entry per unit sold or traded out. The journal is
 * what lets a vendor do five deals back-to-back without falling behind:
 * the booth stays current with two taps, and the recap (cash taken, value
 * traded out) is just a fold over today's entries — no spreadsheet later,
 * no photos to reconstruct from.
 */

const JOURNAL_KEY = 'rarebox_booth_journal'

// Plenty for a show season; keeps localStorage far from quota.
const MAX_ENTRIES = 2000

export function loadJournal() {
  try { return JSON.parse(localStorage.getItem(JOURNAL_KEY)) || [] } catch { return [] }
}

export function saveJournal(entries) {
  try { localStorage.setItem(JOURNAL_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES))) } catch { /* quota */ }
}

export function generateJournalId() {
  return 'jr-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

/** Newest first. mode: 'cash' | 'trade'. One entry = one unit. */
export function addEntry(entries, { boothId, boothName, name, setName, price, mode, game, type, cardId }) {
  entries.unshift({
    id: generateJournalId(),
    ts: Date.now(),
    boothId, boothName: boothName || '',
    name: name || '', setName: setName || '',
    price: price || 0,
    mode: mode === 'trade' ? 'trade' : 'cash',
    game: game || '', type: type || 'card', cardId: cardId || '',
  })
  saveJournal(entries)
  return entries[0]
}

export function removeEntry(entries, id) {
  const i = entries.findIndex(e => e.id === id)
  if (i !== -1) { entries.splice(i, 1); saveJournal(entries) }
}

export function todayEntries(entries, boothId = null) {
  const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0)
  const t0 = dayStart.getTime()
  return entries.filter(e => e.ts >= t0 && (!boothId || e.boothId === boothId))
}

export function journalTotals(entries) {
  const t = { cashCount: 0, cashTotal: 0, tradeCount: 0, tradeTotal: 0 }
  for (const e of entries) {
    if (e.mode === 'trade') { t.tradeCount++; t.tradeTotal += e.price || 0 }
    else { t.cashCount++; t.cashTotal += e.price || 0 }
  }
  return t
}
