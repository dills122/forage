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

Current `npm run check` coverage:
- Script syntax checks
- Pre-MVP JavaScript syntax checks
- Documentation checks
- Workspace structure checks
- Biome lint and format checks for JavaScript, TypeScript, CSS, and JSON
- Astro file formatting checks through Prettier and `prettier-plugin-astro`
- TypeScript and Astro type checks
- Production builds, including Cloudflare Worker dry-run build

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
- Add package-level unit tests for GitHub normalization, category matching, scoring, IndexedDB migrations, and exports.
- Add browser smoke tests once the app has stable flows beyond the current import slice.
- Add deployment preview checks when Cloudflare environment bindings are defined.
