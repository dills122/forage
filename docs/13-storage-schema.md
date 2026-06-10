# Storage Schema

Status:
Initial browser schema implemented

Primary storage:
IndexedDB in the user's browser.

Current browser database:
- Name: `forage`
- Version: `3`
- Store contract: exported from `apps/web/src/lib/db-schema.ts`

Local data classes:
- Repository metadata
- Import events
- Versioned repository analysis results
- Local library profile metadata
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

The current test suite includes a fixture-backed upgrade check from the previous v2 local schema into the current v3 schema. Any future browser database version bump should add a matching fixture test that proves existing repository, import event, profile, and analysis records are either preserved or intentionally migrated.

Backup and restore:
JSON export should be the first supported full-state backup format. Restore should validate schema version, show incompatible version errors clearly, and avoid silently merging incompatible data.

Open implementation decisions:
- Indexes needed for search/filter/sort
- Data retention policy
- Browser quota warning behavior
- Multi-tab locking behavior
- Restore/import from a previous Forage export

Current IndexedDB stores:
- `repositories`
  - Key: `github_id`
  - Indexes: `full_name`, `primary_language`, `starred_at`
- `importEvents`
  - Key: `id`
- `analysisResults`
  - Key: `repository_id`
  - Indexes: `repository_full_name`, `analysis_version`
- `metadata`
  - Key: `id`
  - Current records: `local-library-profile`, `local-operation-lock`

Current server settings behavior:
- `GET /api/settings` returns the authenticated session's settings.
- `PUT /api/settings` updates the authenticated session's settings.
- `analytics_enabled` defaults to `false`.
- If `SETTINGS_KV` is bound, settings persist in Cloudflare KV under a salted SHA-256 GitHub user id hash.
- If `SETTINGS_KV` is not bound, settings use `in-memory-dev` session storage for local development.
- `SETTINGS_HASH_SALT` should be set in deployed environments; the Worker falls back to `GITHUB_CLIENT_SECRET` when no dedicated salt is configured.

Current server session behavior:
- If `AUTH_COORDINATOR` is bound, sessions persist in a Cloudflare Durable Object under opaque session ids.
- Session records are AES-GCM encrypted with `SESSION_ENCRYPTION_KEY`, falling back to `GITHUB_CLIENT_SECRET` for local/dev compatibility.
- Session records use an 8-hour maximum lifetime and are capped by the GitHub access token expiry.
- OAuth state records include the PKCE verifier, use a 10-minute lifetime, and are deleted on callback validation.
- If `AUTH_COORDINATOR` is not bound, `SESSION_KV` and `OAUTH_STATE_KV` can be used as fallback stores.
- If no Cloudflare storage is bound, the Worker uses in-memory development stores.
- `DELETE /api/account` deletes the settings record and active session records for the authenticated user's salted GitHub user id hash.

Current export behavior:
- Exports are generated on demand.
- JSON exports include repositories, latest import event, local library profile, and current analysis results.
- CSV exports include repository, category, and score fields for spreadsheet review.
- If stored analysis is missing for a repository, export calculates analysis with the current analysis version.
