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
- config/constant driven behavior instead of repeated magic strings or values
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

## Configuration Standards

- Prefer named constants or typed configuration objects for route paths, storage keys, cookie names, rate limits, TTLs, security headers, score weights, category rules, labels, and user-facing status text.
- Keep constants private to their owning module when only one module uses them.
- Promote constants to shared typed config modules when values are reused across modules, packages, workers, or tests.
- Avoid duplicating string literals across runtime code and tests; tests should import stable constants or assert behavior through public APIs when possible.
- Treat scoring and category changes as config changes first, then algorithm changes only when config cannot express the behavior clearly.
