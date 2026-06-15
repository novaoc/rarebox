# Rarebox Agent Harness

This repo is Rarebox: a free, open-source, privacy-first multi-TCG collection tracker.

These instructions apply to all coding agents working in this repository.

## Mission

Improve Rarebox without weakening its core promise:

- local-first collection data
- no account required
- user-owned import/export/backup
- offline-capable flows where practical
- fast first render; background loading over blocking screens
- respectful API usage with caching, batching, retries, and graceful fallback
- Tactile UI that feels physical, clear, and collector-native

## Required First Moves

Before editing:

1. Run `git status --short` and note existing user changes.
2. Read the relevant files. Do not infer component/store/service shapes from memory.
3. Trace definitions and usages for the symbols you touch.
4. For third-party APIs, inspect the existing service wrapper first.
5. If the task changes architecture, data persistence, API behavior, or imports, write down the acceptance criteria before coding.

Do not modify unrelated files. Do not remove features without explicit direction.

## Canonical References

- Product/design docs: https://github.com/novaoc/rarebox-docs
- Tactile design source: https://docs.rarebox.io/design/tactile
- Engineering playbook: https://github.com/novaoc/engineering-playbook
- Main repo: https://github.com/novaoc/rarebox

When docs and code disagree, inspect the live code and report the mismatch. Do not blindly follow stale docs.

## Commands

Project stack: Vue 3 + Vite + Pinia + Dexie/IndexedDB.

Use:

```bash
npm install
npm run eval:harness
npm run build
npm run smoke:browser
npm run dev
```

`npm run build` runs `scripts/sync-ocr-assets.mjs` via `prebuild`, then Vite build.

Run the narrowest meaningful verification for the task, but always run `npm run eval:harness` and `npm run build` before claiming a code change is done unless a blocker is explicitly reported. Run `npm run smoke:browser` for route, layout, app-shell, or user-flow changes.

## Architecture Rules

### State and Persistence

- Pinia is the source of truth. Components read store state and call store actions.
- Components must not directly write IndexedDB.
- Do not assign Pinia refs/properties from outside the store for bulk mutations. Add a store method that mutates internal refs and persists.
- Persistent store actions must call `persist()` or `persistNow()` as appropriate.
- High-risk areas: `src/stores/portfolio.js`, `src/db.js`, `src/utils/backup.js`, `src/utils/collectrImport.js`, snapshot logic, import/restore/reset paths.
- Existing user data compatibility matters more than implementation elegance.

### Search and Card Database

- Never block search/browse behind card database preload. The app must remain usable while background loading runs.
- Cache-first is good; cache-only is not acceptable unless a live fallback exists or the UX explicitly says offline-only.
- In-memory search indexes should be built once and queried synchronously; do not load huge IndexedDB tables on every keystroke.
- Multi-TCG cards normalize to:
  `{ id, name, number, set, image, price, rarity, game }`.
- If a search function exists, ensure it is registered in the provider/search registry. Watch for ALL_PROVIDERS drift during merges.

### External APIs

Respect public APIs. Do not create tight loops or unbounded concurrency.

Default expectations:

- cache repeated requests
- cap concurrency to roughly 3-5 unless an existing subsystem documents otherwise
- use timeouts
- retry transient 429/5xx/network failures with small backoff
- cache 404/miss results where appropriate
- degrade gracefully with stale data or clear user-facing status

Important integrations:

- Pokemon: pokemontcg.io plus official data/CDN patterns already in services.
- Japanese Pokemon: tcgdex/Pokellector mappings; `_lang` must be preserved top-level and in cardData where expected.
- MTG: Scryfall.
- Yu-Gi-Oh: YGOPRODeck; set-specific prices often live in `card_sets[].set_price`.
- Lorcana: Lorcast.
- One Piece: optcgapi.
- Riftbound: riftcodex card data; PriceCharting variant-aware prices.
- PriceCharting: parse prices carefully; `$0` is a valid price, not null.
- Limitless: scraped in serverless code; fragile by nature, cache aggressively.

### Security and Input Handling

Treat all external input as hostile:

- Clamp payload sizes before parsing/decompressing.
- Clamp item counts, string lengths, numeric ranges, and enum values.
- Strip `__proto__`, `constructor`, and `prototype` from imported objects.
- Validate message/type prefixes before feeding browser APIs.
- Never expose secrets in code, logs, docs, screenshots, or commit messages.

This applies especially to backup/restore, QR/local transfer, importers, scanner/OCR paths, and any data crossing a third-party relay.

## Tactile Design Rules

Rarebox uses Tactile. Follow it.

- Use tokens from `src/assets/main.css`; do not hardcode hex colors in components.
- Cream paper, white cards, near-black ink.
- 2px ink borders, hard offset shadows, no blurred shadows, no glass, no glows.
- Interactive elements press: shadow compresses and the element translates by 1px.
- Accent fills carry ink/dark text unless an existing token says otherwise.
- Fun is rationed: one sticker/rotation moment per screen; normal controls stay calm.
- Card images sit inside framed mats; raw scans should not float naked on the page.
- Touch targets must be at least 44px.
- Mobile must work down to 280px width; avoid horizontal scroll.
- Respect `:focus-visible` and `prefers-reduced-motion`.
- User-facing copy says “shelves”, not “portfolios”. Code identifiers may keep legacy `portfolio` naming.

## Engineering Playbook

Use this loop:

1. Reproduce or characterize before fixing.
2. Instrument and isolate the root cause.
3. Research consequential choices and probe the load-bearing claims yourself.
4. Make a small reversible change.
5. Verify on the real artifact, not a proxy.
6. Re-read the diff adversarially.
7. Report verified facts, inferred facts, and gaps.
8. Persist durable lessons in docs, AGENTS.md, or skills.

Principles:

- Be your own harshest skeptic.
- Measure claims with numbers where possible.
- Distrust surprising tool output; rule out stale builds, caches, rate limits, and test artifacts.
- Honor the product ethos even when a shortcut is tempting.
- Design for messy real collector use, not clean demos.
- Do what was asked; defer unrelated improvements.

## Review Checklist

Before finishing a change, check:

- Did the build/test/smoke check actually run? What output proved it?
- Did this preserve existing features?
- Could this lose, corrupt, or hide user collection data?
- Does it work before background preload finishes?
- Does it degrade gracefully when an API fails or returns partial data?
- Are requests cached/batched enough to avoid looking like scraping?
- Did it introduce direct external store mutation, raw IndexedDB writes, or unbounded loops?
- Did UI changes follow Tactile tokens and mobile rules?
- Did user-facing copy use shelves instead of portfolios?
- Did any docs, skills, or harness rules need updating because of the lesson learned?

## Reporting

Lead with the outcome. Then list:

- files changed
- verification run and result
- caveats or unverified areas
- suggested next step, if any

Do not claim success without real verification. If blocked, say exactly what blocked verification and what alternative was attempted.
