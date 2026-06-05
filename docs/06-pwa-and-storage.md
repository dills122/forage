
# PWA & Storage Strategy

Primary storage location:

Browser

Technology:
- IndexedDB

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
- IndexedDB store names and schema versions
- Migration strategy
- Local data reset behavior
- Import/export merge behavior
- Browser quota handling
- Multi-tab safety
- Offline state and stale data indicators
- Whether category config ships with the app, syncs from the server, or both

Migration posture:
Use IndexedDB schema migrations when practical. If a future local schema migration would be disproportionately complex, the app may require a re-import from GitHub, but that should be treated as a fallback rather than the default strategy.
