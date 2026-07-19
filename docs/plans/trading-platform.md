# Rarebox Trading Platform Plan

Status: proposal only; no production behavior changes in this PR.

## Outcome

Evolve Rarebox from a local collection tracker into an opt-in collector trading platform without weakening its local-first promise. A collector should be able to identify a physical item, follow its value and custody history, list it, negotiate a card-for-card or cash-balanced trade, and transfer that exact item to another collector.

The experience should borrow the information density, dark terminal surface, amber emphasis, ticker, compact rows, sparklines, watchlist, and fast comparison patterns from `/designs/pulse`. It should not inherit the prototype's investor-first language. Rarebox should still speak about collections, copies, slabs, sealed products, offers, and trades—not securities or guaranteed returns.

## Product principles

1. **A physical item is not a catalog row.** “Charizard, Base Set #4” identifies a printing; a specific near-mint copy, PSA slab, or sealed box needs its own durable identity.
2. **Private until explicitly listed.** Shelves and acquisition history remain local. Publishing a listing uploads only the fields reviewed in a listing preview.
3. **Price is evidence, not truth.** Every quote carries source, variant/grade, timestamp, currency, confidence, and staleness. Missing data stays unknown; `$0` is valid only when a source explicitly reports it.
4. **No silent identity substitution.** Set, collector number, language, finish/variant, condition, grader, and grade must remain distinct through pricing, offers, and transfers.
5. **One physical unit, one availability state.** A listed or reserved unit cannot be promised in another active deal.
6. **Offline collection management remains useful.** Network features degrade to cached, visibly stale marketplace and price data; shelves never become account-gated.
7. **Start with discovery and structured trades.** Payments, shipping labels, escrow, tax reporting, and disputes are separate regulated operational commitments, not incidental UI features.

## Scope and non-goals

### Proposed scope

- Individually identified raw cards, graded slabs, sealed products, and intentional lots.
- Watchlists, market tape, item-level price history, and price alerts.
- Opt-in listings with ask price or trade preferences.
- Search/discovery, saved searches, offers, counteroffers, reservations, and completed trade records.
- Same-device/offline collection history plus authenticated cross-device marketplace participation.
- Local meetup and externally coordinated fulfillment in the first marketplace release.

### Not in the first marketplace release

- Rarebox custody of cards or money.
- Escrow, integrated payment processing, shipping insurance, or authenticity guarantees.
- Auctions, leverage, fractional ownership, financial advice, or investment-return promises.
- Automatic publication of shelf contents, purchase prices, notes, storage locations, or certification numbers.
- Pricing ungraded cards with grade multipliers or using raw prices for slabs.

## Experience model based on Pulse

Pulse becomes an authenticated marketplace/terminal surface, while Tactile remains the default collection surface.

| Pulse pattern | Trading-platform use | Guardrail |
| --- | --- | --- |
| Market ticker | Recent verified price observations, listing changes, and completed trades | Label source and observation time; never call cached estimates live |
| Portfolio/watchlist tabs | My inventory, listings, watchlist, offers | Inventory remains local unless explicitly published |
| Dense holding rows | Thumbnail, exact printing, item state, quote, 24h/7d movement, ask | Mobile collapses safely to 280px; touch targets remain 44px |
| P/L panel | Cost basis and collection-value history | Private by default; collector language rather than “asset class” copy |
| Sparklines | Source-aware market history and listing history | Gaps stay gaps; no fabricated interpolation for a single item |
| Terminal status | Feed timestamp, online/offline, stale-cache status | “Live” only while a realtime connection is healthy |
| Amber action | List, make offer, counter, accept | Destructive/committing actions require a review screen |

Primary desktop layout:

```text
Market tape
┌───────────────┬──────────────────────────────┬─────────────────────┐
│ Watchlist     │ Listings / item detail       │ Offer ticket        │
│ Saved search  │ history · comps · provenance │ give / receive      │
│ My listings   │ seller terms · photos        │ cash adjustment     │
└───────────────┴──────────────────────────────┴─────────────────────┘
Connection · source freshness · last update · currency
```

On mobile, these become terminal tabs with a persistent offer tray instead of three simultaneous columns.

## Domain model

### Catalog identity

Existing providers continue to resolve the shared printing/product identity:

- `game`
- provider/catalog IDs
- set ID and name
- collector number
- language
- finish/printing variant
- canonical name and images

Catalog records are replaceable cache data. They are not ownership records.

### Owned asset

Introduce `OwnedAsset`, one record per physical unit:

```ts
type OwnedAsset = {
  assetId: string                 // UUID, stable across shelf moves and exports
  ownerLocalId: string            // local installation identity; never public
  catalogRef: CatalogRef
  kind: 'raw' | 'graded' | 'sealed'
  quantity: 1                    // physical units are individual in v1
  condition?: CardCondition      // raw only
  grader?: GradingCompany        // graded only
  grade?: string                 // graded only; exact tier
  certFingerprint?: string       // optional/private by default
  sealedSubtype?: string
  language?: string
  variant?: string
  acquisition?: {
    acquiredAt?: string
    unitCost?: Money
    source?: string
  }
  location?: string              // private
  notes?: string                 // private
  photos: LocalPhotoRef[]
  state: 'owned' | 'listed' | 'reserved' | 'transferring' | 'transferred' | 'archived'
  createdAt: string
  updatedAt: string
}
```

Existing rows with `quantity > 1` remain compatible. Marketplace onboarding offers an explicit “split into individual copies” operation that creates new UUIDs while preserving total quantity and acquisition cost. It must never silently duplicate an existing asset.

### Asset events and custody history

Use an append-only local event log rather than overwriting the only record of what happened:

```ts
type AssetEvent = {
  eventId: string
  assetId: string
  type:
    | 'created' | 'acquired' | 'corrected' | 'moved'
    | 'listed' | 'listing_changed' | 'reserved'
    | 'offer_accepted' | 'transfer_started' | 'transferred'
    | 'sale_recorded' | 'trade_recorded' | 'archived'
  occurredAt: string
  actor: 'local-owner' | 'counterparty' | 'system'
  publicPayload?: Record<string, unknown>
  privatePayload?: Record<string, unknown>
  previousEventHash?: string
}
```

The hash chain is tamper-evident history, not blockchain and not proof of authenticity. Corrections append a new event; they do not rewrite earlier custody events.

### Lots

A `TradeLot` groups asset IDs for one offer or listing. Assets remain individually addressable. A sealed case may be one explicitly described asset; six loose booster boxes are six assets unless the seller deliberately creates an indivisible lot.

### Published listing

The server receives a reviewed snapshot, not the shelf object:

```ts
type Listing = {
  listingId: string
  sellerId: string
  assetPublicId: string           // marketplace alias, not ownerLocalId
  catalogRef: CatalogRef
  kind: OwnedAsset['kind']
  condition?: CardCondition
  grader?: GradingCompany
  grade?: string
  variant?: string
  language?: string
  publicPhotos: HostedPhoto[]
  ask?: Money
  acceptsTrades: boolean
  wants?: WantRule[]
  fulfillment: ('local-meetup' | 'coordinate-externally')[]
  state: 'draft' | 'active' | 'reserved' | 'completed' | 'withdrawn' | 'expired'
  version: number
  createdAt: string
  expiresAt: string
}
```

Never publish purchase price, local notes, storage location, full backup data, or full certification number by default. Certification disclosure needs an explicit control and abuse review.

### Offer and transfer

An offer is versioned and references immutable listing/asset snapshots:

```text
draft → sent → countered ↔ sent → accepted → reserved
                                      ↘ declined / expired / withdrawn
reserved → completed | cancelled | disputed
```

Acceptance is a server transaction that checks listing version and availability, creates a reservation with an expiry, and rejects stale competing offers. Completion writes local transfer events for both participants after each client confirms/imports the receipt.

## Pricing and live price action

### Quote envelope

Replace “one current price” at marketplace boundaries with a quote envelope:

```ts
type MarketQuote = {
  quoteId: string
  catalogRef: CatalogRef
  itemKind: 'raw' | 'graded' | 'sealed'
  condition?: string
  grader?: string
  grade?: string
  variant?: string
  currency: string
  value: number | null
  source: string
  sourceUrl?: string
  observedAt: string
  receivedAt: string
  confidence: 'direct' | 'derived' | 'manual'
  staleAfter: string
}
```

Rules:

- Direct variant prices outrank generic fallbacks.
- Graded prices require the exact grade tier and, for company-specific 10s, exact company.
- Sealed quotes never inherit raw-card prices.
- Manual values remain visibly manual and do not enter aggregate market indices.
- `$0` remains a valid explicit observation; unknown remains `null`.
- Currency conversion records both original and display currency/rate timestamp.
- Every displayed move states its window and baseline (`24h`, `7d`, last sale, or listing median).

### Realtime architecture

“Live” marketplace activity requires a server component even though shelves remain local:

```text
Provider refresh workers ─┐
Completed marketplace trades ─┼─> normalized observations -> time-series store
Active listing changes ───────┘                 |
                                                v
                                      SSE market/listing feed
                                                |
                                  IndexedDB cache + Pulse terminal
```

- Start with Server-Sent Events for one-way ticker/listing updates; use ordinary HTTPS for commands.
- Reconnect with cursor/`Last-Event-ID`; deduplicate by event ID.
- Cache the last known quote and feed cursor in IndexedDB.
- Show `LIVE`, `DELAYED`, `STALE`, or `OFFLINE` based on measured connection and quote timestamps.
- Batch provider work, cap concurrency at 3–5 per provider, use timeouts/retries/backoff, and honor provider terms.
- Do not expose provider credentials to clients.
- Keep raw provider observations so mapping/parser corrections are auditable.

### Market views

- Printing overview: raw/condition bands, exact graded tiers, sealed variants.
- Recent observations: source and timestamp, with outlier flags.
- Active listings: ask distribution and age.
- Completed Rarebox trades: only after both sides complete; label sample size.
- Item timeline: acquisition/manual values, quotes applied, listing changes, offers, transfer.

## Local-first and server boundaries

| Remains local by default | Opt-in server data |
| --- | --- |
| Shelves and unlisted assets | Account/public profile minimum |
| Purchase price and private notes | Listing snapshot and public photos |
| Storage location | Wants and fulfillment preferences |
| Full event history | Offer/counteroffer messages and versions |
| Backups and import files | Reservation and completion state |
| Unpublished certification data | Moderation/audit records |

Authentication is optional for tracking and required for marketplace publication. Recommended first implementation: passkeys plus recovery codes, short-lived sessions, CSRF protection, and device/session management. Social login can follow; collection access must never depend on an identity provider being online.

Cross-device sync is not implied by marketplace login. If added, it needs separate consent, encryption, conflict resolution, export, and delete controls.

## Trust, safety, and operations

Before public listings:

- Terms, prohibited-items policy, minimum age decision, privacy policy, reporting, blocking, and appeals.
- Rate limits for accounts, listings, offers, messages, images, and searches.
- Image validation, metadata stripping, malware protection, size/count limits, and signed upload URLs.
- Spam/scam heuristics and human moderation queue.
- Structured meetup safety guidance; never expose precise home location.
- Reputation based on completed interactions, not collection value.
- Versioned audit log for listing/offer/moderation state changes.
- Data deletion/export and retention schedule.
- Abuse-resistant notification preferences.

Payments or shipping move Rarebox into materially different legal and operational territory. Before either, complete jurisdiction, tax, money-transmission/payment-facilitator, chargeback, consumer-protection, sanctions, privacy, and insurance review. Prefer a marketplace payment provider rather than holding funds.

## Storage and service shape

### Local IndexedDB

Migrate from the current single state blob gradually:

- `owned_assets: assetId, catalogRef keys, state, updatedAt`
- `asset_events: eventId, assetId, occurredAt, type`
- `market_quotes: quoteId, catalog key, observedAt, source`
- `marketplace_outbox: operationId, state, retryAt`
- `marketplace_cache: key, receivedAt`

Pinia remains the source of truth for UI state. Dexie access stays behind stores/services. Backup format gains a version and preserves unknown fields for forward compatibility.

### Server services

- Identity/session service.
- Listing and offer API backed by a relational database.
- Object storage for explicitly public listing photos.
- Realtime SSE feed.
- Price ingestion/normalization workers and time-series storage.
- Moderation/admin audit surface.
- Notification worker.

Use idempotency keys on create/accept/complete commands, optimistic listing versions, transactional reservations, bounded payloads, and cursor pagination.

## Delivery phases

### Phase 0 — decisions and prototypes

- Validate demand for discovery-only, local meetup, shipped trades, and cash sales separately.
- Run usability tests on Pulse desktop and 280px/mobile terminal layouts.
- Confirm marketplace jurisdictions, age policy, and provider data rights.
- Define CatalogRef, Money, OwnedAsset, quote, listing, offer, and event schemas.
- Threat model identity, listing publication, messages, images, and trade acceptance.

Exit: approved product scope, data contracts, trust/safety owner, and operating-cost budget.

### Phase 1 — individual inventory and history (local only)

- Add stable `assetId` and explicit raw/graded/sealed identity.
- Add split/merge flows for legacy quantities with reversible migrations.
- Add acquisition lots and append-only asset events.
- Update backup/restore, Collectr import, Excel export, snapshots, booth, and trade analyzer.
- Remove grade multipliers from trade valuation; use exact quotes or manual values.

Exit: no item identity or value changes silently; round-trip and migration harnesses pass.

### Phase 2 — Pulse market terminal (read-only network)

- Watchlists, source-aware quotes, exact grade/variant bands, sparklines, freshness states.
- Cached market/search data and offline terminal.
- Realtime SSE status and reconnect behavior.
- No accounts required for read-only public market data.

Exit: every displayed price is traceable and stale/offline states are honest.

### Phase 3 — opt-in listings and discovery

- Passkey accounts, listing preview/redaction, public profile minimum.
- Fixed-price or trade-interest listings, saved searches, reporting/blocking.
- Local meetup and external coordination only; no Rarebox payments.
- Listing outbox for offline drafts; publication requires online confirmation.

Exit: private shelf data cannot leak through listing APIs; moderation and deletion workflows are staffed.

### Phase 4 — structured offers and transfers

- Multi-asset offers, cash adjustment as informational/manual settlement, counteroffers.
- Transactional reservations, expiries, idempotent acceptance, completion receipts.
- Import received assets as new ownership records while retaining provenance.
- Trade journal, realized cost basis, and counterparty-safe receipt export.

Exit: concurrent-offer tests prove an asset cannot be double-reserved or transferred twice.

### Phase 5 — managed commerce (separate approval)

- Only after legal/operational review: integrated payments, shipping, disputes, refunds, tax reporting, and authenticity partners.
- Launch by jurisdiction and item category behind kill switches.

## PR-sized implementation sequence

1. Schema proposal and fixtures for `OwnedAsset`, `AssetEvent`, `MarketQuote`, and versioned backup.
2. Local migration adding stable asset IDs without splitting quantities.
3. Explicit quantity-to-copy split workflow and rollback metadata.
4. Raw/graded/sealed identity editor and item timeline.
5. Exact quote envelope adapters and stale/confidence UI.
6. Pulse terminal route using cached read-only market data.
7. Realtime SSE client with offline/reconnect harness.
8. Marketplace API threat model and OpenAPI contract.
9. Passkey account shell isolated from local shelf initialization.
10. Listing preview/redaction and offline outbox.
11. Search/discovery, reports, blocks, and moderation queue.
12. Versioned offers/reservations and transfer receipts.

Each PR must preserve existing shelf compatibility and run `eval:harness`, `eval:danger`, `build`, plus browser smoke for user flows.

## Acceptance criteria for the platform program

- Every listed physical unit has one stable asset identity and one availability state.
- Raw, graded, sealed, language, condition, and variant identities never cross-price.
- A missing quote cannot become `$0`, raw market, another grade, or another product.
- Every price displayed in Pulse exposes source and freshness.
- A listing preview exactly matches the server payload.
- Unlisted shelf data is absent from marketplace network requests.
- Competing accepted offers cannot reserve the same asset.
- A completed transfer produces durable receipts and local asset events for both sides.
- Legacy shelves, backups, imports, snapshots, booth, and trade analyzer remain compatible.
- Core shelves/search remain functional offline and without an account.
- Mobile works at 280px and all interactive controls meet the 44px target.

## Verification strategy

- Pure schema/normalization fixtures for every supported TCG, item kind, grade, language, and variant.
- Property tests for quantity split/merge and backup round trips.
- Migration fixtures from every existing backup version.
- Price-contract tests for `$0`, `null`, stale, exact grade, exact variant, and currency.
- Concurrency tests for duplicate commands, competing offers, reservation expiry, and reconnect replay.
- Security tests for authorization, IDOR, CSRF, replay, payload limits, prototype pollution, image abuse, and rate limits.
- Browser smoke: local-only tracking without login, listing preview, offline draft, reconnect, offer/counter/accept, A/B ownership transfer, 280px layout.
- Load tests for ticker fan-out, listing search, provider ingestion, and notification spikes.
- Kill-switch drills for publication, offers, realtime feed, and individual providers.

## Success measures

- Listing completion rate and time to first qualified offer.
- Offer acceptance and completion rate, excluding spam.
- Percentage of quotes with direct identity matches and acceptable freshness.
- Double-reservation/incorrect-transfer rate: target zero.
- Report rate, moderation response time, dispute rate, and blocked-user recurrence.
- Percentage of users who track locally without ever publishing: this remains a supported success case.
- Marketplace uptime must not reduce local collection availability.

## Open decisions requiring owner approval

1. Discovery/local-meetup only, shipped trades, cash sales, or all three?
2. Launch countries and minimum age?
3. Are messages free-form, structured-only, or external links initially?
4. Are certification numbers public, partially masked, or private?
5. What completed-trade data may contribute to Rarebox market prices?
6. Which provider terms permit caching, derived history, and public redistribution?
7. Is cross-device encrypted collection sync part of this program or separate?
8. Who staffs moderation and support, and during which hours?
9. What is the maximum acceptable monthly infrastructure/market-data cost?
10. Which Phase 5 capabilities, if any, should Rarebox explicitly rule out?

## Immediate recommendation

Approve Phases 0–2 as the next product program. Treat Phase 3 as conditional on trust/safety and data-rights readiness. Keep Phase 5 outside the committed roadmap until Rarebox has explicit legal, operational, and financial capacity.
