
# Roadmap

Phase 0
- Planning
- Architecture
- Repository Setup
- GitHub App auth/privacy design
- GitHub API spike
- Import/storage spike

Phase 1
- Core Engine
- Models
- Categorization
- Scoring
- Reporting

Phase 2
- CLI Harness
- Testing
- Local Analysis

Phase 3
- Run Against Real GitHub Accounts
- Refine Categories
- Refine Insights

Phase 4
- Astro Application
- GitHub authorization
- Cloudflare Infrastructure

Phase 5
- Dashboard Experience
- Search
- Filters
- Exports

Phase 6
- Analytics
- Preferences
- Opt-Out Support

Future
- Saved Views
- Category Requests
- GitHub Action
- AI-assisted features (optional)

Recommended first technical spike:
- Create GitHub App authorization proof of concept.
- Fetch starred repositories for the authenticated user.
- Preserve starred_at when available.
- Store normalized records in IndexedDB.
- Record import event metadata.
- Run a minimal browser analysis worker.
- Export JSON.
