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
- Outputs for GitHub App homepage/callback URL values.
- Outputs for Worker and Pages environment variables.

Current manual scope:

- GitHub App creation and permissions.
- GitHub App client id/client secret storage.
- Worker secret values.
- First Worker code deployment with Wrangler.
- Any Cloudflare Git integration that requires a connected GitHub account.

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

Use [Deployment Automation](./23-deployment-automation.md) for the GitHub Actions workflow, repository secrets, GitHub environment variables, and first deployment order.

## Sources Checked

- [Cloudflare Terraform overview](https://developers.cloudflare.com/terraform/)
- [Cloudflare Workers infrastructure-as-code guidance](https://developers.cloudflare.com/workers/platform/infrastructure-as-code/)
- [Cloudflare Terraform Pages resources](https://developers.cloudflare.com/api/terraform/resources/pages)
- [Cloudflare Terraform Workers resources](https://developers.cloudflare.com/api/terraform/resources/workers/)
- [Cloudflare Terraform KV resources](https://developers.cloudflare.com/api/terraform/resources/kv/)
- [Cloudflare Terraform Workers custom domain resources](https://developers.cloudflare.com/api/terraform/resources/workers/subresources/domains/)
