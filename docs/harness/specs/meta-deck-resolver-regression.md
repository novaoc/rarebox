# Meta Deck Resolver Index Regression

## Verified Problem
`resolve_cards_parallel` filters failed resolutions (`results = [r for r in ordered if r]`),
shortening the returned list. The caller in `build_pokemon_meta_decks` then uses
`enumerate(resolved_all)` against the original `card_deck_map` (which has one entry
per input card, including failures). This causes resolved cards to be appended to
the wrong deck after any failure in the batch.

Evidence: code inspection of `resolve_cards_parallel` and its caller showed that
failed resolutions shortened the result list while `card_deck_map` retained every
input. `scripts/evals/meta-deck-resolver.py` covers a failure between two successes.

## Scope
- Narrow fix in build_meta_decks.py only (no store, db, or runtime app paths)
- Add a deterministic regression eval to the standard harness
- No change to generated assets or network behavior

## Non-goals
- Regenerating meta-deck JSONs
- Changes for other games' resolvers
- UI or provenance label changes

## Risk
P2 pure logic; covered by regression; restricted paths untouched.

## Rollback
Close PR before merge; or `git revert <merge sha>` after.
