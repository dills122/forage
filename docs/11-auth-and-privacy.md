# Auth & Privacy

Status:
Selected MVP Direction

Forage is a website that connects to GitHub so it can import the authenticated user's starred repositories.

Selected approach:
Use a GitHub App user authorization flow for MVP. Forage should behave like an authorized website integration, not a GitHub-site workflow users operate from inside GitHub.

Fallback:
A standard OAuth App remains the fallback only if the GitHub App flow cannot cleanly support this narrow read-only user-stars use case.

Forage account model:
Forage has a minimal server-side user record, but it is not a general product account.

Stored in Cloudflare:
- Short-lived GitHub user access tokens inside encrypted session state
- Non-obvious GitHub user hash
- Session state
- OAuth state with PKCE verifier
- Opt-in or opt-out preferences
- Small settings records
- Aggregate analytics if enabled

Not stored in Cloudflare:
- Starred repository lists
- Repository metadata imported from GitHub
- Analysis results
- Generated reports
- User exports

Privacy requirements:
- Do not store raw GitHub usernames unless the product explicitly needs them.
- Do not store repository data on the server.
- Keep analytics aggregate-only.
- Make analytics preference clear and reversible.
- Provide local data reset in the app.
- Provide deletion for minimal server-side account state.
- Document what is stored server-side in user-facing language.

Implemented MVP decisions:
- Use GitHub App user authorization with OAuth `state` and PKCE S256.
- Use expiring GitHub App user access tokens.
- Do not persist refresh tokens for MVP.
- Require reconnect after the GitHub access token or Forage session expires.
- Store session and OAuth coordination in a Cloudflare Durable Object when deployed.
- Store settings under a salted GitHub user id hash.
- Require session-bound CSRF tokens for mutating Worker requests.
- Delete minimal server-side settings/session state through `DELETE /api/account`.

Open implementation decisions:
- Final production and staging hostnames.
- Final user-facing copy for server-side deletion and local data reset.
- Whether a future background refresh feature justifies encrypted refresh-token rotation.

Hosting/security reference:
See [Hosting And Security Plan](./20-hosting-and-security.md).
