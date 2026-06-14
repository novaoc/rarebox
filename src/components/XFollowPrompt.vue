<template>
  <transition name="follow-pop">
    <aside v-if="show" class="x-follow-prompt" role="complementary" aria-label="Follow Rarebox on X">
      <button class="follow-close" type="button" @click="dismiss" aria-label="Dismiss follow prompt">×</button>
      <a class="follow-card" href="https://x.com/getrarebox" target="_blank" rel="noopener noreferrer" @click="markClicked">
        <span class="follow-icon" aria-hidden="true">𝕏</span>
        <span class="follow-copy">
          <span class="follow-kicker">Rarebox updates</span>
          <strong>Follow @getrarebox</strong>
          <span>New features, fixes, and TCG drops.</span>
        </span>
        <span class="follow-arrow" aria-hidden="true">↗</span>
      </a>
    </aside>
  </transition>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'

const DISMISSED_KEY = 'rarebox_x_follow_dismissed_until'
const CLICKED_KEY = 'rarebox_x_follow_clicked'
const SESSION_KEY = 'rarebox_x_follow_seen_session'
const INSTALL_DISMISSED_KEY = 'rarebox_install_dismissed'
const SHOW_DELAY_MS = 45_000
const DISMISS_COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000

const show = ref(false)
const route = useRoute()
let timer = null

function isSuppressedRoute() {
  return route.path.startsWith('/booth') || route.meta?.bare
}

function hasActiveSetupPrompt() {
  // On phones, the PWA install banner already asks for attention on first visit.
  // If they have not dismissed it yet, keep this social prompt out of the way.
  return !localStorage.getItem(INSTALL_DISMISSED_KEY) && /iphone|ipad|ipod|android/i.test(navigator.userAgent)
}

function shouldShow() {
  if (show.value) return false
  if (isSuppressedRoute()) return false
  if (sessionStorage.getItem(SESSION_KEY)) return false
  if (localStorage.getItem(CLICKED_KEY)) return false
  if (hasActiveSetupPrompt()) return false

  const dismissedUntil = Number(localStorage.getItem(DISMISSED_KEY) || 0)
  if (dismissedUntil && Date.now() < dismissedUntil) return false

  return true
}

function dismiss() {
  show.value = false
  sessionStorage.setItem(SESSION_KEY, '1')
  localStorage.setItem(DISMISSED_KEY, String(Date.now() + DISMISS_COOLDOWN_MS))
}

function markClicked() {
  show.value = false
  sessionStorage.setItem(SESSION_KEY, '1')
  localStorage.setItem(CLICKED_KEY, '1')
}

onMounted(() => {
  timer = window.setTimeout(() => {
    if (shouldShow()) {
      show.value = true
      sessionStorage.setItem(SESSION_KEY, '1')
    }
  }, SHOW_DELAY_MS)
})

onUnmounted(() => {
  if (timer) window.clearTimeout(timer)
})
</script>

<style scoped>
.x-follow-prompt {
  position: fixed;
  top: calc(var(--header-height) + env(safe-area-inset-top, 0px) + 12px);
  right: 14px;
  z-index: 320;
  width: min(318px, calc(100vw - 28px));
  pointer-events: none;
}

.follow-card {
  display: grid;
  grid-template-columns: 42px 1fr auto;
  align-items: center;
  gap: 10px;
  min-height: 76px;
  padding: 12px 14px;
  padding-right: 40px;
  background: var(--bg-card);
  color: var(--ink);
  border: var(--bw) solid var(--ink);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  text-decoration: none;
  pointer-events: auto;
  touch-action: manipulation;
  -webkit-tap-highlight-color: transparent;
}

.follow-card:hover {
  text-decoration: none;
  background: var(--bg-hover);
}

.follow-card:active {
  box-shadow: var(--shadow-pressed);
  transform: translate(1px, 1px);
}

.follow-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border: var(--bw) solid var(--ink);
  border-radius: 12px;
  background: var(--pink);
  color: var(--on-accent);
  box-shadow: var(--shadow-pressed);
  font-size: 22px;
  font-weight: 900;
  line-height: 1;
}

.follow-copy {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
  line-height: 1.25;
}

.follow-kicker {
  width: fit-content;
  padding: 2px 7px;
  border: 1.5px solid var(--on-accent);
  border-radius: 999px;
  background: var(--accent);
  color: var(--on-accent);
  font-size: 10px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.follow-copy strong {
  font-size: 14px;
  font-weight: 900;
  letter-spacing: -0.01em;
}

.follow-copy span:last-child {
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 650;
}

.follow-arrow {
  font-size: 16px;
  font-weight: 900;
  align-self: start;
  margin-top: 2px;
}

.follow-close {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 1;
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--text-secondary);
  font-size: 20px;
  font-weight: 900;
  cursor: pointer;
  pointer-events: auto;
  touch-action: manipulation;
}

.follow-close:hover,
.follow-close:focus-visible {
  background: var(--bg-hover);
  color: var(--ink);
}

.follow-pop-enter-active { transition: opacity 0.22s ease, transform 0.22s ease; }
.follow-pop-leave-active { transition: opacity 0.16s ease, transform 0.16s ease; }
.follow-pop-enter-from,
.follow-pop-leave-to { opacity: 0; transform: translateY(-8px) scale(0.98); }

@media (max-width: 640px) {
  .x-follow-prompt {
    top: calc(var(--header-height) + env(safe-area-inset-top, 0px) + 10px);
    right: 10px;
    width: min(304px, calc(100vw - 20px));
  }

  .follow-card {
    min-height: 72px;
    padding: 10px 12px;
    padding-right: 38px;
    grid-template-columns: 38px 1fr auto;
  }

  .follow-icon {
    width: 38px;
    height: 38px;
    font-size: 20px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .follow-pop-enter-active,
  .follow-pop-leave-active {
    transition: none;
  }
}
</style>
