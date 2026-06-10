<template>
  <div class="portfolio-chart-wrapper">
    <div v-if="loading" class="chart-loading flex-center" :style="{ height: height + 'px' }">
      <div class="spinner spinner-lg"></div>
    </div>
    <div v-else-if="noData" class="chart-nodata flex-center flex-col" :style="{ height: height + 'px' }">
      <span style="font-size:40px;opacity:0.2">📈</span>
      <span class="text-muted mt-2">Add items to see shelf value</span>
    </div>
    <div v-else>
      <div class="chart-top">
        <div>
          <div class="portfolio-value">${{ currentValue.toFixed(2) }}</div>
          <div class="portfolio-change" :class="totalChange >= 0 ? 'text-success' : 'text-danger'">
            {{ totalChange >= 0 ? '▲' : '▼' }}
            ${{ Math.abs(totalChange).toFixed(2) }}
            ({{ Math.abs(totalChangePct).toFixed(1) }}%)
            <span class="text-muted">from cost basis</span>
          </div>
        </div>
        <div class="chart-controls">
          <button
            v-for="r in ranges"
            :key="r.value"
            class="range-btn"
            :class="{ active: activeRange === r.value }"
            @click="setRange(r.value)"
          >{{ r.label }}</button>
        </div>
      </div>

      <apexchart
        type="area"
        :height="height"
        :options="chartOptions"
        :series="chartSeries"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, computed } from 'vue'
import { fetchPriceHistory, buildChartSeries } from '../services/priceHistory'
import { usePortfolioStore } from '../stores/portfolio'

const store = usePortfolioStore()

const props = defineProps({
  portfolios: { type: Array, required: true },
  height: { type: Number, default: 300 },
  label: { type: String, default: 'Shelf Value' }
})

const loading = ref(true)
const noData = ref(false)
const chartSeries = ref([])
const activeRange = ref('7d')

const ranges = [
  { label: '7D', value: '7d' },
  { label: '1M', value: '1m' },
  { label: '6M', value: '6m' },
  { label: '1Y', value: '1y' },
  { label: '3Y', value: '3y' },
]

// Date format for x-axis labels based on range
const rangeDateFormats = {
  '7d': { format: 'dd MMM' },
  '1m': { format: 'dd MMM' },
  '6m': { format: 'MMM yyyy' },
  '1y': { format: 'MMM yyyy' },
  '3y': { format: 'MMM yyyy' },
}

const currentValue = computed(() => {
  return props.portfolios.flatMap(p => p.items).reduce((sum, item) => {
    const qty = item.quantity || 1
    const val = item.type === 'card'
      ? (item.currentMarketPrice || item.purchasePrice || 0)
      : (item.currentValue || item.purchasePrice || 0)
    return sum + val * qty
  }, 0)
})

const totalCost = computed(() => {
  return props.portfolios.flatMap(p => p.items).reduce((sum, item) => {
    return sum + (item.purchasePrice || 0) * (item.quantity || 1)
  }, 0)
})

const totalChange = computed(() => currentValue.value - totalCost.value)
const totalChangePct = computed(() => totalCost.value > 0 ? (totalChange.value / totalCost.value) * 100 : 0)

const dark = () => document.documentElement.dataset.theme === 'dark'
const themeChunk = () => ({
  foreColor: dark() ? '#f0e8d8' : '#141414',
  gridColor: dark() ? '#353022' : '#e7dfd0',
  labelColor: dark() ? '#b5ac98' : '#5f5a51',
  tooltipTheme: dark() ? 'dark' : 'light',
  areaFill: dark() ? 'rgba(255,210,63,0.10)' : '#fff3c4'
})

function buildChartOptions() {
  const t = themeChunk()
  return {
    chart: {
      type: 'area',
      background: 'transparent',
      foreColor: t.foreColor,
      toolbar: { show: false },
      zoom: { enabled: false },
      animations: { enabled: true, speed: 600 }
    },
    theme: { mode: t.tooltipTheme },
    dataLabels: { enabled: false },
    stroke: { curve: 'smooth', width: 3 },
    fill: {
      type: 'solid',
      colors: [t.areaFill],
      opacity: 1
    },
    colors: ['#4f86f7'],
    xaxis: {
      type: 'datetime',
      labels: { style: { colors: t.labelColor, fontSize: '11px' } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: {
        style: { colors: t.labelColor, fontSize: '11px' },
        formatter: (v) => `$${v >= 1000 ? (v/1000).toFixed(1) + 'k' : v?.toFixed(0)}`
      }
    },
    tooltip: {
      theme: t.tooltipTheme,
      x: { format: 'MMM dd, yyyy' },
      y: { formatter: (v) => `$${v?.toFixed(2)}` }
    },
    grid: {
      borderColor: t.gridColor,
      strokeDashArray: 3,
      padding: { left: 4, right: 4 }
    },
    markers: { size: 0, hover: { size: 5 } }
  }
}

const chartOptions = ref(buildChartOptions())

// Re-apply theme colors while preserving range-dependent bits (series color, x-axis format)
function applyTheme() {
  const t = themeChunk()
  const prev = chartOptions.value
  chartOptions.value = {
    ...prev,
    chart: { ...prev.chart, foreColor: t.foreColor },
    theme: { mode: t.tooltipTheme },
    fill: { ...prev.fill, colors: [t.areaFill] },
    xaxis: {
      ...prev.xaxis,
      labels: { ...prev.xaxis.labels, style: { ...prev.xaxis.labels.style, colors: t.labelColor } },
    },
    yaxis: {
      ...prev.yaxis,
      labels: { ...prev.yaxis.labels, style: { ...prev.yaxis.labels.style, colors: t.labelColor } },
    },
    tooltip: { ...prev.tooltip, theme: t.tooltipTheme },
    grid: { ...prev.grid, borderColor: t.gridColor },
  }
}

// Find which portfolio an item belongs to
function portfolioForItem(itemId) {
  return props.portfolios.find(p => p.items.some(i => i.id === itemId))
}

async function buildPortfolioHistory() {
  loading.value = true
  noData.value = false

  const allItems = props.portfolios.flatMap(p => p.items)
  if (allItems.length === 0) {
    noData.value = true
    loading.value = false
    return
  }

  const cardItems = allItems.filter(i => i.type === 'card' && i.cardId)
  const historyMap = {}

  // Batched — max 5 concurrent to avoid hammering GitHub
  for (let i = 0; i < cardItems.length; i += 5) {
    const batch = cardItems.slice(i, i + 5)
    await Promise.allSettled(
      batch.map(async item => {
        try {
          const hist = await fetchPriceHistory(item.cardId)
          if (hist) historyMap[item.cardId] = hist
        } catch {}
      })
    )
  }

  // Build per-item sorted series (keyed by item.id)
  const itemSeriesMap = {}

  for (const item of allItems) {
    const portfolio = portfolioForItem(item.id)
    const portfolioId = portfolio?.id

    if (item.type === 'card' && historyMap[item.cardId]) {
      // Use tcgdex historical data
      const result = buildChartSeries(historyMap[item.cardId], item.currentMarketPrice || item.purchasePrice)
      const series = Array.isArray(result) ? result : (result?.series || [])
      if (series.length > 0) {
        itemSeriesMap[item.id] = series.slice().sort((a, b) => a.x - b.x)
      }
    }

    // For cards with no tcgdex history AND for graded/sealed: use snapshot history
    if (!itemSeriesMap[item.id] && portfolioId) {
      const snaps = store.getItemHistory(portfolioId, item.id)
      if (snaps.length > 0) {
        itemSeriesMap[item.id] = snaps.slice().sort((a, b) => a.x - b.x)
      }
    }

    // Last resort: synthesize 2 points (purchase → today) so chart always draws a line
    if (!itemSeriesMap[item.id]) {
      const currentPrice = item.type === 'card'
        ? (item.currentMarketPrice || item.purchasePrice || 0)
        : (item.currentValue || item.purchasePrice || 0)
      const purchasePrice = item.purchasePrice || 0
      const purchaseTs = item.purchaseDate
        ? new Date(item.purchaseDate).getTime()
        : Date.now() - 1000 * 60 * 60 * 24 // yesterday if no date

      const pts = []
      if (purchasePrice > 0) pts.push({ x: purchaseTs, y: purchasePrice })
      if (currentPrice > 0 && currentPrice !== purchasePrice) pts.push({ x: Date.now(), y: currentPrice })
      else if (currentPrice > 0) pts.push({ x: Date.now(), y: currentPrice })
      if (pts.length > 0) itemSeriesMap[item.id] = pts
    }
  }

  // Collect all unique timestamps
  const allTimestamps = new Set()
  for (const series of Object.values(itemSeriesMap)) {
    for (const pt of series) allTimestamps.add(pt.x)
  }
  allTimestamps.add(Date.now())

  if (allTimestamps.size === 0) {
    noData.value = true
    loading.value = false
    return
  }

  const sortedTs = [...allTimestamps].sort((a, b) => a - b)

  // LOCF: for every timestamp, each item contributes its most recent known price
  const points = sortedTs.map(ts => {
    let total = 0
    for (const item of allItems) {
      const qty = item.quantity || 1
      const series = itemSeriesMap[item.id]
      if (series) {
        let price = item.purchasePrice || 0
        for (const pt of series) {
          if (pt.x <= ts) price = pt.y
          else break
        }
        total += price * qty
      }
    }
    return { x: ts, y: Math.round(total * 100) / 100 }
  })

  applyRange(points)
  loading.value = false
}

function setRange(range) {
  activeRange.value = range
  buildPortfolioHistory()
}

function applyRange(points) {
  const DAY = 24 * 60 * 60 * 1000
  const rangeMap = { '7d': 7 * DAY, '1m': 30 * DAY, '6m': 182 * DAY, '1y': 365 * DAY, '3y': 1095 * DAY }
  const ms = rangeMap[activeRange.value] || 365 * DAY
  const cutoff = Date.now() - ms

  let filtered = points.filter(p => p.x >= cutoff)

  // Anchor from last known point before cutoff so short ranges always draw a line
  if (filtered.length < 2) {
    const before = points.filter(p => p.x < cutoff)
    if (before.length > 0) {
      const anchor = before[before.length - 1]
      filtered = [{ x: cutoff, y: anchor.y }, ...filtered]
    }
  }

  const display = filtered.length >= 2 ? filtered : points

  const color = display.length >= 2
    ? (display[display.length - 1].y >= display[0].y ? '#2fbf71' : '#e4434f')
    : '#4f86f7'

  // Set x-axis tick format based on range — prevents "hours" showing on 7D/1M
  const dtFmt = rangeDateFormats[activeRange.value] || { format: 'MMM yyyy' }
  chartOptions.value = {
    ...chartOptions.value,
    colors: [color],
    xaxis: {
      ...chartOptions.value.xaxis,
      labels: {
        ...chartOptions.value.xaxis.labels,
        datetimeFormatter: {
          year: 'yyyy',
          month: dtFmt.format,
          day: dtFmt.format,
          hour: 'HH:mm',
        },
      },
      // Force tick amount for short ranges so dates are evenly spaced
      tickAmount: activeRange.value === '7d' ? 7 : activeRange.value === '1m' ? 6 : undefined,
    },
  }
  chartSeries.value = [{ name: props.label, data: display }]
}

// Debounce rebuild so rapid price refreshes don't trigger multiple full chart rebuilds
let rebuildTimer = null
function debouncedRebuild() {
  clearTimeout(rebuildTimer)
  rebuildTimer = setTimeout(buildPortfolioHistory, 500)
}

watch(() => props.portfolios, debouncedRebuild, { deep: true })
onMounted(() => {
  buildPortfolioHistory()
  window.addEventListener('rarebox-theme', applyTheme)
})
onBeforeUnmount(() => {
  window.removeEventListener('rarebox-theme', applyTheme)
})
</script>

<style scoped>
.chart-loading, .chart-nodata {
  flex-direction: column;
  gap: 8px;
}
.chart-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 8px;
}
@media (max-width: 640px) {
  .chart-top { flex-direction: column; }
  .chart-controls { width: 100%; justify-content: flex-start; overflow-x: auto; }
  .portfolio-value { font-size: 22px; }
  .range-btn { padding: 4px 10px; font-size: 12px; }
}
.portfolio-value { font-size: 28px; font-weight: 700; font-variant-numeric: tabular-nums; }
.portfolio-change { font-size: 13px; margin-top: 4px; }

.chart-controls { display: flex; gap: 4px; align-items: flex-start; }
.range-btn {
  background: var(--bg-card);
  border: var(--bw) solid var(--ink);
  color: var(--text-secondary);
  font-size: 11px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.range-btn:hover { color: var(--text-primary); background: var(--bg-secondary); }
.range-btn.active { background: var(--accent); color: var(--ink); box-shadow: var(--shadow-pressed); }
</style>
