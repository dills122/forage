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
- GitHub token material or token references needed for API access
- Non-obvious GitHub user hash
- Session state
- OAuth state
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
- Document what is stored server-side in user-facing language.

Open implementation decisions:
- Exact token storage approach, using the normal secure pattern for Cloudflare and GitHub App auth.
- Session duration, using conventional web-app defaults.
- Token refresh behavior, using GitHub App defaults where possible.
- Account deletion behavior for the minimal server record.
- Whether settings are keyed by a GitHub hash, app-specific user id, or both.
