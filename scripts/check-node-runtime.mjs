// CVE-2026-111497: patched Node 22 starts at 22.23.4.
// Vercel controls its patch rollout; fail closed if a build worker is stale.
export function isSupportedNode(version) {
  if (!/^v?\d+\.\d+\.\d+$/.test(version)) return false
  const [major, minor, patch] = version.replace(/^v/, '').split('.').map(Number)
  return major === 22 && (minor > 23 || (minor === 23 && patch >= 4))
}
if (!isSupportedNode(process.version)) {
  throw new Error(`Rarebox requires patched Node >=22.23.4 <23; current ${process.version}. Run nvm use, or update the build runtime.`)
}
console.log(`Node security floor passed: ${process.version}`)
