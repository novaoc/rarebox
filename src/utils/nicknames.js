/**
 * Community card slang — the names collectors actually say out loud.
 *
 * "moonbreon" is not on any card, but everyone at a show knows it's the
 * Umbreon VMAX alt art from Evolving Skies. A nickname fires ONLY when it
 * equals the WHOLE query (after trimming) — "bolt" alone is Lightning
 * Bolt, but "thunderbolt pikachu" is left alone — and rewrites into a
 * canonical query that the normal search brain (set codes, collector
 * numbers, targeted lookups) resolves precisely.
 *
 * Curated, not crowdsourced: only slang with one unambiguous meaning.
 * label is what the understood-badge shows.
 */

const N = (q, label) => ({ q, label })

export const NICKNAMES = {
  // ── Pokémon ──
  'moonbreon': N('umbreon vmax swsh7 215', 'Umbreon VMAX (Evolving Skies #215)'),
  'zard': N('charizard', 'Charizard'),
  'base zard': N('charizard base1 4', 'Charizard (Base Set #4)'),
  'base set zard': N('charizard base1 4', 'Charizard (Base Set #4)'),
  'reshizard': N('reshiram charizard gx', 'Reshiram & Charizard-GX'),
  'pikarom': N('pikachu zekrom gx', 'Pikachu & Zekrom-GX'),
  'adp': N('arceus dialga palkia gx', 'Arceus & Dialga & Palkia-GX'),
  'van gogh pikachu': N('pikachu with grey felt hat', 'Pikachu with Grey Felt Hat (Van Gogh promo)'),
  'birthday pikachu': N('pikachu basep 24', "Birthday Pikachu (Black Star promo #24)"),
  'rayray': N('rayquaza', 'Rayquaza'),

  // ── Magic ──
  'bolt': N('lightning bolt', 'Lightning Bolt'),
  'goyf': N('tarmogoyf', 'Tarmogoyf'),
  'tarmo': N('tarmogoyf', 'Tarmogoyf'),
  'jtms': N('jace the mind sculptor', 'Jace, the Mind Sculptor'),
  'bob': N('dark confidant', 'Dark Confidant'),
  'snappy': N('snapcaster mage', 'Snapcaster Mage'),
  'fow': N('force of will', 'Force of Will'),
  'stp': N('swords to plowshares', 'Swords to Plowshares'),
  'lotus': N('black lotus', 'Black Lotus'),
  'bowmasters': N('orcish bowmasters', 'Orcish Bowmasters'),
  'k command': N('kolaghan command', "Kolaghan's Command"),
  'cryptic': N('cryptic command', 'Cryptic Command'),
  'wog': N('wrath of god', 'Wrath of God'),
  'mom': N('mother of runes', 'Mother of Runes'),
  'sad robot': N('solemn simulacrum', 'Solemn Simulacrum'),

  // ── Yu-Gi-Oh! ──
  'ash': N('ash blossom', 'Ash Blossom & Joyous Spring'),
  'imperm': N('infinite impermanence', 'Infinite Impermanence'),
  'droll': N('droll lock bird', 'Droll & Lock Bird'),
  'nib': N('nibiru', 'Nibiru, the Primal Being'),
  'dm': N('dark magician', 'Dark Magician'),
  'dmg': N('dark magician girl', 'Dark Magician Girl'),
  'bewd': N('blue-eyes white dragon', 'Blue-Eyes White Dragon'),
  'rebd': N('red-eyes black dragon', 'Red-Eyes Black Dragon'),
  'pot': N('pot of greed', 'Pot of Greed'),
  'called by': N('called by the grave', 'Called by the Grave'),

  // ── One Piece ──
  'nika': N('monkey d luffy op05 119', 'Monkey.D.Luffy "Nika" (OP05-119)'),
  'gear 5': N('monkey d luffy op05 119', 'Monkey.D.Luffy "Nika" (OP05-119)'),
  'gear five': N('monkey d luffy op05 119', 'Monkey.D.Luffy "Nika" (OP05-119)'),
  'whitebeard': N('edward newgate', 'Edward.Newgate (Whitebeard)'),
  'big mom': N('charlotte linlin', 'Charlotte Linlin (Big Mom)'),
}

/** Whole-query nickname lookup. Returns { q, label } or null. */
export function resolveNickname(raw) {
  const key = String(raw || '').trim().toLowerCase().replace(/\s+/g, ' ')
  return NICKNAMES[key] || null
}
