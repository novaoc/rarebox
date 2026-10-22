# Runtime and dependency security correction

## Evidence and scope
PR 66 used >=22.23.0, which permits Node versions affected by the October Brotli advisory CVE-2026-111497. npm audit reports seven vulnerable packages through Tailwind 3; braces 3.0.3 has no published fixed version. The Vercel CLI currently rejects the saved token; private project settings and environment-variable exposure cannot be attested.

## Verification evidence
- Patched scoped runtime: Node v22.23.4; system Homebrew Node remains v22.22.0. Homebrew currently offers only 22.23.3, below the security floor, so it was not upgraded or globally replaced.
- `npm ci`, `npm audit` (all dependencies), and `npm audit --omit=dev`: exit 0; zero vulnerabilities.
- `npm run eval:harness`, `npm run eval:danger`, `npm run build`, `npm run smoke:browser`: exit 0.
- Old Homebrew Node executes `scripts/check-node-runtime.mjs` with exit 1 as intended; patched runtime passes.
- Automated computed-style comparison against the pre-migration build: 5 routes × 2 viewports × 2 themes; 362 element comparisons; no differences across the inspected typography/color/border/radius/padding/display properties. This is sampled coverage, not a full pixel-perfect proof.
- Removed vulnerable Tailwind 3 dependency chain through official Tailwind 4/PostCSS migration. Config colors preserved as CSS theme variables and generated border compatibility retained.
- Existing Vite bundle-size/static-dynamic import warnings remain unrelated to security.

## Host limits
Public production HTTPS returned 200 with HSTS, frame denial, nosniff, referrer and permissions policies. Repo contains Python serverless APIs; it is not a backend-free app. Private Vercel runtime/settings/environment review is blocked by invalid CLI authentication. No claim of absence of secrets, no secret rotation, and no production deployment/merge performed by this work.

## Acceptance criteria
- Select a bounded supported Node LTS line with minimum patched version 22.23.4 (vendor advisory).
- Clean npm ci and npm audit on that runtime; no audit suppression or unsafe forced dependency overrides.
- Use official Tailwind migration if required; preserve Tactile styling, application behavior, mobile layout, dark theme, and local data compatibility.
- Run harness, danger tripwire, production build and browser smoke; inspect resulting CSS and UI compatibility.
- Keep changes limited to build dependencies/configuration and directly necessary CSS/template compatibility.
- Verify GitHub checks and Vercel preview at the final commit. Do not equate preview success or public HTTP headers with private host security attestation.
- Correct misleading PR description; report host-auth blocker explicitly. No secret rotation, production merge or deployment setting changes without separate authorization/access.
