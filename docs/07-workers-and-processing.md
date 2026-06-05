
# Browser Web Workers & Processing

Import Web Worker

Responsibilities:
- GitHub pagination
- Data normalization
- IndexedDB writes
- Progress events
- Cancellation support
- Retry and backoff handling

Analysis Web Worker

Responsibilities:
- Categorization
- Scoring
- Insight generation
- Report preparation

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
- Decide REST vs GraphQL for import.
- Confirm pagination and rate-limit behavior.
- Decide incremental refresh behavior.
- Decide how partial imports are represented.
