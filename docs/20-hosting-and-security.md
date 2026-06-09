# Hosting And Security Plan

Status:
Implementation hardened for hosted testing

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
- OAuth web flow uses `state` plus PKCE S256 verifier/challenge.
- Worker `/api/session`, `/api/logout`, `/api/settings`, and `/api/github/starred` endpoints.
- Worker `DELETE /api/account` endpoint deletes minimal server-side account state.
- CORS restricted to `WEB_ORIGIN`.
- Mutating API requests require a session-bound `X-Forage-CSRF` token.
- `HttpOnly` cookies with `SameSite=Lax`; `Secure` is added automatically for HTTPS requests.
- Settings can persist to `SETTINGS_KV` under a salted GitHub user id hash.
- Session state prefers the `AUTH_COORDINATOR` Durable Object with encrypted AES-GCM payloads and an 8-hour maximum lifetime.
- OAuth state prefers the `AUTH_COORDINATOR` Durable Object with 10-minute, one-time PKCE state consumption.
- KV session and OAuth stores remain as migration/development fallbacks.
- Worker JSON, redirect, and preflight responses include basic security headers.
- Pages uses Astro CSP support for script/style hashes and Worker `connect-src`.
- Pages static headers include HSTS, frame denial, referrer policy, nosniff, and a restrictive permissions policy.
- Repository data, analysis results, reports, and exports stay out of Cloudflare.
- Initial OpenTofu scaffold for Cloudflare Pages, KV, domains, and environment output wiring.

Not production-ready yet:
- Production `SETTINGS_KV` namespace IDs are not configured in `wrangler.toml`.
- Pages preview deployment CORS behavior is not finalized.
- Production Cloudflare resource names and custom domains are not finalized.
- Production GitHub App callback URLs are still placeholders.
- OpenTofu has not been applied against the real Cloudflare account yet.

## Production Storage Decision

For MVP hosting, use Cloudflare Durable Objects for coordination and KV only for small settings records:

- `SETTINGS_KV`: analytics/settings keyed by salted GitHub user id hash.
- `AUTH_COORDINATOR`: one-time OAuth state, encrypted short-lived session records, user session indexes, and basic request throttles.
- Optional `SESSION_KV` and `OAUTH_STATE_KV`: fallback stores only if Durable Objects are unavailable in a non-production environment.

Do not use KV for:
- Starred repository records.
- Repository analysis results.
- Generated reports.
- User exports.
- Refresh tokens.

D1 is not needed for MVP unless settings/account deletion/audit requirements become relational.

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
- Use expiring GitHub App user access tokens.
- MVP does not persist refresh tokens.
- Users reconnect GitHub after the access token or Forage session expires.
- Revisit encrypted refresh-token rotation only if background refresh becomes a product requirement.

## Cloudflare Configuration

Infrastructure:
- OpenTofu configuration lives in `infra/opentofu`.
- Keep secret values out of OpenTofu state.
- Use OpenTofu outputs for `SETTINGS_KV`, Pages env vars, Worker env vars, and GitHub App URLs.

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
  - `SESSION_ENCRYPTION_KEY`
- Bindings:
  - `AUTH_COORDINATOR`
  - `SETTINGS_KV`

Local config:
- Copy `apps/web/.env.example` to `apps/web/.env` when overriding the Worker origin.
- Copy `apps/worker/.dev.vars.example` to `apps/worker/.dev.vars`.
- Never commit `.env`, `.env.local`, `.dev.vars`, or production secret files.

## Security Headers

Pages:
- `apps/web/public/_headers` sets basic static security headers:
  - `X-Content-Type-Options: nosniff`
  - `X-Frame-Options: DENY`
  - `Strict-Transport-Security`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy` denying unused browser capabilities
  - `Content-Security-Policy: frame-ancestors 'none'`

Astro:
- `astro.config.mjs` enables CSP hashing for bundled scripts/styles.
- CSP includes `PUBLIC_WORKER_ORIGIN` in `connect-src`, so production builds must set that environment variable.

Worker:
- API responses keep `Cache-Control: no-store`.
- JSON, redirect, and preflight responses include common security headers.
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
- Session TTL, target 8 hours, capped by GitHub access token expiry.
- Logout deletes the session record and expires the cookie.
- Account deletion deletes settings and active sessions for the hashed GitHub user id.

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

- Configure production and staging `AUTH_COORDINATOR` bindings and migrations.
- Configure production and staging `SETTINGS_KV` bindings.
- Keep MVP reconnect-only after GitHub session expiration.
- Finalize production and staging hostnames.
- Configure GitHub App callback URLs for production and staging.
- Configure Cloudflare Pages env vars and Worker secrets.
- Create production and staging settings KV namespaces.
- Verify CORS rejects unconfigured origins.
- Verify CSRF rejection on mutating Worker endpoints.
- Verify cookies are `Secure`, `HttpOnly`, and `SameSite=Lax` on HTTPS.
- Verify CSP allows the production Worker origin and blocks unexpected script/connect sources.
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
