<template>
  <transition name="slide-up">
    <div v-if="show" class="install-prompt">
      <div class="install-content">
        <div class="install-icon">⬡</div>
        <div class="install-text">
          <div class="install-title">Install Rarebox</div>
          <div class="install-sub" v-if="platform === 'ios'">
            Tap <span class="ios-share-icon">⎘</span> Share → Add to Home Screen for the full app experience.
          </div>
          <div class="install-sub" v-else-if="platform === 'android'">
            Add to your home screen for quick access and a full app experience.
          </div>
          <div class="install-sub" v-else>
            Add Rarebox to your home screen for quick access.
          </div>
        </div>
      </div>
      <div class="install-actions">
        <button
          v-if="platform === 'android' && deferredPrompt"
          class="btn btn-primary btn-sm"
          @click="installAndroid"
        >Install</button>
        <button
          v-if="platform === 'ios'"
          class="btn btn-primary btn-sm"
          @click="showIosGuide = true"
        >How to Install</button>
        <button class="btn btn-ghost btn-icon btn-sm" @click="dismiss" title="Dismiss">✕</button>
      </div>

      <!-- iOS step-by-step guide modal -->
      <transition name="fade">
        <div v-if="showIosGuide" class="modal-overlay" @click.self="showIosGuide = false">
          <div class="modal" style="max-width:400px">
            <div class="modal-header">
              <h3>Install on iPhone</h3>
              <button class="btn btn-ghost btn-icon" @click="showIosGuide = false">✕</button>
            </div>
            <div class="modal-body">
              <div class="ios-steps">
                <div class="ios-step">
                  <div class="ios-step-num">1</div>
                  <div>
                    <strong>Open in Safari</strong>
                    <p>This only works in Safari. If you're in another browser, open the link in Safari.</p>
                  </div>
                </div>
                <div class="ios-step">
                  <div class="ios-step-num">2</div>
                  <div>
                    <strong>Tap the Share button</strong>
                    <p>Tap the <span class="ios-share-icon">⎘</span> icon at the bottom of the screen.</p>
                  </div>
                </div>
                <div class="ios-step">
                  <div class="ios-step-num">3</div>
                  <div>
                    <strong>Add to Home Screen</strong>
                    <p>Scroll down in the share menu and tap "Add to Home Screen".</p>
                  </div>
                </div>
                <div class="ios-step">
                  <div class="ios-step-num">4</div>
                  <div>
                    <strong>Tap Add</strong>
                    <p>Confirm by tapping "Add" in the top right corner. Rarebox will appear on your home screen.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </transition>
    </div>
  </transition>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const STORAGE_KEY = 'rarebox_install_dismissed'

const show = ref(false)
const platform = ref('unknown')
const deferredPrompt = ref(null)
const showIosGuide = ref(false)

function detectPlatform() {
  const ua = navigator.userAgent.toLowerCase()
  if (/iphone|ipad|ipod/.test(ua)) return 'ios'
  if (/android/.test(ua)) return 'android'
  return 'desktop'
}

function isInStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true // iOS
}

function shouldShow() {
  if (isInStandaloneMode()) return false // already installed
  if (localStorage.getItem(STORAGE_KEY)) return false // dismissed
  const p = detectPlatform()
  if (p === 'desktop') return false // no prompt on desktop
  return true
}

function handleBeforeInstallPrompt(e) {
  e.preventDefault()
  deferredPrompt.value = e
}

async function installAndroid() {
  if (!deferredPrompt.value) return
  deferredPrompt.value.prompt()
  const { outcome } = await deferredPrompt.value.userChoice
  if (outcome === 'accepted') {
    show.value = false
  }
  deferredPrompt.value = null
}

function dismiss() {
  show.value = false
  localStorage.setItem(STORAGE_KEY, '1')
}

onMounted(() => {
  if (!shouldShow()) return
  platform.value = detectPlatform()

  if (platform.value === 'android') {
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
  }

  // Show after a short delay to not be intrusive
  setTimeout(() => { show.value = true }, 3000)
})

onUnmounted(() => {
  window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
})
</script>

<style scoped>
.install-prompt {
  position: fixed;
  bottom: 16px;
  left: 16px;
  right: 16px;
  max-width: 480px;
  margin: 0 auto;
  background: var(--bg-card);
  border: var(--bw) solid var(--ink);
  border-radius: var(--radius-lg);
  padding: 14px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  z-index: 500;
  box-shadow: var(--shadow);
}

.install-content {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.install-icon {
  font-size: 28px;
  flex-shrink: 0;
}

.install-title {
  font-size: 14px;
  font-weight: 700;
}

.install-sub {
  font-size: 12px;
  color: var(--text-secondary);
  margin-top: 2px;
  line-height: 1.4;
}

.install-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
  align-items: center;
}

.ios-share-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border: 1.5px solid var(--ink);
  border-radius: 4px;
  font-size: 12px;
  vertical-align: middle;
}

/* iOS guide steps */
.ios-steps {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.ios-step {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}

.ios-step-num {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--accent);
  color: var(--ink);
  border: 1.5px solid var(--ink);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  flex-shrink: 0;
}

.ios-step strong {
  font-size: 14px;
  display: block;
  margin-bottom: 2px;
}

.ios-step p {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
}

/* Slide up transition */
.slide-up-enter-active { transition: all 0.3s ease-out; }
.slide-up-leave-active { transition: all 0.2s ease-in; }
.slide-up-enter-from { opacity: 0; transform: translateY(40px); }
.slide-up-leave-to { opacity: 0; transform: translateY(20px); }

@media (max-width: 640px) {
  .install-prompt {
    bottom: 12px;
    left: 12px;
    right: 12px;
  }
}
</style>
