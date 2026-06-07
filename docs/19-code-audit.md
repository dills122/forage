# Code Audit

Status:
Initial reliability audit after the Astro/Svelte island migration.

Audit date:
June 6, 2026

Primary concerns found:

- Local-first display was too dependent on Worker availability. The app previously loaded Worker config/session and local IndexedDB data in one `Promise.all`; if the Worker was down, already-imported local data could fail to refresh into UI state. This slice separates local data reads from remote auth/config reads.
- Import refresh only upserted repositories. Completed refreshes could leave repositories that were no longer starred in the local library. This slice adds local reconciliation after a successful full import.
- The main Svelte island is too broad. `ForageApp.svelte` currently owns auth state, import orchestration, export generation, filtering, derived analysis, settings, theme behavior, and most rendering. This is acceptable for the spike-to-MVP transition but should be split before report-building work grows.
- Import and reset now use a browser-wide local data lock. The app prefers the Web Locks API and falls back to an IndexedDB metadata lock with stale-lock expiry.
- The Worker session store is in-memory for local development. This is fine for the current local app loop, but production deployment needs explicit Cloudflare storage/session design before it is relied on.
- Local database migrations are still minimal. Dexie now owns the browser database wrapper, but we should treat any schema version bump as a planned migration with a fixture-backed test.

Near-term design recommendations:

- Split `ForageApp.svelte` into smaller components before adding report views: import controls, library filters, repository list, metrics, settings, and app-state/domain helpers.
- Move pure library filtering/sorting helpers out of the component and test them directly.
- Keep import refresh as full reconciliation for MVP. Add incremental refresh only after there is a measured need and a clear stale-star detection model.
- Add restore/import-from-export only after JSON schema validation is explicit and tested.

Resolved in this slice:

- Added Dexie-backed local data tests using fake IndexedDB.
- Added completed-import reconciliation for stale repositories and stale analysis rows.
- Kept failed and cancelled imports from pruning existing local data.
- Added browser-wide locking around import and reset workflows.
- Updated import/storage docs to match the current implementation.
