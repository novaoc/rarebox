/**
 * rarebox-data fallback — when a primary catalog API is down (pokemontcg.io
 * 500s for hours at a time; tcgdex too), Browse and card lookups fall back
 * to the public dataset the daily pipeline publishes:
 * https://github.com/novaoc/rarebox-data (CC0, raw.githubusercontent, CORS *).
 *
 * The dataset is a daily snapshot — at most a day behind the APIs and
 * identical in coverage (it is BUILT from them, plus the extras/secret-rare
 * merges the APIs lack). Prices are not served from here; the existing
 * static price maps keep doing that. No imports — node-testable.
 */

const DS = 'https://raw.githubusercontent.com/novaoc/rarebox-data/main'

async function dsJson(path) {
  const res = await fetch(`${DS}/${path}`, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`dataset_${res.status}`)
  return res.json()
}

/** pokemontcg.io small image URL → its _hires sibling (best-effort). */
function hiresOf(url) {
  return /images\.pokemontcg\.io\/.*\.png$/.test(url || '')
    ? url.replace(/\.png$/, '_hires.png')
    : url
}

function toAppCard(c) {
  return {
    id: c.id,
    name: c.name,
    number: c.number,
    set: { id: c.set?.id, name: c.set?.name },
    rarity: c.rarity || null,
    supertype: c.supertype || undefined,
    images: c.image ? { small: c.image, large: hiresOf(c.image) } : { small: null, large: null },
    _lang: c._lang || null,
    _dataset: true,
  }
}

/** EN Pokémon set list in the app's getSets() shape. */
export async function dsPokemonSets() {
  const rows = await dsJson('catalog/pokemon/sets.json')
  return rows.map(s => ({
    id: s.id, name: s.name, series: s.series || '',
    total: s.total, printedTotal: s.printedTotal,
    releaseDate: s.releaseDate, ptcgoCode: undefined,
    images: { logo: s.logo || null, symbol: null },
  }))
}

/** EN Pokémon set cards in the app's card shape (prices enrich elsewhere). */
export async function dsPokemonSetCards(setId) {
  const rows = await dsJson(`catalog/pokemon/sets/${setId}.json`)
  return rows.map(toAppCard)
}

/** JA set cards — the dataset already carries the secret rares tcgdex omits. */
export async function dsJapaneseSetCards(setId) {
  const rows = await dsJson(`catalog/pokemon-ja/sets/${setId}.json`)
  return rows.map(toAppCard)
}

/** Single card by id (EN or JA): set id is the prefix before the last dash. */
export async function dsCardById(cardId, lang = null) {
  const id = String(cardId || '')
  const at = id.lastIndexOf('-')
  if (at <= 0) throw new Error('dataset_bad_id')
  const setId = id.slice(0, at)
  const rows = lang === 'ja'
    ? await dsJapaneseSetCards(setId)
    : await dsPokemonSetCards(setId)
  const hit = rows.find(c => c.id === id)
  if (!hit) throw new Error('dataset_miss')
  return hit
}
