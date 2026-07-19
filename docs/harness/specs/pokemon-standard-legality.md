# Feature Spec: Pokémon Standard Legality (Deck Builder)

## Goal

Ship a **first-phase, deck-builder-only** Pokémon **Standard card-eligibility advisory**: given a deck’s cards, show legal / illegal / **unknown** using **versioned, dated, offline** legality data (regulation marks, explicit exceptions/bans), with clear stale/source copy — without runtime scraping and without global collection badges.

User-facing outcome: in the Pokémon deck builder, the collector sees **per-card Standard eligibility** under the bundled ruleset date (mark / ban / exception), plus when data is missing or stale. The UI must **not** claim the whole deck is tournament-legal.

## Non-goals

- Other games’ formats (MTG, Lorcana, etc.) in this phase.
- Global shelf/collection “Standard legal” badges on Portfolio/Search/Browse.
- Expanded, Unlimited, GLC, or multi-format toggles beyond a single Standard ruleset (unless trivially stubbed off).
- Runtime scraping of Limitless, Pokémon.com, or other sites for live banlists.
- Auto-fixing illegal decks or blocking export.
- **Complete tournament deck validation** (v1 is **card eligibility advisory only**).
- **Deck construction rules as v1 goals:** 60-card deck size, 4-copy limits, ACE SPEC limits, Radiant Pokémon limits, Basic Energy exceptions, prize-card rules, or “this list is tournament-legal” certification — **explicit follow-up / non-goals**.
- Guaranteeing tournament compliance as legal advice (copy must stay informational).
- Changing meta-deck generation pipelines except where offline data is produced offline in CI/scripts.
- Japanese-only regulation systems as a separate product track in phase 1 (document if data lacks JP marks).
- **v1 requirement to widen live pokemontcg.io `select=` lists** for `regulationMark` (optional later; offline map is the v1 path).

## Verified current facts (live code)

| Fact | Evidence |
|------|----------|
| Deck builder route `/decks/:id` → `DeckBuilderView.vue` | `src/router/index.js` |
| Decks Pinia store; persistence `localStorage` key `rarebox_decks` | `src/stores/decks.js` |
| Deck card rows: `cardId`, `name`, `setName`, `setCode`, `number`, `quantity`, `price`, `image`, `game` | `addCardToDeck` / `addCardRaw` |
| Ownership stats vs shelves via `cardId` counts | `getDeckStats` |
| **No** legality, regulation mark, banlist, or Standard check in app code | repo search (no `regulationMark` / legality modules) |
| Meta decks labeled “Standard format” in static data only — not enforced | `src/data/metaDecks.js` header comment |
| EN Pokémon API selects often omit regulation fields: `select=id,name,number,set,supertype,rarity,tcgplayer,images` | `pokemonApi.js`, `multiSearch.js`, `cardPreloader.js`, `searchIntel.js` |
| Normalized multi-TCG search shape: `{ id, name, number, set, image, price, rarity, game }` — **no regulationMark** | AGENTS.md + preloader maps |
| JP cards set `_lang: 'ja'` in pokemon/JP paths | `pokemonApi.js` / `masterSets.js` |
| Backup includes decks from `rarebox_decks` | `backup.js` |
| Price/meta assets are often **prebuilt static** files (pattern to mirror for legality) | e.g. en prices, meta decks build scripts |
| Deck not-found empty state already exists | `DeckBuilderView.vue` |

### Normalization impact (v1 decision)

**Verified gap:** live fetches and cache normalizers do not request or retain `regulationMark`.

**v1 decision (pinned):** ship an offline map **`cardId → regulationMark`** (plus ban/exception lists) inside the versioned legality pack so **existing deck rows resolve without widening runtime API selects**. Live `select=` expansion and storing marks on deck cards become **optional later** phases, not v1 blockers.

Implications:

- `cardPreloader` / `multiSearch` select lists: **unchanged in v1**
- Existing decks in `rarebox_decks` without stored marks: resolve via offline map by `cardId` (or fallback identity); else **unknown**
- Backup size: no required per-card mark fields in v1

Do **not** assume docs alone; probe one live card payload and one cached card during implementation if a later phase widens selects.

## Planned behavior

### Scope: deck-builder-only, Pokémon Standard, card eligibility advisory

- When `deck.game === 'pokemon'`, show a Standard **card eligibility** summary in the builder (pill/banner + optional per-card indicators).
- Summary language must describe **card eligibility under bundled Standard mark/ban/exception data**, not “this deck is tournament-legal.”
- Other games: no legality UI in this phase.
- Shelf views: no badges.
- Quantity on a row may be displayed but **v1 does not enforce** copy-count, ACE SPEC, Radiant, or deck-size rules.

### Versioned dated offline data — frozen v1 schema

Bundle a static artifact (e.g. `public/data/pokemon-standard-legality.json` or under `src/data/`) produced by a **build script**, not scraped at runtime in the browser.

#### Root object (required fields)

| Field | Type | Notes |
|-------|------|--------|
| `format` | `string` | Exactly `"standard"` |
| `version` | `string` | Semver or monotonic id (e.g. `"2026.07.01"` or `"1.0.0"`) |
| `asOf` | `string` | ISO date `YYYY-MM-DD` (ruleset effective / publish date for UI) |
| `source` | `string` | Short human-readable attribution |
| `staleAfterDays` | `number` | **Exactly `60`** for v1 consumers (app may hardcode 60; field documents intent) |
| `regulationMarksAllowed` | `string[]` | Marks legal in Standard (e.g. `["F","G","H"]` — illustrative only) |
| `marksByCardId` | `Record<string, string>` | **Primary v1 resolution map:** canonical pokemontcg **card id** → single regulation mark character/string |
| `bans` | `BanExceptionEntry[]` | Explicitly illegal identities |
| `exceptions` | `BanExceptionEntry[]` | Legal despite mark rules (or other mark exceptions); v1 does not encode quantity exceptions as deck-construction enforcement |
| `notes` | `string` (optional) | UI “What’s in this ruleset?” |

#### Ban / exception entry identity (pinned)

```ts
// BanExceptionEntry
{
  // Preferred: canonical pokemontcg.io card id
  cardId?: string,           // e.g. "sv3pt5-199"

  // Fallback when cardId missing or deck row lacks cardId:
  setId?: string,            // pokemontcg set id, e.g. "sv3pt5"
  number?: string,           // normalized collector number (see below)

  name?: string,             // optional display / secondary disambiguation only
  reason?: string            // short UI reason
}
```

**Identity match order (pinned):**

1. **Primary:** exact `cardId` (canonical pokemontcg card id) against deck row `cardId`.
2. **Fallback (only when step 1 does not hit):** compare bundle entry `setId` to deck row **`setCode`**, then compare **normalized collector number** (bundle `number` vs deck row `number`).
3. Else no ban/exception hit for that entry.

**Normalized number (pinned):** trim; uppercase; strip leading zeros from the numeric run where safe for collector numbers (document helper in evaluator); compare case-insensitively. Prefer storing already-normalized numbers in the bundle.

**Canonical card id format:** pokemontcg.io style `{setId}-{number}` as returned by the API (e.g. `sv4-12`). Do not invent a parallel id scheme in v1.

**Bans vs exceptions (pinned):** **bans win over exceptions.** If the same card identity matches both a `bans` entry and an `exceptions` entry, classify **illegal**. Bundle producer (build script) **and** harness eval **must reject** (fail) packs that list the **same identity** in both `bans` and `exceptions` when that identity is detectable (same `cardId`, or same `setId` + normalized `number`). Runtime still applies bans-win if a bad pack ever ships.

#### Fixture schema example

```json
{
  "format": "standard",
  "version": "1.0.0",
  "asOf": "2026-06-01",
  "source": "Bundled offline Standard pack (illustrative fixture)",
  "staleAfterDays": 60,
  "regulationMarksAllowed": ["G", "H", "I"],
  "marksByCardId": {
    "sv4-1": "H",
    "sv3pt5-199": "G",
    "swsh12-1": "F"
  },
  "bans": [
    {
      "cardId": "xyp-XY179",
      "reason": "Banned in Standard (fixture)"
    }
  ],
  "exceptions": [
    {
      "setId": "sv4",
      "number": "1",
      "reason": "Explicit exception example (fixture)"
    }
  ],
  "notes": "v1 advisory data: regulation marks, bans, exceptions only. Not full deck construction validation."
}
```

App loads JSON from same-origin static hosting (cacheable, offline once SW/cache allows — follow existing static data patterns). **No** runtime HTML scrape.

### Mark resolution strategy (pinned)

For each Pokémon deck card row, resolve regulation mark as follows:

1. Look up `marksByCardId[cardId]` when `cardId` present.
2. If no mark and ban/exception identity needs mark only via map miss → treat mark as missing.
3. **Do not** require live API `regulationMark` in v1.
4. **v1 does not** read live/cache `regulationMark` on the deck row. (A later phase may add that; out of scope for v1 acceptance.)

Then classify (**order pinned** — apply ban/exception before mark-only legal):

| State | Meaning (v1) |
|-------|----------------|
| **Illegal** | Identity matches **`bans`** (**bans win** even if also in `exceptions`); **or** mark present, **not** in `regulationMarksAllowed`, and **not** solely excepted |
| **Legal** | Not banned; and (mark present and ∈ `regulationMarksAllowed`, **or** identity matches **`exceptions`** for eligibility) |
| **Unknown** | Bundle loaded but no mark in offline map and no ban/exception identity hit that settles the card; **or** bundle **missing / failed to load** (see missing-bundle copy) |

Deck **summary rollup (advisory only):**

- If any card **illegal** → summary emphasizes illegal count.
- Else if any card **unknown** → summary emphasizes unknown count.
- Else all resolved cards **legal** under mark/ban/exception rules.

**Copy constraint:** never label the deck “tournament legal” / “event ready.” Prefer “All listed cards look Standard-eligible (marks/bans)” vs “N cards not eligible” vs “N cards unknown.”

### Stale / source / missing-bundle copy

- Always show **as-of date** (`asOf`) and **source** near the summary when a bundle is loaded (“Rules as of YYYY-MM-DD · bundled data, not live tournament feed”).
- **Stale definition (pinned, calendar days, UTC date-only):** parse `asOf` as a UTC calendar date (`YYYY-MM-DD`). Let `todayUtc` be the UTC calendar date at evaluation time. Let `ageDays` = whole calendar days from `asOf` to `todayUtc` (non-negative integer day difference on the UTC date grid).
  - `ageDays < 60` → **not stale** (e.g. **59** → not stale).
  - `ageDays >= 60` → **stale** (e.g. **60** → stale; 61+ → stale).
  - Equivalent: stale iff `todayUtc >= asOf + 60 calendar days` (UTC).
- **When stale (bundle present):** show **stale/warning** styling with Tactile tokens (not red panic hardcode); **still evaluate** with the loaded bundle rules; mark/ban/exception results stand; disclaimer that data may be outdated.
- **When bundle missing or failed to load (pinned):** do **not** claim to run “last-known” or any nonexistent prior ruleset. Show **error/unknown** state: **every card is unknown**, plus a clear error line that legality data could not load. No fabricated eligibility.
- Informational disclaimer: not official ruling advice; not full deck-construction validation.

### UX constraints

- Tactile tokens only; ≥44px targets for any legality filter toggles; 280px wrap.
- Do not block adding cards when illegal; legality is advisory.
- Prefer calm summary bar; one sticker max only if celebrating fully eligible cards — still without “tournament legal” wording.

## User-facing behavior

- **First render behavior:** Builder renders deck immediately; eligibility evaluates synchronously from bundled JSON + deck cards (or after tiny async import of JSON). Do not block on network card DB preload.
- **Offline / slow API behavior:** Eligibility works fully offline if bundle is present in the app build. Card search may still need network; legality does not.
- **Mobile behavior:** Summary bar stacks; per-card badges can hide detail text on narrow widths but keep color/dot + title tooltip/aria.
- **Empty/error states:** Empty deck → neutral “Add cards to check Standard eligibility”; failed/missing JSON → **unknown + error line only** (no last-known rules claim).

## Likely files / systems

- **Views/components:** `src/views/DeckBuilderView.vue`; optional `StandardLegalityBar.vue`.
- **Stores / IndexedDB:** `src/stores/decks.js` unchanged required shape in v1; no Dexie requirement (decks are localStorage). **No** component-direct storage writes beyond existing store `persist`.
- **Services / data:** new pure evaluator module; static JSON asset; offline builder script under `scripts/`.
- **Normalization touchpoints:** **v1 does not require** changes to `pokemonApi.js` / `multiSearch.js` / `cardPreloader.js` selects. Optional later phase only.
- **Routes / meta:** optional meta description tweak for Deck Builder only.
- **Harness evals / smoke tests:** new eval with fixture pack (legal / banned / unknown / stale boundary at 60 days); `npm run smoke:browser` if builder chrome changes.

### Integration symbols

- `useDeckStore`, `deck.cards`, `getDeckStats` (ownership separate from eligibility)
- `importMetaDeck` — imported meta decks should evaluate after resolve
- Backup `data.decks` round-trip remains compatible without new required fields

## Data and compatibility impact

- **Existing shelf data affected?** No (phase 1).
- **Backup/import affected?** No required deck field changes in v1.
- **Snapshot/history affected?** No.
- **Migration needed?** Soft defaults only; no wipe.

## API impact

- **Third-party APIs called:** None at evaluation time in v1.
- **Caching / TTL:** Static legality JSON = app-versioned; stale UI when **`ageDays >= 60`** from `asOf` (59 not stale, 60 stale).
- **Concurrency limits:** Unchanged search stack.
- **Timeout / retry behavior:** N/A for static JSON (build-time).
- **Fallback behavior:** Missing mark in offline map → **unknown**, never silent legal. Missing/failed bundle → unknown + error (no last-known rules).
- **Optional later:** extend pokemontcg.io select to include `regulationMark` with existing cache/concurrency/timeouts — not v1.

## Phased dependencies

1. **Phase 0 (this spec):** Frozen offline schema, identity rules, 60-day stale threshold, deck-only advisory UI, non-goals for construction rules.
2. **Phase 1a:** Bundle + pure evaluator + deck summary UI with source/as-of/stale copy + offline `marksByCardId`.
3. **Phase 1b (optional later):** Live select / cache normalization for `regulationMark`; optional persist on deck rows.
4. **Phase 2 (later specs):** Deck construction rules (size, copies, ACE SPEC, Radiant), Expanded formats, shelf badges, JP-specific rules, CI auto-refresh — **out of scope now**.

Independent of trade history, master-set compact, and shelf-link polish. May share “static dated asset” operational patterns with price/meta builders.

## Acceptance criteria

- [ ] Pokémon deck builder shows Standard **card-eligibility** summary using bundled versioned dated data.
- [ ] Per-card or summary breakdown distinguishes legal / illegal / unknown per v1 mark/ban/exception rules.
- [ ] Offline `marksByCardId` resolves existing deck rows without widening runtime API selects.
- [ ] Bans/exceptions match canonical `cardId` first; fallback compares bundle `setId` → deck row `setCode`, then normalized collector number.
- [ ] **Bans win over exceptions** on the same identity; build/eval should reject conflicting ban+exception identities when practical.
- [ ] Stale warning: **`ageDays >= 60`** from `asOf` is stale; **59 not stale, 60 stale**.
- [ ] Missing/failed bundle → unknown + error; **no** claim to run last-known/nonexistent rules.
- [ ] No runtime scraping for banlists/marks.
- [ ] Source + as-of (and stale warning when appropriate) visible in UI when bundle loaded.
- [ ] UI copy does **not** claim the whole deck is tournament-legal or fully construction-valid.
- [ ] Deck-size / copy-count / ACE SPEC / Radiant rules are **not** enforced or implied as complete in v1.
- [ ] Other games unchanged; no shelf-wide legality badges.
- [ ] Existing decks without marks do not crash; yield unknown where map misses.
- [ ] Backup/restore of decks remains compatible.
- [ ] Evaluation does not require card database preload to finish.
- [ ] Tactile tokens; 44px targets; 280px usable.
- [ ] Fixture/eval coverage includes schema example fields (`marksByCardId`, bans, exceptions, `asOf`, stale boundary).

## Verification plan

- [ ] `npm run eval:harness` (add legality fixture eval when implemented)
- [ ] `npm run eval:danger`
- [ ] `npm run build` (ensures static asset is included)
- [ ] `npm run smoke:browser` if deck builder chrome/routes touched
- [ ] Manual/browser steps:
  1. Open Pokémon deck → summary shows as-of/source; no “tournament legal” claim.
  2. Fixture banned `cardId` → illegal.
  3. Card with missing map entry → unknown.
  4. Fully mapped allowed marks, no bans → all cards eligible (advisory wording).
  5. Airplane mode with bundled app → still evaluates.
  6. MTG/other game deck → no Standard bar.
  7. Import old backup decks → no data loss; unknown OK.
  8. Bundle with `asOf` age **60** days → stale; **59** days → not stale; **61+** → stale.
  9. Missing/corrupt bundle → unknown + error; no last-known rules wording.
  10. Same identity in bans and exceptions (if fixture forces it) → illegal (bans win).
  11. Fallback identity: ban/exception with only `setId`+`number` matches deck row `setCode`+normalized `number`.
  12. 280px layout check.

## Risk

- **Wrong eligibility** harming tournament prep — mitigate with source/date/disclaimer, unknown default, and no full-deck “legal” claim.
- **Users mistaking advisory for full construction validation** — mitigate with explicit non-goal copy.
- **Stale bundled data** after rotation — mitigate 60-day banner + easy rebuild script.
- **Cache/select churn** if a later phase widens selects — keep offline map as default path.
- **Confusing ownership “Need” badges with eligibility badges** — distinct labels/colors via tokens.

## Rollback / safety notes

- Remove UI bar + import of evaluator; leave static JSON unused or delete asset.
- No required deck field migration to roll back.
- Revert optional select-list expansions independently if added later.
- No shelf data migration to roll back.
