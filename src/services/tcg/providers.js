// Multi-TCG browse providers.
//
// Each provider normalizes a game's API into a uniform shape so one generic
// browse UI (sets grid → cards grid with prices) works for every TCG.
//
//   Set:  { id, name, code, releaseDate, total, logo }
//   Card: { id, name, number, image, price, rarity }
//
// Data sources (English, free):
//   • MTG       — Scryfall   (api.scryfall.com)    CORS *  — browser-direct
//   • Lorcana   — Lorcast    (api.lorcast.com)     CORS *  — browser-direct
//   • One Piece — optcgapi   (via /api/optcg proxy — optcgapi has no CORS)
//   • Pokémon keeps its richer dedicated flow (SetsView) — not handled here.

async function getJson(url) {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`http_${res.status}`)
  return res.json()
}

function num(v) {
  if (v == null) return null
  const n = parseFloat(String(v).replace(/[$,]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

// ── MTG: Scryfall ───────────────────────────────────────────────────────────
const SCRY = 'https://api.scryfall.com'
const MTG_SET_TYPES = new Set([
  'core', 'expansion', 'masters', 'draft_innovation', 'commander',
  'masterpiece', 'funny', 'starter', 'box', 'duel_deck',
])

const mtg = {
  id: 'mtg',
  async getSets() {
    const d = await getJson(`${SCRY}/sets`)
    return (d.data || [])
      .filter(s => MTG_SET_TYPES.has(s.set_type) && !s.digital && (s.card_count || 0) > 0)
      .map(s => ({
        id: s.code,
        name: s.name,
        code: (s.code || '').toUpperCase(),
        releaseDate: s.released_at || null,
        total: s.card_count || null,
        logo: s.icon_svg_uri || '',
      }))
  },
  async getSetCards(setId) {
    let url = `${SCRY}/cards/search?q=${encodeURIComponent(`set:${setId} game:paper`)}&unique=prints&order=set`
    const cards = []
    let guard = 0
    while (url && guard < 12) {
      guard++
      const d = await getJson(url)
      for (const c of (d.data || [])) {
        const imgs = c.image_uris || c.card_faces?.[0]?.image_uris || {}
        cards.push({
          id: c.id,
          name: c.name,
          number: c.collector_number || '',
          image: imgs.small || imgs.normal || '',
          price: num(c.prices?.usd) || num(c.prices?.usd_foil),
          rarity: c.rarity || '',
        })
      }
      url = d.has_more ? d.next_page : null
    }
    return cards
  },
}

// ── Lorcana: Lorcast ─────────────────────────────────────────────────────────
const LOR = 'https://api.lorcast.com/v0'

const lorcana = {
  id: 'lorcana',
  async getSets() {
    const d = await getJson(`${LOR}/sets`)
    const arr = d.results || d || []
    return arr.map(s => ({
      id: s.code,
      name: s.name,
      code: s.code,
      releaseDate: s.released_at || null,
      total: s.card_count || null,
      logo: '',
    }))
  },
  async getSetCards(setId) {
    const d = await getJson(`${LOR}/sets/${encodeURIComponent(setId)}/cards`)
    const arr = Array.isArray(d) ? d : (d.results || [])
    return arr.map(c => {
      const img = c.image_uris?.digital || {}
      return {
        id: c.id,
        name: c.version ? `${c.name} — ${c.version}` : c.name,
        number: c.collector_number || '',
        image: img.small || img.normal || '',
        price: num(c.prices?.usd) || num(c.prices?.usd_foil),
        rarity: c.rarity || '',
      }
    })
  },
}

// ── One Piece: optcgapi via our /api/optcg proxy ─────────────────────────────
const onePiece = {
  id: 'one-piece',
  async getSets() {
    const d = await getJson('/api/optcg?action=sets')
    return (d.sets || []).map(s => ({
      id: s.set_id,
      name: s.set_name,
      code: s.set_id,
      releaseDate: null,
      total: null,
      logo: '',
    }))
  },
  async getSetCards(setId) {
    const d = await getJson(`/api/optcg?action=cards&set=${encodeURIComponent(setId)}`)
    return (d.cards || []).map(c => ({
      id: c.id,
      name: c.name,
      number: c.number || '',
      image: c.image || '',
      price: num(c.price),
      rarity: c.rarity || '',
    }))
  },
}

const PROVIDERS = { mtg, lorcana, 'one-piece': onePiece }

export function getProvider(id) {
  return PROVIDERS[id] || null
}

// Registry powering the browse landing page. `available:false` = no data source
// yet (shown as "coming soon"). Brand colors drive the logo tiles.
export const TCGS = [
  { id: 'pokemon',   name: 'Pokémon',             tagline: 'Cards, sets & live prices', emoji: '⚡', c1: '#ffcb05', c2: '#2a75bb', route: '/sets/pokemon', available: true },
  { id: 'mtg',       name: 'Magic: The Gathering', tagline: 'Every English set · USD prices', emoji: '🔥', c1: '#f8991c', c2: '#c0202a', route: '/sets/mtg', available: true },
  { id: 'one-piece', name: 'One Piece Card Game',  tagline: 'Sets & market prices', emoji: '🏴‍☠️', c1: '#d7263d', c2: '#1b1b3a', route: '/sets/one-piece', available: true },
  { id: 'lorcana',   name: 'Disney Lorcana',       tagline: 'Sets & USD prices', emoji: '✨', c1: '#7b2c9e', c2: '#0f9b8e', route: '/sets/lorcana', available: true },
  { id: 'riftbound', name: 'Riftbound (LoL TCG)',  tagline: 'Coming soon', emoji: '🛡️', c1: '#0bc6e3', c2: '#0a2540', route: '', available: false },
]
