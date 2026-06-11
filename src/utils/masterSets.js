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
    const data = lang === 'ja' ? await getJapaneseCardsBySet(setId, 1, 999) : await getCardsBySet(setId, 1, 250)
    return (data.data || []).map(c => ({
      id: c.id,
      name: c.name,
      number: c.number,
      images: c.images,
      rarity: c.rarity,
      supertype: c.supertype,
      set: { id: c.set?.id || setId, name: c.set?.name || setName },
      price: (() => { const r = getMarketPrice(c); return r?.price || r || 0 })(),
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
    price: c.price || 0,
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
