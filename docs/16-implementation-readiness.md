# Implementation Readiness

Status:
Ready for initial implementation after package installation and framework selection.

What is already decided:
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

Next implementation sequence:
1. Install project dependencies and lock package manager.
2. Scaffold the real Astro web app in `apps/web`.
3. Scaffold the Cloudflare Worker auth/session backend in `apps/worker`.
4. Move shared contracts from `packages/shared` into compiled TypeScript packages.
5. Move GitHub import logic from the pre-MVP server into `packages/github`.
6. Implement IndexedDB storage and migrations in the web app.
7. Implement category matching in `packages/analysis`.
8. Implement versioned foundational scoring in `packages/analysis`.
9. Implement JSON and CSV exports in `packages/reporting`.
10. Keep `apps/pre-mvp` until the real vertical slice covers the same behavior.

First implementation milestone:
The real app should reproduce the pre-MVP flow with production-shaped boundaries:
- GitHub App authorization
- Import starred repositories
- Store records in IndexedDB
- Record import events
- Run browser worker analysis
- Display a basic table
- Export JSON

Definition of ready for broader MVP work:
- The real app matches or exceeds the pre-MVP spike behavior.
- Shared packages have tests around normalization, category matching, scoring, and export shape.
- Auth/session behavior is documented and deployable to Cloudflare.
- Local schema versions and migrations are implemented before any public testing.
