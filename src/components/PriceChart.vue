<template>
  <div class="price-chart-wrapper">
    <div v-if="loading" class="chart-loading flex-center">
      <div class="spinner"></div>
    </div>
    <div v-else-if="noData" class="chart-nodata flex-center flex-col">
      <span style="font-size:32px;opacity:0.2">📊</span>
      <span class="text-muted mt-2" style="font-size:12px">No price history available for this card</span>
      <span v-if="currentPrice" class="mt-2" style="font-size:14px;font-weight:700">
        Current price: <span class="text-accent">${{ currentPrice?.toFixed(2) }}</span>
      </span>
      <span v-if="!currentPrice" class="text-muted mt-1" style="font-size:11px">Card may not be in the tcgdex price history dataset</span>
    </div>
    <div v-else>
      <div class="chart-header">
        <div class="chart-controls">
          <button
            v-for="r in ranges"
            :key="r.value"
            class="range-btn"
            :class="{ active: activeRange === r.value }"
            @click="setRange(r.value)"
          >{{ r.label }}</button>
        </div>
        <div v-if="availableVariants.length > 1" class="variant-select-wrapper">
          <select v-model="selectedVariant" class="select select-sm" @change="buildSeries">
            <option v-for="v in availableVariants" :key="v" :value="v">
              {{ getVariantLabel(v) }}
            </option>
          </select>
        </div>
      </div>

      <apexchart
        type="area"
        :height="height"
        :options="chartOptions"
        :series="chartSeries"
      />

      <div class="price-stats" v-if="priceStats">
        <div class="price-stat">
          <span class="stat-label">Current</span>
          <span class="stat-val">${{ priceStats.current?.toFixed(2) ?? '—' }}</span>
        </div>
        <div class="price-stat">
          <span class="stat-label">High</span>
          <span class="stat-val text-success">${{ priceStats.high?.toFixed(2) ?? '—' }}</span>
        </div>
        <div class="price-stat">
          <span class="stat-label">Low</span>
          <span class="stat-val text-danger">${{ priceStats.low?.toFixed(2) ?? '—' }}</span>
        </div>
        <div class="price-stat">
          <span class="stat-label">{{ rangeLabel }} Change</span>
          <span class="stat-val" :class="priceStats.change >= 0 ? 'text-success' : 'text-danger'">
            {{ priceStats.change >= 0 ? '+' : '' }}{{ priceStats.changePct?.toFixed(1) }}%
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted } from 'vue'
import { fetchPriceHistory, buildChartSeries, getVariantLabel } from '../services/priceHistory'

const props = defineProps({
  cardId: { type: String, required: true },
  currentPrice: { type: Number, default: null },
  height: { type: Number, default: 280 },
  compact: { type: Boolean, default: false }
})

const loading = ref(true)
const noData = ref(false)
const rawHistory = ref(null)
const chartSeries = ref([])
const availableVariants = ref([])
const selectedVariant = ref(null)
const activeRange = ref('7d')

const rangeLabel = computed(() => {
  const map = { '7d': '7D', '1m': '1M', '6m': '6M', '1y': '1Y', '3y': '3Y' }
  return map[activeRange.value] || 'All'
})

const ranges = [
  { label: '7D', value: '7d' },
  { label: '1M', value: '1m' },
  { label: '6M', value: '6m' },
  { label: '1Y', value: '1y' },
  { label: '3Y', value: '3y' },
]

const chartOptions = ref({
  chart: {
    id: 'price-chart',
    type: 'area',
    background: 'transparent',
    foreColor: '#141414',
    toolbar: { show: false },
    zoom: { enabled: true },
    animations: { enabled: true, speed: 400 }
  },
  theme: { mode: 'light' },
  dataLabels: { enabled: false },
  stroke: { curve: 'smooth', width: 3 },
  fill: {
    type: 'solid',
    colors: ['#fff3c4'],
    opacity: 1
  },
  colors: ['#4f86f7'],
  xaxis: {
    type: 'datetime',
    labels: { style: { colors: '#5f5a51', fontSize: '11px' } },
    axisBorder: { show: false },
    axisTicks: { show: false },
  },
  yaxis: {
    labels: {
      style: { colors: '#5f5a51', fontSize: '11px' },
      formatter: (v) => `$${v?.toFixed(0)}`
    }
  },
  tooltip: {
    theme: 'light',
    x: { format: 'MMM dd, yyyy' },
    y: { formatter: (v) => `$${v?.toFixed(2)}` }
  },
  grid: {
    borderColor: '#e7dfd0',
    strokeDashArray: 3,
    xaxis: { lines: { show: false } },
    yaxis: { lines: { show: true } },
    padding: { left: 0, right: 0 }
  },
  markers: { size: 0, hover: { size: 4 } }
})

const priceStats = computed(() => {
  const data = chartSeries.value?.[0]?.data
  if (!data || data.length === 0) return null

  const prices = data.map(p => p.y).filter(v => v !== null && v !== undefined)
  if (prices.length === 0) return null

  const current = prices[prices.length - 1]
  const first = prices[0]
  const high = Math.max(...prices)
  const low = Math.min(...prices)
  const change = current - first
  const changePct = first > 0 ? (change / first) * 100 : 0

  return { current, high, low, change, changePct }
})

async function load() {
  loading.value = true
  noData.value = false
  try {
    rawHistory.value = await fetchPriceHistory(props.cardId)
    if (rawHistory.value) {
      availableVariants.value = Object.keys(rawHistory.value.variants)
      selectedVariant.value = selectedVariant.value || availableVariants.value[0]
    }
    buildSeries()
  } catch (e) {
    noData.value = true
  } finally {
    loading.value = false
  }
}

function buildSeries() {
  const result = buildChartSeries(rawHistory.value, props.currentPrice, selectedVariant.value)
  if (!result || (Array.isArray(result) && result.length === 0)) {
    noData.value = true
    return
  }
  const allSeries = Array.isArray(result) ? result : result.series
  selectedVariant.value = result.key || selectedVariant.value
  availableVariants.value = result.availableVariants || availableVariants.value
  applyRange(allSeries)
}

function setRange(range) {
  activeRange.value = range
  const result = buildChartSeries(rawHistory.value, props.currentPrice, selectedVariant.value)
  if (!result) return
  const allSeries = Array.isArray(result) ? result : result.series
  applyRange(allSeries)
}

function applyRange(allSeries) {
  if (!allSeries || allSeries.length === 0) {
    noData.value = true
    return
  }

  const DAY = 24 * 60 * 60 * 1000
  const rangeMap = { '7d': 7 * DAY, '1m': 30 * DAY, '6m': 182 * DAY, '1y': 365 * DAY, '3y': 1095 * DAY }
  const ms = rangeMap[activeRange.value] || 1095 * DAY
  const cutoff = Date.now() - ms

  let filtered = allSeries.filter(p => p.x >= cutoff)

  // FIX: Robust filtering anchor logic
  // If we have fewer than 2 points in the requested range, but historical points exist,
  // we must include the last known point before the cutoff to draw a valid line.
  if (filtered.length < 2) {
    const before = allSeries.filter(p => p.x < cutoff)
    if (before.length > 0) {
      const anchor = before[before.length - 1]
      // Use the cutoff timestamp for the anchor point to bridge the gap perfectly
      filtered = [{ x: cutoff, y: anchor.y }, ...filtered]
    }
  }

  // If still less than 2 points (e.g. only 1 point exists in total), fallback to all data
  // but ensure at least 2 points for ApexCharts area rendering (duplicate if needed)
  let display = filtered.length >= 2 ? filtered : allSeries
  if (display.length === 1) {
    const p = display[0]
    display = [{ x: p.x - DAY, y: p.y }, p]
  }

  if (display.length === 0) {
    noData.value = true
    return
  }

  chartSeries.value = [{ name: 'Price', data: display }]

  const color = display.length >= 2
    ? (display[display.length - 1].y >= display[0].y ? '#2fbf71' : '#e4434f')
    : '#4f86f7'

  const dtFmtMap = {
    '7d': 'dd MMM', '1m': 'dd MMM', '6m': 'MMM yyyy', '1y': 'MMM yyyy', '3y': 'MMM yyyy',
  }
  const dtFmt = dtFmtMap[activeRange.value] || 'MMM yyyy'
  chartOptions.value = {
    ...chartOptions.value,
    colors: [color],
    xaxis: {
      ...chartOptions.value.xaxis,
      labels: {
        ...chartOptions.value.xaxis.labels,
        datetimeFormatter: { year: 'yyyy', month: dtFmt, day: dtFmt, hour: 'HH:mm' },
      },
      tickAmount: activeRange.value === '7d' ? 7 : activeRange.value === '1m' ? 6 : undefined,
    },
  }
}

watch(() => props.cardId, load, { immediate: false })
onMounted(load)
</script>

<style scoped>
.price-chart-wrapper { position: relative; }
.chart-loading, .chart-nodata {
  height: 200px;
  flex-direction: column;
  gap: 8px;
}
.chart-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  flex-wrap: wrap;
  gap: 8px;
}
.chart-controls { display: flex; gap: 4px; }
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

.select-sm { width: auto; padding: 4px 8px; font-size: 11px; }

.price-stats {
  display: flex;
  gap: 0;
  background: var(--bg-card);
  border: var(--bw) solid var(--ink);
  border-radius: var(--radius);
  overflow: hidden;
  margin-top: 8px;
  box-shadow: var(--shadow-xs);
}
.price-stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 4px;
  border-right: 1px solid var(--border-subtle);
}
.price-stat:last-child { border-right: none; }
.stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 3px; }
.stat-val { font-size: 13px; font-weight: 700; font-variant-numeric: tabular-nums; }

/* Mobile */
@media (max-width: 640px) {
  .chart-header { flex-direction: column; align-items: flex-start; }
  .chart-controls { overflow-x: auto; width: 100%; }
  .price-stats { flex-wrap: wrap; }
  .price-stat { min-width: 25%; }
  .stat-val { font-size: 12px; }
}
</style>
