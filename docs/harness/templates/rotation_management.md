# Spec: Rotation Management

## Goal
Provide UI tags and alerts that indicate whether a card is legal in the current Standard rotation.

## Component (`src/components/LegalityTag.vue`)
* Props:
  - `isStandardLegal: boolean` – true if the card complies with the current Standard format.
  - `legalUntil?: string` – optional ISO date indicating when legality expires.
* Renders a pill‑shaped badge (height 28 px, min‑width 44 px) with:
  - **Legal**: background `#fdfbf7` (Cream), border `2px solid #1a1a1a` (Ink), text “Legal”.
  - **Illegal**: background `#ffebeb` (light red), border `2px solid #ff5a5a`, text “Illegal”.
* If `legalUntil` is provided and the date is within 30 days, show an additional warning icon (⚠️) and a tooltip “Expires soon”.
* Ensure touch target ≥44 px and font size 16 px.

## Integration
* Cards/components can import and display this tag, passing the result of a utility function that checks legality based on a static list (e.g., `src/utils/legality.ts`).

## Tests (`tests/unit/LegalityTag.spec.ts`)
* Verify correct rendering for legal and illegal states.
* Verify warning appears when `legalUntil` is near.

## Verification Gates
* Run `npm run eval:harness`
* Run `npm run eval:danger`
* Run `npm run build`

## Acceptance Criteria
* The badge respects the UI palette and sizing rules.
* All unit tests pass.
* Build succeeds.
