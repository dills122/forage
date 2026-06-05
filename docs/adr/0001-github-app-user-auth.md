# ADR 0001: GitHub App User Authorization

Status:
Accepted

Context:
Forage is a website that needs to act on behalf of the current user to import their starred GitHub repositories.

Decision:
Use GitHub App user authorization for MVP. Forage should behave as an authorized website integration, not a workflow users operate from inside GitHub.

Consequences:
- The app can request narrow user permissions.
- The MVP auth model aligns with GitHub's preferred app model.
- The backend must handle the authorization callback, token exchange, session state, and secure token storage.
- Standard OAuth App auth remains a fallback only if GitHub App user authorization blocks the stars import use case.

Validation:
The pre-MVP spike successfully authorized GitHub and imported starred repositories.
