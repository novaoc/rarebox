// Fetches live meta deck data from our serverless endpoint
// Server does all the scraping + card resolution
// Client just caches the result for 24h

const CACHE_KEY = 'rarebox_meta_decks_cache'
const CACHE_TTL = 1000 * 60 * 60 * 24 // 24 hours

function getCacheKey(game) {
  return `${CACHE_KEY}_${game || 'pokemon'}`
}

export async function fetchLiveMetaDecks(game = 'pokemon') {
  const cacheKey = getCacheKey(game)

  // Check cache first
  try {
    const cached = JSON.parse(localStorage.getItem(cacheKey))
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.decks
    }
  } catch {}

  // Try serverless endpoint
  try {
    const res = await fetch(`/api/meta-decks?game=${game}`)
    if (res.ok) {
      const data = await res.json()
      if (data.decks?.length) {
        localStorage.setItem(cacheKey, JSON.stringify({
          timestamp: Date.now(),
          decks: data.decks,
        }))
        return data.decks
      }
    }
  } catch {}

  // Server unavailable — return fallback
  const fallback = getFallbackDecks(game)
  return fallback
}

// ── Fallback meta decks for all TCGs ──────────────────────────────────

const FALLBACK_DECKS = {
  pokemon: [
    {
      name: 'Charizard ex',
      archetype: 'Charizard',
      game: 'pokemon',
      description: 'The king of consistency. Rare Candy into Charizard ex for OHKOs.',
      cards: [
        { name: 'Charizard ex', setCode: 'sv3', number: '125', quantity: 3 },
        { name: 'Charmander', setCode: 'sv3', number: '26', quantity: 4 },
        { name: 'Charmeleon', setCode: 'sv3', number: '27', quantity: 1 },
        { name: 'Pidgey', setCode: 'sv3', number: '162', quantity: 4 },
        { name: 'Pidgeot ex', setCode: 'sv3', number: '164', quantity: 2 },
        { name: 'Rotom V', setCode: 'sv4', number: '50', quantity: 1 },
        { name: 'Lumineon V', setCode: 'sv3pt5', number: '40', quantity: 1 },
      ],
    },
    {
      name: 'Gardevoir ex',
      archetype: 'Gardevoir',
      game: 'pokemon',
      description: 'Psychic acceleration with Kirlia draw engine.',
      cards: [
        { name: 'Gardevoir ex', setCode: 'sv1', number: '86', quantity: 3 },
        { name: 'Kirlia', setCode: 'sv1', number: '68', quantity: 4 },
        { name: 'Ralts', setCode: 'sv1', number: '67', quantity: 4 },
        { name: 'Mew ex', setCode: 'sv2', number: '86', quantity: 1 },
        { name: 'Iron Valiant ex', setCode: 'sv4', number: '86', quantity: 2 },
      ],
    },
    {
      name: 'Dragapult ex',
      archetype: 'Dragapult',
      game: 'pokemon',
      description: 'Phantom Dive for spread damage. Fast and aggressive.',
      cards: [
        { name: 'Dragapult ex', setCode: 'sv6', number: '130', quantity: 3 },
        { name: 'Drakloak', setCode: 'sv6', number: '129', quantity: 3 },
        { name: 'Dreepy', setCode: 'sv6', number: '128', quantity: 4 },
        { name: 'Rotom V', setCode: 'sv4', number: '50', quantity: 1 },
        { name: 'Lumineon V', setCode: 'sv3pt5', number: '40', quantity: 1 },
      ],
    },
  ],
  mtg: [
    {
      name: 'Dimir Reanimator',
      archetype: 'Reanimator',
      game: 'mtg',
      description: 'Reanimate big threats from the graveyard. Atraxa, Archfiend, and Valgavoth are common targets.',
      cards: [
        { name: 'Atraxa, Grand Unifier', setCode: 'one', number: '196', quantity: 4 },
        { name: 'Archfiend of the Dross', setCode: 'one', number: '83', quantity: 4 },
        { name: 'Valgavoth, Terror Eater', setCode: 'dsk', number: '206', quantity: 2 },
        { name: 'Overlord of the Balemurk', setCode: 'dsk', number: '103', quantity: 4 },
        { name: 'Priest of Fell Rites', setCode: 'mic', number: '92', quantity: 2 },
        { name: 'Collector Ouphe', setCode: '2x2', number: '107', quantity: 2 },
        { name: 'Grief', setCode: 'mh2', number: '84', quantity: 4 },
      ],
    },
    {
      name: 'Temur Breach',
      archetype: 'Breach',
      game: 'mtg',
      description: 'Grinding Breach combo. Mill yourself and recast spells from graveyard for infinite loops.',
      cards: [
        { name: 'Underworld Breach', setCode: 'thb', number: '161', quantity: 4 },
        { name: 'Grinding Station', setCode: 'brc', number: '127', quantity: 4 },
        { name: 'Sai, Master Thopterist', setCode: 'm19', number: '70', quantity: 3 },
        { name: 'Emry, Lurker of the Loch', setCode: 'eld', number: '43', quantity: 2 },
        { name: 'Urza, Lord High Artificer', setCode: 'mh1', number: '64', quantity: 1 },
      ],
    },
  ],
  lorcana: [
    {
      name: 'Steel Sapphire (Item Ramp)',
      archetype: 'Item Ramp',
      game: 'lorcana',
      description: 'Ramp with items and play high-cost threats early. Tamatoa and Ariel finish games.',
      cards: [
        { name: 'Tamatoa — So Shiny', setCode: '4', number: '170', quantity: 3 },
        { name: 'Ariel — Collector', setCode: '4', number: '143', quantity: 4 },
        { name: 'Hiram Flaversham — Toymaker', setCode: '2', number: '151', quantity: 4 },
        { name: 'Typewriter', setCode: '3', number: '167', quantity: 4 },
        { name: 'One Jump Ahead', setCode: '1', number: '153', quantity: 4 },
        { name: 'Gaston — Arrogant Hunter', setCode: '2', number: '84', quantity: 4 },
        { name: 'How Far Ill Go', setCode: '1', number: '156', quantity: 3 },
      ],
    },
    {
      name: 'Ruby Amethyst (Midrange)',
      archetype: 'Midrange',
      game: 'lorcana',
      description: 'Control the board with removal and card draw. Aggressive finishers like Maleficent.',
      cards: [
        { name: 'Maleficent — Monstrous Dragon', setCode: '1', number: '131', quantity: 3 },
        { name: 'Dragon Fire', setCode: '1', number: '128', quantity: 4 },
        { name: 'Friends on the Other Side', setCode: '1', number: '148', quantity: 4 },
        { name: 'Elsa — Snow Queen', setCode: '1', number: '46', quantity: 2 },
        { name: 'Be Prepared', setCode: '1', number: '122', quantity: 3 },
      ],
    },
  ],
  'one-piece': [
    {
      name: 'Pluffy (Purple Luffy)',
      archetype: 'Purple Luffy',
      game: 'one-piece',
      description: 'Ramp with Don!! and overwhelm with powerful 10-drop Luffy. Top meta deck in OP08.',
      cards: [
        { name: 'Monkey.D.Luffy', setCode: 'OP08', number: '001', quantity: 1 },
        { name: 'Monkey.D.Luffy', setCode: 'OP08', number: '049', quantity: 4 },
        { name: 'Gum Gum Giant', setCode: 'OP08', number: '050', quantity: 4 },
        { name: 'Gear 5 Luffy', setCode: 'OP08', number: '119', quantity: 4 },
        { name: 'Rocks Dragon Kaido', setCode: 'OP09', number: '025', quantity: 3 },
        { name: 'Carrot', setCode: 'ST17', number: '005', quantity: 4 },
        { name: 'Eustass Captain Kid', setCode: 'OP07', number: '030', quantity: 4 },
      ],
    },
    {
      name: 'Belo Betty (Revolutionary)',
      archetype: 'Belo Betty',
      game: 'one-piece',
      description: 'Aggressive leader ability buffs your whole board. Swing wide and fast.',
      cards: [
        { name: 'Belo Betty', setCode: 'OP07', number: '001', quantity: 1 },
        { name: 'Lindbergh', setCode: 'OP07', number: '023', quantity: 4 },
        { name: 'Karasu', setCode: 'OP07', number: '025', quantity: 4 },
        { name: 'Morley', setCode: 'OP07', number: '024', quantity: 4 },
        { name: 'Ivankov', setCode: 'OP07', number: '026', quantity: 3 },
      ],
    },
  ],
  riftbound: [
    {
      name: 'Mono Time (Tempo)',
      archetype: 'Time',
      game: 'riftbound',
      description: 'Time manipulation. Ramp with chrono-shifters, then drop powerful finishers ahead of curve.',
      cards: [
        { name: 'Chronomancer Initiate', setCode: 'core', number: '001', quantity: 4 },
        { name: 'Time Walker', setCode: 'core', number: '042', quantity: 4 },
        { name: 'Temporal Guardian', setCode: 'core', number: '043', quantity: 3 },
        { name: 'Chrono Surge', setCode: 'core', number: '044', quantity: 4 },
        { name: 'Timelord Prime', setCode: 'core', number: '045', quantity: 2 },
      ],
    },
    {
      name: 'Void Mill',
      archetype: 'Void',
      game: 'riftbound',
      description: 'Mill the opponent\'s deck into the void. Control the game with removal and recursion.',
      cards: [
        { name: 'Void Cultist', setCode: 'core', number: '002', quantity: 4 },
        { name: 'Mind Eater', setCode: 'core', number: '046', quantity: 4 },
        { name: 'Void Pulse', setCode: 'core', number: '047', quantity: 4 },
        { name: 'Dark Ritual', setCode: 'core', number: '048', quantity: 3 },
        { name: 'Void Lord', setCode: 'core', number: '049', quantity: 2 },
      ],
    },
  ],
  yugioh: [
    {
      name: 'Snake-Eye Fire King',
      archetype: 'Snake-Eye',
      game: 'yugioh',
      description: 'The top deck of the format. Snake-Eye and Fire King synergize for endless advantage and recursion.',
      cards: [
        { name: 'Snake-Eye Ash', setCode: 'YCOB', number: '000', quantity: 3 },
        { name: 'Snake-Eye Oak', setCode: 'SUDA', number: '018', quantity: 3 },
        { name: 'Snake-Eye Birch', setCode: 'SUDA', number: '017', quantity: 2 },
        { name: 'Fire King Island', setCode: 'SDOK', number: '029', quantity: 3 },
        { name: 'Fire King High Avatar Kirin', setCode: 'SDOK', number: '004', quantity: 2 },
        { name: 'Fire King Avatar Barong', setCode: 'SDOK', number: '003', quantity: 3 },
        { name: 'Bonfire', setCode: 'SUDA', number: '066', quantity: 3 },
      ],
    },
    {
      name: 'Tenpai Dragon (OTK)',
      archetype: 'Tenpai',
      game: 'yugioh',
      description: 'One-turn-kill deck. Summon Tenpai Dragons during the Battle Phase for massive multi-attack damage.',
      cards: [
        { name: 'Tenpai Dragon Chundra', setCode: 'SUDA', number: '012', quantity: 3 },
        { name: 'Tenpai Dragon Fadra', setCode: 'SUDA', number: '013', quantity: 3 },
        { name: 'Tenpai Dragon Bident', setCode: 'SUDA', number: '014', quantity: 3 },
        { name: 'Tenpai Dragon Paidra', setCode: 'SUDA', number: '015', quantity: 3 },
        { name: 'Sangen Summoning', setCode: 'SUDA', number: '057', quantity: 3 },
        { name: 'Sangen Kaimen', setCode: 'SUDA', number: '058', quantity: 3 },
        { name: 'Trident Dragion', setCode: 'SD32', number: '042', quantity: 2 },
      ],
    },
  ],
}

function getFallbackDecks(game) {
  return FALLBACK_DECKS[game] || FALLBACK_DECKS.pokemon
}

export const fallbackMetaDecks = FALLBACK_DECKS.pokemon
