# Rarebox Review Checklist

## Process

- [ ] Relevant files were read before editing.
- [ ] Symbol definitions/usages were traced.
- [ ] Existing user changes were respected.
- [ ] No unrelated refactors or feature removals.

## Product invariants

- [ ] Local-first data remains local-first.
- [ ] No account or analytics dependency was introduced.
- [ ] Search/browse is usable before background preload completes.
- [ ] External API failures degrade gracefully.
- [ ] User-facing copy says “shelves” where applicable.

## Data safety

- [ ] Pinia state is mutated through store actions, not external ref assignment.
- [ ] IndexedDB writes are intentional and compatible with existing users.
- [ ] Backup/import compatibility was considered.
- [ ] Prototype-pollution / hostile input paths are guarded.
- [ ] Zero prices remain valid when relevant.

## API safety

- [ ] Requests are cached.
- [ ] Concurrency is bounded.
- [ ] Timeouts/retries exist for transient failures.
- [ ] 404/miss caching is used where repeated misses are likely.
- [ ] Provider quirks are documented in code/docs/skills if durable.

## UI / Tactile

- [ ] Tokens used instead of hardcoded colors.
- [ ] 2px borders + hard shadows preserved.
- [ ] Touch targets are 44px-ish or better.
- [ ] Mobile works at narrow widths without horizontal overflow.
- [ ] Focus/reduced-motion states are respected.

## Verification

- [ ] `npm run eval:harness`
- [ ] `npm run eval:danger`
- [ ] `npm run build`
- [ ] `npm run smoke:browser` for route/app-shell/UI changes
- [ ] Manual checks documented with exact routes/actions

## Report

Include:
- files changed
- commands run and results
- assumptions
- unverified gaps
- follow-up recommendations
