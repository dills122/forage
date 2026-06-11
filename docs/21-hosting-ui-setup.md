# Hosting UI Setup

Status:
Operator checklist for hosted testing

This document covers the manual UI configuration needed in GitHub and Cloudflare before Forage can be hosted safely. It assumes the current MVP topology:

- Cloudflare Pages hosts `apps/web`.
- Cloudflare Workers hosts `apps/worker`.
- Cloudflare Durable Objects coordinate OAuth state, sessions, user session indexes, and basic throttles.
- Cloudflare KV stores only small settings/preferences records.
- Repository data stays in the browser and is not stored in Cloudflare.

Replace the placeholder domains below before production:

- Production web: `https://forage.example.com`
- Production API: `https://api.forage.example.com`
- Staging web: `https://forage-staging.example.com`
- Staging API: `https://api-staging.forage.example.com`

## GitHub App UI

Create separate GitHub Apps for production and development/staging unless there is a strong reason to share one.

Production GitHub App:
- GitHub path: `Settings` -> `Developer settings` -> `GitHub Apps` -> `New GitHub App`
- GitHub App name: `Forage`
- Homepage URL: production web URL, for example `https://forage.example.com`
- Callback URL: production Worker callback URL, for example `https://api.forage.example.com/auth/github/callback`
- Setup URL: leave blank for MVP
- Webhook: disable active webhook unless a concrete webhook feature is added
- Repository permissions: no repository permissions for MVP unless GitHub requires one for the stars endpoint
- User permissions: minimum permission needed for user-starred repository reads
- Expire user authorization tokens: enabled
- Device flow: disabled for the web MVP
- Request user authorization during installation: not needed for MVP unless installation flow is added

Development or staging GitHub App:
- App name: `Forage Dev` or `Forage Staging`
- Homepage URL: staging web URL or local web URL
- Callback URL for local development: `http://127.0.0.1:8787/auth/github/callback`
- Callback URL for staging: `https://api-staging.forage.example.com/auth/github/callback`
- Use the same permission posture as production

Values to copy from the GitHub App UI:
- Client ID -> Cloudflare Worker secret `GITHUB_CLIENT_ID`
- Client secret -> Cloudflare Worker secret `GITHUB_CLIENT_SECRET`

Do not use the GitHub App private key for the current MVP path. The app is using user authorization, not installation access.

## Cloudflare Pages UI

Create the web app in Cloudflare Pages:
- Cloudflare path: `Workers & Pages` -> `Create` -> `Pages` -> connect the GitHub repository
- Project name: `forage-web` or similar
- Production branch: `main`
- Framework preset: none/custom
- Build command: `pnpm --filter @forage/web build`
- Build output directory: `apps/web/dist`
- Root directory: repository root
- Node version: `22`

Production environment variable:
- `PUBLIC_WORKER_ORIGIN=https://api.forage.example.com`

Staging or preview environment variable:
- `PUBLIC_WORKER_ORIGIN=https://api-staging.forage.example.com`

Custom domains:
- Add the production web hostname, for example `forage.example.com`
- Add the staging web hostname if using a long-lived staging environment
- Confirm HTTPS is active before relying on HSTS

Important:
- `PUBLIC_WORKER_ORIGIN` is compiled into the Astro build and into CSP `connect-src`.
- If the Worker API hostname changes, update the Pages environment variable and redeploy Pages.
- If using OpenTofu, confirm the Pages project, build variables, and custom domains match `infra/opentofu` outputs.

## Cloudflare Worker UI

The Worker can be deployed from CI or locally with Wrangler, but the Cloudflare UI still needs the deployed Worker, custom domain, secrets, and bindings verified.

Worker project:
- Worker name: `forage-worker`
- Production route or custom domain: `https://api.forage.example.com`
- Staging route or custom domain: `https://api-staging.forage.example.com`

Production Worker variables:
- `ENVIRONMENT=production`
- `GITHUB_API_VERSION=2022-11-28`
- `GITHUB_REDIRECT_URI=https://api.forage.example.com/auth/github/callback`
- `WEB_ORIGIN=https://forage.example.com`

Staging Worker variables:
- `ENVIRONMENT=staging`
- `GITHUB_API_VERSION=2022-11-28`
- `GITHUB_REDIRECT_URI=https://api-staging.forage.example.com/auth/github/callback`
- `WEB_ORIGIN=https://forage-staging.example.com`

Production Worker secrets:
- `GITHUB_CLIENT_ID`
- `GITHUB_CLIENT_SECRET`
- `SETTINGS_HASH_SALT`
- `SESSION_ENCRYPTION_KEY`

Staging Worker secrets:
- Use different values from production
- Use the staging GitHub App client ID and client secret
- Use separate `SETTINGS_HASH_SALT` and `SESSION_ENCRYPTION_KEY`

Secret generation guidance:
- `SETTINGS_HASH_SALT`: random 32+ bytes
- `SESSION_ENCRYPTION_KEY`: random 32+ bytes
- Store the values in your password manager
- Do not commit them to the repo

## Cloudflare Storage UI

Durable Object:
- Binding name: `AUTH_COORDINATOR`
- Class name: `AuthCoordinator`
- Migration tag in repo: `v1`
- Confirm the production Worker deployment shows the Durable Object binding

KV namespace:
- Create production namespace: `forage-production-settings`
- Create staging namespace: `forage-staging-settings`
- Bind each namespace to the Worker as `SETTINGS_KV`
- If using OpenTofu, the namespace ids come from `tofu output settings_kv_namespaces`.

Do not create or bind storage for repository lists, analysis results, reports, or exports.

Optional fallback KV namespaces:
- `SESSION_KV`
- `OAUTH_STATE_KV`

These are fallback stores only. Production should use `AUTH_COORDINATOR` for OAuth/session coordination.

## Cloudflare Security UI

Before applying OpenTofu Access resources:
- Open `Zero Trust` in the Cloudflare dashboard.
- Complete the initial Access setup for the Cloudflare account.
- Confirm the login method you want testers to use is available.

OpenTofu can manage:
- Staging web Access application.
- Staging tester allow policy.
- Zone WAF geo challenge rules.
- Zone rate limiting rule for `/auth/*` and `/api/*`.

Minimum security-token permissions:
- Zone `shrimpworks.dev`: Zone Read, Zone WAF Write
- Account: Access Apps and Policies Write, Access Organizations Read, Zero Trust Read

If using the same token for the full OpenTofu root, include read/write permissions for the resources already managed in state, such as Pages, Workers KV, Worker scripts/custom domains, and DNS.

Recommended staging posture:
- Protect `forage-staging.example.com` with Cloudflare Access.
- Allow only explicit tester email addresses.
- Do not put `api-staging.forage.example.com` behind Access initially.
- Use WAF and rate limiting for the API hostname so GitHub OAuth callbacks and credentialed CORS remain straightforward to test.

Recommended production posture:
- Do not put the public web app behind Access.
- Use managed challenges before hard blocks until real traffic patterns are known.
- Keep the combined API/auth rate limit enabled.

Pages preview URLs:
- Add the Pages branch hostname to `staging_access_extra_hostnames` if OpenTofu should include it in the Access app.
- Also check Cloudflare Pages preview access settings in the dashboard because preview URLs can be exposed independently from custom domains.

## GitHub Repository UI

Required repository settings:
- Protect `main`
- Require pull requests before merging
- Require status checks before merging
- Require the CI check that runs `pnpm check`
- Disallow force pushes to `main`
- Disallow direct pushes to `main`

Recommended repository secrets for deployment CI:
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Do not store GitHub App client secrets as public repository variables.

Recommended GitHub environment variables for the manual deploy workflow:
- `CLOUDFLARE_PAGES_PROJECT_NAME`
- `FORAGE_STAGING_WEB_ORIGIN`
- `FORAGE_STAGING_WORKER_ORIGIN`
- `FORAGE_STAGING_PAGES_BRANCH`
- `FORAGE_PRODUCTION_WEB_ORIGIN`
- `FORAGE_PRODUCTION_WORKER_ORIGIN`
- `FORAGE_PRODUCTION_PAGES_BRANCH`

Use GitHub environments named `staging` and `production`. Production should require manual approval before `.github/workflows/deploy.yml` can deploy to it.

## Post-Deploy Verification

Run the automated hosted smoke check:

```sh
FORAGE_WEB_ORIGIN=https://forage.example.com \
FORAGE_WORKER_ORIGIN=https://api.forage.example.com \
pnpm smoke:hosted
```

For staging, use the staging web and API origins, set `FORAGE_SMOKE_EXPECT_PRODUCTION=false`, and set `FORAGE_WEB_SMOKE_MODE=access-protected` when Cloudflare Access protects the staging web hostname:

```sh
FORAGE_WEB_ORIGIN=https://forage-staging.shrimpworks.dev \
FORAGE_WORKER_ORIGIN=https://api-staging.forage.shrimpworks.dev \
FORAGE_SMOKE_EXPECT_PRODUCTION=false \
FORAGE_WEB_SMOKE_MODE=access-protected \
pnpm smoke:hosted
```

This script verifies Worker health, CORS, unauthenticated session shape, GitHub OAuth start redirect/PKCE setup, preflight headers, and either public Pages HTML/security headers or Cloudflare Access protection depending on `FORAGE_WEB_SMOKE_MODE`.

Verify Worker health:
- `GET https://api.forage.example.com/api/health`
- Expected: JSON with `ok: true` and `privacy_boundary: "no repository data stored server-side"`

Verify Pages:
- Open `https://forage.example.com`
- Confirm the app loads
- Confirm browser devtools show CSP applied
- Confirm no blocked app scripts from the expected Forage assets

Verify CORS:
- From the production web app, `/api/config` should work
- From an unconfigured origin, credentialed API requests should not receive `Access-Control-Allow-Origin`

Verify cookies:
- Connect GitHub
- Confirm `forage_session` is `HttpOnly`, `Secure`, `SameSite=Lax`, and scoped to the API hostname
- Confirm `forage_oauth_state` is cleared after callback

Verify OAuth:
- GitHub redirect uses the production callback URL
- Callback returns to the production web URL
- Session response includes `authenticated: true`
- Tokens are never visible in browser responses

Verify privacy:
- Import starred repositories
- Confirm repository records are present in browser IndexedDB
- Confirm no repository records are written to KV, D1, R2, Worker logs, or analytics
- Toggle analytics off and on, then verify only settings state changes in Cloudflare
- Use Delete Server State and verify the settings/session records are removed while browser-local repository data remains local

## Values To Finalize

Before production launch, decide and record:
- Final production web hostname
- Final production API hostname
- Final staging web hostname
- Final staging API hostname
- Whether staging uses a separate GitHub App
- Whether deployment runs from Cloudflare Git integration, GitHub Actions, or local Wrangler
- Which Cloudflare account owns Pages, Worker, KV, Durable Objects, and DNS
