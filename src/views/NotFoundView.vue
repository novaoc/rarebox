<template>
  <div class="not-found">
    <h1>404</h1>
    <span class="sticker sticker-pink not-found-sticker">Page not found</span>
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
.not-found h1 {
  font-size: 72px;
  font-weight: 800;
  letter-spacing: -0.03em;
  margin-bottom: 12px;
  color: var(--text-primary);
}
.not-found-sticker { font-size: 14px; margin-bottom: 8px; }
.not-found p { font-size: 18px; margin: 16px 0 24px; color: var(--text-secondary); }
</style>
