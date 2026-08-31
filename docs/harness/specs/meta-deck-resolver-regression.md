# CLOSED: Meta Deck Resolver Index Regression

**Status: CLOSED** — fix and harness coverage are already in the tree. This file is a durable regression record, not an open feature spec.

## Problem (historical)

`resolve_cards_parallel` previously filtered failed resolutions out of the returned list (e.g. dropping falsy entries). That shortened the result relative to the input. The Pokémon caller then zipped resolved cards against `card_deck_map` by index, so any failure shifted later cards onto the wrong deck.

## Current fix (verified live code)

| Piece | Behavior | Evidence |
|-------|----------|----------|
| `resolve_cards_parallel` | Returns a **positional list** the same length as the input; failures stay as `None` at their index | `scripts/build_meta_decks.py` — `ordered = [None] * len(tasks)`; `results = ordered` |
| Caller `scrape_pokemon` | Enumerates `resolved_all` and **skips `None` by index** before appending to `deck_cards[deck_idx]` | same file — `if resolved is None: continue` |
| Harness eval | Asserts length alignment and that a middle failure remains `None` between two successes | `scripts/evals/meta-deck-resolver.py` |
| Harness wiring | Eval is already listed in the standard harness runner | `scripts/evals/run-all.mjs` — `python3 scripts/evals/meta-deck-resolver.py` |

No open work remains for this regression. Do not re-open as a feature unless a new misalignment is reproduced.

## Scope of the closed change

- Narrow logic in `scripts/build_meta_decks.py` only (build-time meta decks; not app store/db/runtime paths).
- Deterministic regression eval under `scripts/evals/`.
- No change required to generated assets solely because of this record.

## Non-goals (still)

- Regenerating meta-deck JSONs as part of “closing” this note.
- Changes for other games’ resolvers beyond the shared `resolve_cards_parallel` contract.
- UI or provenance label changes.

## Risk / rollback

- P2 pure build-script logic; covered by regression eval.
- If a future edit reintroduces filtering of `None`, `scripts/evals/meta-deck-resolver.py` must fail in `npm run eval:harness`.
- Rollback of the fix would be a normal code revert of the resolver/caller; this doc stays as the failure mode description.

## Acceptance (already met)

- [x] Failed resolutions retain index positions (`None`).
- [x] `scrape_pokemon` skips `None` without shifting deck membership.
- [x] `scripts/evals/meta-deck-resolver.py` is wired into `run-all.mjs`.
