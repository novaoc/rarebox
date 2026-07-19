# Feature Spec: Shelf Link Polish

## Goal

Polish **same-device shelf links** for the existing shelf routes so collectors can copy a link to a shelf, open `/shelf/:id` or `/portfolio/:id` predictably, and see a clear **not-found** state when the id is missing on **this** device — with explicit privacy copy that Rarebox does **not** host shelf data for strangers.

User-facing outcome: from a shelf, “Copy link” puts a same-origin URL on the clipboard; opening that URL on the same browser profile shows the shelf; opening it where the shelf id does not exist shows a calm not-found empty state (not a blank page or a silent dashboard redirect for that id).

## Non-goals

- **True cross-device sharing** of shelf contents via URL alone (no server-side shelf payload).
- Replacing Local Sync, file backup/export, or booth share QR as the multi-device transfer story.
- Public shelf pages, accounts, or short-links for collections.
- Changing Dexie schema or writing shelf data from the router.
- Renaming code identifiers (`portfolio`, `usePortfolioStore`) or removing `/portfolio/:id`.
- Auto-import of shelf JSON embedded in query/hash (future payload format would be a separate spec).

## Verified current facts (live code)

| Fact | Evidence |
|------|----------|
| Canonical shelf route: `/portfolio/:id` → `PortfolioView`, `meta.title: 'Shelf'` | `src/router/index.js` |
| Friendly alias: `/shelf/:id` **redirects** to `/portfolio/:id` | same file |
| Unknown paths `/:pathMatch(.*)*` redirect to `/` (dashboard) | router — **not** `NotFoundView` |
| `NotFoundView.vue` exists (404 sticker + Back to Dashboard) but is **not** wired as the catch-all | `src/views/NotFoundView.vue` vs router |
| `PortfolioView` root is `v-if="portfolio"` with **no `v-else`** | template ends after portfolio-only tree → **blank main area** if id missing |
| Shelf resolved by `store.portfolios.find(p => p.id === route.params.id)` | `PortfolioView.vue` |
| Portfolio store exposes `initialized` | `src/stores/portfolio.js` |
| Navigation to shelves uses `/portfolio/${id}` in App/Dashboard/Booth | e.g. `App.vue`, `DashboardView.vue` |
| Booth has rich share/copy-link patterns (`navigator.clipboard`, Tactile rows) | `BoothShareModal.vue` — **pattern reference**, not shelf data share |
| Local Sync / backup move full collection between devices | `LocalSyncModal.vue`, `backup.js` |
| Privacy posture: local-first, no account required | product mission / Terms |
| No “Copy shelf link” control on `PortfolioView` today | header actions: Add Card, Sealed, Master Set, Import, Prices, Export, Delete |

## Planned behavior

### Copy same-device shelf link

- Add a secondary action on the shelf header (desktop + mobile menu): **Copy link**.
- **Clipboard path (pinned):** copy a same-origin URL whose path is **`/shelf/<id>`** (friendly user-facing form). The existing redirect keeps `/portfolio/<id>` working when opened.
- Success affordance: brief “Copied” on the button (mirror booth copy UX).
- Fallback if `clipboard` unavailable: select-in-input or `document.execCommand` only if already used elsewhere; otherwise show the URL in a small read-only field.

### Not-found state

- **Gate on `store.initialized`:** do not evaluate missing-id / not-found until the portfolio store has finished `init` (`initialized === true`). While not initialized, show the existing loading/shell behavior (or a neutral wait) — **never** flash “Shelf not found” then the real shelf on cold load.
- When initialized and `route.params.id` does not match any shelf:
  - Show explicit empty state: title like “Shelf not found”, short explanation, button back to Dashboard / shelves list.
  - Do **not** leave a blank `v-if` hole.
  - Do **not** create a shelf implicitly from the URL.
- Optional: reuse styling patterns from `NotFoundView` / deck builder’s “Deck not found” (`DeckBuilderView.vue`) for consistency.
- Router catch-all behavior for *unknown paths* may stay dashboard redirect; this spec is about **valid shelf route shape, unknown id**.

### Privacy / local-data limitation (explicit copy)

Near the copy control or in a one-line helper:

- Link only opens this shelf **on a device/browser that already has this Rarebox data**.
- It does **not** upload the shelf or let another phone see cards by URL alone.
- For another device: use **Export**, **Local Sync**, or a **future** share payload — not this link.

User-facing words: **shelf** (not “portfolio”), even though routes/code say `portfolio`.

### Architecture constraints

- Components call store getters/actions only; **no** direct Dexie reads/writes in the view.
- No new persistence required for the feature itself.
- Do not embed item payloads in the URL in this phase.

## User-facing behavior

- **First render behavior:** Wait for `store.initialized` before showing shelf content or not-found. After init, show shelf or not-found — no cold-load not-found flash.
- **Offline / slow API behavior:** Fully local; copy link works offline. Price refresh remains separate.
- **Mobile behavior:** Copy action in header overflow on small screens if needed; control ≥44px; 280px layout without horizontal scroll; Tactile tokens only.
- **Empty/error states:** Shelf not found (only after init); clipboard permission denied message.

## Likely files / systems

- **Views/components:** `src/views/PortfolioView.vue` (copy + not-found + init gate); optionally share small empty-state markup with `NotFoundView.vue` patterns.
- **Stores / IndexedDB:** read-only `usePortfolioStore().portfolios` / `initialized` / existing init — no new keys.
- **Services / APIs:** none.
- **Routes / meta:** keep `/portfolio/:id` and `/shelf/:id` redirect; optionally improve `meta.description` only if copy changes SEO text.
- **Harness evals / smoke tests:** `scripts/evals/route-safety.mjs` if it asserts shelf routes; `npm run smoke:browser` for `/shelf/:id` and missing id.

### Integration symbols

- `portfolio` computed from `route.params.id`
- `store.portfolios`, **`store.initialized`** (required gate for not-found)
- Router entries for `Portfolio` and `/shelf/:id` redirect
- Clipboard pattern from booth share modals (UX only)

## Data and compatibility impact

- **Existing shelf data affected?** No.
- **Backup/import affected?** No.
- **Snapshot/history affected?** No.
- **Migration needed?** No.

## API impact

- **Third-party APIs called:** None.
- **Caching / TTL:** N/A.
- **Concurrency limits:** N/A.
- **Timeout / retry behavior:** N/A.
- **Fallback behavior:** Clipboard failure → visible URL / error text.

## Phased dependencies

1. **Phase A:** Not-found `v-else` (or equivalent) on `PortfolioView`, **gated on `store.initialized`** — highest UX fix.
2. **Phase B:** Copy link control copying **`/shelf/<id>`** + privacy helper line.
3. **Phase C:** Smoke/route eval coverage for `/shelf/:id` redirect and missing id after init.

**Non-goal path (future spec):** cross-device shelf payload (export subset, QR, or signed blob) — must not be implied by this polish.

No dependency on trade history or legality.

## Acceptance criteria

- [ ] User can copy a same-origin shelf link from the shelf UI.
- [ ] Copied path is **`/shelf/<id>`** (same-origin absolute or origin-absolute URL with that path).
- [ ] `/shelf/:id` continues to resolve to the same shelf as `/portfolio/:id` when data exists.
- [ ] Unknown shelf id shows an explicit not-found state (not blank, not a fake shelf).
- [ ] **Not-found is shown only after `store.initialized` is true** — no cold-load flash of not-found before shelves load.
- [ ] Privacy/local-data limitation is visible near copy or in helper copy.
- [ ] True cross-device content sharing is not claimed; export/Local Sync pointed to instead.
- [ ] No direct Dexie or external Pinia bulk mutation from the new UI.
- [ ] User-facing copy says “shelf,” not “portfolio.”
- [ ] Tactile tokens; ≥44px targets; usable at 280px.
- [ ] Existing export/delete/master-set actions remain intact.

## Verification plan

- [ ] `npm run eval:harness`
- [ ] `npm run eval:danger`
- [ ] `npm run build`
- [ ] `npm run smoke:browser` (route + shelf UI)
- [ ] Manual/browser steps:
  1. Open a real shelf → Copy link → paste shows `/shelf/<id>` with correct id.
  2. Open copied link in same profile → same shelf.
  3. Hard-reload `/shelf/<good-id>` and `/portfolio/<good-id>`: never flash not-found before content.
  4. Open `/shelf/not-a-real-id` after load settles → not-found UI + path home.
  5. Open `/portfolio/not-a-real-id` → same not-found.
  6. Confirm `/shelf/<good-id>` redirects/shows content equivalently.
  7. Mobile 280px: copy control reachable; privacy line readable.
  8. Clipboard blocked (if simulable): graceful fallback.

## Risk

- Users assuming the link works like booth share (public payload) — mitigate with explicit privacy copy.
- Flashing not-found before store init — **required** gate on `store.initialized`.
- Putting copy only behind desktop header and omitting mobile menu.

## Rollback / safety notes

- Remove copy button and not-found block; restore prior `v-if="portfolio"` only if necessary (blank missing-id is worse — prefer keeping not-found even if copy reverts).
- No data migration to reverse.
- Does not affect backup compatibility.
