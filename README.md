<p align="center">
  <img src="assets/rarebox-intro.gif" alt="Rarebox — Multi-TCG Portfolio Tracker" width="640">
</p>

# Rarebox

Track your TCG collection across Pokémon, Magic: The Gathering, Disney Lorcana, One Piece Card Game, Yu-Gi-Oh!, and Riftbound — cards, sealed products, and graded slabs — with live prices, portfolio charts, and a trade analyzer.

**Live at [rarebox.io](https://rarebox.io)** · **Docs at [docs.rarebox.io](https://docs.rarebox.io)**

Built by [Nova](https://github.com/novaoc).

## Features

### Collection Management
- Add cards by searching any set — live results with card images and prices from each TCG's API
- Common search bar with TCG filter pills — search all 6 games simultaneously
- Add sealed products (booster boxes, ETBs, tins, packs) — prices and images from PriceCharting
- Add graded slabs (PSA / BGS / CGC / ACE) — grade-specific pricing and multipliers, available for all TCGs
- Bulk import — paste a PTCGL/PTCGO deck list and add all cards at once
- Multiple named portfolios, each with a color and their own value chart
- Combined dashboard showing total collection value, cost basis, and gain/loss across all portfolios
- Add an entire set to a portfolio in one click from any Browse Sets view

### Browse Sets (Multi-TCG)
- Landing page with branded tiles for each TCG — tap to explore
- **Pokémon** — full dedicated experience with English and Japanese sets, variant logos, card images, and TCGPlayer prices
- **Magic: The Gathering** — every English set via Scryfall, USD prices, set symbol icons
- **Disney Lorcana** — all sets via Lorcast, USD prices, branded set badges
- **One Piece Card Game** — 20 English sets, 3300+ cards via optcgapi, USD market prices
- **Yu-Gi-Oh!** — all sets via YGOPRODeck, TCGPlayer market prices
- **Riftbound (League of Legends TCG)** — 7 sets, 1000+ cards via riftcodex.com, card images from Riot CDN, PriceCharting prices
- Click any set → full card grid with card images → "+ Add" opens the add modal pre-filled

### Card Database (Client-Side Index)
- On first visit, selects which TCGs to track
- Preloads all card data into IndexedDB in the background — 0 API calls on subsequent searches
- Floating progress pill shows per-game status, ETA, and overall completion
- Interrupted preloads resume silently on refresh
- Search works immediately — uncached TCGs fall back to live APIs

### Search
- Unified search across all 6 TCGs — one input, live results, filter by game
- Cached TCGs searched instantly from local IndexedDB
- Uncached TCGs searched via live API with automatic fan-out and result merging
- Results sorted by relevance: exact name → prefix → alphabetical
- Sealed product search via PriceCharting — keyword-filtered for boosters, ETBs, tins, etc.

### Price Alerts
- Set "notify when price goes above/below $X" on any card
- Alerts fire via the browser Notification API when prices cross thresholds
- Manage active and triggered alerts from Settings
- All alerts stored locally — no server

### Deck Builder
- Create multiple named decks per TCG, add cards by search
- Track deck cost, ownership status (Need / Owned / ✓ Owned)
- Compare deck cards against your collection — shows which cards you already own
- Import current meta decks with one click — supports all 6 TCGs
- Refresh prices on any deck with one tap

### Live Meta Decks
- Auto-fetches current tournament meta from each TCG's competitive scene:
  - **Pokémon** — Limitless TCG
  - **Magic** — mtgtop8.com
  - **Lorcana** — inkdecks.com
  - **One Piece** — optcg.one
  - **Riftbound** — RiftDecks.com
  - **Yu-Gi-Oh!** — ygoprodeck.com
- Shows top 10 competitive decks ranked by meta share
- Cards resolved server-side with exact card match (set code + number)
- Market prices from TCGPlayer / PriceCharting for every card
- Cached for 24h with version-based invalidation — instant on repeat visits

### Trade Analyzer
- Side-by-side trade comparison — add cards to Side A and Side B via search or camera scan
- Live price delta with winning/losing/even label
- Grading multiplier applied per card (PSA 10 = 2x, etc.)
- Persistent trade state across sessions (IndexedDB)
- Camera scan integration — OCR via Tesseract.js extracts card names from photos

### Pricing & Charts
- Live card prices from pokemontcg.io, Scryfall, Lorcast, optcgapi, YGOPRODeck, riftcodex.com, and PriceCharting
- Per-type price staleness tracking — cards refreshed every 24h, sealed/graded every 12h
- Price history charts (7D / 1M / 6M / 1Y / 3Y ranges) from multiple historical data sources
- Portfolio value-over-time chart with daily price snapshots (3 years retained)
- Graded-grade multipliers for price estimation

### Export, Import & Backup
- Export individual portfolios to Excel (.xlsx) with summary + items sheets
- Export all portfolios to a single Excel file
- Backup entire collection as JSON — download and restore on any device
- **Collectr import** — import CSV or Excel exports from the Collectr app (maps game names, variants, grading, sealed products)
- **Transfer to device** — gzip-compressed QR code or clipboard copy/paste for moving collections between devices
- Stale data cleanup — deleted cards don't linger in snapshots or backups
- Storage usage display in Settings — shows combined IndexedDB + localStorage usage via `navigator.storage.estimate()`
- **Reset Everything** — clears all portfolios, card cache, and stored data with a single button

### Mobile
- Touch-friendly card grids with persistent overlay buttons on touch devices
- Bottom sheet panels for card details, search results, and portfolio items
- Responsive charts, stacked headers, column hiding on smaller screens

### PWA — Add to Home Screen
- Installable as a standalone app on Android and iOS
- Auto-detects platform and shows relevant install prompt
- Full offline support for cached data

### SEO
- Clean URLs, per-route page titles, dynamic OG tags
- Sitemap and robots.txt for search engine indexing

### Data & Privacy
- All data stored locally in your browser (IndexedDB via Dexie.js)
- No accounts, no server — everything runs client-side
- Automatic migration from localStorage for existing users
- Debounced writes with crash-safe flush (beforeunload)
- Price data fetched directly from public APIs in the browser
- Per-type price staleness tracking — cards (24h), sealed/graded (12h)
- Terms & Conditions page with full Privacy Policy at [/terms](https://rarebox.io/terms)
- Vercel Analytics and Speed Insights for anonymized usage metrics (page views, Core Web Vitals — no cookies, no cross-site tracking)

### Feature Tour Videos
- In-app tutorial videos for Browse Sets and Decks pages
- Auto-play once on first visit
- Replay anytime via ⓘ info icon next to the page title
- Built with Manim Community Edition, rendered at 1080p60

## Performance

- Card database preloaded into IndexedDB — instant search with zero API calls for cached TCGs
- Set data cached in localStorage for 24h — instant load on return visits
- Multi-TCG API responses cached in memory (1h sets, 10min cards)
- pokemontcg.io responses trimmed with `select=` — 50-60% smaller payloads
- DNS prefetch for all external domains (APIs and CDNs)
- Chart rebuilds debounced (300ms), 404s cached as misses
- Daily price snapshots use cached prices only — zero API calls
- API calls batched — max 3-5 concurrent requests (no burst scraping)
- Retry with backoff on transient errors (429, 5xx, timeout) — 2 retries, 1s/2s delays
- 8s timeout on all external fetches (no hanging requests)
- Abort-on-unmount for in-flight API calls (no stale state updates)
- Two-phase preloader: sets first (~2s), then cards progressively per TCG
- Failed TCGs get 2 retries with exponential backoff

## Stack

- Vue 3 + Vite
- Pinia (state management)
- Dexie.js (IndexedDB persistence)
- ApexCharts (price/portfolio charts)
- Vue Router (navigation)
- XLSX (Excel export)
- Tesseract.js (OCR for camera scan)
- pokemontcg.io API (Pokémon card data + live prices)
- tcgdex API (Japanese sets/cards, price history Nov 2022+)
- Scryfall API (Magic sets/cards/prices, set symbol icons)
- Lorcast API (Lorcana sets/cards/prices)
- optcgapi API (One Piece sets/cards/market prices)
- YGOPRODeck API (Yu-Gi-Oh! sets/cards/prices)
- riftcodex.com API (Riftbound sets/cards/images)
- PriceCharting JSON API (sealed + graded prices for all TCGs)
- Pokellector CDN (Japanese set logos)
- Vercel (hosting + analytics)

## Multi-TCG Browse (architecture)

"Browse Sets" is a hub for multiple trading card games.

**Flow & routes**
- `/sets` → `BrowseView.vue` — landing page with branded tiles per TCG.
- `/sets/pokemon` → `SetsView.vue` — the full Pokémon experience (JP, variants, charts). **Untouched** — keep it separate.
- `/sets/:game` → `TcgSetsView.vue` — generic sets grid → cards grid (card images, live prices). Card "+ Add" opens `AddItemModal` via its `tcgCard` prop (pre-filled, game-tagged).

**Search** — `src/services/tcg/multiSearch.js`
Fans out to all TCG APIs in parallel, normalizes results to a common shape, sorts by name relevance, and paginates. When a TCG's data is cached in IndexedDB, searches that TCG locally instead of hitting the live API.

**Data layer** — `src/services/tcg/providers.js`
Each game is normalized to a uniform interface:
```
getSets()        -> [{ id, name, code, releaseDate, total, logo }]
getSetCards(id)  -> [{ id, name, number, image, price, rarity }]
```
`TCGS` (same file) drives the landing tiles with inline SVG brand logos.

**Status**

| TCG | Source | Status |
|-----|--------|--------|
| Pokémon | pokemontcg.io / tcgdex | ✅ dedicated `SetsView` with JP support |
| Magic | Scryfall (CORS `*`) | ✅ sets, cards, USD prices, set symbol icons |
| Lorcana | Lorcast (CORS `*`) | ✅ sets, cards, USD prices |
| One Piece | optcgapi (CORS allowed) | ✅ 20 sets, 3300+ cards, USD market prices |
| Yu-Gi-Oh! | YGOPRODeck (CORS `*`) | ✅ all sets, 13000+ cards, TCGPlayer prices |
| Riftbound | riftcodex.com (CORS `*`) | ✅ 7 sets, 1000+ cards, images from Riot CDN, PriceCharting prices |

**To add a TCG:** add a provider object (`getSets`/`getSetCards`) to
`providers.js`, register it in `PROVIDERS`, and add a `TCGS` entry with
`available:true` + `route:'/sets/<id>'`. Optionally add a preloader in
`cardPreloader.js`, an API endpoint in `multiSearch.js`, and a resolver in
`resolveCard()`. No view changes needed.

## Releases

- **[v1.3.0](https://github.com/novaoc/rarebox/releases/tag/v1.3.0)** — Yu-Gi-Oh! support (sets, cards, search, meta decks). Trade Analyzer (side-by-side comparison, camera scan). Collectr import (CSV/XLSX). Card database preloader with progress indicator. Price alerts with browser notifications. Entire set add to portfolio. Sealed product search improvements. Graded card multipliers. Storage usage display. Reset clears card cache. Navigation and transition fixes. **Critical bug fixes:** trade/portfolio state persistence conflict resolved (separate IDB keys), price alerts now auto-checked on dashboard, non-Pokemon cards refresh prices on dashboard load, Collectr import resolves all 6 TCGs. **Lorcana fixes:** meta deck cards load correctly (set field paths, version-aware name matching). **Riftbound fixes:** meta deck cards show correct images/sets/prices. 404 catch-all route. Dynamic imports hoisted per PR review.
- **[v1.2.0](https://github.com/novaoc/rarebox/releases/tag/v1.2.0)** — Riftbound TCG via riftcodex.com (7 sets, 1000+ cards, card images). Sealed products for all TCGs. Graded cards for all TCGs. Type filtering fix.
- **[v1.1.0](https://github.com/novaoc/rarebox/releases/tag/v1.1.0)** — Multi-TCG Browse & Search: Magic (Scryfall), Lorcana (Lorcast), One Piece (optcgapi) with live prices. Unified search across all TCGs. Graded cards for all TCGs. Brand logos. API caching + abort-on-unmount.
- **[v1.0.1](https://github.com/novaoc/rarebox/releases/tag/v1.0.1)** — Critical fix: Vue reactive proxies couldn't be serialized to IndexedDB
- **[v1.0.0](https://github.com/novaoc/rarebox/releases/tag/v1.0.0)** — First release. Full feature set: collections, decks, meta decks, pricing, charts, PWA, SEO, bulk import, backup/transfer, IndexedDB persistence

## Getting Started

```bash
npm install
npm run dev
```

Opens at http://localhost:5173

## Build

```bash
npm run build
```

## License

MIT
