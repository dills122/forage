
# Dashboard & UX

Primary philosophy:

Data dashboard first.
Guided exploration second.

Dashboard Sections:

Summary Cards
- Total Repositories
- Categories
- Languages
- Archived Count
- Active Count

Results Table
- Search
- Filters
- Sorting
- Categories
- Scores
- Insight Labels

Insight Panels
- Forgotten Gems
- Worth Revisiting
- Ancient Relics
- Interesting Oddities

Exports
- JSON
- CSV

Current implemented states:
- Authenticated and disconnected sessions
- Local library owner messaging
- Initial loading/hydration
- Import progress
- Import cancellation
- Rate-limit terminal state
- No matching results
- Local data reset confirmation
- JSON and CSV export actions

Future:
More guided exploration experiences, Markdown export, and HTML report export.

Deferred but required UX states:
- Empty state
- GitHub auth failure
- Rate limit warning
- Partial import recovery
- Export success and failure
- Offline or stale data state

MVP UX can stay utilitarian at first, but these states should exist before a public release.
