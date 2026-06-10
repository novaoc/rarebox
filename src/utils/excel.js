import * as XLSX from 'xlsx'

export function exportPortfolioToExcel(portfolio, filename = null) {
  const wb = XLSX.utils.book_new()

  // Summary sheet
  const summaryData = buildSummarySheet(portfolio)
  const summaryWs = XLSX.utils.aoa_to_sheet(summaryData)
  styleSheet(summaryWs, summaryData)
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Summary')

  // Items sheet
  const itemsData = buildItemsSheet(portfolio.items)
  const itemsWs = XLSX.utils.aoa_to_sheet(itemsData)
  styleSheet(itemsWs, itemsData)
  XLSX.utils.book_append_sheet(wb, itemsWs, 'Items')

  // Cards only sheet (if mixed)
  const cards = portfolio.items.filter(i => i.type === 'card')
  if (cards.length > 0 && cards.length < portfolio.items.length) {
    const cardsData = buildItemsSheet(cards, 'Cards')
    const cardsWs = XLSX.utils.aoa_to_sheet(cardsData)
    XLSX.utils.book_append_sheet(wb, cardsWs, 'Cards')
  }

  const name = filename || `${portfolio.name.replace(/[^a-z0-9]/gi, '_')}_shelf.xlsx`
  XLSX.writeFile(wb, name)
}

export function exportAllPortfolios(portfolios, filename = 'all_shelves.xlsx') {
  const wb = XLSX.utils.book_new()

  // Combined overview
  const allItems = portfolios.flatMap(p => p.items.map(i => ({ ...i, _portfolio: p.name })))
  const overviewData = buildCombinedSheet(portfolios)
  const overviewWs = XLSX.utils.aoa_to_sheet(overviewData)
  XLSX.utils.book_append_sheet(wb, overviewWs, 'Overview')

  // Per-portfolio sheets
  for (const portfolio of portfolios) {
    const data = buildItemsSheet(portfolio.items)
    const ws = XLSX.utils.aoa_to_sheet(data)
    const sheetName = portfolio.name.substring(0, 31) // Excel sheet name limit
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
  }

  XLSX.writeFile(wb, filename)
}

function buildSummarySheet(portfolio) {
  const totalCost = portfolio.items.reduce((s, i) => s + (i.purchasePrice || 0) * (i.quantity || 1), 0)
  const totalValue = portfolio.items.reduce((s, i) => s + getCurrentValue(i) * (i.quantity || 1), 0)
  const gain = totalValue - totalCost
  const gainPct = totalCost > 0 ? (gain / totalCost) * 100 : 0

  return [
    ['Shelf Summary', ''],
    ['', ''],
    ['Shelf Name', portfolio.name],
    ['Total Items', portfolio.items.length],
    ['Total Quantity', portfolio.items.reduce((s, i) => s + (i.quantity || 1), 0)],
    ['', ''],
    ['Total Cost Basis', `$${totalCost.toFixed(2)}`],
    ['Current Market Value', `$${totalValue.toFixed(2)}`],
    ['Total Gain/Loss', `$${gain.toFixed(2)}`],
    ['Return %', `${gainPct.toFixed(2)}%`],
    ['', ''],
    ['Export Date', new Date().toLocaleDateString()],
  ]
}

function buildItemsSheet(items, title = 'Items') {
  const headers = [
    'Type', 'Name', 'Set', 'Card #', 'Variant / Grade',
    'Condition', 'Quantity', 'Purchase Price (each)', 'Current Value (each)',
    'Total Cost', 'Total Value', 'Gain/Loss', 'Return %',
    'Purchase Date', 'Notes'
  ]

  const rows = items.map(item => {
    const qty = item.quantity || 1
    const cost = (item.purchasePrice || 0) * qty
    const current = getCurrentValue(item) * qty
    const gain = current - cost
    const gainPct = cost > 0 ? ((gain / cost) * 100).toFixed(2) + '%' : 'N/A'

    return [
      formatType(item.type),
      getItemName(item),
      item.cardData?.set?.name || item.setName || '',
      item.cardData?.number || '',
      getVariantOrGrade(item),
      item.condition || '',
      qty,
      item.purchasePrice || 0,
      getCurrentValue(item),
      cost,
      current,
      gain,
      gainPct,
      item.purchaseDate || '',
      item.notes || ''
    ]
  })

  return [headers, ...rows]
}

function buildCombinedSheet(portfolios) {
  const headers = [
    'Shelf', 'Type', 'Name', 'Set', 'Quantity',
    'Purchase Price', 'Current Value', 'Gain/Loss', 'Return %'
  ]

  const rows = []
  for (const portfolio of portfolios) {
    const subtotal = { cost: 0, value: 0 }
    for (const item of portfolio.items) {
      const qty = item.quantity || 1
      const cost = (item.purchasePrice || 0) * qty
      const value = getCurrentValue(item) * qty
      subtotal.cost += cost
      subtotal.value += value
      rows.push([
        portfolio.name,
        formatType(item.type),
        getItemName(item),
        item.cardData?.set?.name || item.setName || '',
        qty,
        cost,
        value,
        value - cost,
        cost > 0 ? ((value - cost) / cost * 100).toFixed(2) + '%' : 'N/A'
      ])
    }
    rows.push([`${portfolio.name} Total`, '', '', '', '', subtotal.cost, subtotal.value, subtotal.value - subtotal.cost, ''])
    rows.push([])
  }

  return [headers, ...rows]
}

function getCurrentValue(item) {
  if (item.type === 'card') {
    return item.currentMarketPrice || item.purchasePrice || 0
  }
  return item.currentValue || item.purchasePrice || 0
}

function getItemName(item) {
  if (item.type === 'card' || item.type === 'graded') {
    return item.cardData?.name || item.name || ''
  }
  return item.name || ''
}

function getVariantOrGrade(item) {
  if (item.type === 'graded') {
    return `${item.gradingCompany || 'PSA'} ${item.grade || '10'}`
  }
  return item.variant || item.priceVariant || ''
}

function formatType(type) {
  const map = { card: 'Card', sealed: 'Sealed', graded: 'Graded Slab' }
  return map[type] || type
}

function styleSheet(ws, data) {
  // Set column widths
  ws['!cols'] = [
    { wch: 20 }, { wch: 25 }, { wch: 20 }, { wch: 10 },
    { wch: 20 }, { wch: 12 }, { wch: 10 }, { wch: 18 },
    { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 10 }, { wch: 15 }, { wch: 30 }
  ]
}
