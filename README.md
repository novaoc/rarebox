<p align="center">
  <img src="assets/rarebox-intro.gif" alt="Rarebox — Pokémon TCG Portfolio Tracker" width="640">
</p>

# Rarebox

Track your Pokemon TCG collection — cards, sealed products, and graded slabs — with live prices and portfolio charts.

**Live at [rarebox.io](https://rarebox.io)** · **Docs at [docs.rarebox.io](https://docs.rarebox.io)**

Built by [Nova](https://github.com/novaoc).

## Features

### Collection Management
- Add cards by searching any set — live results with card images and TCGPlayer prices
- Add sealed products (booster boxes, ETBs, tins) — prices and images fetched from PriceCharting
- Add graded slabs (PSA / BGS / CGC / ACE) — grade-specific pricing from PriceCharting
- Bulk import — paste a PTCGL/PTCGO deck list and add all cards at once
- Multiple named portfolios, each with a color and their own value chart
- Combined dashboard showing total collection value, cost basis, and gain/loss

### Deck Builder
- Create multiple named decks, add cards by search
- Track deck cost, ownership status (Need / Owned / ✓ Owned)
- Compare decks against your collection — shows which cards you already own
- Import current meta decks with one click

### Live Meta Decks
- Auto-fetches current tournament meta from Limitless TCG
- Shows top 8 competitive decks ranked by meta share and CP
- Core cards resolved server-side with exact card match (set code + number)
- Market prices from TCGPlayer for every card
- Cached for 24h — instant on repeat visits
- Updates automatically as tournament results shift

### Browse & Search
- Browse all TCG sets — English and Japanese, with set logos and card counts
- Click into any set to browse the full card list
- Search cards by name across all sets with live results

### Pricing & Charts
- Live card prices from pokemontcg.io, sealed/graded prices from PriceCharting
- Price history charts back to November 2022 (7D / 1M / 6M / 1Y / 3Y ranges)
- Portfolio value-over-time chart with daily price snapshots (3 years retained)

### Export & Backup
- Export individual portfolios to Excel (summary + items sheets)
- Export all portfolios to a single Excel file
- Backup entire collection as JSON — download and restore on any device
- Transfer to device — gzip-compressed QR code or clipboard copy/paste for moving collections between devices
- Stale data cleanup — deleted cards don't linger in snapshots or backups

### Mobile
- Touch-friendly card grids with persistent overlay buttons on touch devices
- Bottom sheet panels for card details, search results, and portfolio items
- Responsive charts, stacked headers, column hiding on smaller screens

### PWA — Add to Home Screen
- Installable as a standalone app on Android and iOS
- Auto-detects platform and shows relevant install option

### SEO
- Clean URLs, per-route page titles, dynamic OG tags
- Sitemap and robots.txt for search engine indexing

### Data & Privacy
- All data stored locally in your browser (IndexedDB via Dexie.js)
- No accounts, no server — everything runs client-side
- Automatic migration from localStorage for existing users
- Debounced writes with crash-safe flush (beforeunload)
- Price data fetched directly from public APIs in the browser
- Price alerts — set thresholds on cards, get browser notifications when prices cross them
- Per-type price staleness tracking — cards (24h), sealed/graded (12h)
- Terms & Conditions page with full Privacy Policy at [/terms](https://rarebox.io/terms)
- Vercel Analytics and Speed Insights for anonymized usage metrics (page views, Core Web Vitals — no cookies, no cross-site tracking)

### Feature Tour Videos
- In-app tutorial videos for Browse Sets and Decks pages
- Auto-play once on first visit
- Replay anytime via ⓘ info icon next to the page title
- Built with Manim Community Edition, rendered at 1080p60

## Performance

- Set data cached in localStorage for 24h — instant load on return visits
- pokemontcg.io responses trimmed with `select=` — 50-60% smaller payloads
- DNS prefetch for all external domains (APIs and CDNs)
- In-memory API cache with 1h TTL for card/detail fetches
- Chart rebuilds debounced (300ms), 404s cached as misses
- Daily price snapshots use cached prices only — zero API calls
- API calls batched — max 3-5 concurrent requests (no burst scraping)
- Retry with backoff on transient errors (429, 5xx, timeout) — 2 retries, 1s/2s delays
- 15s timeout on all external fetches (no hanging requests)

## Stack

- Vue 3 + Vite
- Pinia (state management)
- Dexie.js (IndexedDB persistence)
- ApexCharts (price/portfolio charts)
- Vue Router (navigation)
- XLSX (Excel export)
- pokemontcg.io API (card data + live prices)
- tcgdex API (Japanese sets/cards, price history Nov 2022+)
- PriceCharting JSON API (sealed + graded prices)
- Scryfall API (Magic sets/cards/prices) · Lorcast API (Lorcana sets/cards/prices)
- Pokellector CDN (Japanese set logos)
- Vercel (hosting + analytics)

## Multi-TCG Browse (architecture)

"Browse Sets" is a hub for multiple trading card games, not just Pokémon. For
agents/models continuing this work:

**Flow & routes**
- `/sets` → `BrowseView.vue` — landing page with a branded tile per TCG.
- `/sets/pokemon` → `SetsView.vue` — the original, full Pokémon experience (JP, variants, charts). **Untouched** — keep it separate.
- `/sets/:game` → `TcgSetsView.vue` — generic sets grid → cards grid (live prices), mirroring the Pokémon UX. Card "+ Add" opens `AddItemModal` via its `tcgCard` prop (pre-filled, game-tagged single).

**Data layer** — `src/services/tcg/providers.js`
Each game is normalized to a uniform interface so one UI serves all:
```
getSets()        -> [{ id, name, code, releaseDate, total, logo }]
getSetCards(id)  -> [{ id, name, number, image, price, rarity }]
```
`TCGS` (same file) drives the landing tiles; `available:false` renders "coming soon".

**Status (English only; JP deferred)**

| TCG | Source | Status |
|-----|--------|--------|
| Pokémon | pokemontcg.io / tcgdex (existing) | ✅ dedicated `SetsView` |
| Magic | Scryfall (`api.scryfall.com`, CORS `*`) | ✅ browser-direct: sets, cards, USD prices, images |
| Lorcana | Lorcast (`api.lorcast.com`, CORS `*`) | ✅ browser-direct: sets, cards, USD prices, images |
| One Piece | optcgapi / apitcg.com | 🔜 deferred — see below |
| Riftbound | none | 🔜 no public API yet |

**To add a TCG:** add a provider object (`getSets`/`getSetCards`) to
`providers.js`, register it in `PROVIDERS`, and add a `TCGS` entry with
`available:true` + `route:'/sets/<id>'`. No view changes needed.

**One Piece notes (deferred):** optcgapi.com has card data + market prices but
(a) no CORS — browser can't call it, and (b) Cloudflare blocks datacenter IPs —
a Vercel serverless proxy gets a challenge page (verified). apitcg.com works
from servers but needs a registered API key. Wire it up once a key/source is
available; the `getSetCards` shape is ready for it. JP languages for the
non-Pokémon TCGs are also a future task.

## Releases

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
