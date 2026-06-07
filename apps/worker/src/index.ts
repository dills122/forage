import { deleteAccount } from "./account-handlers";
import { AuthCoordinator } from "./auth-coordinator";
import { configPayload, json, responseHeaders } from "./http";
import { finishGitHubAuth, startGitHubAuth } from "./oauth-handlers";
import { enforceRateLimit } from "./rate-limit";
import { getSessionResponse, logout } from "./session-handlers";
import { getSettings, updateSettings } from "./settings-handlers";
import { fetchStarred } from "./starred-handlers";
import type { Env } from "./types";

export { AuthCoordinator };

async function route(request: Request, env: Env) {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: responseHeaders(request, env),
    });
  }

  if (url.pathname === "/health" || url.pathname === "/api/health") {
    return json(request, env, {
      ok: true,
      service: "forage-worker",
      privacy_boundary: "no repository data stored server-side",
    });
  }

  if (url.pathname === "/api/config") {
    return json(request, env, configPayload(request, env));
  }

  if (url.pathname === "/auth/github") {
    const rateLimitResponse = await enforceRateLimit(request, env, "auth-start", 20, 60);
    if (rateLimitResponse) return rateLimitResponse;
    return await startGitHubAuth(request, env);
  }

  if (url.pathname === "/auth/github/callback") {
    const rateLimitResponse = await enforceRateLimit(request, env, "auth-callback", 30, 10 * 60);
    if (rateLimitResponse) return rateLimitResponse;
    return finishGitHubAuth(request, env);
  }

  if (url.pathname === "/api/session") {
    return getSessionResponse(request, env);
  }

  if (url.pathname === "/api/logout" && request.method === "POST") {
    return logout(request, env);
  }

  if (url.pathname === "/api/settings" && request.method === "GET") {
    return getSettings(request, env);
  }

  if (url.pathname === "/api/settings" && request.method === "PUT") {
    return updateSettings(request, env);
  }

  if (url.pathname === "/api/account" && request.method === "DELETE") {
    return deleteAccount(request, env);
  }

  if (url.pathname === "/api/github/starred") {
    const rateLimitResponse = await enforceRateLimit(request, env, "github-starred", 180, 60);
    if (rateLimitResponse) return rateLimitResponse;
    return fetchStarred(request, env);
  }

  return json(request, env, { error: "Not found" }, { status: 404 });
}

export default {
  fetch(request, env) {
    return route(request, env);
  },
} satisfies ExportedHandler<Env>;
