import fs from 'node:fs'
import path from 'node:path'

export const root = path.resolve(new URL('../../', import.meta.url).pathname)

export function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8')
}

export function fail(message, detail = '') {
  const err = new Error(detail ? `${message}\n${detail}` : message)
  err.isEvalFailure = true
  throw err
}

export function assert(condition, message, detail = '') {
  if (!condition) fail(message, detail)
}

export function ok(message) {
  console.log(`✓ ${message}`)
}

export function extractObjectKeys(source, constName) {
  const start = source.indexOf(`const ${constName} = {`)
  if (start === -1) return []
  const bodyStart = source.indexOf('{', start)
  let depth = 0
  let end = -1
  for (let i = bodyStart; i < source.length; i++) {
    const ch = source[i]
    if (ch === '{') depth++
    if (ch === '}') depth--
    if (depth === 0) { end = i; break }
  }
  if (end === -1) return []
  const body = source.slice(bodyStart + 1, end)
  const keys = []
  const re = /(?:^|\n|,)\s*(?:'([^']+)'|"([^"]+)"|([a-zA-Z_$][\w$-]*))\s*:/g
  let m
  while ((m = re.exec(body))) keys.push(m[1] || m[2] || m[3])
  for (const part of body.split(',')) {
    const shorthand = part.trim().match(/^([a-zA-Z_$][\w$]*)$/)
    if (shorthand && !keys.includes(shorthand[1])) keys.push(shorthand[1])
  }
  return keys
}

export function extractExportedArrayObjects(source, arrayName) {
  const start = source.indexOf(`export const ${arrayName} = [`)
  if (start === -1) return []
  const arrStart = source.indexOf('[', start)
  let depth = 0
  let end = -1
  for (let i = arrStart; i < source.length; i++) {
    const ch = source[i]
    if (ch === '[') depth++
    if (ch === ']') depth--
    if (depth === 0) { end = i; break }
  }
  if (end === -1) return []
  const text = source.slice(arrStart, end + 1)
  const objects = []
  const re = /\{\s*id:\s*'([^']+)'[\s\S]*?route:\s*'([^']+)'[\s\S]*?available:\s*(true|false)/g
  let m
  while ((m = re.exec(text))) objects.push({ id: m[1], route: m[2], available: m[3] === 'true' })
  return objects
}

export function runEval(name, fn) {
  try {
    fn()
    console.log(`\nPASS ${name}`)
  } catch (err) {
    console.error(`\nFAIL ${name}`)
    console.error(err?.message || err)
    process.exitCode = 1
  }
}
