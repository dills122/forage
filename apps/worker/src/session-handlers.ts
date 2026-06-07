import { getGitHubUserIdentity } from "./github";
import { cookie, hasValidCsrfToken, json } from "./http";
import { getSessionLookup } from "./request-session";
import { deleteSession } from "./session-store";
import type { Env } from "./types";

export async function getSessionResponse(request: Request, env: Env) {
  const lookup = await getSessionLookup(request, env);
  if (!lookup.session) {
    return json(request, env, {
      authenticated: false,
      error: lookup.expired ? "GitHub session expired. Reconnect GitHub to continue." : undefined,
    });
  }

  const identity = await getGitHubUserIdentity(lookup.session, env);
  if (!identity.ok) {
    if (lookup.sessionId) await deleteSession(lookup.sessionId, env, lookup.session);
    return json(
      request,
      env,
      {
        authenticated: false,
        error: "GitHub session validation failed",
        rate_limit: identity.rateLimit,
      },
      {
        status: identity.status,
        headers: {
          "Set-Cookie": cookie(request, "forage_session", "", { maxAge: 0 }),
        },
      },
    );
  }

  return json(request, env, {
    authenticated: true,
    user: {
      login: identity.user.login,
      id: identity.user.id,
    },
    token_type: lookup.session.tokenType,
    scope: lookup.session.scope,
    created_at: lookup.session.createdAt,
    access_token_expires_at: lookup.session.accessTokenExpiresAt,
    csrf_token: lookup.session.csrfToken,
    rate_limit: identity.user.rateLimit,
  });
}

export async function logout(request: Request, env: Env) {
  const lookup = await getSessionLookup(request, env);
  if (lookup.session && !hasValidCsrfToken(request, lookup.session)) {
    return json(request, env, { error: "Invalid CSRF token" }, { status: 403 });
  }

  if (lookup.sessionId) {
    await deleteSession(lookup.sessionId, env, lookup.session ?? undefined);
  }

  return json(
    request,
    env,
    { ok: true },
    {
      headers: {
        "Set-Cookie": cookie(request, "forage_session", "", { maxAge: 0 }),
      },
    },
  );
}
