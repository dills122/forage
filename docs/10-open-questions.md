
# Open Questions

Items intentionally deferred.

- Scoring and category tuning after reviewing more real imports
- Insight calculation algorithms beyond the current analysis detail view
- Future personalized Match Score design
- Export format enhancements beyond JSON and CSV
- Category submission workflow
- Restore/import from a previous Forage export
- Browser quota warnings and offline/stale data behavior
- Multi-tab import/reset conflict handling beyond the current local operation lock
- Pages preview access policy for non-canonical preview URLs

Current philosophy:

Do not over-engineer.

Build the engine.
Run real data.
Refine based on observations.

Resolved direction:
Use a GitHub App user authorization flow for the website. Forage should behave as an authorized website integration. Fall back to a standard OAuth App only if the GitHub App flow cannot cleanly support the starred repository import.

Base scoring direction:
Repository scores are user-agnostic. Any future preference-aware ranking should be represented as a separate Match Score rather than changing the base score.

Hosting/security direction:
Use Cloudflare Pages for the static web app and a separate Cloudflare Worker for auth/session/settings/API proxying. See [Hosting And Security Plan](./20-hosting-and-security.md).

Current hosted domains are tracked in [Documentation](./README.md) and [Hosting UI Setup](./21-hosting-ui-setup.md).

MVP token/session direction:
Use expiring GitHub App user access tokens and require reconnect after session expiry. Do not persist refresh tokens for MVP. Minimal server-side account state can be deleted through the Worker account deletion endpoint.
