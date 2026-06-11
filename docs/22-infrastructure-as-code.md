# Infrastructure As Code

Status:
Cloudflare staging path proven

Forage uses OpenTofu-compatible Terraform configuration for Cloudflare resources under `infra/opentofu`.

The current split is intentional:

- OpenTofu owns stable account/project resources and hostname wiring.
- Wrangler still owns Worker code upload and Durable Object migrations.
- GitHub App creation and OAuth secrets stay manual/operator-controlled.
- Repository data remains browser-local and is not represented in Cloudflare infrastructure.

## Managed Resources

Current OpenTofu scope:

- Cloudflare Pages project for `apps/web`.
- Pages production and preview build environment variables.
- Pages custom domains.
- DNS CNAME records for Pages custom domains.
- Cloudflare KV namespaces for `SETTINGS_KV`.
- Optional Worker custom domains after the Worker service exists.
- Optional WAF custom rules for hosted web/API traffic.
- Optional rate limiting rule for hosted `/auth/*` and `/api/*` endpoints.
- Optional Cloudflare Access app and policy for staging web allowlisting.
- Outputs for GitHub App homepage/callback URL values.
- Outputs for Worker and Pages environment variables.

Current manual scope:

- GitHub App creation and permissions.
- GitHub App client id/client secret storage.
- Worker secret values.
- First Worker code deployment with Wrangler.
- Any Cloudflare Git integration that requires a connected GitHub account.
- Cloudflare Zero Trust account initialization before Access resources can be applied.
- Pages preview access settings in the Cloudflare UI when branch URLs need protection.

## Privacy Boundary

Do not add server-side storage resources for:

- Starred repository lists.
- GitHub repository metadata imported by the user.
- Analysis results.
- Generated reports.
- User exports.

Allowed server-side resources remain limited to auth/session coordination, non-obvious user hashes, settings/preferences, and aggregate analytics if the user opts in.

## First Run

```sh
cd infra/opentofu
cp terraform.tfvars.example terraform.tfvars
tofu init
tofu plan
```

Set `manage_worker_custom_domains = false` until the Worker service has been deployed at least once.

After apply, copy the `settings_kv_namespaces` output into the Worker binding configuration as `SETTINGS_KV` for each environment.

Worker custom domains intentionally attach to the Cloudflare Worker service environment named `production`. Wrangler environment deploys create separate Worker service names, such as `forage-worker-staging`, and each of those services exposes its deployed code under Cloudflare's service-level `production` environment.

Pages custom domain DNS is managed by OpenTofu when `manage_pages_domains = true`. Production points at `<pages_project_name>.pages.dev`; non-production environments point at `<environment>.<pages_project_name>.pages.dev`, so the Pages branch name must match the environment key.

Security controls are opt-in:

```hcl
manage_security_controls = true
manage_staging_access    = true

staging_access_allowed_emails = [
  "operator@example.com",
]
```

`manage_security_controls` creates zone-level WAF rules and a combined API/auth rate-limit rule for the configured hosted domains. `manage_staging_access` creates a Cloudflare Access self-hosted application for the staging web hostname when at least one allowed email is configured.

The staging Access app defaults to `SameSite=Lax` cookies and the canonical custom staging hostname only. Keep `staging_access_extra_hostnames` empty unless a second hostname has been explicitly tested, because mixing the custom hostname and `pages.dev` branch hostname in one Access app can create confusing cross-host redirect/session behavior.

The default combined rate limit uses a 10-second period, 10-second mitigation timeout, and `block` action because some Cloudflare plans only allow one rate-limit rule per zone with those `http_ratelimit` values. Raise the entitlement-specific values only after confirming the active zone plan allows them.

For a temporary local token named `TEMP_CLOUDFLARE_API_TOKEN`, run plans with:

```sh
CLOUDFLARE_API_TOKEN="$TEMP_CLOUDFLARE_API_TOKEN" tofu plan
```

If the same OpenTofu state already manages Pages, KV, DNS, or Worker custom domains, a normal `tofu plan` refreshes those resources too. The API token must therefore be able to read existing managed resources, not only the new security resources. A narrow security-only token can validate the new resources with `-refresh=false`, but use a full infra/deploy token for normal apply runs.

Use [Deployment Automation](./23-deployment-automation.md) for the GitHub Actions workflow, repository secrets, GitHub environment variables, and first deployment order.

## Sources Checked

- [Cloudflare Terraform overview](https://developers.cloudflare.com/terraform/)
- [Cloudflare Workers infrastructure-as-code guidance](https://developers.cloudflare.com/workers/platform/infrastructure-as-code/)
- [Cloudflare Terraform Pages resources](https://developers.cloudflare.com/api/terraform/resources/pages)
- [Cloudflare Terraform Workers resources](https://developers.cloudflare.com/api/terraform/resources/workers/)
- [Cloudflare Terraform KV resources](https://developers.cloudflare.com/api/terraform/resources/kv/)
- [Cloudflare Terraform Workers custom domain resources](https://developers.cloudflare.com/api/terraform/resources/workers/subresources/domains/)
