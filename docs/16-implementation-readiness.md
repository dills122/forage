# Implementation Readiness

Status:
Real app scaffold, local-first import flow, analysis/reporting packages, CI gates, and hosted staging path are implemented. Remaining readiness work is MVP hardening and production verification.

What is already decided and implemented:
- Product name is Forage.
- MVP uses GitHub App user authorization.
- Repository data is stored locally in IndexedDB.
- Cloudflare stores only auth, session, preferences, small settings, and aggregate analytics.
- Server-side repository storage is out of scope.
- Pre-MVP import proved the starred repositories endpoint is viable.
- MVP can avoid per-repository detail calls at first.
- Base scoring is user-agnostic.
- Personalized Match Score is deferred.
- Categories start broad, then narrow after real data review.
- `apps/web` is an Astro app with Svelte islands.
- `apps/worker` is a Cloudflare Worker for auth/session/settings and GitHub API proxying.
- `packages/shared`, `packages/core`, `packages/github`, `packages/analysis`, and `packages/reporting` hold cross-boundary contracts and logic.
- Browser IndexedDB schema version 3 stores repositories, import events, local metadata, and analysis results.
- JSON and CSV exports are available from local browser data.
- Cloudflare Pages, Worker, Durable Object, KV, OpenTofu, deployment workflow, and hosted smoke check paths are documented and partially proven through staging.

Current implementation sequence:
1. Harden import resilience: retry/recovery UX, cancellation, rate-limit display, and stalled page recovery.
2. Tighten first-run and re-auth UX across local, staging, and production origins.
3. Finish settings/privacy surface and make analytics opt-in state obvious.
4. Verify production GitHub App, Cloudflare secrets, Worker bindings, custom domains, and hosted smoke results.
5. Review real account imports to tune category weights, labels, score explanations, and edge cases.
6. Add broader browser smoke coverage after the primary app flows stabilize.
7. Keep `apps/pre-mvp` until the real app has fully replaced the same validation value in tests and docs.

Implemented first milestone:
The real app reproduces the pre-MVP flow with production-shaped boundaries:
- GitHub App authorization
- Import starred repositories
- Store records in IndexedDB
- Record import events
- Run browser worker analysis
- Display dashboard/table/search/filter/sort views
- Export JSON and CSV

Definition of ready for broader MVP work:
- The real app matches or exceeds the pre-MVP spike behavior.
- Shared packages have tests around normalization, category matching, scoring, and export shape.
- Auth/session behavior is documented and deployable to Cloudflare.
- Local schema versions and migrations are implemented before any public testing.
- Hosted staging smoke checks pass after deploy.

Definition of ready for hosted testing:
- Cloudflare Pages and Worker staging hostnames are finalized.
- Worker `AUTH_COORDINATOR` Durable Object binding and migration are configured.
- Worker `SETTINGS_KV` namespaces are created and bound.
- GitHub token expiration behavior is reconnect-only for MVP.
- Server-side settings, sessions, OAuth state, and token records have deletion behavior.
- Production secrets and Cloudflare bindings are configured outside git.
- Security header and CORS behavior is verified on HTTPS.

Definition of ready for production launch:
- Production hostnames and GitHub App callback URLs are final.
- Production Worker secrets and Cloudflare bindings are configured outside git.
- Hosted smoke passes for production in public mode.
- Staging remains protected by Cloudflare Access.
- Traffic controls are active and do not break GitHub OAuth start/callback.
- Privacy checks confirm repository data remains browser-local.
