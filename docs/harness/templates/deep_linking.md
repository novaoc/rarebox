# Spec: Deep Linking

## Goal
Enable shareable URLs that encode a specific portfolio or set view, allowing users to navigate directly to that collection.

## Router Configuration (`src/router/index.ts`)
* Use Vue Router (v4) with history mode.
* Define a route:
  ```ts
  {
    path: '/portfolio/:id',
    name: 'Portfolio',
    component: () => import('../views/PortfolioView.vue'),
    props: true,
  }
  ```
* The `:id` param represents a UUID or slug for the portfolio.
* Add a fallback route for the home page (`/`).

## View Component (`src/views/PortfolioView.vue`)
* Accepts `id` prop from the router.
* On `setup`, fetch portfolio data from IndexedDB (via a Pinia store or Dexie directly).
* Render the portfolio using existing components (e.g., `CardThumbnail`, `TradeAnalyzer`).
* If the `id` is not found, show a user‑friendly “Portfolio not found” message.

## URL Generation Helper (`src/utils/deepLink.ts`)
* Export a function `generatePortfolioLink(id: string): string` that returns `${window.location.origin}/portfolio/${id}`.
* Use this helper wherever a shareable link is needed (e.g., copy‑to‑clipboard button).

## UI Integration
* Add a button in the portfolio header that copies the generated link to the clipboard.
* Ensure the button meets the 44 px touch target rule and uses the Cream/Ink palette.

## Tests (`tests/unit/deepLinking.spec.ts`)
* Verify `generatePortfolioLink` creates the correct URL.
* Verify the router resolves `/portfolio/abc123` to the `PortfolioView` with prop `id='abc123'`.

## Verification Gates
* `npm run eval:harness`
* `npm run eval:danger`
* `npm run build`

## Acceptance Criteria
* Visiting a generated URL loads the appropriate portfolio without errors.
* UI adheres to palette, borders, and touch‑target standards.
* All unit tests pass and the build succeeds.
