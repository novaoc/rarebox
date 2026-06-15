## Summary

<!-- What changed, and why? -->

## Type of change

- [ ] Feature
- [ ] Fix
- [ ] Refactor
- [ ] Docs / harness only
- [ ] Data refresh / generated assets

## Agentic engineering checklist

- [ ] I read the relevant files and traced touched symbols before editing.
- [ ] I did not remove or degrade existing features without explicit direction.
- [ ] I checked whether this affects user data, imports, backups, snapshots, or IndexedDB.
- [ ] Search/browse still works before background preload finishes, or this PR does not touch search/preload.
- [ ] External API calls are cached/batched/timed out and degrade gracefully, or this PR does not touch APIs.
- [ ] UI changes follow Tactile tokens, hard-shadow/press rules, mobile touch targets, and no horizontal scroll.
- [ ] User-facing copy says “shelves” instead of “portfolios” where applicable.
- [ ] I updated AGENTS.md, docs, skills, or evals if this PR taught a durable lesson.

## Verification

Paste real command output or a concise summary:

- [ ] `npm run eval:harness`
- [ ] `npm run build`
- [ ] `npm run smoke:browser`

## Screenshots / recordings

<!-- Required for visible UI changes. -->

## Caveats / unverified areas

<!-- Say what you could not verify. Honest caveats beat fake confidence. -->
