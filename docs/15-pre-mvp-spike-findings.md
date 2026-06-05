# Pre-MVP Spike Findings

Source:
Local export from June 5, 2026.

Result:
The pre-MVP GitHub App authorization and starred repository import path is viable.

Validated assumptions:
- GitHub App user authorization works for the website flow.
- The authenticated starred repositories endpoint is reachable.
- `starred_at` is preserved for imported repositories.
- The starred repositories endpoint returns enough metadata for MVP normalization.
- Import can use one API request per page without per-repository detail calls.
- IndexedDB local storage works for the imported dataset.
- Browser Web Worker analysis can run against the imported data.
- JSON export works.

Observed import stats:
- Repositories imported: 719
- GitHub API pages: 8
- Import duration: about 16 seconds
- GitHub core rate limit used: 8 requests for the import
- GitHub core rate limit remaining after import: 4,985 of 5,000
- Import status: completed
- Import errors: none

Observed data completeness:
- `starred_at`: 719 of 719
- `topics`: 538 of 719
- `description`: 705 of 719
- `homepage`: 396 of 719
- `license`: 641 of 719
- `primary_language`: 685 of 719
- `owner_avatar_url`: 719 of 719
- `default_branch`: 719 of 719

Repository characteristics:
- Archived repositories: 63
- Disabled repositories: 0
- Forks: 1
- Private repositories: 0
- Repositories without language: 34
- Repositories without description: 14
- Repositories without license: 78

Top observed languages:
- JavaScript: 150
- TypeScript: 130
- Go: 64
- C#: 64
- Rust: 57
- Python: 44
- C: 28
- Shell: 23
- HTML: 21
- C++: 19

Top rough categories from the spike worker:
- Frontend: 317
- Developer Tooling: 254
- Backend: 254
- Security: 165
- DevOps: 102
- Data: 51
- Testing: 21
- Learning Resources: 8

Scoring observations:
- Current spike scoring range: 2 to 100
- Average score: about 76
- Score distribution:
  - 0-19: 11
  - 20-39: 20
  - 40-59: 218
  - 60-79: 65
  - 80-100: 405

Product implications:
- The API is sufficient for the first MVP without per-repository detail calls.
- Rate limiting is not a major concern for ordinary imports if the app keeps one request per page.
- Refresh can start as user-initiated and conservative.
- Category matching needs meaningful tuning; the first rules over-classify broad buckets like Frontend, Backend, Developer Tooling, and Security.
- Scoring needs better normalization because too many repositories currently land in the 80-100 range.
- `starred_at` enables useful rediscovery insights such as old stars, forgotten gems, and recently revived repositories.

Recommended next decisions:
- Lock the first normalized repository schema from the observed fields.
- Design a first real category config with weighted rules.
- Replace the spike score with versioned foundational scores.
- Add import-state handling for cancellation, retry, rate-limit pause, and partial import.
- Start the real app scaffold once the schema/category/scoring contracts are drafted.
