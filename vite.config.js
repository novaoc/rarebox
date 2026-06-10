import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { resolve } from 'node:path'

/**
 * Generates dist/sw.js from scripts/sw-template.js after each build,
 * injecting the precache list (index.html + every hashed bundle asset +
 * the static shell files from public/). Videos and scan indexes are
 * deliberately NOT precached — they cache at runtime on first use.
 */
function rareboxServiceWorker() {
  return {
    name: 'rarebox-sw',
    apply: 'build',
    writeBundle(options, bundle) {
      const precache = ['/', '/index.html', '/favicon.svg', '/manifest.webmanifest', '/icons.svg']
      for (const file of Object.keys(bundle)) {
        if (file === 'index.html' || file.endsWith('.map')) continue
        if (/\.(js|css|svg|woff2?)$/.test(file)) precache.push('/' + file)
      }
      const template = readFileSync(resolve(import.meta.dirname, 'scripts/sw-template.js'), 'utf8')
      const version = createHash('sha256').update(precache.join('|')).digest('hex').slice(0, 12)
      const sw = template
        .replace('__VERSION__', version)
        .replace('__PRECACHE__', JSON.stringify(precache))
      writeFileSync(resolve(options.dir, 'sw.js'), sw)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue(), rareboxServiceWorker()],
})
