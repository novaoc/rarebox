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
  let serverDecks = []
  try {
    const res = await fetch(`/api/meta-decks?game=${game}`)
    if (res.ok) {
      const data = await res.json()
      if (data.decks?.length) serverDecks = data.decks
    }
  } catch {}

  const fallback = getFallbackDecks(game)

  // Merge: keep server decks that have cards, pad with fallback to 10
  const validServer = serverDecks.filter(d => d.cards?.length > 0)
  const existingNames = new Set(validServer.map(d => d.archetype || d.name))
  const extras = fallback.filter(d => !existingNames.has(d.archetype || d.name))
  const merged = [...validServer, ...extras].slice(0, 10)

  localStorage.setItem(cacheKey, JSON.stringify({
    timestamp: Date.now(),
    decks: merged,
  }))
  return merged
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
      ],
    },
    {
      name: 'Regidrago VSTAR',
      archetype: 'Regidrago',
      game: 'pokemon',
      description: 'Lost Zone engine fueling Regidrago VSTAR. Copies any Dragon attack from the discard pile.',
      cards: [
        { name: 'Regidrago VSTAR', setCode: 'sv5', number: '136', quantity: 3 },
        { name: 'Regidrago V', setCode: 'sv5', number: '135', quantity: 3 },
        { name: 'Comfey', setCode: 'sv2', number: '64', quantity: 4 },
        { name: 'Sableye', setCode: 'sv2', number: '70', quantity: 1 },
        { name: 'Radiant Greninja', setCode: 'sv1', number: '46', quantity: 1 },
      ],
    },
    {
      name: 'Roaring Moon ex',
      archetype: 'Roaring Moon',
      game: 'pokemon',
      description: 'Ancient Box. Aggressive dark-type with Frenzied Gouging and Ancient Booster Energy.',
      cards: [
        { name: 'Roaring Moon ex', setCode: 'sv5', number: '124', quantity: 3 },
        { name: 'Flutter Mane', setCode: 'sv5', number: '79', quantity: 4 },
        { name: 'Scream Tail', setCode: 'sv5', number: '86', quantity: 2 },
        { name: 'Ancient Booster Energy', setCode: 'sv5', number: '149', quantity: 4 },
        { name: 'Professor Sada\'s Vitality', setCode: 'sv5', number: '154', quantity: 4 },
      ],
    },
    {
      name: 'Miraidon ex',
      archetype: 'Miraidon',
      game: 'pokemon',
      description: 'Electric box with Future Booster Energy. Fast setup, big lightning damage.',
      cards: [
        { name: 'Miraidon ex', setCode: 'sv1', number: '79', quantity: 3 },
        { name: 'Raichu V', setCode: 'sv1', number: '48', quantity: 2 },
        { name: 'Magnezone', setCode: 'sv6', number: '53', quantity: 2 },
        { name: 'Future Booster Energy', setCode: 'sv5', number: '150', quantity: 4 },
        { name: 'Electric Generator', setCode: 'sv4', number: '106', quantity: 4 },
      ],
    },
    {
      name: 'Lugia VSTAR',
      archetype: 'Lugia',
      game: 'pokemon',
      description: 'Summoning from the Lost Zone. Powerful colorless attackers with Archeops acceleration.',
      cards: [
        { name: 'Lugia VSTAR', setCode: 'swsh12pt5', number: '139', quantity: 3 },
        { name: 'Lugia V', setCode: 'swsh12pt5', number: '138', quantity: 3 },
        { name: 'Archeops', setCode: 'swsh12pt5', number: '147', quantity: 4 },
        { name: 'Snorlax', setCode: 'sv3', number: '143', quantity: 2 },
      ],
    },
    {
      name: 'Chien-Pao ex',
      archetype: 'Chien-Pao',
      game: 'pokemon',
      description: 'Baxcalibur ice energy acceleration. Load up Chien-Pao for OHKOs.',
      cards: [
        { name: 'Chien-Pao ex', setCode: 'sv4', number: '61', quantity: 3 },
        { name: 'Frigibax', setCode: 'sv4', number: '58', quantity: 4 },
        { name: 'Arctibax', setCode: 'sv4', number: '59', quantity: 2 },
        { name: 'Baxcalibur', setCode: 'sv4', number: '60', quantity: 2 },
        { name: 'Radiant Greninja', setCode: 'sv1', number: '46', quantity: 1 },
      ],
    },
    {
      name: 'Ancient Box (No ex)',
      archetype: 'Ancient Box',
      game: 'pokemon',
      description: 'Single-prize Ancient attackers. Roaring Moon spread damage with Sableye synergy.',
      cards: [
        { name: 'Roaring Moon', setCode: 'sv5', number: '109', quantity: 4 },
        { name: 'Flutter Mane', setCode: 'sv5', number: '79', quantity: 4 },
        { name: 'Sableye', setCode: 'sv2', number: '70', quantity: 3 },
        { name: 'Ancient Booster Energy', setCode: 'sv5', number: '149', quantity: 4 },
      ],
    },
    {
      name: 'Snorlax Stall',
      archetype: 'Snorlax',
      game: 'pokemon',
      description: 'Block the active with Snorlax\'s ability. Mill and counter control.',
      cards: [
        { name: 'Snorlax', setCode: 'sv3', number: '143', quantity: 4 },
        { name: 'Rotom V', setCode: 'sv4', number: '50', quantity: 1 },
        { name: 'Pidgeot V', setCode: 'sv2', number: '137', quantity: 1 },
        { name: 'Miss Fortune Sisters', setCode: 'sv6', number: '164', quantity: 3 },
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
    {
      name: 'Azorius Control',
      archetype: 'Azorius Control',
      game: 'mtg',
      description: 'Counter and remove everything. Win with Teferi or Shark Typhoon tokens.',
      cards: [
        { name: 'Teferi, Time Raveler', setCode: 'war', number: '221', quantity: 3 },
        { name: 'No More Lies', setCode: 'mkm', number: '69', quantity: 4 },
        { name: 'Sunfall', setCode: 'mkm', number: '40', quantity: 3 },
        { name: 'Shark Typhoon', setCode: 'mh1', number: '67', quantity: 2 },
        { name: 'The Wandering Emperor', setCode: 'neo', number: '42', quantity: 2 },
      ],
    },
    {
      name: 'Mono-Red Aggro',
      archetype: 'Mono-Red',
      game: 'mtg',
      description: 'Fastest deck in the format. Burn, haste creatures, and direct damage to close games.',
      cards: [
        { name: 'Monastery Swiftspear', setCode: 'otj', number: '142', quantity: 4 },
        { name: 'Heartfire Hero', setCode: 'blb', number: '142', quantity: 4 },
        { name: 'Slickshot Show-Off', setCode: 'otj', number: '146', quantity: 4 },
        { name: 'Lightning Strike', setCode: 'dsk', number: '136', quantity: 4 },
        { name: 'Witchstalker Frenzy', setCode: 'blb', number: '159', quantity: 3 },
      ],
    },
    {
      name: 'Rakdos Midrange',
      archetype: 'Rakdos Midrange',
      game: 'mtg',
      description: 'Efficient creatures and removal. Outgrind the opponent with card advantage.',
      cards: [
        { name: 'Fable of the Mirror-Breaker', setCode: 'neo', number: '141', quantity: 4 },
        { name: 'Sheoldred, the Apocalypse', setCode: 'dmu', number: '107', quantity: 3 },
        { name: 'Bloodtithe Harvester', setCode: 'vow', number: '232', quantity: 4 },
        { name: 'Go for the Throat', setCode: 'otj', number: '246', quantity: 4 },
        { name: 'Thoughtseize', setCode: 'tsr', number: '126', quantity: 3 },
      ],
    },
    {
      name: 'Domain Ramp',
      archetype: 'Domain',
      game: 'mtg',
      description: 'Ramp to cast big threats. Scapeshift combo or Herd Migration beats.',
      cards: [
        { name: 'Up the Beanstalk', setCode: 'woe', number: '195', quantity: 4 },
        { name: 'Herd Migration', setCode: 'otj', number: '166', quantity: 4 },
        { name: 'Scapeshift', setCode: 'mh1', number: '175', quantity: 3 },
        { name: 'Omnath, Locus of Creation', setCode: 'znr', number: '232', quantity: 3 },
        { name: 'Leyline Binding', setCode: 'mkm', number: '222', quantity: 4 },
      ],
    },
    {
      name: 'Izzet Phoenix',
      archetype: 'Phoenix',
      game: 'mtg',
      description: 'Fill the graveyard with spells, bring back Arclight Phoenix. Draw, discard, repeat.',
      cards: [
        { name: 'Arclight Phoenix', setCode: 'grn', number: '91', quantity: 4 },
        { name: 'Picklock Prankster', setCode: 'dsk', number: '75', quantity: 4 },
        { name: 'Consider', setCode: 'mkc', number: '78', quantity: 4 },
        { name: 'Lórien Revealed', setCode: 'ltr', number: '60', quantity: 3 },
        { name: 'Temporal Trespass', setCode: 'fdn', number: '87', quantity: 1 },
      ],
    },
    {
      name: 'Boros Convoke',
      archetype: 'Convoke',
      game: 'mtg',
      description: 'Cheat mana with convoke. Wide board of creatures into Knight-Errant of Eos.',
      cards: [
        { name: 'Knight-Errant of Eos', setCode: 'blb', number: '205', quantity: 4 },
        { name: 'Venerated Loxodon', setCode: 'grn', number: '30', quantity: 3 },
        { name: 'Novice Inspector', setCode: 'mkm', number: '29', quantity: 4 },
        { name: 'Thraben Inspector', setCode: 'soi', number: '44', quantity: 4 },
        { name: 'Witchstalker Frenzy', setCode: 'blb', number: '159', quantity: 2 },
      ],
    },
    {
      name: 'Golgari Yawgmoth',
      archetype: 'Yawgmoth',
      game: 'mtg',
      description: 'Combo deck based on Yawgmoth + undying creatures. Draw the whole deck and win.',
      cards: [
        { name: 'Yawgmoth, Thran Physician', setCode: 'mh1', number: '116', quantity: 4 },
        { name: 'Young Wolf', setCode: 'dka', number: '143', quantity: 4 },
        { name: 'Strangleroot Geist', setCode: 'dka', number: '164', quantity: 4 },
        { name: 'Zulaport Cutthroat', setCode: 'bfz', number: '130', quantity: 3 },
        { name: 'Chord of Calling', setCode: 'mh1', number: '156', quantity: 4 },
      ],
    },
    {
      name: 'Jeskai Control',
      archetype: 'Jeskai Control',
      game: 'mtg',
      description: 'Three-color control. Card draw, counters, removal, and powerful planeswalker finishers.',
      cards: [
        { name: 'Teferi, Hero of Dominaria', setCode: 'dom', number: '207', quantity: 3 },
        { name: 'Memory Deluge', setCode: 'mid', number: '62', quantity: 3 },
        { name: 'Settle the Wreckage', setCode: 'xln', number: '35', quantity: 2 },
        { name: 'Supreme Verdict', setCode: 'rtr', number: '199', quantity: 3 },
        { name: 'Lightning Helix', setCode: 'exp', number: '21', quantity: 4 },
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
        { name: 'One Jump Ahead', setCode: '1', number: '153', quantity: 4 },
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
    {
      name: 'Ruby Amethyst (Bounce)',
      archetype: 'Bounce',
      game: 'lorcana',
      description: 'Bounce enemy threats back to hand with Ursula and Madam Mim. Tempo advantage.',
      cards: [
        { name: 'Ursula — Deceiver', setCode: '4', number: '114', quantity: 3 },
        { name: 'Madam Mim — Fox', setCode: '2', number: '58', quantity: 4 },
        { name: 'Merlin — Goat', setCode: '2', number: '63', quantity: 3 },
        { name: 'Friends on the Other Side', setCode: '1', number: '148', quantity: 4 },
        { name: 'Dragon Fire', setCode: '1', number: '128', quantity: 3 },
      ],
    },
    {
      name: 'Amber Steel (Songs)',
      archetype: 'Songs',
      game: 'lorcana',
      description: 'Overwhelm with songs. Sing big threats early and control the board with strength.',
      cards: [
        { name: 'Cinderella — Stouthearted', setCode: '3', number: '1', quantity: 4 },
        { name: 'A Whole New World', setCode: '2', number: '156', quantity: 3 },
        { name: 'Grab Your Sword', setCode: '3', number: '152', quantity: 3 },
        { name: 'Robin Hood — Champion', setCode: '3', number: '37', quantity: 4 },
        { name: 'Let It Go', setCode: '2', number: '146', quantity: 4 },
      ],
    },
    {
      name: 'Emerald Steel (Discard)',
      archetype: 'Discard',
      game: 'lorcana',
      description: 'Force opponents to discard while building your own board. Value engine.',
      cards: [
        { name: 'Cogsworth — Grandfather Clock', setCode: '3', number: '178', quantity: 3 },
        { name: 'Chernabog — Evildoer', setCode: '4', number: '185', quantity: 3 },
        { name: 'Prince John — Philanderer', setCode: '2', number: '87', quantity: 4 },
        { name: 'Sudden Chill', setCode: '3', number: '156', quantity: 4 },
        { name: 'Grab Your Sword', setCode: '3', number: '152', quantity: 3 },
      ],
    },
    {
      name: 'Sapphire Steel (Ramp)',
      archetype: 'Sapphire Steel',
      game: 'lorcana',
      description: 'Ramp with Sapphire, control with Steel. Big threats and efficient removal.',
      cards: [
        { name: 'How Far Ill Go', setCode: '1', number: '156', quantity: 4 },
        { name: 'One Jump Ahead', setCode: '1', number: '153', quantity: 4 },
        { name: 'Grab Your Sword', setCode: '3', number: '152', quantity: 3 },
        { name: 'Let It Go', setCode: '2', number: '146', quantity: 3 },
        { name: 'Tiana — Restaurateur', setCode: '3', number: '141', quantity: 3 },
      ],
    },
    {
      name: 'Amethyst Aggro',
      archetype: 'Amethyst Aggro',
      game: 'lorcana',
      description: 'Low-curve aggressive deck. Flood the board with cheap Amethyst creatures.',
      cards: [
        { name: 'Merlin — Rabbit', setCode: '2', number: '59', quantity: 4 },
        { name: 'Merlin — Squirrel', setCode: '2', number: '60', quantity: 4 },
        { name: 'Madam Mim — Fox', setCode: '2', number: '58', quantity: 4 },
        { name: 'Dr. Facilier — Agent', setCode: '4', number: '92', quantity: 3 },
        { name: 'Friends on the Other Side', setCode: '1', number: '148', quantity: 4 },
      ],
    },
    {
      name: 'Amber Amethyst (Hyper Aggro)',
      archetype: 'Hyper Aggro',
      game: 'lorcana',
      description: 'Hyper-aggressive hybrid. Play cheap threats and refill with card draw.',
      cards: [
        { name: 'Lilo — Escape Artist', setCode: '2', number: '1', quantity: 4 },
        { name: 'Winnie the Pooh — Bear', setCode: '3', number: '12', quantity: 4 },
        { name: 'Merlin — Rabbit', setCode: '2', number: '59', quantity: 4 },
        { name: 'Friends on the Other Side', setCode: '1', number: '148', quantity: 3 },
        { name: 'One Jump Ahead', setCode: '1', number: '153', quantity: 3 },
      ],
    },
    {
      name: 'Ruby Sapphire (Control)',
      archetype: 'Ruby Sapphire',
      game: 'lorcana',
      description: 'Greedy control. Ramp, remove, and win with big finishers like Tamatoa.',
      cards: [
        { name: 'Tamatoa — So Shiny', setCode: '4', number: '170', quantity: 3 },
        { name: 'Be Prepared', setCode: '1', number: '122', quantity: 3 },
        { name: 'How Far Ill Go', setCode: '1', number: '156', quantity: 4 },
        { name: 'Dragon Fire', setCode: '1', number: '128', quantity: 4 },
        { name: 'One Jump Ahead', setCode: '1', number: '153', quantity: 4 },
      ],
    },
    {
      name: 'Amethyst Steel (Midrange)',
      archetype: 'Amethyst Steel',
      game: 'lorcana',
      description: 'Versatile midrange. Steel removal with Amethyst card draw and threats.',
      cards: [
        { name: 'Elsa — Snow Queen', setCode: '1', number: '46', quantity: 3 },
        { name: 'Grab Your Sword', setCode: '3', number: '152', quantity: 4 },
        { name: 'Let It Go', setCode: '2', number: '146', quantity: 3 },
        { name: 'Friends on the Other Side', setCode: '1', number: '148', quantity: 4 },
        { name: 'Merlin — Goat', setCode: '2', number: '63', quantity: 3 },
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
        { name: 'Gear 5 Luffy', setCode: 'OP08', number: '119', quantity: 4 },
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
    {
      name: 'Blue Nami',
      archetype: 'Nami',
      game: 'one-piece',
      description: 'Mill your own deck and win with Nami leader ability. Draw and control.',
      cards: [
        { name: 'Nami', setCode: 'OP01', number: '001', quantity: 1 },
        { name: 'Shirahoshi', setCode: 'OP02', number: '030', quantity: 4 },
        { name: 'Hatchan', setCode: 'OP01', number: '038', quantity: 4 },
        { name: 'Krieg', setCode: 'OP01', number: '037', quantity: 4 },
        { name: 'Gum Gum Rain', setCode: 'OP01', number: '039', quantity: 4 },
      ],
    },
    {
      name: 'Yellow Enel',
      archetype: 'Enel',
      game: 'one-piece',
      description: 'Life manipulation with Enel\'s leader ability. Trigger-based control deck.',
      cards: [
        { name: 'Enel', setCode: 'OP02', number: '001', quantity: 1 },
        { name: 'Yamato', setCode: 'OP02', number: '065', quantity: 4 },
        { name: 'O-Nami', setCode: 'OP02', number: '066', quantity: 4 },
        { name: 'Thunderbolt', setCode: 'OP02', number: '068', quantity: 4 },
        { name: 'Kuzan', setCode: 'OP03', number: '116', quantity: 3 },
      ],
    },
    {
      name: 'Green Doflamingo',
      archetype: 'Doflamingo',
      game: 'one-piece',
      description: 'Control the field with Don!! management. Reuse Don!! for powerful effects.',
      cards: [
        { name: 'Doflamingo', setCode: 'OP01', number: '001', quantity: 1 },
        { name: 'Bellamy', setCode: 'OP01', number: '067', quantity: 4 },
        { name: 'Gladius', setCode: 'OP01', number: '068', quantity: 4 },
        { name: 'Hina', setCode: 'OP01', number: '069', quantity: 4 },
        { name: 'Gum Gum Jet Pistol', setCode: 'OP01', number: '072', quantity: 3 },
      ],
    },
    {
      name: 'Red Zoro',
      archetype: 'Zoro',
      game: 'one-piece',
      description: 'Aggressive red aggro. Swarm with low-cost units and pump with leader ability.',
      cards: [
        { name: 'Roronoa Zoro', setCode: 'OP01', number: '002', quantity: 1 },
        { name: 'Nami', setCode: 'OP01', number: '003', quantity: 4 },
        { name: 'Sanji', setCode: 'OP01', number: '004', quantity: 4 },
        { name: 'Tony Tony Chopper', setCode: 'OP01', number: '005', quantity: 4 },
        { name: 'Gum Gum Jet Pistol', setCode: 'OP01', number: '039', quantity: 4 },
      ],
    },
    {
      name: 'Purple Queen',
      archetype: 'Queen',
      game: 'one-piece',
      description: 'Don!! ramp with purple. Play expensive threats ahead of curve with Leader Queen.',
      cards: [
        { name: 'Queen', setCode: 'OP04', number: '001', quantity: 1 },
        { name: 'Kaido', setCode: 'OP04', number: '024', quantity: 4 },
        { name: 'King', setCode: 'OP04', number: '025', quantity: 4 },
        { name: 'Black Maria', setCode: 'OP04', number: '026', quantity: 4 },
        { name: 'Gum Gum Giant', setCode: 'OP03', number: '009', quantity: 4 },
      ],
    },
    {
      name: 'Blue Kaido',
      archetype: 'Kaido',
      game: 'one-piece',
      description: 'Animal Kingdom Pirates. Blue control with powerful top-end threats.',
      cards: [
        { name: 'Kaido', setCode: 'OP04', number: '004', quantity: 1 },
        { name: 'King', setCode: 'OP04', number: '031', quantity: 4 },
        { name: 'Queen', setCode: 'OP04', number: '032', quantity: 4 },
        { name: 'Jack', setCode: 'OP04', number: '033', quantity: 4 },
        { name: 'Who\'s Who', setCode: 'OP04', number: '034', quantity: 4 },
      ],
    },
    {
      name: 'Red Whitebeard',
      archetype: 'Whitebeard',
      game: 'one-piece',
      description: 'Powerful red aggro. Whitebeard Pirates synergy with big bodies and removal.',
      cards: [
        { name: 'Whitebeard', setCode: 'OP02', number: '001', quantity: 1 },
        { name: 'Marco', setCode: 'OP02', number: '007', quantity: 4 },
        { name: 'Jozu', setCode: 'OP02', number: '008', quantity: 4 },
        { name: 'Ace', setCode: 'OP02', number: '009', quantity: 4 },
        { name: 'Gum Gum Red Roc', setCode: 'OP02', number: '013', quantity: 3 },
      ],
    },
    {
      name: 'Green Law',
      archetype: 'Law',
      game: 'one-piece',
      description: 'Restart with Leader Law. 7-cost Law as finisher. Supernova synergy.',
      cards: [
        { name: 'Trafalgar Law', setCode: 'OP01', number: '003', quantity: 1 },
        { name: 'Trafalgar Law', setCode: 'OP07', number: '049', quantity: 4 },
        { name: 'Eustass Captain Kid', setCode: 'OP01', number: '069', quantity: 4 },
        { name: 'Killer', setCode: 'OP01', number: '070', quantity: 4 },
        { name: 'Hawkins', setCode: 'OP01', number: '071', quantity: 3 },
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
    {
      name: 'Mono Nature (Ramp)',
      archetype: 'Nature',
      game: 'riftbound',
      description: 'Ramp with nature spirits and play over-statted threats. Board control with heals.',
      cards: [
        { name: 'Druid of the Grove', setCode: 'core', number: '003', quantity: 4 },
        { name: 'Nature\'s Blessing', setCode: 'core', number: '050', quantity: 4 },
        { name: 'Ancient Treant', setCode: 'core', number: '051', quantity: 3 },
        { name: 'Vine Lash', setCode: 'core', number: '052', quantity: 4 },
        { name: 'Forest Spirit', setCode: 'core', number: '053', quantity: 2 },
      ],
    },
    {
      name: 'Mono Fire (Aggro)',
      archetype: 'Fire',
      game: 'riftbound',
      description: 'Fast aggro with direct damage. Burn the opponent down before they can stabilize.',
      cards: [
        { name: 'Fire Elemental', setCode: 'core', number: '004', quantity: 4 },
        { name: 'Flame Strike', setCode: 'core', number: '054', quantity: 4 },
        { name: 'Inferno Hound', setCode: 'core', number: '055', quantity: 4 },
        { name: 'Burning Wrath', setCode: 'core', number: '056', quantity: 4 },
        { name: 'Phoenix Reborn', setCode: 'core', number: '057', quantity: 2 },
      ],
    },
    {
      name: 'Mono Water (Control)',
      archetype: 'Water',
      game: 'riftbound',
      description: 'Control with Water magic. Bounce, freeze, and card draw advantage engine.',
      cards: [
        { name: 'Water Spirit', setCode: 'core', number: '005', quantity: 4 },
        { name: 'Tidal Wave', setCode: 'core', number: '058', quantity: 4 },
        { name: 'Ice Barrier', setCode: 'core', number: '059', quantity: 3 },
        { name: 'Deep Sea Kraken', setCode: 'core', number: '060', quantity: 2 },
        { name: 'Healing Rain', setCode: 'core', number: '061', quantity: 3 },
      ],
    },
    {
      name: 'Mono Death (Reanimator)',
      archetype: 'Death',
      game: 'riftbound',
      description: 'Reanimate threats from the graveyard. Sacrifice and recursion value engine.',
      cards: [
        { name: 'Necromancer Acolyte', setCode: 'core', number: '006', quantity: 4 },
        { name: 'Raise Dead', setCode: 'core', number: '062', quantity: 4 },
        { name: 'Bone Dragon', setCode: 'core', number: '063', quantity: 3 },
        { name: 'Death Grasp', setCode: 'core', number: '064', quantity: 4 },
        { name: 'Lich King', setCode: 'core', number: '065', quantity: 2 },
      ],
    },
    {
      name: 'Mono Light (Midrange)',
      archetype: 'Light',
      game: 'riftbound',
      description: 'Holy magic midrange. Board buffs, heals, and versatile removal.',
      cards: [
        { name: 'Priest of Light', setCode: 'core', number: '007', quantity: 4 },
        { name: 'Holy Smite', setCode: 'core', number: '066', quantity: 4 },
        { name: 'Guardian Angel', setCode: 'core', number: '067', quantity: 3 },
        { name: 'Divine Shield', setCode: 'core', number: '068', quantity: 3 },
        { name: 'Archangel', setCode: 'core', number: '069', quantity: 2 },
      ],
    },
    {
      name: 'Time/Void (Tempo)',
      archetype: 'Time/Void',
      game: 'riftbound',
      description: 'Dual-element tempo. Time manipulation with Void removal. Flexible answers.',
      cards: [
        { name: 'Chronomancer Initiate', setCode: 'core', number: '001', quantity: 4 },
        { name: 'Void Cultist', setCode: 'core', number: '002', quantity: 3 },
        { name: 'Void Pulse', setCode: 'core', number: '047', quantity: 3 },
        { name: 'Chrono Surge', setCode: 'core', number: '044', quantity: 4 },
        { name: 'Temporal Guardian', setCode: 'core', number: '043', quantity: 3 },
      ],
    },
    {
      name: 'Nature/Fire (Midrange)',
      archetype: 'Nature/Fire',
      game: 'riftbound',
      description: 'Flexible midrange. Nature ramp into Fire finishers. Board presence and burn.',
      cards: [
        { name: 'Druid of the Grove', setCode: 'core', number: '003', quantity: 4 },
        { name: 'Fire Elemental', setCode: 'core', number: '004', quantity: 4 },
        { name: 'Nature\'s Blessing', setCode: 'core', number: '050', quantity: 3 },
        { name: 'Flame Strike', setCode: 'core', number: '054', quantity: 3 },
        { name: 'Ancient Treant', setCode: 'core', number: '051', quantity: 2 },
      ],
    },
    {
      name: 'Water/Death (Control)',
      archetype: 'Water/Death',
      game: 'riftbound',
      description: 'Grindy control. Water card advantage plus Death recursion. Out-value opponents.',
      cards: [
        { name: 'Water Spirit', setCode: 'core', number: '005', quantity: 4 },
        { name: 'Necromancer Acolyte', setCode: 'core', number: '006', quantity: 3 },
        { name: 'Tidal Wave', setCode: 'core', number: '058', quantity: 3 },
        { name: 'Raise Dead', setCode: 'core', number: '062', quantity: 3 },
        { name: 'Deep Sea Kraken', setCode: 'core', number: '060', quantity: 2 },
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
        { name: 'Tenpai Dragon Paidra', setCode: 'SUDA', number: '015', quantity: 3 },
        { name: 'Sangen Summoning', setCode: 'SUDA', number: '057', quantity: 3 },
        { name: 'Trident Dragion', setCode: 'SD32', number: '042', quantity: 2 },
      ],
    },
    {
      name: 'Rescue-ACE',
      archetype: 'Rescue-ACE',
      game: 'yugioh',
      description: 'Fire warrior deck. Set up Hydrant and search your entire archetype. Control with quick effects.',
      cards: [
        { name: 'Rescue-ACE Hydrant', setCode: 'AGOV', number: '020', quantity: 3 },
        { name: 'Rescue-ACE Turbulence', setCode: 'AGOV', number: '019', quantity: 3 },
        { name: 'Rescue-ACE Fire Attacker', setCode: 'DUNE', number: '013', quantity: 3 },
        { name: 'Rescue-ACE Air Lifter', setCode: 'DUNE', number: '012', quantity: 2 },
        { name: 'Emergency!', setCode: 'AGOV', number: '022', quantity: 3 },
      ],
    },
    {
      name: 'Labrynth',
      archetype: 'Labrynth',
      game: 'yugioh',
      description: 'Trap control deck. Set powerful Normal Traps and recur them with Lovely Labrynth.',
      cards: [
        { name: 'Lovely Labrynth of the Silver Castle', setCode: 'DABL', number: '030', quantity: 2 },
        { name: 'Labrynth Chandraglier', setCode: 'DABL', number: '031', quantity: 3 },
        { name: 'Welcome Labrynth', setCode: 'DABL', number: '032', quantity: 3 },
        { name: 'Arias the Labrynth Butler', setCode: 'PHNI', number: '032', quantity: 2 },
        { name: 'Daruma Cannon', setCode: 'PHNI', number: '075', quantity: 3 },
      ],
    },
    {
      name: 'Branded Despia',
      archetype: 'Branded',
      game: 'yugioh',
      description: 'Fusion summoning deck. Branded Fusion into Mirrorjade locks opponents out of extra deck.',
      cards: [
        { name: 'Fallen of Albaz', setCode: 'BODE', number: '023', quantity: 3 },
        { name: 'Branded Fusion', setCode: 'BODE', number: '042', quantity: 3 },
        { name: 'Mirrorjade the Iceblade Dragon', setCode: 'BODE', number: '025', quantity: 2 },
        { name: 'Branded Lost', setCode: 'BODE', number: '043', quantity: 2 },
        { name: 'Albion the Branded Dragon', setCode: 'BODE', number: '024', quantity: 2 },
      ],
    },
    {
      name: 'Voiceless Voice',
      archetype: 'Voiceless Voice',
      game: 'yugioh',
      description: 'Ritual control deck. Protect your monsters with Skull Guardian and Lo\'s prayers.',
      cards: [
        { name: 'Skull Guardian', setCode: 'PHNI', number: '004', quantity: 2 },
        { name: 'Saora the Voiceless Voice', setCode: 'PHNI', number: '003', quantity: 3 },
        { name: 'Lo\'s Prayer', setCode: 'PHNI', number: '005', quantity: 3 },
        { name: 'Voice of the Voiceless', setCode: 'PHNI', number: '006', quantity: 2 },
        { name: 'Pre-Preparation of Rites', setCode: 'SR08', number: '029', quantity: 3 },
      ],
    },
    {
      name: 'Runic Stun',
      archetype: 'Runick',
      game: 'yugioh',
      description: 'Quick-play spell control. Banish opponents\' cards while protecting your own board.',
      cards: [
        { name: 'Runick Tip', setCode: 'MZTM', number: '023', quantity: 3 },
        { name: 'Runick Dispelling', setCode: 'MZTM', number: '022', quantity: 3 },
        { name: 'Runick Flashing Fire', setCode: 'MZTM', number: '024', quantity: 3 },
        { name: 'Hugin the Runick Wings', setCode: 'MZTM', number: '020', quantity: 2 },
        { name: 'Geril the Runick Eyes', setCode: 'MZTM', number: '021', quantity: 2 },
      ],
    },
    {
      name: 'Swordsoul Tenyi',
      archetype: 'Swordsoul',
      game: 'yugioh',
      description: 'Synchro summoning deck. Swordsoul tokens enable powerful Wyrm Synchro plays.',
      cards: [
        { name: 'Swordsoul of Mo Ye', setCode: 'BODE', number: '001', quantity: 3 },
        { name: 'Swordsoul of Taia', setCode: 'BODE', number: '002', quantity: 2 },
        { name: 'Swordsoul Emergence', setCode: 'BODE', number: '014', quantity: 3 },
        { name: 'Baronne de Fleur', setCode: 'MP22', number: '025', quantity: 2 },
        { name: 'Archnemeses Protos', setCode: 'LIOV', number: '026', quantity: 1 },
      ],
    },
    {
      name: 'Mannadium',
      archetype: 'Mannadium',
      game: 'yugioh',
      description: 'Synchro combo deck. Create a board of negates using Mannadium tuners and Scareclaw links.',
      cards: [
        { name: 'Mannadium Meek', setCode: 'CYAC', number: '015', quantity: 3 },
        { name: 'Mannadium Fearless', setCode: 'PHHY', number: '012', quantity: 3 },
        { name: 'Mannadium Reframing', setCode: 'PHHY', number: '013', quantity: 2 },
        { name: 'Cairngorgon, Antiluminescent Knight', setCode: 'PHHY', number: '021', quantity: 2 },
        { name: 'Scareclaw Reichheart', setCode: 'DABL', number: '009', quantity: 3 },
      ],
    },
    {
      name: 'Purrely',
      archetype: 'Purrely',
      game: 'yugioh',
      description: 'Xyz beatdown. Small cats grow into giant monsters with quick-play spell memories.',
      cards: [
        { name: 'Purrely', setCode: 'AMDE', number: '001', quantity: 3 },
        { name: 'Purrely Pretty Memory', setCode: 'AMDE', number: '002', quantity: 3 },
        { name: 'Purrely Sleepy Memory', setCode: 'AMDE', number: '003', quantity: 3 },
        { name: 'Purrelyeap!?', setCode: 'AMDE', number: '004', quantity: 2 },
        { name: 'Expurrely Happiness', setCode: 'AMDE', number: '006', quantity: 2 },
      ],
    },
  ],
}

function getFallbackDecks(game) {
  return FALLBACK_DECKS[game] || FALLBACK_DECKS.pokemon
}

export const fallbackMetaDecks = FALLBACK_DECKS.pokemon
