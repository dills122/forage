# Repository Scope And Priorities

This repository builds Forage, a privacy-first GitHub repository rediscovery tool.

Primary deliverables:

- GitHub App authorization and starred repository import
- Local-first IndexedDB storage and analysis
- Explainable dashboard, scoring, insights, and exports

Core priorities:

- no server-side repository data storage
- stable shared TypeScript contracts
- stable typed contracts between modules
- maintainable local workflows

## Active Boundaries

- `apps/web` owns browser UI, IndexedDB, local workers, and exports.
- `apps/worker` owns GitHub auth, sessions, settings, preferences, and aggregate analytics.
- `packages/shared` owns cross-package contracts.
- `packages/github` owns GitHub import and normalization.
- `packages/analysis` owns categories, scoring, labels, and insights.
- `packages/reporting` owns export generation.

## Safe Refactor Boundaries

Do not refactor these without explicit instruction:

- project names and paths registered in workspace config
- public API route surfaces
- persistent data model semantics
- generated code ownership boundaries
- privacy boundaries between Cloudflare and browser-local data
- GitHub App auth assumptions captured in ADRs

Safe default changes:

- feature-scoped improvements
- endpoint hardening and validation
- focused test additions
- typing improvements
