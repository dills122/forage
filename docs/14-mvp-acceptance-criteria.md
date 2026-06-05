# MVP Acceptance Criteria

Forage MVP is ready for broader testing when a user can:

- Open the website.
- Authorize GitHub through the GitHub App flow.
- Import starred repositories for the authenticated user.
- See clear import progress.
- Recover from auth, rate-limit, cancellation, and partial-import states.
- Store repository data locally in IndexedDB.
- Record import event metadata locally.
- Refresh or re-run import without duplicating records.
- Generate category assignments.
- Generate user-agnostic versioned scores with explanations.
- View a dashboard with summary counts, filtering, sorting, scores, labels, and insight panels.
- Export JSON and CSV.
- Reset local data.
- Opt in or out of analytics/preferences.

Non-goals for MVP:
- AI-assisted analysis
- Saved cloud reports
- Server-side repository storage
- Full guided exploration
- Personalized Match Score
- Public category submission workflow
- GitHub Action

Technical acceptance:
- Shared core logic works outside the UI.
- Import and analysis run in browser Web Workers.
- Cloudflare Worker code is limited to auth/session/settings responsibilities.
- Repository data never persists in Cloudflare.
- Scoring/category outputs include version metadata.
- The app has tests for normalization, category matching, scoring, and import state transitions.
