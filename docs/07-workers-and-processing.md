
# Browser Web Workers & Processing

Import Web Worker

Status:
Planned for pagination/orchestration hardening. Current imports are initiated from the web app and use shared import state contracts.

Responsibilities:
- GitHub pagination
- Data normalization
- IndexedDB writes
- Progress events
- Cancellation support
- Retry and backoff handling

Analysis Web Worker

Status:
Implemented for imported repository pages in `apps/web`

Responsibilities:
- Categorization
- Scoring
- Insight generation
- Persistable analysis result generation

UI Thread

Responsibilities:
- Rendering
- Filtering
- Searching
- User interaction

Goal:
Keep large imports responsive.

Cloudflare Workers are separate from these browser workers and should only handle backend auth/session/settings responsibilities.

Required follow-up:
- Move import pagination/orchestration into a browser worker.
- Keep REST as the MVP import path; revisit GraphQL only if future richer metadata needs justify it.
- Continue measuring pagination and rate-limit behavior on hosted imports.
- Decide incremental refresh behavior.
- Decide how partial imports are represented.
