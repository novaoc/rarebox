<template>
  <div
    ref="containerEl"
    class="pull-to-refresh-container"
    :class="{ 'pulling-active': isPulling || refreshing }"
  >
    <!-- Pull down indicator — localized localized localized -->
    <div
      class="pull-indicator"
      :class="{ refreshing, 'can-release': pullDistance >= threshold }"
      :style="indicatorStyle"
      aria-hidden="true"
    >
      <div class="indicator-inner">
        <svg
          v-if="!refreshing"
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
          class="indicator-svg"
          :style="svgStyle"
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          <polyline points="21 3 21 9 15 9" />
        </svg>
        <div v-else class="spinner spinner-sm"></div>
      </div>
    </div>

    <!-- Content Wrapper — Subtly translates down as you pull -->
    <div class="pull-content" :style="contentStyle">
      <slot />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'

const props = defineProps({
  refreshing: { type: Boolean, default: false },
  threshold: { type: Number, default: 60 },
  maxPull: { type: Number, default: 90 }
})

const emit = defineEmits(['refresh'])
const route = useRoute()

// Pull-to-refresh is only allowed on Dashboard and Portfolio views
const isAllowedRoute = computed(() => {
  return ['Dashboard', 'Portfolio'].includes(route.name)
})

const containerEl = ref(null)
const startY = ref(0)
const pullDistance = ref(0)
const isPulling = ref(false)
let scrollParent = null

function getScrollParent(el) {
  let node = el?.parentElement
  while (node) {
    const oy = getComputedStyle(node).overflowY
    if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) return node
    node = node.parentElement
  }
  return null
}

function atTop() {
  if (!scrollParent) return true
  return scrollParent.scrollTop <= 0
}

const indicatorStyle = computed(() => {
  const y = props.refreshing ? 20 : Math.min(pullDistance.value * 0.4, props.maxPull)
  const opacity = Math.min(pullDistance.value / (props.threshold * 0.8), 1)

  return {
    transform: `translateY(${y}px) scale(${opacity})`,
    opacity: opacity
  }
})

const contentStyle = computed(() => {
  if (props.refreshing) return { transform: `translateY(40px)` }
  if (pullDistance.value <= 0) return {}
  const y = Math.min(pullDistance.value * 0.3, 40)
  return { transform: `translateY(${y}px)` }
})

const svgStyle = computed(() => {
  const rotation = (pullDistance.value / props.threshold) * 360
  return { transform: `rotate(${rotation}deg)` }
})

function onTouchStart(e) {
  if (!isAllowedRoute.value || props.refreshing || !atTop()) return
  startY.value = e.touches[0].clientY
  isPulling.value = true
}

function onTouchMove(e) {
  if (!isPulling.value) return
  const dy = e.touches[0].clientY - startY.value

  if (dy > 0 && atTop()) {
    pullDistance.value = dy
    // Prevent the actual scroll/rubber-band of the container
    if (e.cancelable) e.preventDefault()
  } else {
    isPulling.value = false
    pullDistance.value = 0
  }
}

function onTouchEnd() {
  if (!isPulling.value) return
  if (pullDistance.value >= props.threshold) {
    emit('refresh')
  }
  isPulling.value = false
  pullDistance.value = 0
}

onMounted(() => {
  scrollParent = getScrollParent(containerEl.value)
  const el = containerEl.value
  if (!el) return
  el.addEventListener('touchstart', onTouchStart, { passive: true })
  el.addEventListener('touchmove', onTouchMove, { passive: false })
  el.addEventListener('touchend', onTouchEnd, { passive: true })
})

onBeforeUnmount(() => {
  const el = containerEl.value
  if (!el) return
  el.removeEventListener('touchstart', onTouchStart)
  el.removeEventListener('touchmove', onTouchMove)
  el.removeEventListener('touchend', onTouchEnd)
})

// Reset pull state if we navigate away
watch(() => route.path, () => {
  isPulling.value = false
  pullDistance.value = 0
})
</script>

<style scoped>
.pull-to-refresh-container {
  position: relative;
  min-height: 100%;
}

.pull-indicator {
  position: absolute;
  top: -20px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 100;
  pointer-events: none;
  transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1), opacity 0.2s;
}

.indicator-inner {
  background: var(--bg-card);
  border: var(--bw) solid var(--ink);
  color: var(--ink);
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-xs);
  transition: background 0.15s;
}

.can-release .indicator-inner {
  background: var(--accent);
}

.pull-content {
  transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1);
  will-change: transform;
}

.pulling-active .pull-content {
  transition: none; /* Smooth manual follow while pulling */
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@media (prefers-reduced-motion: reduce) {
  .pull-indicator, .pull-content {
    transition: none !important;
  }
}
</style>
