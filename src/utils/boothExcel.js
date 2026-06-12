/**
 * Booth ledger → Excel. One workbook per booth:
 *   Summary  — earnings & movement totals, all-time and today
 *   Ledger   — every movement (sold / traded / bought), newest first
 *   Listings — what's on the table right now
 *
 * Same SheetJS path as the shelf exports (excel.js).
 */
import * as XLSX from 'xlsx'
import { journalTotals, todayEntries, KINDS } from './boothJournal'
import { boothTotal } from './booth'

export function exportBoothLedger(booth, entries) {
  const wb = XLSX.utils.book_new()

  const summary = XLSX.utils.aoa_to_sheet(buildSummary(booth, entries))
  summary['!cols'] = [{ wch: 26 }, { wch: 16 }, { wch: 16 }]
  XLSX.utils.book_append_sheet(wb, summary, 'Summary')

  const ledger = XLSX.utils.aoa_to_sheet(buildLedger(entries))
  ledger['!cols'] = [{ wch: 19 }, { wch: 13 }, { wch: 34 }, { wch: 24 }, { wch: 11 }, { wch: 8 }, { wch: 12 }, { wch: 11 }, { wch: 11 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, ledger, 'Ledger')

  const listings = XLSX.utils.aoa_to_sheet(buildListings(booth))
  listings['!cols'] = [{ wch: 34 }, { wch: 24 }, { wch: 8 }, { wch: 11 }, { wch: 8 }, { wch: 6 }, { wch: 12 }, { wch: 12 }]
  XLSX.utils.book_append_sheet(wb, listings, 'Listings')

  const stem = (booth.name || 'booth').replace(/[^a-z0-9]/gi, '_').toLowerCase()
  const date = new Date().toISOString().split('T')[0]
  XLSX.writeFile(wb, `${stem}_ledger_${date}.xlsx`)
}

function totalsRows(label, t) {
  return [
    [label, '', ''],
    ['Sales (cash in)', t.sales.count, round(t.sales.cash)],
    ['Purchases (cash out)', t.buys.count, round(-t.buys.cost)],
    ['Cash on trades (net)', '', round(t.tradeCash)],
    ['Traded away (value)', t.tradesOut.count, round(t.tradesOut.value)],
    ['Traded in (value)', t.tradesIn.count, round(t.tradesIn.value)],
    ['NET CASH', '', round(t.cashNet)],
    ['', '', ''],
  ]
}

function buildSummary(booth, entries) {
  const all = journalTotals(entries)
  const today = journalTotals(todayEntries(entries, booth.id))
  return [
    ['Booth', booth.name || ''],
    ['Venue', [booth.venue, booth.table && `Table ${booth.table}`].filter(Boolean).join(' · ')],
    ['Exported', new Date().toLocaleString()],
    ['', '', ''],
    ['', 'Count', 'Cash / Value $'],
    ...totalsRows('— ALL TIME —', all),
    ...totalsRows('— TODAY —', today),
    ['Current listings', booth.items?.length || 0, round(boothTotal(booth))],
  ]
}

function buildLedger(entries) {
  const headers = ['Date', 'Action', 'Item', 'Set', 'Game', 'Type', 'Value $', 'Cash in $', 'Cash out $', 'Trade group']
  const rows = entries.map(e => [
    new Date(e.ts).toLocaleString(),
    KINDS[e.kind]?.label || e.kind,
    e.name, e.setName || '', e.game || '', e.type || '',
    round(e.price),
    e.cash > 0 ? round(e.cash) : '',
    e.cash < 0 ? round(-e.cash) : '',
    e.tradeId || '',
  ])
  return [headers, ...rows]
}

function buildListings(booth) {
  const headers = ['Item', 'Set', 'Number', 'Game', 'Type', 'Qty', 'Asking $ (each)', 'Asking $ (total)']
  const rows = (booth.items || []).map(it => [
    it.name, it.setName || '', it.number || '', it.game || '', it.type || '',
    it.qty || 1, round(it.price), round((it.price || 0) * (it.qty || 1)),
  ])
  return [headers, ...rows]
}

function round(n) {
  return Math.round((n || 0) * 100) / 100
}
