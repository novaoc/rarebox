/**
 * Collectr → Rarebox import
 * Handles both CSV and Excel (.xlsx) exports from Collectr.
 * Built by Nova — GitHub: @novaoc
 */
import * as XLSX from 'xlsx'

const GAME_MAP = {
  pokemon: 'pokemon',
  yugioh: 'yu-gi-oh',
  'magic: the gathering': 'magic',
  mtg: 'magic',
  magic: 'magic',
  'one piece': 'one-piece',
  lorcana: 'lorcana',
  riftbound: 'riftbound',
}

const VARIANCE_MAP = {
  normal: 'normal',
  holofoil: 'holofoil',
  'reverse holo': 'reverseHolofoil',
  'reverse holofoil': 'reverseHolofoil',
  'master ball reverse holo': 'reverseHolofoil',
  'poke ball reverse holo': 'reverseHolofoil',
}

const GRADE_RE = /^(PSA|BGS|CGC|ACE)\s+(\d+(?:\.\d+)?)/

const COLORS = ['#58a6ff', '#f5a623', '#3fb950', '#da3633', '#a371f7', '#f778ba', '#7ee787', '#d2a8ff']

function normalizeGame(raw) {
  const c = raw.trim().toLowerCase()
  for (const [key, val] of Object.entries(GAME_MAP)) {
    if (c.includes(key)) return val
  }
  return null
}

function isJapanese(productName, setName) {
  const text = (productName + ' ' + setName).toLowerCase()
  return text.includes('(jp)')
}

function parseCost(val) {
  if (val == null || val === '') return 0
  const cleaned = String(val).replace(/[$,"]/g, '')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

function parseGrade(raw) {
  if (!raw || raw.trim().toLowerCase() === 'ungraded') return [null, null]
  const m = GRADE_RE.exec(raw.trim())
  if (m) return [m[1], m[2]]
  for (const company of ['PSA', 'BGS', 'CGC', 'ACE']) {
    if (raw.trim().toUpperCase().startsWith(company)) {
      const rest = raw.trim().slice(company.length).trim()
      const g = rest.match(/(\d+(?:\.\d+)?)/)
      return [company, g ? g[1] : '10']
    }
  }
  return [null, null]
}

function mapVariance(v) {
  if (!v) return null
  return VARIANCE_MAP[v.trim().toLowerCase()] || null
}

function uuid() {
  return crypto.randomUUID()
}

/**
 * Find a column value by prefix match (handles date-stamped columns
 * like "Market Price (As of 2026-03-31)").
 */
function colByPrefix(row, prefix) {
  for (const key of Object.keys(row)) {
    if (key.toLowerCase().startsWith(prefix.toLowerCase())) {
      return (row[key] || '').trim()
    }
  }
  return ''
}

export function convertRow(row) {
  const pname = (row['Portfolio Name'] || '').trim()
  const category = (row['Category'] || '').trim()
  const setName = (row['Set'] || '').trim()
  const productName = (row['Product Name'] || '').trim()
  const cardNumber = (row['Card Number'] || '').trim()
  const rarity = (row['Rarity'] || '').trim()
  const variance = (row['Variance'] || '').trim()
  const gradeRaw = (row['Grade'] || '').trim()
  const condition = (row['Card Condition'] || '').trim()
  const costStr = (row['Average Cost Paid'] || '').trim()
  const qtyStr = (row['Quantity'] || '').trim()
  const marketPriceStr = colByPrefix(row, 'Market Price')
  const priceOverrideStr = (row['Price Override'] || '').trim()
  const dateAdded = (row['Date Added'] || '').trim()
  const notes = (row['Notes'] || '').trim()

  const game = normalizeGame(category)
  const isPkmn = game === 'pokemon'
  const jp = isPkmn && isJapanese(productName, setName)
  const cost = parseCost(costStr)
  const quantity = Math.max(1, parseInt(qtyStr, 10) || 1)
  const hasCardNumber = cardNumber.length > 0
  const [gradingCompany, grade] = parseGrade(gradeRaw)
  const now = new Date().toISOString()

  // Price override takes precedence over market price
  const overridePrice = parseCost(priceOverrideStr)
  const marketPrice = overridePrice > 0 ? overridePrice : parseCost(marketPriceStr)

  const base = {
    id: uuid(),
    quantity,
    purchasePrice: cost,
    purchaseDate: dateAdded || null,
    notes,
    addedAt: now,
    lastPriceUpdate: now,
  }

  if (!isPkmn) base.game = game

  if (!hasCardNumber) {
    // ── Sealed product ───────────────────────────────────────────────────
    base.type = 'sealed'
    base.name = productName
    base.setName = setName
    base.sealedType = 'booster_box'
    base.currentValue = marketPrice || null
    base.pcUrl = ''
    base.imageUrl = ''
    if (condition) base.condition = condition
  } else if (gradingCompany) {
    // ── Graded slab ──────────────────────────────────────────────────────
    base.type = 'graded'
    base.gradingCompany = gradingCompany
    base.grade = grade || '10'
    base.currentValue = marketPrice || null
    base.cardData = {
      name: productName,
      number: cardNumber,
      set: { name: setName },
      rarity,
      images: { small: '', large: '' },
    }
    if (isPkmn) base._lang = jp ? 'ja' : null
    if (condition) base.condition = condition
  } else {
    // ── Raw card ─────────────────────────────────────────────────────────
    base.type = 'card'
    base.priceVariant = mapVariance(variance)
    base.currentMarketPrice = marketPrice || null
    base.cardData = {
      name: productName,
      number: cardNumber,
      set: { name: setName },
      rarity,
      images: { small: '', large: '' },
    }
    if (isPkmn) base._lang = jp ? 'ja' : null
    if (condition) base.condition = condition
  }

  return { portfolioName: pname || 'Uncategorized', item: base }
}

// ── CSV parsing ────────────────────────────────────────────────────────────

function parseLine(line) {
  const result = []
  let current = ''
  let inQuotes = false

  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)

  return result.map(f => {
    if (f.startsWith('"') && f.endsWith('"')) return f.slice(1, -1)
    return f
  })
}

/**
 * Strip BOM (Byte Order Mark) from text — Windows CSV exports often include this.
 */
function stripBom(text) {
  return text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text
}

export function convertCsv(text, onlyPortfolio) {
  text = stripBom(text)
  const lines = text.split('\n').filter(l => l.trim())
  if (lines.length < 2) throw new Error('CSV is empty or has no data rows')

  const header = parseLine(lines[0])
  const groups = {}

  for (let i = 1; i < lines.length; i++) {
    const row = parseLine(lines[i])
    const entry = {}
    for (let j = 0; j < header.length; j++) {
      entry[header[j].trim()] = (row[j] || '').trim()
    }

    const { portfolioName, item } = convertRow(entry)
    if (onlyPortfolio && portfolioName !== onlyPortfolio) continue
    if (!groups[portfolioName]) groups[portfolioName] = []
    groups[portfolioName].push(item)
  }

  const portfolios = Object.entries(groups).map(([name, items], idx) => ({
    id: uuid(),
    name,
    color: COLORS[idx % COLORS.length],
    createdAt: new Date().toISOString(),
    items,
  }))

  return portfolios
}

// ── Excel parsing ──────────────────────────────────────────────────────────

function rowsToObjectArrays(rows) {
  if (rows.length < 2) return []
  const header = rows[0].map(h => String(h ?? '').trim())
  const result = []
  for (let i = 1; i < rows.length; i++) {
    if (rows[i].every(c => c == null || String(c).trim() === '')) continue
    const entry = {}
    for (let j = 0; j < header.length; j++) {
      entry[header[j]] = String(rows[i][j] ?? '').trim()
    }
    result.push(entry)
  }
  return result
}

function convertExcelRows(rows, onlyPortfolio) {
  const entries = rowsToObjectArrays(rows)
  if (entries.length === 0) throw new Error('Excel file has no data rows')

  const groups = {}
  for (const entry of entries) {
    const { portfolioName, item } = convertRow(entry)
    if (onlyPortfolio && portfolioName !== onlyPortfolio) continue
    if (!groups[portfolioName]) groups[portfolioName] = []
    groups[portfolioName].push(item)
  }

  return Object.entries(groups).map(([name, items], idx) => ({
    id: uuid(),
    name,
    color: COLORS[idx % COLORS.length],
    createdAt: new Date().toISOString(),
    items,
  }))
}

// ── Unified import entry point ─────────────────────────────────────────────

/**
 * Parse a Collectr file (CSV or Excel) and return an array of portfolio objects.
 * @param {File} file - The file object from the file input
 * @param {string} [onlyPortfolio] - If set, only include items from this portfolio name
 * @returns {Promise<Array>} Array of portfolio objects
 */
export function parseCollectrFile(file, onlyPortfolio) {
  return new Promise((resolve, reject) => {
    const name = (file.name || '').toLowerCase()
    const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls')

    if (isExcel) {
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const wb = XLSX.read(reader.result, { type: 'array' })
          const sheetName = wb.SheetNames[0]
          if (!sheetName) {
            reject(new Error('Excel file has no sheets'))
            return
          }
          const rows = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '' })
          const portfolios = convertExcelRows(rows, onlyPortfolio)
          resolve(portfolios)
        } catch (e) {
          reject(new Error('Failed to parse Excel file: ' + (e.message || e)))
        }
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsArrayBuffer(file)
    } else {
      const reader = new FileReader()
      reader.onload = () => {
        try {
          const portfolios = convertCsv(reader.result, onlyPortfolio)
          resolve(portfolios)
        } catch (e) {
          reject(e)
        }
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsText(file)
    }
  })
}
