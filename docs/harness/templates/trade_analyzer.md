# Spec: Trade Analyzer & Logging Module

## Goal
Provide a Pinia store to track trade states (cards offered vs. received), persist trade history locally with Dexie (IndexedDB), and expose a UI component visualizing net‑gain/loss using ApexCharts.

## Store (`src/stores/trades.ts`)
* Define a `Trade` interface with fields:
  - `id?: number` (auto‑increment primary key)
  - `offered: string[]` – card IDs the user offers
  - `received: string[]` – card IDs the user receives
  - `date: Date`
  - `netGain: number` – monetary gain (positive) or loss (negative)
* Create a Dexie database class `TradeDB` with a `trades` table keyed by `++id`.
* Export a Pinia store `useTradeStore` that:
  - Loads all trades from Dexie on init.
  - Provides actions `addTrade(trade)`, `clearHistory()`, `getHistory()`.
  - Keeps an in‑memory reactive array `trades` synced with IndexedDB.

## UI Component (`src/components/TradeAnalyzer.vue`)
* Imports the `useTradeStore`.
* Computes series data for ApexCharts:
  - X‑axis: trade date (ISO string)
  - Y‑axis: `netGain` values.
* Renders `<apexchart type="area" …>` with the tactile palette (Cream background, Ink axes, 2 px grid lines).
* Shows a summary table of total trades, total gain, total loss.
* Provides a button to clear history (calls `clearHistory`).

## Tests (`tests/unit/tradeStore.spec.ts`)
* Verify that adding a trade updates the store and Dexie correctly.
* Verify that `netGain` aggregation matches added trades.

## Verification Gates
* Run `npm run eval:harness`
* Run `npm run eval:danger`
* Run `npm run build`

## Acceptance Criteria
* Trades persist across page reloads via IndexedDB.
* The chart updates reactively when new trades are added.
* All unit tests pass.
* UI adheres to the Cream/Ink palette, 44 px touch targets, 2 px borders, and 16 px font size.
