import { cookie, hasValidCsrfToken, json } from "./http";
import { getSessionLookup } from "./request-session";
import { deleteSession, deleteSessionsForUser } from "./session-store";
import { ensureSessionUserHash, settingsKeyFromHash } from "./settings";
import type { Env } from "./types";

export async function deleteAccount(request: Request, env: Env) {
  const lookup = await getSessionLookup(request, env);
  if (!lookup.session) {
    return json(request, env, { error: "Not authenticated" }, { status: 401 });
  }
  if (!hasValidCsrfToken(request, lookup.session)) {
    return json(request, env, { error: "Invalid CSRF token" }, { status: 403 });
  }

  const githubUserHash = await ensureSessionUserHash(lookup.session, env);
  if (githubUserHash && env.SETTINGS_KV) {
    await env.SETTINGS_KV.delete(settingsKeyFromHash(githubUserHash));
  }
  if (githubUserHash) {
    await deleteSessionsForUser(githubUserHash, env);
  }
  if (lookup.sessionId) {
    await deleteSession(lookup.sessionId, env, lookup.session);
  }

  return json(
    request,
    env,
    {
      ok: true,
      deleted_server_state: true,
      stores_repository_data: false,
    },
    {
      headers: {
        "Set-Cookie": cookie(request, "forage_session", "", { maxAge: 0 }),
      },
    },
  );
}
