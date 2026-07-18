# Spec: Visual Ownership Cues

## Purpose
Provide a clear visual indication of which cards in the grid view are owned by the user. Unowned cards should appear desaturated and slightly darkened to signal they are not in the collection.

## Design Requirements
* Implement as a **Vue 3 composable** (`useOwnershipCue`) that computes a CSS filter string based on a reactive `owned` boolean prop.
* CSS filter should combine:
  - `grayscale(100%)` to remove colour.
  - `brightness(85%)` to darken slightly.
* The filter must be applied to the card thumbnail `<img>` element via a `:style` binding.
* Touch targets must remain at least **44 px** tall/wide; the overlay must not shrink the image.
* Follow UI palette:
  - Background: `#fdfbf7` (Cream)
  - Text/Icons: `#1a1a1a` (Ink)
* Use **2 px solid** border with Ink color around each card.
* Provide a unit test that verifies the computed style string matches the expected value when `owned` is `false`.

## Implementation Steps
1. Add `src/composables/useOwnershipCue.ts` exporting a function that returns a reactive `filter` string.
2. Update the existing card component (`src/components/CardThumbnail.vue`) to import the composable and bind the computed style.
3. Add a Pinia store entry (`src/store/ownership.ts`) if needed for global ownership state (optional – the composable receives the prop directly).
4. Add a unit test under `tests/unit/useOwnershipCue.spec.ts` using Vitest.
5. Update Tailwind config if custom utilities are required (not needed for basic filter).
6. Run verification gates:
   - `npm run eval:harness`
   - `npm run eval:danger`
   - `npm run build`

## Acceptance Criteria
* When a card's `owned` prop is `true`, no CSS filter is applied (original thumbnail).
* When `owned` is `false`, the thumbnail receives `filter: grayscale(100%) brightness(85%);`.
* The component passes the unit test.
* The build succeeds with no lint errors.
