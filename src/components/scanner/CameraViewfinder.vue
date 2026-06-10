<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'

const emit = defineEmits<{
  capture: [imageData: string]
  close: []
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const stream = ref<MediaStream | null>(null)
const cameraActive = ref(false)
const cameraError = ref('')
const flashActive = ref(false)

const prefersReducedMotion = computed(() => {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
})

async function startCamera() {
  try {
    cameraError.value = ''
    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: 'environment',
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    }
    stream.value = await navigator.mediaDevices.getUserMedia(constraints)
    if (videoRef.value) {
      videoRef.value.srcObject = stream.value
      await videoRef.value.play()
      cameraActive.value = true
    }
  } catch (err: any) {
    cameraError.value = err.name === 'NotAllowedError'
      ? 'Camera access denied. Please allow camera permissions or use file upload.'
      : err.name === 'NotFoundError'
        ? 'No camera found. Please use file upload.'
        : `Camera error: ${err.message}`
  }
}

function stopCamera() {
  if (stream.value) {
    stream.value.getTracks().forEach(t => t.stop())
    stream.value = null
  }
  cameraActive.value = false
}

function captureFrame() {
  if (!videoRef.value || !canvasRef.value) return
  const video = videoRef.value
  const canvas = canvasRef.value
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Flash effect
  flashActive.value = true
  setTimeout(() => { flashActive.value = false }, 150)

  ctx.drawImage(video, 0, 0)
  const imageData = canvas.toDataURL('image/jpeg', 0.92)
  emit('capture', imageData)
}

function triggerFileInput() {
  fileInputRef.value?.click()
}

function onFileSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  const reader = new FileReader()
  reader.onload = (e) => {
    const dataUrl = e.target?.result as string
    if (dataUrl) emit('capture', dataUrl)
  }
  reader.readAsDataURL(file)
  // Reset input so same file can be selected again
  input.value = ''
}

function close() {
  stopCamera()
  emit('close')
}

onMounted(() => {
  startCamera()
})

onBeforeUnmount(() => {
  stopCamera()
})
</script>

<template>
  <div class="relative w-full h-full bg-black rounded-xl overflow-hidden">
    <!-- Camera Feed -->
    <video
      ref="videoRef"
      autoplay
      playsinline
      muted
      class="absolute inset-0 w-full h-full object-cover"
      :class="{ hidden: !cameraActive }"
    />

    <!-- Canvas (hidden, used for capture) -->
    <canvas ref="canvasRef" class="hidden" />

    <!-- Flash overlay -->
    <Transition name="flash">
      <div
        v-if="flashActive"
        class="absolute inset-0 z-30 bg-white pointer-events-none"
      />
    </Transition>

    <!-- Scan line overlay -->
    <div
      v-if="cameraActive && !prefersReducedMotion"
      class="absolute inset-0 z-10 pointer-events-none overflow-hidden"
    >
      <div class="scan-line" />
      <!-- Corner brackets -->
      <div class="corner corner-tl" />
      <div class="corner corner-tr" />
      <div class="corner corner-bl" />
      <div class="corner corner-br" />
    </div>

    <!-- Reduced motion: static overlay instead of animated scan line -->
    <div
      v-if="cameraActive && prefersReducedMotion"
      class="absolute inset-0 z-10 pointer-events-none"
    >
      <div class="guide-box" />
      <div class="corner corner-tl" />
      <div class="corner corner-tr" />
      <div class="corner corner-bl" />
      <div class="corner corner-br" />
    </div>

    <!-- Error / No camera fallback -->
    <div
      v-if="!cameraActive"
      class="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 p-6 text-center"
    >
      <div class="text-5xl mb-2">📸</div>
      <p class="text-white text-lg font-medium">
        {{ cameraError || 'Camera not active' }}
      </p>
      <p class="text-white/70 text-sm">
        Tap the button below to upload a photo instead
      </p>
    </div>

    <!-- Controls -->
    <div class="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-black/70">
      <!-- Close button -->
      <button
        aria-label="Close camera"
        class="vf-btn"
        @click="close"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <!-- Capture button -->
      <button
        aria-label="Capture photo"
        class="vf-capture"
        :disabled="!cameraActive"
        @click="captureFrame"
      >
        <div class="vf-capture-core" />
      </button>

      <!-- File upload fallback -->
      <button
        aria-label="Upload photo from file"
        class="vf-btn"
        @click="triggerFileInput"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      </button>
    </div>

    <!-- Hidden file input -->
    <input
      ref="fileInputRef"
      type="file"
      capture="environment"
      accept="image/*"
      class="sr-only"
      aria-hidden="true"
      tabindex="-1"
      @change="onFileSelected"
    />
  </div>
</template>

<style scoped>
/* Animated scan line — solid accent bar, no glow */
.scan-line {
  position: absolute;
  left: 15%;
  right: 15%;
  height: 3px;
  border-radius: 2px;
  background: var(--accent, #ffd23f);
  animation: scanMove 2.2s ease-in-out infinite;
}

@keyframes scanMove {
  0%, 100% { top: 15%; }
  50% { top: 85%; }
}

/* Respect reduced motion */
@media (prefers-reduced-motion: reduce) {
  .scan-line {
    animation: none;
    top: 50%;
    opacity: 0.5;
  }
}

/* Corner brackets */
.corner {
  position: absolute;
  width: 24px;
  height: 24px;
  border-color: var(--accent, #ffd23f);
  border-style: solid;
  border-width: 0;
}
.corner-tl { top: 15%; left: 15%; border-top-width: 3px; border-left-width: 3px; border-top-left-radius: 6px; }
.corner-tr { top: 15%; right: 15%; border-top-width: 3px; border-right-width: 3px; border-top-right-radius: 6px; }
.corner-bl { bottom: 15%; left: 15%; border-bottom-width: 3px; border-left-width: 3px; border-bottom-left-radius: 6px; }
.corner-br { bottom: 15%; right: 15%; border-bottom-width: 3px; border-right-width: 3px; border-bottom-right-radius: 6px; }

/* Reduced-motion static card guide */
.guide-box {
  position: absolute;
  inset: 15%;
  border: 2px solid rgba(255, 210, 63, 0.5);
  border-radius: 12px;
}

/* Tactile controls on the dark camera surface */
.vf-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: var(--bg-card, #fff);
  color: var(--ink, #141414);
  border: var(--bw, 2px) solid var(--ink, #141414);
  box-shadow: var(--shadow-xs);
  cursor: pointer;
  transition: background 0.12s, transform 0.1s, box-shadow 0.1s;
}
.vf-btn:hover { background: var(--bg-hover, #f6f0e2); }
.vf-btn:active { transform: translate(1px, 1px); box-shadow: var(--shadow-pressed); }

.vf-capture {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 68px;
  height: 68px;
  border-radius: 50%;
  background: var(--accent, #ffd23f);
  border: 3px solid var(--ink, #141414);
  box-shadow: var(--shadow);
  cursor: pointer;
  transition: background 0.12s, transform 0.1s, box-shadow 0.1s;
}
.vf-capture:hover:not(:disabled) { background: var(--accent-hover, #ffc907); }
.vf-capture:active:not(:disabled) { transform: translate(2px, 2px); box-shadow: var(--shadow-pressed); }
.vf-capture:disabled { opacity: 0.5; cursor: not-allowed; }

.vf-capture-core {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #fff;
  border: var(--bw, 2px) solid var(--ink, #141414);
}

/* Flash transition */
.flash-enter-active { transition: opacity 0.05s ease-out; }
.flash-leave-active { transition: opacity 0.15s ease-in; }
.flash-enter-from, .flash-leave-to { opacity: 0; }
</style>
