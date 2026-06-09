<template>
  <div class="not-found">
    <h1>404</h1>
    <p>This page could not be found.</p>
    <router-link to="/" class="btn btn-primary">Back to Dashboard</router-link>
  </div>
</template>

<script setup>
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
onMounted(() => {
  console.warn('[router] 404 —', router.currentRoute.value.fullPath)
})
</script>

<style scoped>
.not-found { text-align: center; padding: 80px 20px; }
.not-found h1 { font-size: 72px; margin-bottom: 16px; color: var(--accent); }
.not-found p { font-size: 18px; margin-bottom: 24px; color: var(--text-secondary); }
</style>
