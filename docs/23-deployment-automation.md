# Deployment Automation

Status:
Manual GitHub Actions workflow scaffolded and staging-hosting path proven

Forage deploys through `.github/workflows/deploy.yml`. The workflow is manual-only for now so staging and production deploys remain operator-controlled while the Cloudflare hosting path is still being proven.

## Workflow Inputs

- `environment`: `staging` or `production`
- `deploy_worker`: deploy `apps/worker` with Wrangler
- `deploy_pages`: deploy `apps/web/dist` to Cloudflare Pages with Wrangler direct upload
- `run_hosted_smoke`: run `pnpm smoke:hosted` after deployment

## GitHub Repository Secrets

Configure these as repository or environment secrets:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

The Cloudflare API token should be scoped narrowly to the Forage account and resources needed for Worker and Pages deployment. Keep GitHub App client secrets in Cloudflare Worker secrets, not GitHub repository variables.

## GitHub Environment Variables

Configure these on the `staging` and `production` GitHub environments:

- `CLOUDFLARE_PAGES_PROJECT_NAME`
- `FORAGE_STAGING_WEB_ORIGIN`
- `FORAGE_STAGING_WORKER_ORIGIN`
- `FORAGE_STAGING_PAGES_BRANCH`
- `FORAGE_PRODUCTION_WEB_ORIGIN`
- `FORAGE_PRODUCTION_WORKER_ORIGIN`
- `FORAGE_PRODUCTION_PAGES_BRANCH`

Defaults:

- Pages project defaults to `forage-web` when `CLOUDFLARE_PAGES_PROJECT_NAME` is unset.
- Staging Pages branch defaults to `staging` when `FORAGE_STAGING_PAGES_BRANCH` is unset.
- Production Pages branch defaults to `main` when `FORAGE_PRODUCTION_PAGES_BRANCH` is unset.

`FORAGE_*_WORKER_ORIGIN` is required because the Astro build compiles `PUBLIC_WORKER_ORIGIN` into the web app and CSP. `FORAGE_*_WEB_ORIGIN` is required when hosted smoke checks are enabled.

## First Deploy Order

1. Apply `infra/opentofu` with `manage_worker_custom_domains = false`.
2. Configure Worker secrets in Cloudflare.
3. Deploy the Worker once with Wrangler or the manual deploy workflow.
4. Enable Worker custom domains in OpenTofu if the Worker service now exists.
5. Apply OpenTofu again.
6. Deploy Pages through the manual deploy workflow.
7. Run the hosted smoke check.

This order avoids the Cloudflare custom-domain dependency where the Worker service must exist before OpenTofu can attach Worker domains.

## Workflow Behavior

Worker deploy:

```sh
pnpm --filter @forage/worker build
cd apps/worker
pnpm exec wrangler deploy --env staging
```

Pages deploy:

```sh
PUBLIC_WORKER_ORIGIN=https://api-staging.forage.example.com pnpm --filter @forage/web build
cd apps/worker
pnpm exec wrangler pages deploy ../../apps/web/dist --project-name forage-web --branch staging
```

Hosted smoke:

```sh
FORAGE_WEB_ORIGIN=https://staging.forage.example.com \
FORAGE_WORKER_ORIGIN=https://api-staging.forage.example.com \
FORAGE_SMOKE_EXPECT_PRODUCTION=false \
pnpm smoke:hosted
```

Set `FORAGE_SMOKE_EXPECT_PRODUCTION=false` for staging because staging Worker config intentionally exposes non-secret setup diagnostics. Leave it unset for production so the smoke check verifies that production config hides those diagnostics.

When using Cloudflare Pages custom branch domains, the staging branch name should match the OpenTofu environment key. For example, the `staging` environment maps to `staging.<pages_project_name>.pages.dev` and can be connected to a custom hostname such as `forage-staging.example.com`.

## Quality Gates

The main Check workflow installs OpenTofu and runs `npm run infra:fmt:check`. The root `npm run check` also includes the same infra formatting check so local and CI gates stay aligned.

## Sources Checked

- [Cloudflare Pages direct upload](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- [Cloudflare Workers GitHub Actions](https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/)
- [Wrangler GitHub Action](https://github.com/cloudflare/wrangler-action)
- [OpenTofu setup action](https://github.com/opentofu/setup-opentofu)
