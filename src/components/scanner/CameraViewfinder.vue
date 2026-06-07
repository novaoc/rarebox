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
      <div class="absolute inset-[15%] border-2 border-rb-accent/40 rounded-lg" />
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
      <p class="text-rb-text text-lg font-medium">
        {{ cameraError || 'Camera not active' }}
      </p>
      <p class="text-rb-text-secondary text-sm">
        Tap the button below to upload a photo instead
      </p>
    </div>

    <!-- Controls -->
    <div class="absolute bottom-0 left-0 right-0 z-20 flex items-center justify-between p-4 bg-gradient-to-t from-black/80 to-transparent">
      <!-- Close button -->
      <button
        aria-label="Close camera"
        class="flex items-center justify-center w-11 h-11 rounded-full bg-rb-card/80 text-rb-text hover:bg-rb-hover transition-colors"
        @click="close"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <!-- Capture button -->
      <button
        aria-label="Capture photo"
        class="flex items-center justify-center w-16 h-16 rounded-full border-4 border-white bg-white/20 hover:bg-white/30 transition-all active:scale-95"
        :class="{ 'opacity-50 cursor-not-allowed': !cameraActive }"
        :disabled="!cameraActive"
        @click="captureFrame"
      >
        <div class="w-12 h-12 rounded-full bg-white" />
      </button>

      <!-- File upload fallback -->
      <button
        aria-label="Upload photo from file"
        class="flex items-center justify-center w-11 h-11 rounded-full bg-rb-card/80 text-rb-text hover:bg-rb-hover transition-colors"
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
/* Animated scan line */
.scan-line {
  position: absolute;
  left: 15%;
  right: 15%;
  height: 2px;
  background: linear-gradient(90deg, transparent, var(--accent, #f5a623), transparent);
  box-shadow: 0 0 12px 2px rgba(245, 166, 35, 0.6);
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
  border-color: var(--accent, #f5a623);
  border-style: solid;
  border-width: 0;
}
.corner-tl { top: 15%; left: 15%; border-top-width: 3px; border-left-width: 3px; border-top-left-radius: 6px; }
.corner-tr { top: 15%; right: 15%; border-top-width: 3px; border-right-width: 3px; border-top-right-radius: 6px; }
.corner-bl { bottom: 15%; left: 15%; border-bottom-width: 3px; border-left-width: 3px; border-bottom-left-radius: 6px; }
.corner-br { bottom: 15%; right: 15%; border-bottom-width: 3px; border-right-width: 3px; border-bottom-right-radius: 6px; }

/* Flash transition */
.flash-enter-active { transition: opacity 0.05s ease-out; }
.flash-leave-active { transition: opacity 0.15s ease-in; }
.flash-enter-from, .flash-leave-to { opacity: 0; }
</style>
