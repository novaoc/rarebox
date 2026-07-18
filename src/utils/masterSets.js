/**
 * Master-set helpers — fetch a set's FULL card list (not just what the
 * user owns) normalized to the shelf item shape. Used by the Add Master
 * Set modal and the Hunt-mode gallery. Set lists ride the same cached
 * layers as Browse, so a set you've opened once works offline too.
 */
import { getCardsBySet, getJapaneseCardsBySet, getMarketPrice } from '../services/pokemonApi'
import { getProvider } from '../services/tcg/providers'

export async function fetchSetCards({ game, setId, setName, lang }) {
  if (game === 'pokemon') {
    let list
    if (lang === 'ja') {
      list = (await getJapaneseCardsBySet(setId, 1, 999)).data || []
    } else {
      // pokemontcg.io caps pageSize at 250 and a few sets exceed it
      // (Surging Sparks is 252) — page until the set runs dry
      list = []
      for (let page = 1; ; page++) {
        const batch = (await getCardsBySet(setId, page, 250)).data || []
        list.push(...batch)
        if (batch.length < 250) break
      }
    }
    return list.map(c => ({
      id: c.id,
      name: c.name,
      number: c.number,
      images: c.images,
      rarity: c.rarity,
      supertype: c.supertype,
      set: { id: c.set?.id || setId, name: c.set?.name || setName },
      // Numeric only — never persist a getMarketPrice result object. $0 stays 0.
      price: (() => {
        const r = getMarketPrice(c)
        const p = typeof r === 'number' ? r : r?.price
        return (typeof p === 'number' && Number.isFinite(p)) ? p : 0
      })(),
      _lang: lang === 'ja' ? 'ja' : null,
      game: 'pokemon',
    }))
  }
  const raw = await getProvider(game)?.getSetCards(setId) || []
  return raw.map(c => ({
    id: c.id,
    name: c.name,
    number: c.number,
    images: { small: c.image },
    rarity: c.rarity,
    set: { id: setId, name: setName },
    price: (typeof c.price === 'number' && Number.isFinite(c.price)) ? c.price : 0,
    _lang: null,
    game,
  }))
}

/** Sort by collector number (numeric where possible, TG15/SV049 tolerated) */
export function sortByNumber(cards) {
  return [...cards].sort((a, b) => {
    const na = parseInt(String(a.number).replace(/\D/g, ''), 10)
    const nb = parseInt(String(b.number).replace(/\D/g, ''), 10)
    if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb
    return String(a.number).localeCompare(String(b.number))
  })
}
