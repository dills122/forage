# Hosting And Security Plan

Status:
Initial deployment plan

## Recommended Topology

Use two Cloudflare properties:

- `apps/web`: Cloudflare Pages static Astro deployment.
- `apps/worker`: Cloudflare Worker API for GitHub auth, session, settings, and GitHub API proxying.

The web app should be served from the product hostname, for example `https://forage.example.com`.
The Worker should be served from a separate API hostname, for example `https://api.forage.example.com`.

Reasons:
- The Astro app is static and local-first, so Pages is the simplest hosting boundary.
- The Worker remains narrowly scoped to auth/session/settings/API proxy responsibilities.
- Separate hostnames keep browser cookies, CORS, and cache behavior explicit.
- Repository data remains browser-local IndexedDB data and is not stored in Cloudflare.

Fallback:
Host the Astro app and Worker under one Cloudflare Worker with static assets only if Pages plus Worker coordination becomes a deployment burden. That is not the preferred MVP path.

## Current Implementation Status

Already implemented:
- Static Astro app with Svelte islands.
- Worker GitHub authorization start/callback endpoints.
- Worker `/api/session`, `/api/logout`, `/api/settings`, and `/api/github/starred` endpoints.
- CORS restricted to `WEB_ORIGIN`.
- `HttpOnly` cookies with `SameSite=Lax`; `Secure` is added automatically for HTTPS requests.
- Settings can persist to `SETTINGS_KV` under a salted GitHub user id hash.
- Repository data, analysis results, reports, and exports stay out of Cloudflare.

Not production-ready yet:
- Session state is in-memory and will not survive Worker isolate eviction.
- OAuth state is in-memory and will not survive Worker isolate eviction.
- GitHub user access token material is held only in memory.
- GitHub refresh tokens are not persisted or rotated.
- There is no account deletion endpoint for server-side settings/session/token state.
- Worker security headers are minimal.
- Pages preview deployment CORS behavior is not finalized.
- Production Cloudflare resource names and custom domains are not finalized.

## Production Storage Decision

For MVP hosting, use Cloudflare KV for small server-side records:

- `SETTINGS_KV`: analytics/settings keyed by salted GitHub user id hash.
- `SESSION_KV`: short-lived session records keyed by an opaque session id.
- `OAUTH_STATE_KV`: short-lived OAuth state records keyed by opaque state.
- Optional `TOKEN_KV`: encrypted GitHub user token material if sessions must survive browser restarts or imports need refresh token support.

Do not use KV for:
- Starred repository records.
- Repository analysis results.
- Generated reports.
- User exports.

Durable Objects can replace session/OAuth KV if we need stronger consistency or explicit per-session coordination. D1 is not needed for MVP unless settings/account deletion/audit requirements become relational.

## GitHub App Configuration

Use GitHub App user authorization through the web application flow.

Production GitHub App settings:
- Homepage URL: production web origin.
- Callback URL: production Worker callback URL, for example `https://api.forage.example.com/auth/github/callback`.
- Add staging callback URL if a separate staging Worker is used.
- Add local callback URL only for the development GitHub App, not the production app.
- Repository permissions: none unless future features require installation access.
- User permissions: minimum needed to read starred repositories through the authenticated user API.
- Webhook: disabled for MVP unless a concrete event-driven feature is added.
- Expiring user access tokens: enabled.

Token posture:
- Store token material only server-side.
- Prefer expiring user access tokens with refresh tokens.
- Refresh tokens should be rotated whenever used.
- If refresh token storage is deferred, require users to reconnect GitHub after the session expires.

## Cloudflare Configuration

Pages production config:
- Build command: `pnpm --filter @forage/web build`
- Build output directory: `apps/web/dist`
- Production branch: `main`
- Node version: `22`
- Environment variable: `PUBLIC_WORKER_ORIGIN=https://api.forage.example.com`

Worker production config:
- Deploy command from `apps/worker`: `pnpm exec wrangler deploy --env production`
- Non-secret vars:
  - `GITHUB_API_VERSION=2022-11-28`
  - `GITHUB_REDIRECT_URI=https://api.forage.example.com/auth/github/callback`
  - `WEB_ORIGIN=https://forage.example.com`
- Secrets:
  - `GITHUB_CLIENT_ID`
  - `GITHUB_CLIENT_SECRET`
  - `SETTINGS_HASH_SALT`
  - Future token encryption key when persistent token storage is added.
- Bindings:
  - `SETTINGS_KV`
  - Future `SESSION_KV`
  - Future `OAUTH_STATE_KV`
  - Future `TOKEN_KV` if refresh-token persistence is implemented.

Local config:
- Copy `apps/web/.env.example` to `apps/web/.env` when overriding the Worker origin.
- Copy `apps/worker/.dev.vars.example` to `apps/worker/.dev.vars`.
- Never commit `.env`, `.env.local`, `.dev.vars`, or production secret files.

## Security Headers

Pages:
- `apps/web/public/_headers` sets basic static security headers:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` denying unused browser capabilities

Deferred:
- Add a Content Security Policy after final hostnames are chosen.
- CSP must include the Worker origin in `connect-src`.
- Current inline theme bootstrap means either a nonce/hash approach or a narrow inline allowance is needed before enabling strict CSP.

Worker:
- API responses should keep `Cache-Control: no-store`.
- Add common security headers to JSON and redirect responses.
- Keep `Access-Control-Allow-Origin` exact-match only.
- Keep `Access-Control-Allow-Credentials: true` only for the configured web origin.

## Cookie And Session Policy

Current cookies:
- `forage_session`
- `forage_oauth_state`

Production requirements:
- `HttpOnly`
- `Secure`
- `SameSite=Lax`
- `Path=/`
- Short OAuth state TTL, target 10 minutes.
- Session TTL, target 8 hours unless refresh-token persistence is implemented.
- Logout deletes the session record and expires the cookie.
- Account deletion deletes settings, sessions, OAuth state, and token records for the hashed GitHub user id.

If web and API remain on separate subdomains, keep cookies host-only on the API hostname and continue using credentialed CORS from the web app.

## Deployment Environments

Use at least two environments:

- `staging`
  - Pages preview or staging branch.
  - Separate Worker environment and KV namespaces.
  - Separate GitHub App or separate callback URL.
  - No production token/session/settings data.

- `production`
  - Pages production branch `main`.
  - Production Worker custom domain.
  - Production KV namespaces and secrets.

Do not point local development at production KV by default.

## Pre-Launch Security Checklist

- Replace in-memory sessions with persistent short-lived session storage.
- Replace in-memory OAuth state with persistent short-lived OAuth state storage.
- Decide whether MVP persists refresh tokens or requires reconnect after session expiration.
- If token material is persisted, encrypt it before writing to Cloudflare storage.
- Add account deletion for the minimal server-side record.
- Add Worker security headers.
- Finalize production and staging hostnames.
- Configure GitHub App callback URLs for production and staging.
- Configure Cloudflare Pages env vars and Worker secrets.
- Create production and staging KV namespaces.
- Verify CORS rejects unconfigured origins.
- Verify cookies are `Secure`, `HttpOnly`, and `SameSite=Lax` on HTTPS.
- Verify no repository data is written to Worker logs, KV, D1, R2, or analytics.
- Verify GitHub tokens are never returned to the browser.
- Add deployment preview checks after Cloudflare bindings are configured.

## Sources Checked

- Cloudflare Workers environment variables and secrets docs.
- Cloudflare Workers environments docs.
- Cloudflare Workers KV binding docs.
- Cloudflare Pages Astro deployment docs.
- Cloudflare static asset headers docs.
- GitHub App user access token and callback URL docs.
