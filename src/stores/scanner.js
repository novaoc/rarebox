/**
 * Rarebox — Pokémon TCG Portfolio Tracker
 * Built by Nova — GitHub: @novaoc
 * https://rarebox.io
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useScannerStore = defineStore('scanner', () => {
  // State
  const isCameraOpen = ref(false)
  const isProcessing = ref(false)
  const currentSession = ref([]) // Array of ScanResult

  // Actions
  function openCamera() {
    isCameraOpen.value = true
  }

  function closeCamera() {
    isCameraOpen.value = false
    isProcessing.value = false
  }

  function startProcessing() {
    isProcessing.value = true
  }

  function stopProcessing() {
    isProcessing.value = false
  }

  function addScanResult(result) {
    currentSession.value.push({
      ...result,
      id: crypto.randomUUID(),
      timestamp: Date.now()
    })
  }

  function clearSession() {
    currentSession.value = []
  }

  function removeResult(id) {
    currentSession.value = currentSession.value.filter(r => r.id !== id)
  }

  return {
    isCameraOpen,
    isProcessing,
    currentSession,
    openCamera,
    closeCamera,
    startProcessing,
    stopProcessing,
    addScanResult,
    clearSession,
    removeResult
  }
})
