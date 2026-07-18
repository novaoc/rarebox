/**
 * Tactile theme switching — light (default) / dark / system.
 *
 * The choice persists in localStorage and is applied as
 * document.documentElement.dataset.theme before paint (index.html bootstrap)
 * so there is no flash. Everything else follows from the token remap in
 * main.css under :root[data-theme="dark"].
 */

const KEY = 'rarebox_theme'
const META_COLORS = { light: '#faf6ef', dark: '#16140e' }

export function getThemePref() {
  try { return localStorage.getItem(KEY) || 'light' } catch { return 'light' }
}

export function resolvedTheme(pref = getThemePref()) {
  if (pref === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  return pref === 'dark' ? 'dark' : 'light'
}

export function applyTheme(pref = getThemePref()) {
  const t = resolvedTheme(pref)
  document.documentElement.dataset.theme = t
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', META_COLORS[t])
  window.dispatchEvent(new CustomEvent('rarebox-theme', { detail: t }))
  return t
}

export function setThemePref(pref) {
  try { localStorage.setItem(KEY, pref) } catch { /* private mode */ }
  return applyTheme(pref)
}

export function isDark() {
  return document.documentElement.dataset.theme === 'dark'
}

export function isLight() {
  return document.documentElement.dataset.theme === 'light'
}

// keep "system" users in sync with the OS
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (getThemePref() === 'system') applyTheme('system')
})
