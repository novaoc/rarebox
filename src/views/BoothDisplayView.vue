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
      <p class="bd-note">DIRECT = device-to-device (WebRTC, works on a hotspot with no internet). RELAY = end-to-end encrypted via ntfy.sh, which only ever sees scrambled bytes; the key stayed inside the pairing code. Screen is kept awake while this page is visible.</p>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import RbIcon from '../components/icons/RbIcon.vue'
import BoothLiveQr from '../components/BoothLiveQr.vue'
import { secretFromLocation, deriveChannel, deriveSigChannel, subscribeState, subscribeSig, publishSig, open as openPacket } from '../utils/remoteQr'
import { displayPeer } from '../utils/remoteP2p'
import { decodeBoothBytes } from '../utils/booth'

const secret = ref(secretFromLocation(window.location.hash))
const booth = ref(null)
const bytes = ref(null)
const status = ref('connecting')
const direct = ref(false)

let stop = null
let stopSig = null
let peer = null
let p2pTs = 0
let wakeLock = null

const displayStatus = computed(() => {
  // A live WebRTC channel means we're current even if the relay (which
  // needs internet) can't connect — that's the whole hotspot story.
  if (direct.value) return booth.value ? 'live' : 'waiting'
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
  stop = subscribeState(channel, async ({ ts, shareBytes }) => {
    try {
      if (ts <= p2pTs) return // the direct leg already delivered something newer
      booth.value = await decodeBoothBytes(shareBytes)
      bytes.value = shareBytes
    } catch { /* malformed state — keep showing the last good one */ }
  }, s => { status.value = s })

  // Direct (WebRTC) leg: answer the phone's offers and take sealed states
  // over the data channel — same decoder as the relay, no internet needed.
  const sigChannel = await deriveSigChannel(secret.value)
  peer = displayPeer({
    sigChannel,
    onPacket: async (sealed) => {
      try {
        const state = await openPacket(channel.key, sealed)
        if (state.ts <= p2pTs) return
        p2pTs = state.ts
        booth.value = await decodeBoothBytes(state.shareBytes)
        bytes.value = state.shareBytes
      } catch { /* not ours / garbage — ignore */ }
    },
    onMode: (m) => { direct.value = m === 'direct' },
  })
  stopSig = subscribeSig(sigChannel, (msg) => {
    if (msg.t === 'offer' && typeof msg.sdp === 'string') peer?.onOffer(msg.sdp)
  })
  publishSig(sigChannel, { t: 'hello' }) // tell an armed phone we just arrived

  acquireWakeLock()
  // iOS releases wake locks when the tab loses visibility — re-grab
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') acquireWakeLock()
  })
})

onBeforeUnmount(() => {
  stop?.()
  stopSig?.()
  peer?.stop()
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
