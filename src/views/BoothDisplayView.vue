<template>
  <div class="bd-page">
    <template v-if="!secret">
      <div class="bd-help">
        <div class="bd-help-title"><RbIcon name="antenna" :size="24" /> Booth display</div>
        <p>This screen shows a booth's live QR, driven from another device.</p>
        <p>On your phone: <strong>Booth → Table → Live QR → Show on another device</strong>, then scan the pairing code with this device's camera.</p>
      </div>
    </template>

    <template v-else>
      <BoothLiveQr :booth="booth" :shareBytes="bytes" :status="displayStatus" />
      <p v-if="!booth" class="bd-wait">Paired — waiting for the first update from your phone.</p>
      <div class="bd-actions">
        <button class="btn btn-secondary btn-sm" @click="goFullscreen">⛶ Fullscreen — always-on stand mode</button>
      </div>
      <p class="bd-note">Updates arrive end-to-end encrypted via ntfy.sh — the relay only ever sees scrambled bytes; the key stayed inside the pairing code. Screen is kept awake while this page is visible.</p>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import RbIcon from '../components/icons/RbIcon.vue'
import BoothLiveQr from '../components/BoothLiveQr.vue'
import { secretFromLocation, deriveChannel, subscribeState } from '../utils/remoteQr'
import { decodeBoothBytes } from '../utils/booth'

const secret = ref(secretFromLocation(window.location.hash))
const booth = ref(null)
const bytes = ref(null)
const status = ref('connecting')

let stop = null
let wakeLock = null

const displayStatus = computed(() => {
  if (status.value !== 'connected') return status.value === 'reconnecting' ? 'reconnecting' : 'connecting'
  return booth.value ? 'live' : 'waiting'
})

async function acquireWakeLock() {
  try { wakeLock = await navigator.wakeLock?.request('screen') } catch { /* unsupported */ }
}

function goFullscreen() {
  document.documentElement.requestFullscreen?.().catch(() => { /* iOS Safari: no element fullscreen — wake lock still holds */ })
}

onMounted(async () => {
  if (!secret.value) return
  // tidy the URL so the secret doesn't sit in the address bar / history
  history.replaceState(null, '', window.location.pathname)
  const channel = await deriveChannel(secret.value)
  stop = subscribeState(channel, async ({ shareBytes }) => {
    try {
      booth.value = await decodeBoothBytes(shareBytes)
      bytes.value = shareBytes
    } catch { /* malformed state — keep showing the last good one */ }
  }, s => { status.value = s })
  acquireWakeLock()
  // iOS releases wake locks when the tab loses visibility — re-grab
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') acquireWakeLock()
  })
})

onBeforeUnmount(() => {
  stop?.()
  try { wakeLock?.release() } catch { /* gone */ }
})
</script>

<style scoped>
.bd-page {
  min-height: 100vh;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 14px; text-align: center;
  padding: calc(24px + env(safe-area-inset-top, 0px)) 24px calc(24px + env(safe-area-inset-bottom, 0px));
  background: var(--bg-secondary, #faf6ef);
}
.bd-wait { font-size: 14px; font-weight: 700; color: var(--text-secondary, #5f5a51); }
.bd-actions { display: flex; gap: 10px; }
.bd-note { font-size: 11.5px; color: var(--text-muted, #8a8478); font-weight: 600; max-width: 420px; }
.bd-help { max-width: 420px; display: flex; flex-direction: column; gap: 10px; font-size: 14.5px; line-height: 1.55; }
.bd-help-title { font-size: 24px; font-weight: 900; display: flex; align-items: center; gap: 8px; justify-content: center; }

/* stand mode: in fullscreen, drop everything but the branded card */
:fullscreen .bd-actions, :fullscreen .bd-note { display: none; }
</style>
