# ADR 0002: Local-First Repository Data

Status:
Accepted

Context:
Forage's privacy promise depends on not storing a user's repository list, analysis results, reports, or exports on the server.

Decision:
Store imported repository data and generated analysis in browser IndexedDB. Cloudflare may store only auth/session state, a non-obvious GitHub user hash, preferences, small settings, and aggregate analytics if enabled.

Consequences:
- Repository data remains local to the browser.
- Backup and restore must be supported through export/import.
- IndexedDB schema migrations are required.
- Some future cross-device features are out of scope unless the privacy model is revisited.

Validation:
The pre-MVP spike stored and exported 719 repositories locally.
