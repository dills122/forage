import { fetchStarredRepositoriesPage, GitHubApiError } from "@forage/github";
import type { ApplicationSettingsUpdate } from "@forage/shared";
import { AuthCoordinator } from "./auth-coordinator";
import { oauthStateTtlSeconds, sessionTtlSeconds } from "./constants";
import { createId, createPkceChallenge, createPkceVerifier, hashGitHubUserId } from "./crypto";
import { githubApiVersion, redirectUri, settingsStore, webOrigin } from "./env";
import { getGitHubUserIdentity } from "./github";
import {
  configPayload,
  cookie,
  hasValidCsrfToken,
  json,
  parseCookies,
  redirect,
  responseHeaders,
} from "./http";
import { enforceRateLimit } from "./rate-limit";
import {
  consumeOAuthState,
  deleteSession,
  deleteSessionsForUser,
  isSessionExpired,
  loadSession,
  saveOAuthState,
  saveSession,
  tokenExpiresAt,
} from "./session-store";
import {
  defaultSettings,
  ensureSessionUserHash,
  loadSettings,
  saveSettings,
  settingsKeyFromHash,
} from "./settings";
import type { Env, Session } from "./types";

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

async function startGitHubAuth(request: Request, env: Env) {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return json(
      request,
      env,
      { error: "Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET" },
      { status: 500 },
    );
  }

  const state = createId();
  const codeVerifier = createPkceVerifier();
  const codeChallenge = await createPkceChallenge(codeVerifier);
  await saveOAuthState(
    state,
    {
      createdAt: Date.now(),
      codeVerifier,
    },
    env,
  );

  const authUrl = new URL("https://github.com/login/oauth/authorize");
  authUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri(request, env));
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  return redirect(
    authUrl.toString(),
    [cookie(request, "forage_oauth_state", state, { maxAge: oauthStateTtlSeconds })],
    request,
    env,
  );
}

async function finishGitHubAuth(request: Request, env: Env) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const cookies = parseCookies(request.headers.get("cookie"));

  const oauthState =
    state && code && cookies.forage_oauth_state === state
      ? await consumeOAuthState(state, env)
      : null;

  if (!oauthState || !code) {
    return json(request, env, { error: "Invalid GitHub auth state" }, { status: 400 });
  }

  try {
    const tokenPayload = await exchangeCodeForToken(request, env, code, oauthState.codeVerifier);
    const sessionId = createId();
    const session: Session = {
      accessToken: tokenPayload.access_token,
      tokenType: tokenPayload.token_type,
      scope: tokenPayload.scope,
      createdAt: new Date().toISOString(),
      csrfToken: createId(),
      settings: defaultSettings(),
    };
    const accessTokenExpiresAt = tokenExpiresAt(tokenPayload.expires_in);
    if (accessTokenExpiresAt) session.accessTokenExpiresAt = accessTokenExpiresAt;
    const identity = await getGitHubUserIdentity(session, env);
    if (identity.ok && identity.user.id !== null) {
      session.githubUserHash = await hashGitHubUserId(identity.user.id, env);
    }

    await saveSession(sessionId, session, env);

    return redirect(
      webOrigin(env),
      [
        cookie(request, "forage_session", sessionId, { maxAge: sessionTtlSeconds }),
        cookie(request, "forage_oauth_state", "", { maxAge: 0 }),
      ],
      request,
      env,
    );
  } catch (error) {
    return json(
      request,
      env,
      { error: error instanceof Error ? error.message : "GitHub token exchange failed" },
      { status: 502 },
    );
  }
}

async function getSessionResponse(request: Request, env: Env) {
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

async function logout(request: Request, env: Env) {
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

async function getSettings(request: Request, env: Env) {
  const lookup = await getSessionLookup(request, env);
  if (!lookup.session) {
    return json(request, env, { error: "Not authenticated" }, { status: 401 });
  }

  const settings = await loadSettings(lookup.session, env);
  return json(request, env, {
    settings,
    stores_repository_data: false,
    settings_store: settingsStore(env),
  });
}

async function updateSettings(request: Request, env: Env) {
  const lookup = await getSessionLookup(request, env);
  if (!lookup.session) {
    return json(request, env, { error: "Not authenticated" }, { status: 401 });
  }
  if (!hasValidCsrfToken(request, lookup.session)) {
    return json(request, env, { error: "Invalid CSRF token" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  if (!isSettingsUpdate(payload)) {
    return json(request, env, { error: "Invalid settings payload" }, { status: 400 });
  }

  const settings = {
    analytics_enabled: payload.analytics_enabled,
    updated_at: new Date().toISOString(),
  };
  await saveSettings(lookup.session, env, settings);

  return json(request, env, {
    settings,
    stores_repository_data: false,
    settings_store: settingsStore(env),
  });
}

async function fetchStarred(request: Request, env: Env) {
  const lookup = await getSessionLookup(request, env);
  if (!lookup.session) {
    return json(request, env, { error: "Not authenticated" }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") || 1);
  const perPage = Number(url.searchParams.get("per_page") || 100);

  try {
    const pageResult = await fetchStarredRepositoriesPage({
      accessToken: lookup.session.accessToken,
      apiVersion: githubApiVersion(env),
      page,
      perPage,
      fetcher: fetch,
    });

    return json(request, env, {
      page: pageResult.page,
      next_page: pageResult.nextPage,
      repositories: pageResult.repositories,
      rate_limit: pageResult.rateLimit,
      raw_field_names: pageResult.rawFieldNames,
    });
  } catch (error) {
    if (error instanceof GitHubApiError) {
      return json(
        request,
        env,
        { error: error.message, rate_limit: error.rateLimit },
        { status: error.status },
      );
    }

    return json(
      request,
      env,
      { error: error instanceof Error ? error.message : "GitHub starred import failed" },
      { status: 502 },
    );
  }
}

async function deleteAccount(request: Request, env: Env) {
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

async function exchangeCodeForToken(
  request: Request,
  env: Env,
  code: string,
  codeVerifier: string,
) {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri(request, env),
      code_verifier: codeVerifier,
    }),
  });

  const payload = (await response.json()) as {
    access_token?: string;
    token_type?: string;
    scope?: string;
    expires_in?: number;
    refresh_token?: string;
    refresh_token_expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || payload.error || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || "GitHub token exchange failed");
  }

  return {
    access_token: payload.access_token,
    token_type: payload.token_type ?? "bearer",
    scope: payload.scope ?? "",
    expires_in: payload.expires_in,
  };
}

async function getSessionLookup(request: Request, env: Env) {
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

function isSettingsUpdate(payload: unknown): payload is ApplicationSettingsUpdate {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "analytics_enabled" in payload &&
    typeof (payload as { analytics_enabled?: unknown }).analytics_enabled === "boolean"
  );
}

export default {
  fetch(request, env) {
    return route(request, env);
  },
} satisfies ExportedHandler<Env>;
