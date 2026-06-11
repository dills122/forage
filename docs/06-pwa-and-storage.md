
# PWA & Storage Strategy

Status:
Initial local-first storage implemented

Primary storage location:

Browser

Technology:
- IndexedDB
- Dexie in `apps/web/src/lib/db-schema.ts`

Current database:
- Name: `forage`
- Version: `3`
- Stores: `repositories`, `importEvents`, `metadata`, `analysisResults`

Stored locally:

- Repository data
- Import events
- Analysis results
- Categories
- User exports
- Computed insights

Server storage:

- GitHub token material or token references
- Non-obvious GitHub user hash
- OAuth state
- Session state
- Analytics preferences
- Small application settings
- Aggregate analytics

Never stored:

- Repository lists
- Analysis results
- User exports

Backup & Restore:

Export State
→ JSON export

Import State
→ Restore application state

Open storage decisions:
- Local data reset behavior
- Import/export merge behavior
- Browser quota handling
- Multi-tab safety
- Offline state and stale data indicators
- Whether category config ships with the app, syncs from the server, or both

Implemented storage decisions:
- Repository records, import events, analysis results, local library profile, and local operation lock metadata live in browser IndexedDB.
- Server settings are limited to small preferences and analytics opt-in state.
- The current test suite includes a fixture-backed migration check from the previous v2 local schema into v3.
- Local reset clears browser-local repository and analysis data without requiring server-side repository deletion because repository data is never uploaded.

Migration posture:
Use IndexedDB schema migrations when practical. If a future local schema migration would be disproportionately complex, the app may require a re-import from GitHub, but that should be treated as a fallback rather than the default strategy.
