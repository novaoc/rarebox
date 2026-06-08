<template>
  <div class="settings-view">
    <h2 class="settings-title">Settings</h2>

    <!-- Data & Privacy -->
    <div class="settings-section card mb-4">
      <h3 class="settings-section-title">Data & Privacy</h3>
      <p class="settings-desc">All data is stored locally in your browser. Nothing is sent to any server.</p>

      <div class="settings-item">
        <div>
          <div class="settings-item-label">Storage Used</div>
          <div class="settings-item-sub">Portfolios, items, and price cache</div>
        </div>
        <div class="settings-item-value">{{ storageUsed }}</div>
      </div>

      <div class="settings-item">
        <div>
          <div class="settings-item-label">Price History Cache</div>
          <div class="settings-item-sub">{{ cacheCount }} cached price histories</div>
        </div>
        <button class="btn btn-secondary btn-sm" @click="clearPriceCache">Clear Cache</button>
      </div>

      <hr class="divider" />

      <div class="settings-item danger-zone">
        <div>
          <div class="settings-item-label" style="color:var(--danger)">Reset All Data</div>
          <div class="settings-item-sub">Delete all portfolios, items, and cached data. This cannot be undone.</div>
        </div>
        <button class="btn btn-danger btn-sm" @click="confirmReset = true">Reset Everything</button>
      </div>
    </div>

    <!-- Card Database -->
    <div class="settings-section card mb-4">
      <h3 class="settings-section-title">Card Database</h3>
      <p class="settings-desc">All TCG card data is cached locally for instant search. Refresh to update prices.</p>

      <template v-for="(count, game) in cardCounts" :key="game">
        <div v-if="game !== 'total'" class="settings-item">
          <div>
            <div class="settings-item-label">{{ gameLabels[game] || game }}</div>
            <div class="settings-item-sub">{{ count.toLocaleString() }} cards cached</div>
          </div>
        </div>
      </template>

      <div class="settings-item" v-if="cardCounts.total">
        <div>
          <div class="settings-item-label" style="font-weight:600">Total</div>
          <div class="settings-item-sub">{{ cardCounts.total.toLocaleString() }} cards</div>
        </div>
        <button class="btn btn-primary btn-sm" @click="refreshCardDb" :disabled="refreshing">
          {{ refreshing ? 'Refreshing…' : 'Refresh Prices' }}
        </button>
      </div>

      <div v-if="refreshStatus" class="settings-item">
        <div class="settings-item-sub" :style="{ color: refreshError ? 'var(--danger)' : 'var(--success)' }">
          {{ refreshStatus }}
        </div>
      </div>
    </div>

    <!-- Price Data Sources -->
    <div class="settings-section card mb-4">
      <h3 class="settings-section-title">Price Data Sources</h3>
      <p class="settings-desc">All price data is fetched directly in your browser. No API keys or accounts required.</p>

      <div class="settings-item">
        <div>
          <div class="settings-item-label">Card Prices</div>
          <div class="settings-item-sub">Live market prices from pokemontcg.io</div>
        </div>
        <span class="badge badge-success">Active</span>
      </div>
      <div class="settings-item">
        <div>
          <div class="settings-item-label">Price History</div>
          <div class="settings-item-sub">TCGPlayer historical data via tcgdex (Nov 2022+)</div>
        </div>
        <span class="badge badge-success">Active</span>
      </div>
      <div class="settings-item">
        <div>
          <div class="settings-item-label">Sealed & Graded Prices</div>
          <div class="settings-item-sub">PriceCharting — fetched directly from your browser</div>
        </div>
        <span class="badge badge-success">Active</span>
      </div>
    </div>

    <!-- Export -->
    <div class="settings-section card mb-4">
      <h3 class="settings-section-title">Export</h3>
      <p class="settings-desc">Export your portfolio data to Excel for further analysis.</p>

      <div v-for="portfolio in store.portfolios" :key="portfolio.id" class="settings-item">
        <div class="flex items-center gap-2">
          <span class="portfolio-dot" :style="{ background: portfolio.color }"></span>
          <div>
            <div class="settings-item-label">{{ portfolio.name }}</div>
            <div class="settings-item-sub">{{ portfolio.items.length }} items</div>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" @click="exportOne(portfolio)">↓ Export</button>
      </div>

      <hr class="divider" v-if="store.portfolios.length > 1" />

      <div v-if="store.portfolios.length > 1" class="settings-item">
        <div>
          <div class="settings-item-label">All Portfolios</div>
          <div class="settings-item-sub">Export all portfolios to a single Excel file</div>
        </div>
        <button class="btn btn-primary btn-sm" @click="exportAll">↓ Export All</button>
      </div>
    </div>

    <!-- Backup & Restore -->
    <div class="settings-section card mb-4">
      <h3 class="settings-section-title">Backup & Restore</h3>
      <p class="settings-desc">Download your entire collection as a JSON file. Restore it anytime on any device.</p>

      <div class="settings-item">
        <div>
          <div class="settings-item-label">Transfer to Device</div>
          <div class="settings-item-sub">Copy your collection to another device via QR code or clipboard</div>
        </div>
        <button class="btn btn-secondary btn-sm" @click="showLocalSync = true">↑↓ Transfer</button>
      </div>

      <div class="settings-item">
        <div>
          <div class="settings-item-label">Export Backup</div>
          <div class="settings-item-sub">Download all portfolios, settings, and price snapshots</div>
        </div>
        <button class="btn btn-secondary btn-sm" @click="doExportBackup">↓ Download</button>
      </div>

      <div class="settings-item">
        <div>
          <div class="settings-item-label">Import Backup</div>
          <div class="settings-item-sub">Restore from a previously exported backup file</div>
        </div>
        <label class="btn btn-secondary btn-sm backup-import-btn">
          ↑ Import
          <input type="file" accept=".json" @change="handleImport" hidden />
        </label>
      </div>

      <div v-if="importResult" class="settings-item" style="border-bottom:none">
        <div class="import-result" :class="importResult.error ? 'error' : 'success'">
          {{ importResult.error || `Restored ${importResult.portfolios} portfolio(s), ${importResult.snapshots} snapshot(s)` }}
        </div>
      </div>
    </div>

    <!-- Collectr Import -->
    <div class="settings-section card mb-4">
      <h3 class="settings-section-title">Import from Collectr</h3>
      <p class="settings-desc">Upload a Collectr portfolio export CSV to create portfolios in Rarebox. Maps card types, variants, grades, and sealed products automatically.</p>

      <div class="settings-item">
        <div>
          <div class="settings-item-label">Collectr Export File</div>
          <div class="settings-item-sub">Export from Collectr → Portfolios → Export as CSV or Excel</div>
        </div>
        <label class="btn btn-secondary btn-sm backup-import-btn">
          ↑ Select File
          <input type="file" accept=".csv,.xlsx,.xls" @change="handleCollectrImport" hidden />
        </label>
      </div>

      <div v-if="collectrError" class="settings-item" style="border-bottom:none">
        <div class="import-result error">{{ collectrError }}</div>
      </div>
    </div>

    <!-- Price Alerts -->
    <div class="settings-section card mb-4">
      <h3 class="settings-section-title">Price Alerts</h3>
      <p class="settings-desc">Get notified when a card's price crosses your threshold. Alerts are checked when prices refresh.</p>

      <div v-if="allAlerts.length === 0" class="settings-item" style="border-bottom:none">
        <div class="text-muted" style="font-size:13px">No alerts set. View a card and click "Set Price Alert" to create one.</div>
      </div>

      <div v-for="alert in allAlerts" :key="alert.id" class="settings-item">
        <div>
          <div class="settings-item-label">{{ alert.cardName }}</div>
          <div class="settings-item-sub">
            {{ alert.condition === 'above' ? '↑ Above' : '↓ Below' }} ${{ alert.threshold.toFixed(2) }}
            <span v-if="alert.triggered" style="color:#3fb950"> · Triggered</span>
          </div>
        </div>
        <button class="btn btn-ghost btn-icon btn-sm" @click="removeAlertById(alert.id)" style="color:var(--danger)">✕</button>
      </div>

      <div v-if="triggeredCount > 0" class="settings-item" style="border-bottom:none">
        <button class="btn btn-secondary btn-sm" @click="doClearTriggered">Clear {{ triggeredCount }} triggered</button>
      </div>
    </div>

    <!-- About -->
    <div class="settings-section card">
      <h3 class="settings-section-title">About</h3>
      <div class="about-grid">
        <div class="about-item">
          <div class="about-label">Version</div>
          <div class="about-val">1.1.0</div>
        </div>
        <div class="about-item">
          <div class="about-label">Card Prices</div>
          <div class="about-val">pokemontcg.io</div>
        </div>
        <div class="about-item">
          <div class="about-label">Price History</div>
          <div class="about-val">tcgdex (Nov 2022+)</div>
        </div>
        <div class="about-item">
          <div class="about-label">Sealed / Graded</div>
          <div class="about-val">PriceCharting</div>
        </div>
      </div>

      <div class="settings-notes mt-3">
        <div class="note">
          <span>📊</span>
          <p>Card price history comes from the <strong>tcgdex/price-history</strong> GitHub repository (TCGPlayer data). History goes back to November 2022. Current prices are fetched live from <strong>pokemontcg.io</strong>.</p>
        </div>
        <div class="note">
          <span>📦</span>
          <p>Sealed product and graded slab prices are fetched directly from <strong>PriceCharting</strong> — no backend, no API key needed.</p>
        </div>
      </div>
    </div>

    <!-- Reset Confirm Modal -->
    <transition name="fade">
      <div v-if="confirmReset" class="modal-overlay" @click.self="confirmReset = false">
        <div class="modal" style="max-width:420px">
          <div class="modal-header">
            <h3>⚠️ Reset All Data</h3>
            <button class="btn btn-ghost btn-icon" @click="confirmReset = false">✕</button>
          </div>
          <div class="modal-body">
            <p class="text-secondary mb-3">This will permanently delete:</p>
            <ul class="reset-list">
              <li>All {{ store.portfolios.length }} portfolio{{ store.portfolios.length !== 1 ? 's' : '' }}</li>
              <li>All {{ totalItems }} item{{ totalItems !== 1 ? 's' : '' }} across all portfolios</li>
              <li>All cached price data</li>
            </ul>
            <p class="text-danger mt-3" style="font-size:13px;font-weight:600">This cannot be undone.</p>
            <div class="form-group mt-3">
              <label class="form-label">Type "RESET" to confirm</label>
              <input v-model="resetConfirmText" class="input" placeholder="RESET" />
            </div>
          </div>
          <div class="modal-footer">
            <button class="btn btn-secondary" @click="confirmReset = false">Cancel</button>
            <button class="btn btn-danger" :disabled="resetConfirmText !== 'RESET'" @click="doReset">Reset Everything</button>
          </div>
        </div>
      </div>
    </transition>
  </div>

  <LocalSyncModal v-if="showLocalSync" @close="showLocalSync = false" />

  <!-- Collectr Import Overlay -->
  <transition name="fade">
    <div v-if="collectrImporting" class="import-overlay">
      <div class="import-overlay-card">
        <!-- Spinner -->
        <div v-if="collectrPhase !== 'done'" class="import-spinner"></div>
        <div v-else class="import-done-icon">✓</div>

        <!-- Status text -->
        <div class="import-status">{{ collectrImportStatus }}</div>

        <!-- Progress bar (resolving phase) -->
        <div v-if="collectrPhase === 'resolving' && collectrTotal > 0" class="import-progress-wrap">
          <div class="import-progress-bar" :style="{ width: Math.round((collectrResolved / collectrTotal) * 100) + '%' }"></div>
        </div>
        <div v-if="collectrPhase === 'resolving' && collectrTotal > 0" class="import-progress-label">
          {{ collectrResolved }} / {{ collectrTotal }}
        </div>

        <!-- Phase indicators -->
        <div v-if="collectrPhase !== 'done'" class="import-phases">
          <span :class="{ active: collectrPhase === 'parsing' || collectrPhase === 'importing' || collectrPhase === 'resolving' }">Parse</span>
          <span class="import-phase-dot">·</span>
          <span :class="{ active: collectrPhase === 'importing' || collectrPhase === 'resolving' }">Import</span>
          <span class="import-phase-dot">·</span>
          <span :class="{ active: collectrPhase === 'resolving' }">Resolve</span>
        </div>

        <!-- Done button -->
        <button
          v-if="collectrImportDone"
          class="btn btn-primary btn-lg import-done-btn"
          @click="goToDashboard"
        >Go to Dashboard</button>

        <!-- Error -->
        <div v-if="collectrError" class="import-error">
          {{ collectrError }}
          <button class="btn btn-secondary btn-sm mt-2" @click="collectrImporting = false; collectrPhase = ''">Close</button>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { usePortfolioStore } from '../stores/portfolio'
import { exportPortfolioToExcel, exportAllPortfolios } from '../utils/excel'
import { exportBackup, validateBackup, importBackup } from '../utils/backup'
import { parseCollectrFile } from '../utils/collectrImport'
import { getActiveAlerts, getTriggeredAlerts, removeAlert, clearTriggeredAlerts, clearAllAlerts } from '../utils/alerts'
import LocalSyncModal from '../components/LocalSyncModal.vue'
import { getCardCounts, clearCardCache, saveCardDatabaseReady } from '../services/tcg/cardCache'
import { refreshPrices } from '../services/tcg/cardPreloader'
const store = usePortfolioStore()
const router = useRouter()

const confirmReset = ref(false)
const resetConfirmText = ref('')
const showLocalSync = ref(false)

// Alert state
const allAlerts = computed(() => {
  const active = getActiveAlerts()
  const triggered = getTriggeredAlerts()
  return [...triggered, ...active]
})
const triggeredCount = computed(() => getTriggeredAlerts().length)

function removeAlertById(id) { removeAlert(id) }
function doClearTriggered() { clearTriggeredAlerts() }

// Card database state
const cardCounts = ref({})
const refreshing = ref(false)
const refreshStatus = ref('')
const refreshError = ref(false)
const gameLabels = {
  pokemon: 'Pokémon',
  mtg: 'Magic: The Gathering',
  lorcana: 'Disney Lorcana',
  'one-piece': 'One Piece',
  riftbound: 'Riftbound',
  yugioh: 'Yu-Gi-Oh!',
}

async function loadCardCounts() {
  cardCounts.value = await getCardCounts()
}

async function refreshCardDb() {
  refreshing.value = true
  refreshStatus.value = 'Refreshing prices…'
  refreshError.value = false
  try {
    const counts = await refreshPrices()
    cardCounts.value = await getCardCounts()
    refreshStatus.value = `Updated! ${counts.total || 0} cards refreshed.`
  } catch (err) {
    refreshStatus.value = `Refresh failed: ${err.message}`
    refreshError.value = true
  } finally {
    refreshing.value = false
  }
}

onMounted(loadCardCounts)

const totalItems = computed(() => store.portfolios.reduce((s, p) => s + p.items.length, 0))

const cacheCount = computed(() => {
  return Object.keys(localStorage).filter(k => k.startsWith('ph_cache_')).length
})

const storageUsed = computed(() => {
  let bytes = 0
  for (const key of Object.keys(localStorage)) {
    bytes += (localStorage.getItem(key) || '').length * 2
  }
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
})

function clearPriceCache() {
  const keys = Object.keys(localStorage).filter(k => k.startsWith('ph_cache_'))
  keys.forEach(k => localStorage.removeItem(k))
}

async function doReset() {
  await store.resetAll()
  confirmReset.value = false
  resetConfirmText.value = ''
  router.push('/')
}

function exportOne(portfolio) {
  exportPortfolioToExcel(portfolio)
}

function exportAll() {
  exportAllPortfolios(store.portfolios)
}

const importResult = ref(null)
const collectrImporting = ref(false)
const collectrImportStatus = ref('')
const collectrError = ref('')
const collectrPhase = ref('')     // 'parsing' | 'importing' | 'resolving' | 'done'
const collectrResolved = ref(0)
const collectrTotal = ref(0)
const collectrImportDone = ref(false)

function doExportBackup() {
  exportBackup()
}

async function handleImport(e) {
  const file = e.target.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = async () => {
    try {
      const data = JSON.parse(reader.result)
      const error = validateBackup(data)
      if (error) {
        importResult.value = { error }
        return
      }
      importResult.value = await importBackup(data)
    } catch {
      importResult.value = { error: 'Invalid JSON file' }
    }
  }
  reader.readAsText(file)
  e.target.value = ''
}

async function handleCollectrImport(e) {
  const file = e.target.files?.[0]
  if (!file) return
  collectrError.value = ''
  collectrImporting.value = true
  collectrImportDone.value = false
  const ext = (file.name || '').split('.').pop()?.toLowerCase() || ''
  try {
    // Phase 1: Parse
    collectrPhase.value = 'parsing'
    collectrImportStatus.value = ext === 'csv' ? 'Reading CSV…' : 'Reading Excel…'
    const portfolios = await parseCollectrFile(file)
    if (portfolios.length === 0) throw new Error('No portfolios found in file')
    // Phase 2: Import into store
    collectrPhase.value = 'importing'
    const totalItems = portfolios.reduce((s, p) => s + p.items.length, 0)
    collectrImportStatus.value = `Importing ${totalItems} items…`
    await store.importAll(portfolios)
    // Phase 3: Resolve card images + prices (blocks until done)
    collectrPhase.value = 'resolving'
    collectrImportStatus.value = 'Resolving cards…'
    const resolved = await store.resolveImportedItems((done, total) => {
      collectrResolved.value = done
      collectrTotal.value = total
    })
    // Phase 4: Done
    collectrPhase.value = 'done'
    collectrImportStatus.value = `Done! Resolved ${resolved} cards.`
    collectrImportDone.value = true
  } catch (err) {
    collectrError.value = err.message || 'Import failed'
    collectrImporting.value = false
    collectrPhase.value = ''
  }
  e.target.value = ''
}

function goToDashboard() {
  window.location.href = '/'
}
</script>

<style scoped>
.settings-view { max-width: 720px; margin: 0 auto; }
.settings-title { font-size: 22px; font-weight: 700; margin-bottom: 24px; }
.settings-section { }
.settings-section-title { font-size: 15px; font-weight: 700; margin-bottom: 6px; }
.settings-desc { font-size: 13px; color: var(--text-secondary); margin-bottom: 16px; }

.settings-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-subtle);
  gap: 12px;
}
.settings-item:last-child { border-bottom: none; }
.settings-item-label { font-size: 14px; font-weight: 500; }
.settings-item-sub { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
.settings-item-value { font-size: 13px; color: var(--text-secondary); font-variant-numeric: tabular-nums; }

/* PC key row — column layout */
.settings-item-col {
  flex-direction: column;
  align-items: stretch;
  gap: 10px;
}
.settings-item-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.pc-key-input-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.about-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
.about-item { background: var(--bg-hover); padding: 12px; border-radius: var(--radius); }
.about-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 4px; }
.about-val { font-size: 13px; font-weight: 600; }

.settings-notes { display: flex; flex-direction: column; gap: 12px; }
.note {
  display: flex;
  gap: 10px;
  background: var(--bg-hover);
  padding: 12px;
  border-radius: var(--radius);
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}
.note span { font-size: 18px; flex-shrink: 0; }
.note strong { color: var(--text-primary); }

.reset-list {
  list-style: disc;
  padding-left: 20px;
  color: var(--text-secondary);
  font-size: 13px;
  line-height: 1.8;
}

.portfolio-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }

.import-result {
  font-size: 13px;
  padding: 8px 12px;
  border-radius: var(--radius);
  width: 100%;
}
.import-result.success { background: rgba(63, 185, 80, 0.1); color: #3fb950; }
.import-result.error { background: rgba(248, 81, 73, 0.1); color: #f85149; }
.backup-import-btn { cursor: pointer; }

@media (max-width: 640px) {
  .about-grid { grid-template-columns: 1fr; }
  .pc-key-input-row { flex-wrap: wrap; }
  .pc-key-input-row .input { min-width: 0; }
}

/* ── Import Overlay ─────────────────────────────────────────────────── */
.import-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
}
.import-overlay-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg, 16px);
  padding: 48px 40px;
  max-width: 420px;
  width: 90vw;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}
.import-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: import-spin 0.8s linear infinite;
}
@keyframes import-spin {
  to { transform: rotate(360deg); }
}
.import-done-icon {
  width: 48px;
  height: 48px;
  background: var(--success, #3fb950);
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  font-weight: 700;
}
.import-status {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}
.import-progress-wrap {
  width: 100%;
  height: 6px;
  background: var(--border);
  border-radius: 3px;
  overflow: hidden;
}
.import-progress-bar {
  height: 100%;
  background: var(--accent);
  border-radius: 3px;
  transition: width 0.3s ease;
}
.import-progress-label {
  font-size: 12px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.import-phases {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
}
.import-phases span.active {
  color: var(--accent);
  font-weight: 600;
}
.import-phase-dot { opacity: 0.4; }
.import-done-btn {
  margin-top: 8px;
  min-width: 180px;
}
.import-error {
  color: var(--danger, #f85149);
  font-size: 13px;
  text-align: center;
}
</style>
