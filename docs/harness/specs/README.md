# Harness feature specs

Phase 0 documents under this folder. Most files are **upcoming feature specs**
(following `docs/harness/templates/feature-spec.md`). One file is a **closed
regression record**, not planned work.

Specs separate **verified live-code facts** from **planned** behavior. They are
specifications only — not implementation claims.

| Doc | Kind | Summary |
|-----|------|---------|
| [trade-history.md](./trade-history.md) | Feature spec | Log Trade Analyzer sessions into bounded history on existing `trade_state` |
| [master-set-compact-mode.md](./master-set-compact-mode.md) | Feature spec | Optional compact gallery density; canonical cards only |
| [shelf-link-polish.md](./shelf-link-polish.md) | Feature spec | Same-device shelf copy-link + not-found; no cross-device host |
| [pokemon-standard-legality.md](./pokemon-standard-legality.md) | Feature spec | Deck-builder Pokémon Standard card-eligibility advisory via versioned offline data |
| [meta-deck-resolver-regression.md](./meta-deck-resolver-regression.md) | **CLOSED** regression record | Positional `None` resolver fix + harness eval already wired |

User-facing copy in specs uses **shelves** (not “portfolios”). Code identifiers may keep legacy `portfolio` naming.
