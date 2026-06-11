# Cloudflare Token Permissions

Status:
Operator reference for local OpenTofu, deploy workflow, and temporary recovery tokens

Cloudflare API tokens should be short-lived when used locally and scoped as narrowly as the Cloudflare UI allows. Prefer zone-scoped policies for `shrimpworks.dev` over all-zone policies. Revoke temporary tokens after the apply or recovery task is complete.

Do not commit token values. Use local `.env`, GitHub Actions secrets, or a password manager.

## Token Types

Use three token profiles:

- Full infra token: local OpenTofu plan/apply for all resources in `infra/opentofu`.
- Deploy token: GitHub Actions or local Wrangler deploys for Worker and Pages code deployment.
- Security recovery token: temporary targeted updates to WAF, rate limits, or Access resources.

The full infra token can do everything the security recovery token can do. The security recovery token may require `tofu apply -refresh=false -target=...` because a normal OpenTofu plan refreshes every resource already in state.

## Full Infra Token

Use this for normal local `tofu plan` and `tofu apply` from `infra/opentofu`.

Account-level permissions:
- Pages Read
- Pages Write
- Workers KV Storage Read
- Workers KV Storage Write
- Workers Scripts Read
- Workers Scripts Write
- Access Apps and Policies Read
- Access Apps and Policies Write
- Access Organizations Read
- Zero Trust Read

Zone-level permissions for the Forage zone:
- Zone Read
- DNS Read
- DNS Write
- Zone WAF Read
- Zone WAF Write

Why it needs broad read access:
- OpenTofu refreshes every resource in state before planning changes.
- Current state includes Pages, KV namespaces, Worker custom domains, DNS records, WAF rulesets, rate-limit rulesets, and Access resources.
- A token that can write only Access or WAF may still fail a normal plan while refreshing Pages, KV, or Worker domain resources.

Recommended local command:

```sh
cd infra/opentofu
CLOUDFLARE_API_TOKEN="$TEMP_CLOUDFLARE_API_TOKEN" tofu plan
```

## Deploy Token

Use this as GitHub secret `CLOUDFLARE_API_TOKEN` for `.github/workflows/deploy.yml`.

Account-level permissions:
- Pages Read
- Pages Write
- Workers Scripts Read
- Workers Scripts Write

Zone-level permissions for the Forage zone:
- Zone Read
- DNS Read

Notes:
- The deploy workflow uploads Worker code and Pages assets.
- It does not need to manage WAF, rate limits, Access policies, KV namespaces, or DNS records directly.
- Keep GitHub App client secrets in Cloudflare Worker secrets, not GitHub repository variables.

## Security Recovery Token

Use this for short-lived local fixes to Cloudflare Access, WAF, or rate limiting.

Account-level permissions:
- Access Apps and Policies Read
- Access Apps and Policies Write
- Access Organizations Read
- Zero Trust Read

Zone-level permissions for the Forage zone:
- Zone Read
- Zone WAF Read
- Zone WAF Write

If this token does not include Pages, KV, Worker, and DNS read permissions, use targeted applies only after reviewing the targeted plan:

```sh
cd infra/opentofu
CLOUDFLARE_API_TOKEN="$TEMP_CLOUDFLARE_API_TOKEN" \
  tofu plan -refresh=false -target='cloudflare_zero_trust_access_application.staging_web[0]'
```

```sh
cd infra/opentofu
CLOUDFLARE_API_TOKEN="$TEMP_CLOUDFLARE_API_TOKEN" \
  tofu apply -refresh=false -target='cloudflare_zero_trust_access_application.staging_web[0]'
```

Use targeted applies only for recovery. Follow with a normal full-token `tofu plan` when possible to confirm full state convergence.

## Current Cloudflare Plan Constraints

The active Forage Cloudflare plan currently requires:

- One `http_ratelimit` rule per zone.
- 10-second rate-limit period.
- 10-second mitigation timeout.
- `block` action for rate limiting.

Do not change these defaults unless the Cloudflare zone plan is upgraded and the new entitlement is verified with `tofu plan` and `tofu apply`.

## Temporary Token Cleanup

After local setup or recovery:

1. Run a final `tofu plan` with the full infra token when available.
2. Confirm the plan reports `No changes`.
3. Revoke the temporary token in Cloudflare.
4. Remove `TEMP_CLOUDFLARE_API_TOKEN` from local `.env` if it is no longer needed.
