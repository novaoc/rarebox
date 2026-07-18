# Spec: Dex View Mode

## Goal
Provide a compact grid view that highlights missing card numbers within a set, enabling users to quickly see completion progress.

## Component (`src/components/DexGridView.vue`)
* Props:
  - `setSize: number` – total number of cards in the set.
  - `ownedCards: number[]` – array of card numbers the user already has.
* Renders a CSS grid (`display: grid`) with evenly sized cells (44 px × 44 px) respecting the 44 px touch target rule.
* Each cell shows the card number. If the number is **not** in `ownedCards`, apply a visual cue:
  - Background: `#fdfbf7` (Cream) with a subtle `rgba(0,0,0,0.1)` overlay.
  - Border: `2px solid #1a1a1a` (Ink).
  - Text colour: Ink.
* Owned cards display normally (no overlay).
* Component emits an event `cardClick(cardNumber)` when a cell is tapped, allowing future actions (e.g., open card details).

## Styling
* Use Tailwind utilities where possible, falling back to scoped CSS for the overlay.
* Maintain 16 px base font size.

## Tests (`tests/unit/DexGridView.spec.ts`)
* Verify that missing cards receive the overlay class.
* Verify that clicking a missing card emits `cardClick` with the correct number.

## Verification Gates
* `npm run eval:harness`
* `npm run eval:danger`
* `npm run build`

## Acceptance Criteria
* The grid accurately reflects missing vs. owned cards.
* UI follows the Cream/Ink palette, 2 px borders, and 44 px touch targets.
* All unit tests pass and the build succeeds.
