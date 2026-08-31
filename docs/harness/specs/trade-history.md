# Feature Spec: Trade History

## Goal

Let collectors **complete/log** a Trade Analyzer session into a **bounded, immutable history** of past trades, then browse that history as a list — without losing the in-progress trade draft, without a second Dexie database, and without breaking backup/restore/Local Sync/reset.

User-facing outcome: after a fair (or intentionally uneven) trade is finished, the user can confirm **Log trade**, the sides clear for the next deal, and a durable history entry remains available on-device.

## Non-goals

- Trade value **charts** / time-series graphs of history (follow-up only; list first).
- Server sync, accounts, or multi-device live trade rooms.
- Mutating shelf inventory automatically when a trade is logged (no auto remove/add of shelf items).
- A second Dexie DB, second Dexie table, or parallel Pinia store outside `useTradeStore`.
- Replacing the existing in-progress draft (`sideA` / `sideB`) persistence model.
- Cross-device “share this trade” deep links (use export / Local Sync if needed).
- Booth table-mode journal (`boothJournal`) integration — separate product surface.
- Naming the store action `logTrade` (that name collides with booth table UI; see Planned behavior).

## Verified current facts (live code)

These are **as implemented today**, not planned behavior:

| Fact | Evidence |
|------|----------|
| **One** Dexie database named `Rarebox` | `src/db.js` — `new Dexie('Rarebox')` |
| Schema versions on that DB: v1 `state`, v2 `prices_cache`, v3 `cards` (cards store registered from card cache module) | `src/db.js` v1/v2; `src/services/tcg/cardCache.js` `db.version(3).stores({ cards: ... })` |
| In-progress trade lives at `state` table key `trade_state` (JSON blob) | `loadTradeState` / `saveTradeState` in `src/db.js` |
| Pinia store `useTradeStore` holds only `sideA`, `sideB`, `initialized` | `src/stores/trade.js` |
| Side shape is `{ items: [], totalValue: 0 }`, not bare arrays | `trade.js` `getState` / `applyState`; `backup.js` |
| Debounced persist (3s) + `pagehide` / `visibilitychange` flush | `trade.js` — **no** exported `persistNow` today |
| Actions: `addToSide`, `updateCardGrade`, `removeFromSide`, `clearSide`, `resetTrade` — **no** complete/history | `trade.js` return |
| Booth table has a separate `logTrade` handler (journal), not trade-store history | `BoothTableView.vue` + `boothJournal` |
| UI: Trade Analyzer at `/trade/analyzer`; Reset Trade calls `resetTrade()` with **no** confirmation | `TradeAnalyzerView.vue` |
| Delta UI treats `abs(delta) < 0.01` as even / `$0.00` | `TradeAnalyzerView.vue` |
| Totals use `??` so **`$0` is a valid price**, not null-collapse | `trade.js` `calculateTotal` |
| Backup exports `data.trade` only when either side has items | `buildBackupPayload` in `src/utils/backup.js` |
| Restore always writes trade via `saveTradeState(data.data.trade \|\| empty sides)` | `restoreBackupData` |
| Settings “Reset Everything” resets trade store + writes empty `trade_state` immediately | `SettingsView.vue` `doReset` |
| Local Sync compact path calls `slimItems(trade.sideA)` / `slimItems(trade.sideB)` on **side objects**, but `slimItems` expects an **items array** | `LocalSyncModal.vue` `compactForTransfer` / `slimItems` — verified mismatch; history work **must** walk `.items` |
| No `tradeHistory` / `trade_history` key or UI exists | repo search |

## Planned behavior

### Complete / log action

1. User builds sides A/B as today.
2. **User-facing copy:** **Log trade**.
3. **Code action name:** `completeTrade` only — **do not** name the trade-store action `logTrade` (avoids collision with booth `logTrade` in `BoothTableView.vue`).
4. **Confirmation** required when either side has items (disable or no-op when both sides empty).
  5. On confirm:
    - If either side has **>200** items: **reject** `completeTrade` with a **visible error**; do not snapshot, append, clear, or persist. (Never silent clamp — totals/snapshots would diverge.)
    - Else build an **immutable snapshot** of both sides + totals + delta + timestamp + id (deep-clone; full side item lists as confirmed, ≤200 each).
    - Cancel any pending debounced persist, then call **`persistNow()`** (immediate `saveTradeState`) so **history + empty draft** are written **before** UI treats the draft as cleared. `persistNow` returns **`true`/`false`**.
    - If `persistNow` returns **`false`**: **do not clear** sides; surface error; leave draft intact; do not keep a partial in-memory history row (rollback-safe).
    - If `persistNow` returns **`true`**: clear live draft sides in memory to match the persisted empty draft.
  6. History is append-only from the user’s perspective; edits to past entries are out of scope (delete-one optional later; not required for v1).

### Snapshot shape (planned)

Store under the **same** `trade_state` value blob on the existing `state` table (extend object — **not** a new Dexie table or DB):

```js
{
  sideA: { items: [], totalValue: 0 },
  sideB: { items: [], totalValue: 0 },
  history: [ /* newest first — required order */ ]
}
```

**Order (pinned):** `history[0]` is the **newest** entry; older entries follow. On overflow, drop from the **end** (oldest).

Each history entry (immutable after write):

| Field | Notes |
|-------|--------|
| `id` | `crypto.randomUUID()` |
| `loggedAt` | ISO timestamp |
| `sideA` / `sideB` | Deep-cloned `{ items, totalValue }` at log time |
| `priceDelta` | `sideB.totalValue - sideA.totalValue` (number; **0 and near-zero allowed**) |
| `isFairTrade` | Optional boolean using existing ≤10% rule |

**Bounds (required, hard caps):**

- History length: **exactly 100** entries max; drop oldest on overflow.
- Snapshot items per side: **exactly 200** items max per side at `completeTrade` time.
  - **Pinned:** if either side has **more than 200** items, **`completeTrade` must reject** with a **visible error** and leave the draft unchanged.
  - **Never silently clamp** the snapshot to 200 on complete — clamping would make `totalValue` / `priceDelta` diverge from the live analyzer totals the user just confirmed.
  - Import/restore paths may still clamp oversized history entries to 200/side (defensive sanitize of hostile/old payloads); that path is separate from complete.
- Clamp string fields on import (name, set, grade company, etc.).
- Strip `__proto__` / `constructor` / `prototype` on import (reuse `sanitizeBackupData` patterns).
- Deep-clone on complete so later draft edits cannot mutate history.

**Do not** invent a second Dexie store or DB name. Trade history remains inside the `trade_state` blob on the shared Rarebox DB.

### History list (v1 UI)

- Entry point from Trade Analyzer and/or Trade landing: **Trade history**.
- List: date, side totals, delta (with `$0.00` / even styling consistent with analyzer), item counts — **newest first**.
- Detail expand optional: card names/qty/grades from snapshot.
- Empty state: calm Tactile empty copy; no chart placeholder required.
- **Chart of history over time = non-goal / follow-up.**

### $0 and zero difference

- `$0` market price on a card remains **0**, not “missing.”
- Logged delta of `0` or `|delta| < 0.01` displays as even / `$0.00`, same as live analyzer.
- Never use `price || null` patterns that drop zero.

### Confirmation and rollback

- Confirm dialog before log (and before destructive clear-all if log is not used).
- **`persistNow` before clear** is the primary safety net.
- **`persistNow` contract (pinned):** wraps immediate `saveTradeState`; returns **`true` on success**, **`false` on failure**. Callers (`completeTrade`, Settings reset) must branch on that boolean — never treat a failed write as success.
- Failed IDB write → keep draft; no partial history row.
- User can still **Reset Trade** without logging (confirm recommended if dirty). `resetTrade` clears draft only (not history) unless Settings Reset Everything runs the full reset sequence above.
- **Debounce safety (pinned):** any path that calls `persistNow` or Settings reset must **cancel the pending debounced persist timer before** the authoritative immediate write, so a stale 3s timer cannot overwrite the just-written state.

## User-facing behavior

- **First render behavior:** Analyzer loads existing draft from `trade_state` as today. History list reads `history` from the same blob after store `init()`; no network.
- **Offline / slow API behavior:** Logging and history are fully local. Card search/scan for *new* trades still uses existing search/scan paths; history browse does not call APIs.
- **Mobile behavior:** Works down to **280px**; primary actions ≥ **44px** touch targets; Tactile tokens only (no hardcoded hex in new UI). One calm sticker moment max on the history screen.
- **Empty/error states:** Empty history; persist failure toast/banner; confirm cancel leaves draft unchanged.

## Likely files / systems

- **Views/components:** `src/views/TradeAnalyzerView.vue`, `src/views/TradeLanding.vue`; optional small `TradeHistoryList` component.
- **Stores / IndexedDB:** `src/stores/trade.js` (extend); `src/db.js` `loadTradeState` / `saveTradeState` only — **same key** `trade_state` on existing Rarebox `state` table.
- **Services / APIs:** none new for history itself.
- **Routes / meta:** optional `/trade/history` or in-page panel; if route added, set `meta.title` / description; user copy says “trade,” not portfolio.
- **Backup / sync:** `src/utils/backup.js` `buildBackupPayload` / `restoreBackupData`; `src/components/LocalSyncModal.vue` compact path; `src/views/SettingsView.vue` `doReset`.
- **Harness evals / smoke tests:** extend `scripts/evals/backup-roundtrip.mjs` (+ fixture) for `data.trade.history`; optional unit-style eval for clamp/bounds; `npm run smoke:browser` if routes/UI shell change.

### Integration symbols (touch carefully)

- `useTradeStore` → add `history`, **`completeTrade`**, **`persistNow`**, load path for `history`.
- `getState` / `applyState` must round-trip `history`.
- `resetTrade` vs complete: reset clears draft only; Settings reset clears draft **and** history (document in UI copy for Reset Everything).
- Backup: **must export `data.trade` when `history` is non-empty even if both draft sides are empty** (today trade is omitted when both sides empty — required compatibility change). Old backups without `history` must still restore with `history: []`.

## Data and compatibility impact

- **Existing shelf data affected?** No (history does not write `app_state` / shelves).
- **Backup/import affected?** Yes — `data.trade` may gain `history[]`. Old backups with only `sideA`/`sideB` must restore with `history: []`. New exports must include history-only trade blobs.
- **Snapshot/history affected?** Shelf `snapshots` in portfolio store: **No**. Trade history is separate.
- **Migration needed?** Soft only: `applyState` defaults missing `history` to `[]`. No Dexie version bump required if value remains one JSON blob under `trade_state`.

### Import / Local Sync / reset clamps

| Path | Requirement |
|------|-------------|
| File backup export | **Required:** include `data.trade` whenever `history.length > 0`, even if both draft sides are empty. Also include when sides have items (as today). |
| File backup import | Sanitize; clamp history to 100; clamp per-entry items to 200/side; default missing history to `[]`. |
| Local Sync send | Include history in compact payload. **Mandatory hard requirement:** slim only via `.items` arrays — `trade.sideA.items`, `trade.sideB.items`, and each `history[i].sideA.items` / `history[i].sideB.items`. **Never** call `slimItems` on side objects (`{ items, totalValue }`). |
| Local Sync receive | Same clamps as backup import via `importBackup`. |
| Settings reset | **Pinned Reset Everything sequence** (must all happen, in order): (1) **cancel any pending debounce** timer; (2) set in-memory draft sides empty and **`history = []`**; (3) **`persistNow()`** writing the **exact empty shape** `{ sideA: { items: [], totalValue: 0 }, sideB: { items: [], totalValue: 0 }, history: [] }` (always include `history: []`, never omit); (4) treat `persistNow` **`true` = success**, **`false` = failure** — surface failure and do not claim reset succeeded on `false`; (5) success path leaves no pending debounce that can resurrect pre-reset history or draft. |
| Old backups | No `history` → empty list; sides restore as today. |

## API impact

- **Third-party APIs called:** None for log/list.
- **Caching / TTL:** N/A for history blob.
- **Concurrency limits:** N/A.
- **Timeout / retry behavior:** IDB write failure via `persistNow` → surface error; no silent drop.
- **Fallback behavior:** Keep in-memory draft if persist fails.

## Phased dependencies

1. **Phase A — Store + persistence:** extend `trade_state` shape; `completeTrade` + `persistNow` with persist-before-clear; hard caps 100 / 200; newest-first; init defaults.
2. **Phase B — Backup/restore/Local Sync/reset:** history-only export; import clamps; **mandatory** Local Sync `.items` walk; reset clears history; eval coverage.
3. **Phase C — History list UI:** Tactile list + confirm on Log trade; wire analyzer CTA.
4. **Follow-up (explicit non-goal now):** history value chart.

No dependency on shelf-link, master-set compact, or legality work.

## Acceptance criteria

- [ ] **Log trade** (UI) calls store action **`completeTrade`** (not `logTrade`).
- [ ] Completing a trade appends one immutable history entry (**newest first**) and clears the live draft **only after** successful **`persistNow`**.
- [ ] Failed `persistNow` leaves draft intact and does not append a partial entry.
- [ ] History is stored in existing Rarebox Dexie `state` key `trade_state` — no second DB/table.
- [ ] History length hard-capped at **100**; overflow drops oldest.
- [ ] Snapshot items hard-capped at **200 per side**: `completeTrade` **rejects** (visible error, no clear, no append) when either side has **>200** items — **never** silent clamp on complete.
- [ ] `$0` card prices and `$0.00` deltas survive complete + reload + backup round-trip.
- [ ] Old backups without `history` restore cleanly (empty history, sides as before).
- [ ] New backups export trade when **history-only** (empty draft sides, non-empty history) and restore that history on a fresh profile.
- [ ] Settings Reset Everything: in-memory `history=[]` + empty sides; cancel pending debounce; immediate write exact empty shape including `history: []`; `persistNow`/`saveTradeState` success=`true` / failure=`false`; no late debounce rewrite of pre-reset state.
- [ ] Local Sync / import paths sanitize prototypes, clamp sizes, and **must** slim via `.items` arrays on draft sides **and** each history entry’s sides (not side objects).
- [ ] Confirmation required before complete when sides are non-empty.
- [ ] History **list** is usable newest-first; no chart required.
- [ ] UI uses Tactile tokens, ≥44px targets, usable at 280px width.
- [ ] User-facing copy does not say “portfolio” for shelves (N/A on this screen except any shelf deep-links left untouched).
- [ ] No automatic shelf item mutation on complete.

## Verification plan

- [ ] `npm run eval:harness` (after implementation; include backup/trade history cases)
- [ ] `npm run eval:danger`
- [ ] `npm run build`
- [ ] `npm run smoke:browser` if route/app-shell/UI touched
- [ ] Manual/browser steps:
  1. Add cards both sides (include a `$0` price card); note delta.
  2. Log trade → confirm → draft empty; history shows one row (top) with same totals/delta.
  3. Reload app → history and empty draft persist.
  4. With history present and empty sides, export backup → payload includes `data.trade.history`.
  5. Import that backup on clean profile → history present.
  6. Import pre-history backup → no crash; history empty.
  7. Fill history past 100 → oldest dropped; order remains newest-first.
  8. Attempt complete with >200 items on a side → visible error; draft unchanged; no history row.
  9. Simulate IDB failure (if testable) → draft retained; `persistNow` returns false.
  10. Reset Everything → history gone; `trade_state` is exact empty shape with `history: []`; no late debounce rewrite.
  11. Mobile width 280px: list and confirm usable.

## Risk

- **Data loss:** clearing draft before `persistNow` (mitigate: persist-before-clear).
- **Quota:** large item snapshots bloat IDB/backups (mitigate: hard caps 100 / 200 + optional slim fields on snapshot items).
- **Backup size / Local Sync QR frame count:** history multiplies payload (mitigate: caps; optional exclude images in snapshots).
- **Local Sync slim bug** if `.items` walk is skipped (mitigate: **mandatory** correct walk while touching that path).
- **Name collision** with booth `logTrade` (mitigate: store action `completeTrade` only).
- **User expectation** that log moves cards between shelves (mitigate: copy — “logs values only”).

## Rollback / safety notes

- Safest revert: remove history UI + `completeTrade`; keep reading unknown `history` key ignored, or strip on read.
- Feature-flag optional but not required if change stays in trade store.
- Revert does not need Dexie migration down if blob remains JSON-compatible.
- Never ship a path that writes shelf `app_state` from trade complete without explicit future spec.
