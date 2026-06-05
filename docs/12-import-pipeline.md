# Import Pipeline

Status:
Discovery Required

Goal:
After GitHub authorization, the user imports their starred repositories into the browser. Forage then normalizes the GitHub data, stores it in IndexedDB, and generates local reports.

Import model:
Each import is recorded as an import event. Repository data from that event is stored locally. A user can later request a refresh, but refresh work should run in the background and avoid aggressive API usage.

Initial source:
GitHub REST endpoint for repositories starred by the authenticated user.

Important API behavior to verify:
- Pagination with up to 100 records per page
- Rate limits and secondary rate limits
- Starred timestamp support
- Whether all required repository fields are present in the starred list response
- Whether additional repository detail calls are needed
- Whether private starred repositories appear with the selected authorization model

Import stages:
- Start authenticated import
- Fetch pages from GitHub
- Normalize repository records
- Write records to IndexedDB
- Record import event metadata
- Emit progress to the UI
- Report completion, cancellation, partial failure, or rate limit status

Browser Web Worker responsibilities:
- Pagination orchestration
- Retry and backoff
- Normalization
- IndexedDB writes
- Progress events
- Cancellation handling
- Conservative refresh scheduling

Rate-limit posture:
- Prefer fewer API calls over richer metadata during MVP.
- Avoid per-repository follow-up calls unless the initial API spike proves they are necessary.
- Support pause/resume or retry-later behavior when rate limits are reached.
- Keep refresh user-initiated at first, then consider scheduled/background refresh only after measuring API behavior.

Open implementation decisions:
- REST vs GraphQL after the initial spike
- Full reimport vs incremental refresh
- How to detect removed stars
- Whether to keep previous analysis when metadata changes
- Partial import recovery format
- Import metadata stored per run
