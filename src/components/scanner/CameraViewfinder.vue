<template>
  <div class="camera-viewfinder h-full w-full bg-black flex flex-col items-center justify-center relative overflow-hidden">
    <!-- Video Stream -->
    <video
      ref="videoRef"
      autoplay
      playsinline
      class="h-full w-full object-cover"
      :class="{ 'opacity-50': isProcessing }"
    ></video>

    <!-- Scanner Overlay / Guidelines -->
    <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div class="w-64 h-88 border-2 border-rb-accent/50 rounded-2xl relative shadow-[0_0_0_100vw_rgba(0,0,0,0.4)]">
        <div class="absolute -top-10 left-1/2 -translate-x-1/2 text-rb-accent text-xs font-bold whitespace-nowrap uppercase tracking-widest">
          Align Card in Frame
        </div>
        <!-- Corner Accents -->
        <div class="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-rb-accent rounded-tl-xl"></div>
        <div class="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-rb-accent rounded-tr-xl"></div>
        <div class="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-rb-accent rounded-bl-xl"></div>
        <div class="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-rb-accent rounded-br-xl"></div>
      </div>
    </div>

    <!-- Controls -->
    <div class="absolute bottom-10 inset-x-0 flex items-center justify-center gap-8 px-6">
      <button
        @click="$emit('close')"
        class="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-white hover:bg-white/20 active:scale-95 transition-all"
        aria-label="Close scanner"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <button
        @click="capture"
        :disabled="isProcessing"
        class="w-20 h-20 rounded-full border-4 border-white flex items-center justify-center active:scale-90 transition-all disabled:opacity-50"
        aria-label="Capture card"
      >
        <div class="w-16 h-16 rounded-full bg-rb-accent shadow-lg shadow-rb-accent/40"></div>
      </button>

      <div class="w-12 h-12"></div> <!-- Spacer to center the capture button -->
    </div>

    <canvas ref="canvasRef" class="hidden"></canvas>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const emit = defineEmits(['capture', 'close'])
const props = defineProps({
  isProcessing: {
    type: BOOLEAN,
    default: false
  }
})

const videoRef = ref(null)
const canvasRef = ref(null)
let stream = null

async function initCamera() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment',
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    })
    if (videoRef.value) {
      videoRef.value.srcObject = stream
    }
  } catch (err) {
    console.error('Camera access failed:', err)
    alert('Could not access camera. Please ensure permissions are granted.')
    emit('close')
  }
}

function capture() {
  if (!videoRef.value || !canvasRef.value) return

  const video = videoRef.value
  const canvas = canvasRef.value
  const context = canvas.getContext('2d')

  // Set canvas size to video aspect ratio
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight

  // Draw current frame to canvas
  context.drawImage(video, 0, 0, canvas.width, canvas.height)

  // Get base64 data
  const imageData = canvas.toDataURL('image/jpeg', 0.8)
  emit('capture', imageData)
}

onMounted(() => {
  initCamera()
})

onBeforeUnmount(() => {
  if (stream) {
    stream.getTracks().forEach(track => track.stop())
  }
})
</script>

<style scoped>
.h-88 {
  height: 22rem;
}
</style>
