# Code Audit

Status:
Refactor follow-up notes after the Astro/Svelte island migration, local reliability work, and Worker module split.

Audit date:
June 6, 2026

Primary concerns found and current status:

- Local-first display was too dependent on Worker availability. The app previously loaded Worker config/session and local IndexedDB data in one `Promise.all`; if the Worker was down, already-imported local data could fail to refresh into UI state. This slice separates local data reads from remote auth/config reads.
- Import refresh only upserted repositories. Completed refreshes could leave repositories that were no longer starred in the local library. This slice adds local reconciliation after a successful full import.
- The main Svelte island was too broad. `ForageApp.svelte` previously owned auth state, import orchestration, export generation, filtering, derived analysis, settings, theme behavior, and most rendering. This has been partially resolved by moving app state, refresh, export, theme, and import pipeline logic into focused modules.
- The Cloudflare Worker entrypoint was too broad. `apps/worker/src/index.ts` previously owned routing, OAuth, sessions, settings, CORS/security headers, rate limiting, crypto helpers, storage coordination, GitHub proxying, and the Durable Object. This has been resolved by splitting route handlers, support modules, and Durable Object logic by concern.
- Import and reset now use a browser-wide local data lock. The app prefers the Web Locks API and falls back to an IndexedDB metadata lock with stale-lock expiry.
- The Worker session store uses in-memory storage only when Cloudflare storage bindings are absent for local development. Hosted deployments should use the Durable Object-backed encrypted session path.
- Local database migrations are still minimal. Dexie now owns the browser database wrapper, but we should treat any schema version bump as a planned migration with a fixture-backed test.

Current refactor standards:

- Prefer configuration and named constants over inline magic strings, route paths, storage keys, score weights, limits, TTLs, labels, and status text.
- Keep constants close to the owning module when they are private implementation details, and promote them to a typed config module when shared across handlers, workers, packages, or tests.
- Make user-facing behavior changes through typed config structures where possible, especially category rules, scoring weights, rate limits, storage keys, and security header policy.
- Pair config extraction with focused tests so changing a config value has an obvious expected behavior.

Near-term design recommendations:

- Continue splitting `ForageApp.svelte` only when new UI surfaces add real complexity. The current app shell is acceptable after the orchestration split.
- Keep import refresh as full reconciliation for MVP. Add incremental refresh only after there is a measured need and a clear stale-star detection model.
- Add restore/import-from-export only after JSON schema validation is explicit and tested.
- Keep local schema migration work fixture-backed now that the browser database is split into a facade plus focused store modules.
- Treat future category and scoring tuning as config changes first now that analysis versions, category rules, scoring weights, thresholds, and label cutoffs are in typed config modules.

Resolved in this slice:

- Added Dexie-backed local data tests using fake IndexedDB.
- Added completed-import reconciliation for stale repositories and stale analysis rows.
- Kept failed and cancelled imports from pruning existing local data.
- Added browser-wide locking around import and reset workflows.
- Updated import/storage docs to match the current implementation.
- Split web app orchestration, export, theme, refresh, and import pipeline logic into focused modules.
- Split Worker support modules, route handlers, Durable Object logic, and test helpers by concern.
- Split browser local data storage into a public DB facade plus schema, repository, import-event, analysis-result, profile, operation-lock, and reset modules.
- Extracted analysis plan/version constants, category rules, and scoring weights/thresholds into typed config modules.
