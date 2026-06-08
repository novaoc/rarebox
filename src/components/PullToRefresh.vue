<template>
  <div
    ref="containerEl"
    class="pull-to-refresh-container"
    :style="containerStyle"
  >
    <!-- Pull down indicator -->
    <div
      class="pull-indicator"
      :class="{ refreshing, 'can-release': pullDistance >= threshold }"
      :style="indicatorStyle"
      aria-hidden="true"
    >
      <div class="indicator-inner">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
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
      </div>
    </div>

    <!-- Screen reader status -->
    <div
      class="sr-only"
      role="status"
      aria-live="polite"
    >
      {{ refreshing ? 'Refreshing portfolio data...' : '' }}
    </div>

    <slot />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'

const props = defineProps({
  refreshing: {
    type: Boolean,
    default: false
  },
  threshold: {
    type: Number,
    default: 70
  },
  maxPull: {
    type: Number,
    default: 120
  }
})

const emit = defineEmits(['refresh'])

const containerEl = ref(null)
const startY = ref(0)
const startX = ref(0)
const pullDistance = ref(0)
const isPulling = ref(false)
const lockedDirection = ref(null) // null | 'vertical' | 'horizontal'
let scrollParent = null

// Find the nearest scrollable ancestor — the app scrolls inside .main-content,
// not the window, so window.scrollY is always 0 and can't gate the gesture.
function getScrollParent(el) {
  let node = el?.parentElement
  while (node) {
    const oy = getComputedStyle(node).overflowY
    if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) return node
    node = node.parentElement
  }
  return document.scrollingElement || document.documentElement
}

function atTop() {
  return (scrollParent ? scrollParent.scrollTop : window.scrollY) <= 0
}

const containerStyle = computed(() => {
  if (props.refreshing) return { overflow: 'hidden' }
  return {}
})

const indicatorStyle = computed(() => {
  const y = props.refreshing ? 40 : Math.min(pullDistance.value * 0.5, props.maxPull)
  const opacity = Math.min(pullDistance.value / props.threshold, 1)

  return {
    transform: `translateY(${y}px) scale(${opacity})`,
    opacity: opacity
  }
})

const svgStyle = computed(() => {
  if (props.refreshing) return {}
  const rotation = (pullDistance.value / props.threshold) * 360
  return {
    transform: `rotate(${rotation}deg)`
  }
})

function onTouchStart(e) {
  // Only allow pull if the scroll container is at the very top
  if (props.refreshing || !atTop()) return
  startY.value = e.touches[0].clientY
  startX.value = e.touches[0].clientX
  isPulling.value = true
  lockedDirection.value = null
}

function onTouchMove(e) {
  if (!isPulling.value) return
  const t = e.touches[0]
  const dy = t.clientY - startY.value
  const dx = t.clientX - startX.value

  // Lock gesture direction on first meaningful movement so a horizontal swipe
  // (e.g. the horizontally-scrollable items table) never triggers a refresh.
  if (lockedDirection.value === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
    lockedDirection.value = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical'
  }
  if (lockedDirection.value === 'horizontal') {
    isPulling.value = false
    pullDistance.value = 0
    return
  }

  if (dy > 0 && atTop()) {
    pullDistance.value = dy
    // Non-passive listener (bound in onMounted) so this actually suppresses
    // the native rubber-band scroll on iOS instead of being ignored.
    if (e.cancelable) e.preventDefault()
  } else {
    pullDistance.value = 0
  }
}

function onTouchEnd() {
  if (!isPulling.value) return
  if (pullDistance.value >= props.threshold) emit('refresh')
  isPulling.value = false
  pullDistance.value = 0
  lockedDirection.value = null
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
</script>

<style scoped>
.pull-to-refresh-container {
  position: relative;
  min-height: 100%;
}

.pull-indicator {
  position: absolute;
  top: -40px;
  left: 0;
  right: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 50;
  pointer-events: none;
  transition: transform 0.2s cubic-bezier(0.2, 0, 0, 1), opacity 0.2s;
}

.indicator-inner {
  background: var(--bg-secondary, #0d1117);
  border: 1px solid var(--border, #30363d);
  color: var(--accent, #f5a623);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.indicator-svg {
  transition: transform 0.1s linear;
}

.refreshing .indicator-svg {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.can-release .indicator-inner {
  border-color: var(--accent);
  box-shadow: 0 0 10px var(--accent-dim);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}

@media (prefers-reduced-motion: reduce) {
  .pull-indicator, .indicator-svg {
    transition: none;
  }
  .refreshing .indicator-svg {
    animation: none;
  }
}
</style>
