# CI And Quality Gates

Status:
Initial CI contract implemented

Purpose:
Keep local development, pull requests, and protected branch checks aligned around the same source of truth.

Required CI job:
- Workflow: `.github/workflows/check.yml`
- Trigger: pull requests targeting `main`, pushes to `main`, and manual dispatch
- Runtime: Node 22 and pnpm 10.23.0
- Install: `pnpm install --frozen-lockfile`
- Truth command: `npm run check`
- Coverage threshold: 75% lines, 75% branches, and 75% functions for package source loaded by package tests

Current `npm run check` coverage:
- Script syntax checks
- Pre-MVP JavaScript syntax checks
- Analysis review fixture check
- Documentation checks
- Workspace structure checks
- OpenTofu formatting for `infra/opentofu`
- Package tests with coverage
- Worker API contract tests
- Biome lint and format checks for JavaScript, TypeScript, CSS, and JSON
- Astro file formatting checks through Prettier and `prettier-plugin-astro`
- TypeScript and Astro type checks
- Production builds, including Cloudflare Worker dry-run build
- Local web build smoke checks

Current package test coverage:
- `@forage/analysis`: category matching, scoring versions, score bounds, stale/archived/disabled behavior
- `@forage/github`: starred repository request construction, pagination, normalization defaults, malformed items, API errors
- `@forage/reporting`: versioned JSON payloads, CSV escaping, missing analysis fields, generated export timestamps

Current Worker API contract coverage:
- OAuth `state` and PKCE verifier exchange
- CSRF rejection for authenticated mutations
- Production config diagnostics trimming
- Expired GitHub session reconnect behavior
- CORS allowed and rejected origins
- Secure OAuth/session cookie attributes
- Token material non-disclosure in session responses
- Account deletion for settings and active sessions
- Auth start throttling and retry metadata

Hosted smoke command:
- Script: `scripts/check-hosted-smoke.mjs`
- Command: `FORAGE_WEB_ORIGIN=https://forage.shrimpworks.dev FORAGE_WORKER_ORIGIN=https://api.forage.shrimpworks.dev pnpm smoke:hosted`
- Purpose: verify deployed Worker health, Worker CORS/preflight, unauthenticated session shape, OAuth start redirect/PKCE setup, Pages headers, CSP Worker origin, and basic rendered app HTML
- Staging can use `FORAGE_WEB_SMOKE_MODE=access-protected` when the web hostname is behind Cloudflare Access.
- This is not part of the default CI gate because it requires live hosted domains.

Local developer hooks:
- Husky installs the pre-commit hook through the root `prepare` script.
- The pre-commit hook runs `pnpm exec lint-staged`.
- `lint-staged` auto-fixes staged JavaScript, TypeScript, CSS, and JSON files with Biome.
- `lint-staged` formats staged `.astro` files with Prettier.

Formatter and linter choice:
- Use Biome instead of ESLint for the first JavaScript, TypeScript, CSS, and JSON lint/format pass.
- Keep Prettier narrowly scoped to `.astro` files because Astro CLI formatting still relies on `prettier-plugin-astro`.
- Do not introduce ESLint unless Biome misses a concrete rule category we need.

Branch protection expectation:
- `main` should require the Check workflow before merge.
- Direct pushes to `main` should remain blocked.
- PRs should include concrete verification notes using the repository PR template.

Self-check behavior:
- `scripts/check-workspace.mjs` verifies that the CI workflow exists and still runs the canonical install and check commands.
- This keeps future workflow edits honest by making CI contract drift visible in the same `npm run check` path.

Future gates:
- Raise package source coverage from 75% to 90% after the MVP worker/import state boundaries stabilize.
- Add package-level unit tests for IndexedDB migrations.
- Add browser smoke tests once the app has stable flows beyond the current import slice.
- Expand deployment preview checks after Cloudflare environment bindings are proven.
- Enable hosted smoke checks by default once Cloudflare domains are configured.
