# Import Pipeline

Status:
Initial import worker orchestration implemented

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

Import state contract:
- `packages/core` owns the pure import run state helpers.
- Current terminal states are `completed`, `failed`, `cancelled`, and `rate_limited`.
- The web app uses this contract for visible import progress, cancellation, failure, and rate-limit terminal states.
- Rate-limited runs preserve retry timing when the Worker or GitHub response provides `Retry-After`, `retry_after_seconds`, or GitHub rate-limit reset metadata.

Retry model:
- The web import worker may retry narrow transient failures: request timeout, network fetch failure, and 5xx worker/GitHub proxy responses.
- Authentication failures, validation failures, user cancellation, and rate-limit responses are not retried automatically.
- Retry delays are bounded by the web import retry policy so background import work does not quietly wait for long windows.

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
- Full reimport is the MVP refresh model; completed imports reconcile local data to remove repositories that are no longer starred.
- Whether to keep previous analysis when metadata changes
- Partial import recovery format
- Import metadata stored per run
