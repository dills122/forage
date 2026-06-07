import { parseCookies } from "./http";
import { deleteSession, isSessionExpired, loadSession } from "./session-store";
import type { Env } from "./types";

export async function getSessionLookup(request: Request, env: Env) {
  const cookies = parseCookies(request.headers.get("cookie"));
  const sessionId = cookies.forage_session;
  if (!sessionId) {
    return {
      sessionId: null,
      session: null,
      expired: false,
    };
  }

  const session = await loadSession(sessionId, env);
  if (!session) {
    return {
      sessionId,
      session: null,
      expired: false,
    };
  }

  if (isSessionExpired(session)) {
    await deleteSession(sessionId, env, session);
    return {
      sessionId,
      session: null,
      expired: true,
    };
  }

  return {
    sessionId,
    session,
    expired: false,
  };
}
