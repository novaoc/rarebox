# Feature Spec: Master Set Compact Mode

## Goal

Add an **optional compact mode** inside the existing Master Set showcase UI (`MasterSetStack` / `MasterSetGallery`) so collectors can scan large sets quickly on phones — without inventing a parallel ownership store, without naive `1..setSize` number grids, and without breaking hunt marks, wantlist ISO, add-found, EN/JP, or offline-cached set lists.

User-facing outcome: on a showcased master set, the user can toggle **Compact** and still see accurate owned / not-owned / found state for every **real card record** in the set.

## Non-goals

- Replacing binder-stack showcase with a different shelf model.
- A new Pinia store or Dexie table for master-set progress.
- Generating placeholder slots from `1..total` / `1..setSize` without card identities.
- Changing how shelf items are stored (items remain the source of ownership).
- Auto-completing sets or bulk-deleting duplicates.
- Desktop-only density controls that break 280px layouts.
- Non-master-set shelf table density (separate concern).
- **v1 persistence of the compact preference** (session-only in v1; persist is a later phase).

## Verified current facts (live code)

| Fact | Evidence |
|------|----------|
| Showcase metadata on each shelf: `portfolio.masterSets[key]` | `showcaseMasterSet` in `src/stores/portfolio.js` |
| Keys like `` `${game}:` + optional `ja:` + setId `` | `PortfolioView.vue` `msItemKey` / `msCanonicalKey`; JP qualified to avoid EN/JP id collisions |
| Grouping is **view-layer only**; unshowcase restores single rows | `portfolio.js` comments; items not deleted on showcase |
| Hunt marks: `masterSets[key].hunt = { [cardId]: timestamp }` | `toggleHuntMark` / `clearHuntMarks` |
| Stack UI: `MasterSetStack.vue` — progress, value, Show cards / Unstack | component props `group`, `open` |
| Gallery UI: `MasterSetGallery.vue` — full set fetch, filters, marks, ISO wantlist, add-found, lightbox | props `group`, `marks` |
| Full card list from `fetchSetCards` + `sortByNumber` | `src/utils/masterSets.js` |
| Pokémon EN pages until dry (pageSize 250); JP via `getJapaneseCardsBySet` | `masterSets.js` |
| Normalized card fields include `id`, `name`, `number`, `images`, `rarity`, `set`, `price`, `_lang`, `game` | `masterSets.js` map |
| **`$0` price stays 0** (numeric finite check, not `\|\|`) | `masterSets.js` |
| Ownership match: `cardId` set, else `name\|number`, else bare `name` | `MasterSetGallery.vue` `isOwned` |
| Alphanumeric / secret-style numbers sorted via parseInt digits + localeCompare fallback | `sortByNumber` |
| Gallery refuses empty `setId` (avoids wrong-set dump) | `MasterSetGallery.vue` onMounted |
| Offline: uses same cached layers as Browse; error copy if uncached offline | gallery catch + `masterSets.js` header comment |
| Wantlist ISO + add-found → `store.addItem` + `clearHuntMarks` | gallery + `PortfolioView.addFoundCards` |
| Completion denominator prefers fetched list length backfilled into `saved.total` | `msGalleryLoaded` |
| Yu-Gi-Oh API totals intentionally null (rarity printings); gallery backfills | `loadMsSetMeta` comment |
| No compact mode flag or density toggle exists today | component templates |

## Planned behavior

### Compact mode (optional, in-gallery)

- Toggle on `MasterSetGallery` header (and optionally reflect density on stack subtitle only if it does not clutter).
- **Default:** compact **off** (current comfortable grid) so existing muscle memory stays.
- **v1 preference scope (pinned):** **session-only** UI state, default off. Reload / new session returns to non-compact. **Do not** persist on `masterSets[key]` or settings in v1.
- **Later phase (separate):** optional persist of preference via store method — out of v1 acceptance.
- Compact layout still renders **one cell per canonical card record** from `fetchSetCards` / `cards[]`, never a synthetic index range.
- Compact cells must still encode: owned / need / found (marks), collector number, and enough affordance to tap (mark or preview).
- **Hit targets (required despite denser visuals):** compact **cells**, density **toggle**, **mark**, and **preview** actions must each expose a usable hit area of **≥44px** in at least one dimension pair (min height/width or padded hit-box). Visual density may shrink artwork/labels; interactive targets must not drop below 44px.
- **Do not** drop hunt, ISO wantlist, add-found footer, or lightbox; they may reflow but remain reachable with ≥44px controls.
- Variants / secret rares / TG-SV style numbers appear only if present in the fetched set list (source of truth = API/cache list).

### Ownership and identity (unchanged rules)

- Continue matching via existing `isOwned` logic (cardId → name|number → name).
- EN vs JP: keep `lang` / `_lang: 'ja'` and `ja:` key prefix; compact mode must not merge EN/JP sets.
- Multi-game: same gallery path via `getProvider(game).getSetCards` normalization in `fetchSetCards`.

### What compact must not do

- Naive `for (let i = 1; i <= setSize; i++)` grids.
- Parallel “progress only” store disconnected from shelf items.
- Hide missing cards that exist in the set list.
- Break 280px width (horizontal scroll forbidden).
- Hardcode hex colors; use `src/assets/main.css` tokens.
- Touch targets &lt; 44px for toggle, mark, preview, or compact cell activation.
- Persist compact preference in v1.

## User-facing behavior

- **First render behavior:** Stack and gallery behave as today; compact off until user toggles. Gallery still async-loads set list; progress header can show owned/total from existing group meta before load finishes. Session-only: compact resets on full reload.
- **Offline / slow API behavior:** Unchanged — cached set list works offline; clear error if not cached. Compact toggle does not trigger extra network.
- **Mobile behavior:** Primary motivation; 280px: compact grid may use smaller visual minmax but keep ≥44px hit areas for toggle / mark / preview / cell actions; filters and footer wrap.
- **Empty/error states:** Preserve current loading / error / no-setId messages; compact toggle disabled or hidden while loading if grid empty.

## Likely files / systems

- **Views/components:** `src/components/MasterSetGallery.vue` (primary), possibly `MasterSetStack.vue` (badge only), `src/views/PortfolioView.vue` (pass-through props if needed).
- **Stores / IndexedDB:** **none for v1 preference** (session-only). Later persist phase may use existing `showcaseMasterSet` / `persist` in `src/stores/portfolio.js`. **No** direct IndexedDB from components.
- **Services / APIs:** reuse `fetchSetCards` / `sortByNumber` in `src/utils/masterSets.js`; no new endpoints.
- **Routes / meta:** none.
- **Harness evals / smoke tests:** `scripts/test_master_sets.mjs` if present patterns fit; browser smoke if shelf UI flow changes; manual gallery checks for EN/JP/secret numbers and 44px targets.

### Integration symbols

- `isOwned`, `visibleCards`, `marks`, `toggle-mark`, `add-found`, `isoTheRest`
- `msCanonicalKey`, `masterSetGroups`, `addFoundCards`, `msGalleryLoaded`
- `fetchSetCards`, `sortByNumber`
- `toggleHuntMark`, `clearHuntMarks`, `addItem`

## Data and compatibility impact

- **Existing shelf data affected?** No item schema change. **v1 writes no new fields.**
- **Backup/import affected?** No in v1 (session-only).
- **Snapshot/history affected?** No (shelf value snapshots unrelated).
- **Migration needed?** No.

## API impact

- **Third-party APIs called:** None new; same set-card fetches as gallery open today.
- **Caching / TTL:** Existing Browse/pokemon/provider caches.
- **Concurrency limits:** Unchanged pagination in `fetchSetCards`.
- **Timeout / retry behavior:** Unchanged gallery error handling.
- **Fallback behavior:** Offline message unchanged.

## Phased dependencies

1. **Phase A (v1):** Compact CSS/layout + toggle in `MasterSetGallery`; **session-only**, default off; ≥44px hit areas; preserve all actions.
2. **Phase B (later, separate):** Persist preference on showcase meta via store method (no component IDB writes) — **not** part of v1 acceptance.
3. **Phase C:** Hardening — 280px QA, reduced-motion, focus-visible on toggle.

Independent of trade history and shelf-link polish. Benefits from existing master-set key migration already in `PortfolioView`.

## Acceptance criteria

- [ ] Optional compact mode available inside master set gallery (**default off**).
- [ ] **v1 preference is session-only** (reload returns to non-compact); no persisted compact flag required.
- [ ] Compact mode lists **canonical fetched cards only** — no `1..setSize` placeholders.
- [ ] Owned matching still uses cardId / name|number / name; no parallel ownership store.
- [ ] EN and JP sets remain distinct; JP `_lang` / key prefix preserved.
- [ ] Alphanumeric, secret, and variant numbers that appear in the set list remain visible and sortable as today.
- [ ] Hunt marks, ISO wantlist, add-found, and preview/lightbox still work in compact mode.
- [ ] **Compact cells, toggle, mark, and preview actions each provide ≥44px hit areas** despite denser visuals.
- [ ] Offline cached set lists still open; uncached offline still errors clearly.
- [ ] No direct Dexie/component writes for this feature in v1.
- [ ] Tactile tokens only; usable at 280px without horizontal scroll.
- [ ] Unshowcase / completion / stack progress behavior unchanged.
- [ ] Existing shelf items and backups remain valid with no new required fields.

## Verification plan

- [ ] `npm run eval:harness`
- [ ] `npm run eval:danger`
- [ ] `npm run build`
- [ ] `npm run smoke:browser` if shelf UI flow/layout materially changes
- [ ] Manual/browser steps:
  1. Showcase an EN Pokémon set with secrets/TG-style numbers; open gallery; toggle compact; counts match non-compact.
  2. JP set: owned marks correct; no EN bleed.
  3. Mark found → add to shelf → marks clear; items appear; compact still consistent.
  4. ISO the rest → wantlist entries created.
  5. Go offline after one successful load → reopen gallery (cached).
  6. 280px width: toggle + grid usable; no horizontal page scroll; measure ≥44px on toggle/mark/preview/cell hit areas.
  7. Reload: compact resets to off (session-only).

## Risk

- Over-dense cells becoming untappable on small phones — mitigate with mandatory ≥44px hit boxes.
- CSS regressions on complete-set gold treatment / filters.
- Accidentally persisting compact in v1 without store `persist` — out of scope; keep session-only.
- Mistaken “fake grid” shortcuts for sets with null totals (YGO/Lorcast) — must always wait for fetched list.

## Rollback / safety notes

- Remove toggle + compact CSS classes; no data flag to clean in v1.
- No Dexie schema rollback required.
- Safest ship: session-only compact first (this spec); persist later under a separate phase.
