import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [vue()],
  optimizeDeps: {
    include: ['tesseract.js']
  },
  build: {
    commonjsOptions: {
      include: [/tesseract.js/, /node_modules/]
    }
  }
})
