
# Roadmap

Status:
Current MVP hardening roadmap

Completed:
- Planning, architecture, and repository setup.
- GitHub App auth/privacy design.
- Pre-MVP GitHub API import and IndexedDB storage spike.
- Real Astro/Svelte web app scaffold.
- Cloudflare Worker auth/session/settings/API boundary.
- Shared contracts and package structure.
- REST starred repository import, normalization, local storage, and import events.
- Category matching, user-agnostic scoring, labels, and analysis details.
- Dashboard summary, search, filters, sorting, details, JSON export, and CSV export.
- CI, coverage, formatting, type checks, builds, OpenTofu format checks, and hosted smoke script.
- Cloudflare hosting/security docs, OpenTofu configuration, staging Access posture, and deploy workflow.

Current:
- Import resilience and recovery UX.
- First-run, reconnect, and local-library ownership UX.
- Hosted staging verification and production deploy rehearsal.
- Real account analysis review for category and score tuning.
- Security/privacy regression checks before broader testing.

Next:
- Production GitHub App and Cloudflare secret/binding verification.
- Browser smoke tests for auth/import/dashboard/export flows.
- Settings/privacy screen refinement.
- Export/restore compatibility decisions.
- Browser quota and multi-tab edge case handling.
- Broader beta acceptance pass against [MVP Acceptance Criteria](./14-mvp-acceptance-criteria.md).

Future
- Saved Views
- Category Requests
- GitHub Action
- AI-assisted features (optional)
