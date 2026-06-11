# Forage Cloudflare OpenTofu

This directory manages the hosted Cloudflare infrastructure that can be safely represented as code for the Forage MVP.

Managed here:
- Cloudflare KV namespaces for small settings/preferences records.
- Cloudflare Pages project build settings and non-secret environment variables.
- Cloudflare Pages custom domains.
- Optional Cloudflare Worker custom domains after the Worker service exists.
- Outputs for GitHub App callback/homepage URLs and Worker/Page environment wiring.

Not managed here:
- GitHub App creation or OAuth client secrets.
- Secret values such as `GITHUB_CLIENT_SECRET`, `SETTINGS_HASH_SALT`, or `SESSION_ENCRYPTION_KEY`.
- Browser-local repository data, analysis results, reports, or exports.
- Worker code uploads for MVP; `apps/worker` still deploys through Wrangler so Durable Object migrations stay aligned with `wrangler.toml`.

## Usage

```sh
cd infra/opentofu
cp terraform.tfvars.example terraform.tfvars
tofu init
tofu plan
tofu apply
```

Use environment variables for Cloudflare authentication:

```sh
export CLOUDFLARE_API_TOKEN=...
```

The token needs enough access to manage Pages, Workers custom domains, and Workers KV in the selected account and zone.
See `../../docs/24-cloudflare-token-permissions.md` for the full infra, deploy, and temporary recovery token permission profiles.

Formatting:

```sh
pnpm infra:fmt:check
pnpm infra:fmt
```

## First Apply

For a new account, keep `manage_worker_custom_domains = false` until `pnpm --filter @forage/worker exec wrangler deploy --env <environment>` or equivalent Wrangler deployment has created the Worker service.

After the Worker exists:

1. Set `manage_worker_custom_domains = true`.
2. Re-run `tofu plan`.
3. Re-run `tofu apply`.

## Secrets

OpenTofu intentionally does not accept secret variables for the GitHub App or Worker session crypto. Configure these with Wrangler or Cloudflare UI/CI secret handling:

```sh
pnpm --filter @forage/worker exec wrangler secret put GITHUB_CLIENT_ID --env production
pnpm --filter @forage/worker exec wrangler secret put GITHUB_CLIENT_SECRET --env production
pnpm --filter @forage/worker exec wrangler secret put SETTINGS_HASH_SALT --env production
pnpm --filter @forage/worker exec wrangler secret put SESSION_ENCRYPTION_KEY --env production
```

Use separate values for staging and production.

## Wrangler Bindings

After apply, read `settings_kv_namespaces` from `tofu output`. Bind each namespace as `SETTINGS_KV` in `apps/worker/wrangler.toml` or equivalent deployment automation.

Do not add KV namespaces for repositories, analysis, reports, or exports.
