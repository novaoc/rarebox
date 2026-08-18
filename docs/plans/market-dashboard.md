# Rarebox Market Dashboard Plan

Status: proposal only<br>
Design reference: `/designs/pulse`

## Outcome

Build a collector-first market intelligence dashboard inside Rarebox. It should help a collector understand current listings, recent sales, price movement, and availability for the exact cards and sealed products they track across multiple external markets.

Rarebox is **not** the trading venue. It does not publish listings, accept offers, execute purchases, custody cards or tokens, connect wallets, or settle payments. Every actionable listing links to its original marketplace, where the user independently decides what to do.

The experience borrows Pulse's information density, dark terminal surface, amber emphasis, ticker, compact rows, sparklines, watchlists, and rapid comparison patterns. It must retain Rarebox's collector language and must not describe cards as securities, promise returns, or turn collection tracking into an account-gated investment product.

## Product principles

1. **Observe markets; do not become one.** Rarebox indexes permitted public or partner data and sends users to the source.
2. **Match the exact collectible.** Set, collector number, language, finish, variant, condition, grader, grade, certification, and sealed configuration cannot be silently substituted.
3. **A listing is not a sale.** Asking prices, accepted offers, auctions, platform buybacks, estimates, and completed sales are distinct evidence types.
4. **Physical and tokenized listings can be compared, not conflated.** A vaulted, redeemable token represents a specific custodied item with different fees, redemption terms, and risks from a shipped physical listing.
5. **Freshness is visible.** Every price has a source and observation time and is labeled live, delayed, stale, or offline.
6. **Unknown is not zero.** `$0` is valid only when a source explicitly reports zero; missing prices remain `null`.
7. **Private shelves stay local.** Watchlists and market caches work without publishing collection contents to Rarebox or to a marketplace.
8. **Source rights come first.** Prefer official APIs and partnerships; obey licenses, rate limits, robots rules, and deletion requirements. No fragile scraping disguised as an integration.

## Scope

### Proposed

- A Pulse-style market dashboard for raw cards, exact graded copies, and sealed products.
- Current external listings, recent completed sales, platform buyback quotes, and market estimates when the source exposes them.
- Conventional card markets and vaulted/on-chain collectible markets in one normalized view.
- Initial integration research for Collector Crypt, Courtyard, and Phygitals, plus existing Rarebox pricing sources.
- Exact-grade tracking including PSA, CGC, BGS/Beckett, SGC, TAG, ACE, and supported decimal grades such as 9.5.
- Per-item collection tracking with optional certification number, vault/provider reference, marketplace URL, and on-chain identity.
- Source filters, currency normalization, fee/shipping/redemption context, alerts, watchlists, charts, and deep links.
- Cached, visibly stale read-only data when offline.

### Explicitly out of scope

- Rarebox listings, seller profiles, buyer/seller messaging, offers, counteroffers, or auctions.
- Checkout, wallet connection, token transfers, escrow, payment processing, shipping labels, disputes, or tax reporting.
- Rarebox custody, vaulting, authentication, grading, or guarantees that a token remains redeemable.
- Automatic trading, bidding, market making, lending, yield, portfolio-return claims, or financial advice.
- Treating platform pack odds, instant buybacks, insurance values, and completed sales as interchangeable market prices.

## Experience model based on Pulse

Pulse becomes a read-only market terminal. Tactile remains the default collection experience.

| Pulse pattern | Rarebox market meaning | Guardrail |
| --- | --- | --- |
| Global ticker | New listings, price changes, completed sales, and buyback changes | Each event shows its source and event type |
| Holdings tab | Exact collectibles on local shelves | Never upload shelf contents merely to price them |
| Watchlist tab | Cards, grades, sealed SKUs, and saved searches | Local by default |
| Market rows | Best ask, recent sale, listing count, spread, and freshness | Never label an ask as market value |
| Sparklines | Source-aware sale and ask history | Gaps remain gaps; do not invent observations |
| Trade analyzer | Compare owned items against observable external evidence | Analysis only; no execution button |
| Amber action | View source listing or add an alert | External links are visibly external |

Desktop concept:

```text
┌──────────────────────────────────────────────────────────────────────────┐
│ PULSE  MARKET LIVE/DELAYED  USD ▼   Collector Crypt · Courtyard · ...   │
├────────────────────┬─────────────────────────────┬───────────────────────┤
│ MY CARDS/WATCHLIST │ PRICE ACTION                │ LIVE LISTINGS         │
│ exact variant      │ sales + asks by source      │ source · ask · age    │
│ grade/company      │ range · volume · freshness  │ fees · vault · link → │
├────────────────────┴─────────────────────────────┴───────────────────────┤
│ EVENT TAPE: listed · repriced · sold · buyback changed · stale          │
└──────────────────────────────────────────────────────────────────────────┘
```

On mobile these become tabs. A persistent source/freshness strip prevents a cached number from losing its context.

## Tracking model

### Catalog identity

`CatalogRef` identifies the product independent of ownership or market:

```ts
type CatalogRef = {
  game: string
  setId: string
  cardId?: string
  sealedProductId?: string
  collectorNumber?: string
  language: string
  variant: string
}
```

Normalization must support both provider-specific IDs and a Rarebox canonical ID. Cross-source matching records the rule, confidence, and review status; low-confidence records do not contribute to aggregates.

### Owned asset

One `OwnedAsset` represents one physical item or one explicitly indivisible sealed unit:

```ts
type OwnedAsset = {
  assetId: string                 // stable local UUID
  catalogRef: CatalogRef
  kind: 'raw' | 'graded' | 'sealed'
  condition?: string              // raw only
  gradingCompany?: string
  grade?: string                  // preserve 9.5, Pristine 10, Black Label, etc.
  certificationNumber?: string
  sealedKind?: 'pack' | 'deck' | 'box' | 'bundle' | 'case' | 'other'
  acquisition?: { amount: number; currency: string; acquiredAt: string }
  identifiers?: ExternalAssetIdentifier[]
  notes?: string
  photos?: string[]
}

```ts
type ExternalAssetIdentifier = {
  venue: string
  venueAssetId?: string
  listingUrl?: string
  chain?: string
  contractAddress?: string
  tokenId?: string
  vaultReference?: string
  redeemabilityLastCheckedAt?: string
}
```

These identifiers let a collector track a specific slab or vaulted representation without making Rarebox an authority on title, custody, authenticity, or redemption. Certification numbers and wallet/token identifiers are sensitive and remain local unless a user explicitly exports them.

Existing inventory rows with `quantity > 1` remain valid. An optional “track copies individually” action splits a quantity into stable UUIDs while preserving total quantity and allocated acquisition cost.

### Sealed inventory

Sealed identity includes game, set, region/language, product type, configuration, edition/print marker when known, and case quantity. A booster box, loose packs, and a factory-sealed case are different products. Damaged wrap and incomplete cases are condition attributes and cannot use sealed-comparable quotes without a warning.

### Local item history

Use append-only local events for acquisition, manual value, grade submission, grade result, vault deposit, vault redemption, external listing bookmarked, external sale recorded, and archive. These are collector records—not claims independently verified by Rarebox.

## External market observation model

### Venue profile

Each connector publishes capabilities and limitations:

```ts
type VenueProfile = {
  venue: string
  marketType: 'conventional' | 'vaulted' | 'onchain' | 'hybrid'
  supportedEvidence: MarketEvidenceKind[]
  currencies: string[]
  chains?: string[]
  supportsDeepLinks: boolean
  dataMode: 'official_api' | 'partner_feed' | 'licensed_dataset' | 'onchain_index'
  termsReviewedAt: string
}
```

No connector ships until its data access method and display rights are documented. Browser automation or scraping is not the default fallback when an API is unavailable.

### Market evidence

```ts
type MarketEvidenceKind =
  | 'fixed_ask'
  | 'auction_ask'
  | 'best_offer'
  | 'completed_sale'
  | 'platform_buyback'
  | 'market_estimate'

type MarketObservation = {
  observationId: string
  catalogRef: CatalogRef
  physicalIdentity?: {
    gradingCompany?: string
    grade?: string
    certificationFingerprint?: string
  }
  venue: string
  venueListingId?: string
  evidenceKind: MarketEvidenceKind
  amount: number
  currency: string
  amountUsd?: number
  fxObservedAt?: string
  observedAt: string
  sourceEventAt?: string
  availability: 'active' | 'ended' | 'sold' | 'unknown'
  custodyModel?: 'seller_held' | 'vaulted' | 'unknown'
  chain?: string
  tokenId?: string
  redeemable?: boolean | null
  redemptionLastCheckedAt?: string
  fees?: { knownBuyerFee?: number; knownSellerFee?: number }
  shipping?: { included?: boolean; knownAmount?: number }
  sourceUrl: string
  matchConfidence: number
}
```

Never store a wallet address as proof of the real-world owner. On-chain finality proves a token event, not continued vault custody, physical condition, authenticity, or redemption availability.

### Named venue research

The first discovery spike should validate official or partner access for:

| Venue | What Rarebox may observe | Required distinction |
| --- | --- | --- |
| Collector Crypt | Marketplace asks, sales, vaulted graded-card identity, and permitted on-chain events | CARDS token price is separate from collectible prices; gacha spend/buyback is not a comparable sale |
| Courtyard | Vaulted collectible listings, recently listed/sold activity, grade/cert identity, and permitted on-chain history | Listing, trade, pack pull, and instant buyback are separate evidence |
| Phygitals | Marketplace asks, graded/raw/sealed categories, sales or buyback data when exposed, vault/redeemability metadata | Fair-market estimate and 85–90% buyback are labeled estimates/quotes, not completed sales |

This table describes investigation targets, not a promise that each venue exposes an API or grants redistribution rights.

### Price aggregation

For one exact collectible, show evidence in layers:

1. Current asks by venue, including listing age and known landed-cost context.
2. Recent completed sales by venue and date.
3. Platform buyback quotes in their own band.
4. Third-party estimates in their own band.
5. A Rarebox summary only when enough comparable evidence exists.

The summary method must be versioned and explainable. Initial approach:

- Exact identity only; no grade multipliers.
- Deduplicate relisted or syndicated assets using venue IDs, certification fingerprints, source URLs, and timestamps.
- Exclude low-confidence matches and non-arm's-length/anomalous events when detectable; retain them in source detail with a reason.
- Use a time-weighted median of qualified completed sales when sample size is sufficient.
- If sales are sparse, display the ask range rather than inventing a fair value.
- Show sample size, range, included venues, lookback window, and calculation version.
- Normalize currencies with timestamped FX data while retaining the original amount and stablecoin symbol. Do not assume a stablecoin always equals USD.

### Live price action

```text
Official/partner venue feeds ─┐
Permitted on-chain events ───┼─> connector workers -> normalized observations
Existing pricing providers ──┘             |                  |
                                    identity matcher      time-series store
                                             |                  |
                                             └────> quote API + SSE feed
                                                          |
                                                IndexedDB market cache
                                                          |
                                                    Pulse dashboard
```

- Use Server-Sent Events for ticker and listing changes; ordinary HTTPS handles initial snapshots and history.
- Treat connectors as untrusted inputs: schemas, payload limits, timeouts, retry budgets, circuit breakers, and kill switches are required.
- Idempotency is `(venue, venue listing/event ID, event type, source timestamp)` where available.
- Reconcile active listings periodically because a missed “ended” event must not leave a phantom ask.
- Preserve immutable observations; corrections append superseding records.
- Respect provider rate limits and cap fan-out with server-side subscriptions.

Every UI number carries one state:

| State | Meaning |
| --- | --- |
| `LIVE` | Inside that connector's documented live window |
| `DELAYED` | Healthy source with a known publication delay |
| `STALE` | Past its source-specific freshness threshold |
| `OFFLINE` | Last cached observation; refresh unavailable |

“Live” is defined per source. On-chain events, marketplace listings, and completed-sale datasets will have different latency.

## Dashboard views

- **Market overview:** tracked games/sets, new listings, sales, availability, and source health.
- **Exact item:** all active asks, recent sales, grade/condition breakdown, market estimates, and external links.
- **My collection:** local assets with best comparable evidence and freshness—not a brokerage balance.
- **Sealed:** SKU-specific listings and sales; boxes, bundles, packs, and cases never merge.
- **Graded:** grader and exact-grade matrix, including decimal and named grade designations.
- **Venue comparison:** listing count, ask range, latest qualified sale, currency, custody model, fees, and redemption caveats.
- **Event tape:** listed, repriced, ended, sold, buyback changed, source delayed, source recovered.
- **Alerts:** ask below threshold, new exact-grade listing, completed sale, spread change, or stale-source warning.

The event tape uses “sold” only when the venue identifies a completed sale. A disappeared listing is “ended/unknown,” not inferred sold.

## Privacy and local-first boundaries

| Local IndexedDB | Rarebox market service |
| --- | --- |
| Shelves and owned-asset IDs | Public/partner market observations |
| Acquisition cost and notes | Canonical catalog mapping |
| Certification and vault references | Hashed/fingerprinted deduplication data only when permitted |
| Watchlists and alert preferences by default | Aggregate time series and source health |
| Cached quotes and listing snapshots | Anonymous subscription topics, not shelf contents |

The client requests quotes by canonical catalog key. It must not upload “user owns this asset.” Remote alerts, if later added, require explicit opt-in and a narrowly scoped server subscription.

No marketplace authentication, wallet, or social login is required for the first dashboard. If a venue requires a user's account to expose private inventory, that is a separate future integration with explicit consent, revocable tokens, least-privilege scopes, and local secret storage review.

## Trust, data quality, and legal review

- Display venue attribution and a direct source link beside every listing.
- Explain that Rarebox does not operate, endorse, custody, or guarantee external venues or items.
- Display known buyer fees, shipping, redemption fees, chain/network, currency, and vault model where data is available; label unknown costs.
- Do not recommend a marketplace based on referral revenue. Sponsored or affiliate links require explicit labels and cannot change ranking.
- Document connector data licenses, retention, attribution, caching, redistribution, and deletion requirements.
- Create source-level incident controls for compromised feeds, duplicate floods, currency errors, and stale data.
- Apply anomaly flags to wash trading, self-trading, circular transfers, outlier prices, and gacha/buyback events where observable. A flag is not an accusation.
- Complete legal review for market-data redistribution, trademark use, financial-promotion language, privacy, and jurisdictions before public release.

## Storage and services

### Local IndexedDB

Migrate beyond the current single-state blob with versioned tables:

- `owned_assets: assetId, catalogKey, kind, updatedAt`
- `asset_events: eventId, assetId, eventAt, eventType`
- `external_identifiers: assetId, venue, venueAssetId`
- `watchlist: watchId, catalogKey, exactMatchRules`
- `market_cache: topic, receivedAt, staleAfter`
- `alerts: alertId, topic, rule, lastTriggeredAt`

Backups and exports include local tracking data but not bulky market caches. Migrations must preserve current quantities, shelves, acquisition values, snapshots, and graded metadata.

### Server components

- Connector workers, each isolated with its own rate and failure budget.
- Canonical identity and reviewed cross-source mappings.
- Append-only normalized observation store plus aggregate time series.
- Read-only quote/listing/history API and SSE gateway.
- Source-health, reconciliation, anomaly, and legal-compliance controls.

There is no listing command API, offer service, payment service, user wallet, or custody service in this plan.

## Delivery phases

### Phase 0 — access and data proof

- Confirm user questions: price discovery, availability, spread comparison, collection valuation, and alerts.
- Inventory existing provider contracts and data rights.
- Contact or validate official access for Collector Crypt, Courtyard, and Phygitals.
- Capture representative raw, graded (including 9.5 and named 10 grades), sealed, fiat, stablecoin, vaulted, relisted, ended, and sold fixtures.
- Define catalog identity, evidence, currency, custody, and freshness schemas.
- Produce a source capability matrix and go/no-go decision for each connector.

Exit: at least two legally usable sources can be matched and compared without silent identity loss.

### Phase 1 — exact local asset tracking

- Add stable per-copy asset IDs and optional split-by-copy flow.
- Track raw condition, exact grader/grade/cert, sealed configuration, and external identifiers.
- Add append-only local history and backup/export migrations.
- Remove grade multipliers from market valuation; exact evidence or manual value only.
- Keep all existing shelf, booth, snapshot, import, and trade-analyzer behavior compatible.

Exit: two copies of the same catalog card can carry different conditions, grades, costs, external references, and histories.

### Phase 2 — normalized market data

- Ship connector framework, canonical matching, observation storage, reconciliation, and source health.
- Integrate the first approved conventional source and first approved vaulted/on-chain source.
- Build exact-card listing and sale APIs with source links and freshness.
- Validate deduplication and currency handling against golden fixtures.

Exit: asks, sales, buybacks, and estimates remain distinct through ingestion, storage, API, and UI.

### Phase 3 — Pulse dashboard

- Overview, exact-item, graded, sealed, venue comparison, and event-tape views.
- Live/delayed/stale/offline states and connector status.
- Local watchlists, source filters, external listing links, and mobile tabs.
- Explainable aggregates with sample size and methodology.

Exit: a collector can find an exact item, compare active listings across sources, inspect recent qualified sales, and open the original listing without Rarebox handling the transaction.

### Phase 4 — alerts and coverage

- Local alerts first; opt-in remote alerts only after privacy review.
- Add sources only through the capability/data-rights checklist.
- Expand games, graders, sealed products, currencies, and on-chain indexing.
- Add anomaly review, correction workflows, and public source-status history.

Exit: source failure and stale data are visible, bounded, and cannot contaminate healthy venue aggregates.

## PR-sized implementation sequence

1. Architecture decision: read-only dashboard boundary and terminology.
2. Source capability/data-rights matrix with Collector Crypt, Courtyard, Phygitals, and current providers.
3. CatalogRef, exact-grade, sealed-SKU, Money, and MarketObservation schemas plus fixtures.
4. IndexedDB asset-ID migration and split-by-copy flow.
5. Raw/graded/sealed tracking UI and local event history.
6. Connector interface, validation, source health, and kill switches.
7. First conventional connector and matching review tool.
8. First vaulted/on-chain connector and token/vault metadata handling.
9. Observation store, deduplication, reconciliation, and quote API.
10. Pulse shell with source/freshness strip and external-link guardrail.
11. Exact-item listings/sales view and explainable price chart.
12. Graded/sealed/venue comparison views.
13. Local watchlists and alerts.
14. Additional approved connectors one at a time.

Each connector is its own reviewable PR. A connector cannot be enabled merely because a parser works.

## Acceptance criteria

- Rarebox contains no action that lists, bids, buys, sells, swaps, transfers, or pays for a collectible.
- Every actionable market row identifies and links to the external venue.
- Asking prices, auctions, sales, buybacks, and estimates cannot share an unlabeled price field.
- Raw, graded, and sealed comparables never cross without an explicit user-selected comparison.
- PSA 10, CGC 10, CGC Pristine 10, BGS 9.5, BGS 10, and Black Label remain distinct.
- A vanished listing is not recorded as sold without source evidence.
- Stablecoins retain their original symbol and timestamped conversion; they are not silently treated as USD.
- Every number shows source, timestamp, freshness, currency, and sample size where aggregated.
- Offline mode shows cached data as offline/stale while collection tracking remains fully usable.
- Shelf contents, acquisition costs, certificates, token IDs, and watchlists are not uploaded without explicit scope and consent.
- Existing backups, imports, snapshots, booth, and trade analyzer remain compatible.

## Verification strategy

Per `AGENTS.md`, every implementation PR runs `npm run eval:harness`, `npm run eval:danger`, and `npm run build`; UI work also runs `npm run smoke:browser`.

Additional coverage:

- Contract fixtures for every connector and every evidence kind.
- Golden identity tests for languages, variants, graders, decimal grades, named grades, and sealed configurations.
- Property tests that no unmatched or stale record enters a current aggregate.
- Currency tests for fiat, stablecoins, conversion timestamps, rounding, and temporary de-pegs.
- Deduplication tests for relists, syndicated listings, and repeated on-chain events.
- Reconciliation tests for sold, ended, delisted, and unknown availability.
- Browser smoke at 280px for dashboard tabs, source links, freshness, and offline cache.
- Failure drills for rate limits, invalid payloads, delayed feeds, chain reorganizations, and connector shutdown.

## Success measures

- Exact-match rate and reviewed false-match rate.
- Coverage of tracked items with at least one current external listing.
- Median source-to-dashboard latency by connector.
- Percentage of displayed observations within their freshness target.
- Duplicate and incorrectly inferred-sale rate.
- External listing click-through and alert usefulness—not transaction volume.
- Zero private shelf-field leakage in network-contract tests.

## Open decisions requiring owner approval

1. Which conventional marketplaces join the three named vaulted/on-chain research targets?
2. Which sources provide licensed APIs, partner feeds, or redistributable on-chain data?
3. Should the first release prioritize Pokémon graded cards, all supported TCGs, or sealed coverage?
4. Which currencies and chains are required at launch?
5. Should watchlists remain device-local only, or may users opt into remote alerts later?
6. Which fees and redemption costs must be available before Rarebox allows venue sorting by effective price?
7. What evidence threshold permits a Rarebox aggregate rather than only source rows?

## Immediate recommendation

Approve Phases 0 and 1 together. Treat Collector Crypt, Courtyard, and Phygitals as integration research targets until access and display rights are confirmed. Then ship one conventional and one vaulted/on-chain source through the full normalization path before investing in the complete Pulse dashboard.

This establishes honest individual-card, graded, and sealed tracking while proving the hardest part—comparable, permitted, current multi-market data—without turning Rarebox into a trading platform.
