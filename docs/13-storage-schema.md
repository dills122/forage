# Storage Schema

Status:
Discovery Required

Primary storage:
IndexedDB in the user's browser.

Local data classes:
- Repository metadata
- Import runs
- Import events
- Category config
- Category assignments
- Score results
- Insight results
- Export metadata
- Local app preferences that do not need server persistence

Server data classes:
- Auth/session state
- Non-obvious GitHub user hash
- Opt-in or opt-out preferences
- Small settings records
- Aggregate analytics if enabled

Required schema properties:
- Versioned stores
- Migration path
- Clear reset behavior
- Import/export compatibility version
- Score version
- Category config version

Migration posture:
Use forward migrations for local IndexedDB data when practical. If a future schema change is too large or risky to migrate safely, Forage may require a local reset and GitHub re-import, but that should be exceptional.

Backup and restore:
JSON export should be the first supported full-state backup format. Restore should validate schema version, show incompatible version errors clearly, and avoid silently merging incompatible data.

Open implementation decisions:
- Exact IndexedDB store names
- Indexes needed for search/filter/sort
- Data retention policy
- Browser quota warning behavior
- Multi-tab locking behavior
- Whether generated exports are stored locally or generated on demand
