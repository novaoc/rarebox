import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  // Use relative base path so it works on Vercel root and GitHub Pages subfolders
  base: './',
  plugins: [vue()],
  build: {
    // Ensure assets are handled correctly with relative paths
    assetsDir: 'assets',
  }
})
