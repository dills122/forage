import { fetchStarredRepositoriesPage, GitHubApiError } from "@forage/github";
import type { ApplicationSettings, ApplicationSettingsUpdate } from "@forage/shared";

interface Env {
  ENVIRONMENT?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GITHUB_REDIRECT_URI?: string;
  GITHUB_API_VERSION?: string;
  WEB_ORIGIN?: string;
  SETTINGS_HASH_SALT?: string;
  SESSION_ENCRYPTION_KEY?: string;
  SETTINGS_KV?: KVNamespace;
  SESSION_KV?: KVNamespace;
  OAUTH_STATE_KV?: KVNamespace;
  AUTH_COORDINATOR?: DurableObjectNamespace;
}

interface Session {
  accessToken: string;
  tokenType: string;
  scope: string;
  createdAt: string;
  csrfToken: string;
  accessTokenExpiresAt?: string;
  settings: ApplicationSettings;
  githubUserHash?: string;
}

interface OAuthStateRecord {
  createdAt: number;
  codeVerifier: string;
}

interface EncryptedSessionRecord {
  version: 1;
  algorithm: "AES-GCM";
  iv: string;
  ciphertext: string;
}

interface StoredSessionRecord {
  record: EncryptedSessionRecord;
  expiresAt: number;
  githubUserHash?: string;
}

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

interface GitHubUserIdentity {
  id: number | null;
  login: string | null;
  rateLimit: ReturnType<typeof rateLimitFromHeaders>;
}

const sessions = new Map<string, Session>();
const oauthStates = new Map<string, number>();
const oauthStateRecords = new Map<string, OAuthStateRecord>();
const userSessionIndexes = new Map<string, Set<string>>();
const rateLimits = new Map<string, RateLimitRecord>();

const defaultApiVersion = "2022-11-28";
const defaultWebOrigin = "http://127.0.0.1:4321";
const oauthStateTtlSeconds = 10 * 60;
const sessionTtlSeconds = 8 * 60 * 60;

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

function githubHeaders(accessToken: string, apiVersion: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${accessToken}`,
    "User-Agent": "forage",
    "X-GitHub-Api-Version": apiVersion,
  };
}

function json(request: Request, env: Env, payload: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(payload, null, 2), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...responseHeaders(request, env),
      ...init.headers,
    },
  });
}

function redirect(location: string, cookies: string[] = [], request: Request, env: Env) {
  const headers = new Headers({
    Location: location,
    ...responseHeaders(request, env),
  });
  for (const value of cookies) headers.append("Set-Cookie", value);
  return new Response(null, { status: 302, headers });
}

function responseHeaders(request: Request, env: Env) {
  return {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    ...corsHeaders(request, env),
  };
}

function corsHeaders(request: Request, env: Env) {
  const origin = request.headers.get("origin");
  const allowedOrigin = webOrigin(env);
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,X-Forage-CSRF",
    "Access-Control-Allow-Credentials": "true",
  };

  if (origin === allowedOrigin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  }

  return headers;
}

function configPayload(request: Request, env: Env) {
  const githubConfigured = Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET);
  const basePayload = {
    auth_type: "github-app-user-authorization",
    github_configured: githubConfigured,
    stores_repository_data: false,
  };

  if (isProduction(env)) return basePayload;

  return {
    ...basePayload,
    has_github_client_id: Boolean(env.GITHUB_CLIENT_ID),
    has_github_client_secret: Boolean(env.GITHUB_CLIENT_SECRET),
    redirect_uri: redirectUri(request, env),
    github_api_version: githubApiVersion(env),
    web_origin: webOrigin(env),
    session_store: sessionStore(env),
    oauth_state_store: oauthStateStore(env),
  };
}

function isProduction(env: Env) {
  return env.ENVIRONMENT === "production";
}

function hasValidCsrfToken(request: Request, session: Session) {
  return request.headers.get("x-forage-csrf") === session.csrfToken;
}

function defaultSettings(): ApplicationSettings {
  return {
    analytics_enabled: false,
    updated_at: null,
  };
}

async function loadSettings(session: Session, env: Env): Promise<ApplicationSettings> {
  if (!env.SETTINGS_KV) return session.settings;

  const key = await settingsKey(session, env);
  if (!key) return session.settings;
  const storedSettings = await env.SETTINGS_KV.get<ApplicationSettings>(key, "json");
  session.settings = storedSettings ?? defaultSettings();
  return session.settings;
}

async function saveSettings(session: Session, env: Env, settings: ApplicationSettings) {
  session.settings = settings;
  await persistSessionIfNeeded(session, env);
  if (!env.SETTINGS_KV) return;

  const key = await settingsKey(session, env);
  if (!key) return;
  await env.SETTINGS_KV.put(key, JSON.stringify(settings));
}

async function settingsKey(session: Session, env: Env) {
  if (session.githubUserHash) return `settings:${session.githubUserHash}`;

  const githubUserHash = await ensureSessionUserHash(session, env);
  return githubUserHash ? settingsKeyFromHash(githubUserHash) : null;
}

async function ensureSessionUserHash(session: Session, env: Env) {
  if (session.githubUserHash) return session.githubUserHash;

  const identity = await getGitHubUserIdentity(session, env);
  if (!identity.ok || identity.user.id === null) return null;

  session.githubUserHash = await hashGitHubUserId(identity.user.id, env);
  await persistSessionIfNeeded(session, env);
  return session.githubUserHash;
}

function settingsKeyFromHash(githubUserHash: string) {
  return `settings:${githubUserHash}`;
}

async function hashGitHubUserId(userId: number, env: Env) {
  const salt = env.SETTINGS_HASH_SALT || env.GITHUB_CLIENT_SECRET || "forage-local-dev";
  const data = new TextEncoder().encode(`github-user:${userId}:${salt}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function settingsStore(env: Env) {
  return env.SETTINGS_KV ? "cloudflare-kv" : "in-memory-dev";
}

function sessionStore(env: Env) {
  if (env.AUTH_COORDINATOR) return "durable-object-encrypted";
  return env.SESSION_KV ? "cloudflare-kv-encrypted" : "in-memory-dev";
}

function oauthStateStore(env: Env) {
  if (env.AUTH_COORDINATOR) return "durable-object";
  return env.OAUTH_STATE_KV ? "cloudflare-kv" : "in-memory-dev";
}

async function saveOAuthState(state: string, record: OAuthStateRecord, env: Env) {
  if (env.AUTH_COORDINATOR) {
    await coordinatorFetch(env, oauthStateObjectName(state), "/oauth-state", {
      method: "PUT",
      body: JSON.stringify(record),
    });
    return;
  }

  if (!env.OAUTH_STATE_KV) {
    oauthStates.set(state, record.createdAt);
    oauthStateRecords.set(state, record);
    return;
  }

  await env.OAUTH_STATE_KV.put(oauthStateKey(state), JSON.stringify(record), {
    expirationTtl: oauthStateTtlSeconds,
  });
}

async function consumeOAuthState(state: string, env: Env) {
  if (env.AUTH_COORDINATOR) {
    const response = await coordinatorFetch(env, oauthStateObjectName(state), "/oauth-state", {
      method: "POST",
    });
    if (response.status === 404) return null;
    const record = (await response.json()) as OAuthStateRecord;
    return isFreshOAuthState(record) ? record : null;
  }

  if (!env.OAUTH_STATE_KV) {
    const record = oauthStateRecords.get(state);
    oauthStates.delete(state);
    oauthStateRecords.delete(state);
    return record && isFreshOAuthState(record) ? record : null;
  }

  const key = oauthStateKey(state);
  const payload = await env.OAUTH_STATE_KV.get<OAuthStateRecord>(key, "json");
  await env.OAUTH_STATE_KV.delete(key);
  return payload && isFreshOAuthState(payload) ? payload : null;
}

function isFreshOAuthState(record: OAuthStateRecord) {
  return Boolean(
    record.createdAt &&
      record.codeVerifier &&
      Date.now() - record.createdAt <= oauthStateTtlSeconds * 1000,
  );
}

async function saveSession(sessionId: string, session: Session, env: Env) {
  sessions.set(sessionId, session);
  if (env.AUTH_COORDINATOR) {
    const record = await encryptSession(session, env);
    const storedSession: StoredSessionRecord = {
      record,
      expiresAt: sessionExpiresAt(session),
    };
    if (session.githubUserHash) storedSession.githubUserHash = session.githubUserHash;

    await coordinatorFetch(env, sessionObjectName(sessionId), "/session", {
      method: "PUT",
      body: JSON.stringify(storedSession),
    });
    if (session.githubUserHash) {
      await trackUserSession(session.githubUserHash, sessionId, env);
    }
    return;
  }

  if (!env.SESSION_KV) return;

  const record = await encryptSession(session, env);
  await env.SESSION_KV.put(sessionKey(sessionId), JSON.stringify(record), {
    expirationTtl: sessionTtlSeconds,
  });
  if (session.githubUserHash) {
    await trackUserSession(session.githubUserHash, sessionId, env);
  }
}

async function loadSession(sessionId: string, env: Env) {
  if (env.AUTH_COORDINATOR) {
    const response = await coordinatorFetch(env, sessionObjectName(sessionId), "/session");
    if (response.status === 404) return null;
    const stored = (await response.json()) as StoredSessionRecord;
    try {
      return await decryptSession(stored.record, env);
    } catch {
      await coordinatorFetch(env, sessionObjectName(sessionId), "/session", { method: "DELETE" });
      return null;
    }
  }

  const memorySession = sessions.get(sessionId);
  if (memorySession) return memorySession;
  if (!env.SESSION_KV) return null;

  const record = await env.SESSION_KV.get<EncryptedSessionRecord>(sessionKey(sessionId), "json");
  if (!record) return null;

  try {
    const session = await decryptSession(record, env);
    sessions.set(sessionId, session);
    return session;
  } catch {
    await env.SESSION_KV.delete(sessionKey(sessionId));
    return null;
  }
}

async function deleteSession(sessionId: string, env: Env, session?: Session) {
  const sessionToDelete = session ?? (await loadSession(sessionId, env));
  sessions.delete(sessionId);
  if (sessionToDelete?.githubUserHash) {
    await untrackUserSession(sessionToDelete.githubUserHash, sessionId, env);
  }
  if (env.AUTH_COORDINATOR) {
    await coordinatorFetch(env, sessionObjectName(sessionId), "/session", { method: "DELETE" });
    return;
  }
  if (env.SESSION_KV) await env.SESSION_KV.delete(sessionKey(sessionId));
}

async function persistSessionIfNeeded(session: Session, env: Env) {
  for (const [sessionId, candidate] of sessions.entries()) {
    if (candidate === session) {
      await saveSession(sessionId, session, env);
      return;
    }
  }
}

async function trackUserSession(githubUserHash: string, sessionId: string, env: Env) {
  if (env.AUTH_COORDINATOR) {
    await coordinatorFetch(env, userSessionIndexObjectName(githubUserHash), "/session-index", {
      method: "PUT",
      body: JSON.stringify({ sessionId }),
    });
    return;
  }

  const localIndex = userSessionIndexes.get(githubUserHash) ?? new Set<string>();
  localIndex.add(sessionId);
  userSessionIndexes.set(githubUserHash, localIndex);

  if (!env.SESSION_KV) return;
  const key = userSessionIndexKey(githubUserHash);
  const stored = (await env.SESSION_KV.get<string[]>(key, "json")) ?? [];
  await env.SESSION_KV.put(key, JSON.stringify([...new Set([...stored, sessionId])]), {
    expirationTtl: sessionTtlSeconds,
  });
}

async function untrackUserSession(githubUserHash: string, sessionId: string, env: Env) {
  if (env.AUTH_COORDINATOR) {
    await coordinatorFetch(env, userSessionIndexObjectName(githubUserHash), "/session-index", {
      method: "DELETE",
      body: JSON.stringify({ sessionId }),
    });
    return;
  }

  const localIndex = userSessionIndexes.get(githubUserHash);
  localIndex?.delete(sessionId);

  if (!env.SESSION_KV) return;
  const key = userSessionIndexKey(githubUserHash);
  const stored = (await env.SESSION_KV.get<string[]>(key, "json")) ?? [];
  await env.SESSION_KV.put(
    key,
    JSON.stringify(stored.filter((storedSessionId) => storedSessionId !== sessionId)),
    {
      expirationTtl: sessionTtlSeconds,
    },
  );
}

async function deleteSessionsForUser(githubUserHash: string, env: Env) {
  const sessionIds = await listUserSessions(githubUserHash, env);
  await Promise.all(sessionIds.map((sessionId) => deleteSession(sessionId, env)));
  if (env.AUTH_COORDINATOR) {
    await coordinatorFetch(env, userSessionIndexObjectName(githubUserHash), "/session-index/all", {
      method: "DELETE",
    });
    return;
  }

  userSessionIndexes.delete(githubUserHash);
  if (env.SESSION_KV) await env.SESSION_KV.delete(userSessionIndexKey(githubUserHash));
}

async function listUserSessions(githubUserHash: string, env: Env) {
  if (env.AUTH_COORDINATOR) {
    const response = await coordinatorFetch(
      env,
      userSessionIndexObjectName(githubUserHash),
      "/session-index",
    );
    if (response.status === 404) return [];
    const payload = (await response.json()) as { sessionIds?: string[] };
    return payload.sessionIds ?? [];
  }

  const localIndex = userSessionIndexes.get(githubUserHash);
  if (localIndex) return [...localIndex];
  if (!env.SESSION_KV) return [];
  return (await env.SESSION_KV.get<string[]>(userSessionIndexKey(githubUserHash), "json")) ?? [];
}

async function encryptSession(session: Session, env: Env): Promise<EncryptedSessionRecord> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(session));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    await sessionEncryptionKey(env),
    encoded,
  );

  return {
    version: 1,
    algorithm: "AES-GCM",
    iv: base64UrlEncode(iv),
    ciphertext: base64UrlEncode(new Uint8Array(ciphertext)),
  };
}

async function decryptSession(record: EncryptedSessionRecord, env: Env): Promise<Session> {
  if (record.version !== 1 || record.algorithm !== "AES-GCM") {
    throw new Error("Unsupported session record");
  }

  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64UrlDecode(record.iv),
    },
    await sessionEncryptionKey(env),
    base64UrlDecode(record.ciphertext),
  );

  return JSON.parse(new TextDecoder().decode(plaintext)) as Session;
}

async function sessionEncryptionKey(env: Env) {
  const secret = env.SESSION_ENCRYPTION_KEY || env.GITHUB_CLIENT_SECRET;
  if (!secret) {
    throw new Error("Missing SESSION_ENCRYPTION_KEY or GITHUB_CLIENT_SECRET");
  }

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return await crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

function sessionKey(sessionId: string) {
  return `session:${sessionId}`;
}

function oauthStateKey(state: string) {
  return `oauth-state:${state}`;
}

function tokenExpiresAt(expiresInSeconds: number | undefined) {
  if (!expiresInSeconds) return undefined;
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

function sessionExpiresAt(session: Session) {
  const sessionExpiry = Date.parse(session.createdAt) + sessionTtlSeconds * 1000;
  const tokenExpiry = session.accessTokenExpiresAt
    ? Date.parse(session.accessTokenExpiresAt)
    : sessionExpiry;
  return Math.min(sessionExpiry, tokenExpiry);
}

function isSessionExpired(session: Session) {
  return Date.now() >= sessionExpiresAt(session);
}

function userSessionIndexKey(githubUserHash: string) {
  return `user-sessions:${githubUserHash}`;
}

function oauthStateObjectName(state: string) {
  return `oauth-state:${state}`;
}

function sessionObjectName(sessionId: string) {
  return `session:${sessionId}`;
}

function userSessionIndexObjectName(githubUserHash: string) {
  return `user-sessions:${githubUserHash}`;
}

function rateLimitObjectName(bucket: string, key: string) {
  return `rate-limit:${bucket}:${key}`;
}

async function coordinatorFetch(
  env: Env,
  objectName: string,
  path: string,
  init: RequestInit = {},
) {
  if (!env.AUTH_COORDINATOR) throw new Error("Missing AUTH_COORDINATOR binding");
  const id = env.AUTH_COORDINATOR.idFromName(objectName);
  const stub = env.AUTH_COORDINATOR.get(id);
  return await stub.fetch(`https://forage-auth.local${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

async function enforceRateLimit(
  request: Request,
  env: Env,
  bucket: string,
  limit: number,
  windowSeconds: number,
) {
  const key = await operationalHash(`${bucket}:${clientKey(request)}`, env);
  const result = await checkRateLimit(env, bucket, key, limit, windowSeconds);
  if (result.allowed) return null;

  return json(
    request,
    env,
    {
      error: "Too many requests. Try again shortly.",
      retry_after_seconds: result.retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
      },
    },
  );
}

async function checkRateLimit(
  env: Env,
  bucket: string,
  key: string,
  limit: number,
  windowSeconds: number,
) {
  if (env.AUTH_COORDINATOR) {
    const response = await coordinatorFetch(env, rateLimitObjectName(bucket, key), "/rate-limit", {
      method: "POST",
      body: JSON.stringify({ limit, windowSeconds }),
    });
    return (await response.json()) as { allowed: boolean; retryAfterSeconds: number };
  }

  const rateLimitKey = `${bucket}:${key}`;
  const now = Date.now();
  const current = rateLimits.get(rateLimitKey);
  if (!current || now >= current.resetAt) {
    rateLimits.set(rateLimitKey, {
      count: 1,
      resetAt: now + windowSeconds * 1000,
    });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  current.count += 1;
  return {
    allowed: current.count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
  };
}

function clientKey(request: Request) {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "local"
  );
}

async function operationalHash(value: string, env: Env) {
  const salt = env.SETTINGS_HASH_SALT || env.GITHUB_CLIENT_SECRET || "forage-local-dev";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${value}:${salt}`),
  );
  return base64UrlEncode(new Uint8Array(digest));
}

function createPkceVerifier() {
  return createId();
}

async function createPkceChallenge(verifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

async function getGitHubUserIdentity(session: Session, env: Env) {
  const response = await fetch("https://api.github.com/user", {
    headers: githubHeaders(session.accessToken, githubApiVersion(env)),
  });
  const payload = (await response.json().catch(() => null)) as {
    login?: string;
    id?: number;
  } | null;
  const rateLimit = rateLimitFromHeaders(response.headers);

  if (!response.ok) {
    return {
      ok: false as const,
      status: response.status,
      rateLimit,
    };
  }

  return {
    ok: true as const,
    user: {
      id: payload?.id ?? null,
      login: payload?.login ?? null,
      rateLimit,
    } satisfies GitHubUserIdentity,
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

function cookie(request: Request, name: string, value: string, options: { maxAge?: number } = {}) {
  const url = new URL(request.url);
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (url.protocol === "https:") parts.push("Secure");
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  return parts.join("; ");
}

function parseCookies(header: string | null) {
  if (!header) return {} as Record<string, string>;

  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

function createId() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

function base64UrlEncode(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

function redirectUri(request: Request, env: Env) {
  if (env.GITHUB_REDIRECT_URI) return env.GITHUB_REDIRECT_URI;
  const url = new URL(request.url);
  return `${url.origin}/auth/github/callback`;
}

function githubApiVersion(env: Env) {
  return env.GITHUB_API_VERSION ?? defaultApiVersion;
}

function webOrigin(env: Env) {
  return env.WEB_ORIGIN ?? defaultWebOrigin;
}

function rateLimitFromHeaders(headers: Headers) {
  return {
    limit: headers.get("x-ratelimit-limit"),
    remaining: headers.get("x-ratelimit-remaining"),
    reset: headers.get("x-ratelimit-reset"),
    used: headers.get("x-ratelimit-used"),
    resource: headers.get("x-ratelimit-resource"),
  };
}

export class AuthCoordinator {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request) {
    const url = new URL(request.url);

    if (url.pathname === "/oauth-state") {
      return await this.handleOAuthState(request);
    }

    if (url.pathname === "/session") {
      return await this.handleSession(request);
    }

    if (url.pathname === "/session-index") {
      return await this.handleSessionIndex(request);
    }

    if (url.pathname === "/session-index/all" && request.method === "DELETE") {
      await this.state.storage.delete("sessionIds");
      return new Response(null, { status: 204 });
    }

    if (url.pathname === "/rate-limit" && request.method === "POST") {
      return await this.handleRateLimit(request);
    }

    return new Response("Not found", { status: 404 });
  }

  private async handleOAuthState(request: Request) {
    if (request.method === "PUT") {
      await this.state.storage.put("record", await request.json<OAuthStateRecord>());
      return new Response(null, { status: 204 });
    }

    if (request.method === "POST") {
      const record = await this.state.storage.get<OAuthStateRecord>("record");
      await this.state.storage.delete("record");
      if (!record) return new Response(null, { status: 404 });
      return jsonFromObject(record);
    }

    return new Response("Method not allowed", { status: 405 });
  }

  private async handleSession(request: Request) {
    if (request.method === "PUT") {
      await this.state.storage.put("record", await request.json<StoredSessionRecord>());
      return new Response(null, { status: 204 });
    }

    if (request.method === "GET") {
      const stored = await this.state.storage.get<StoredSessionRecord>("record");
      if (!stored) return new Response(null, { status: 404 });
      if (Date.now() >= stored.expiresAt) {
        await this.state.storage.delete("record");
        return new Response(null, { status: 404 });
      }
      return jsonFromObject(stored);
    }

    if (request.method === "DELETE") {
      await this.state.storage.delete("record");
      return new Response(null, { status: 204 });
    }

    return new Response("Method not allowed", { status: 405 });
  }

  private async handleSessionIndex(request: Request) {
    if (request.method === "GET") {
      const sessionIds = (await this.state.storage.get<string[]>("sessionIds")) ?? [];
      return jsonFromObject({ sessionIds });
    }

    const payload = (await request.json().catch(() => ({}))) as { sessionId?: string };
    if (!payload.sessionId) return new Response("Invalid session index payload", { status: 400 });

    const sessionIds = (await this.state.storage.get<string[]>("sessionIds")) ?? [];
    if (request.method === "PUT") {
      await this.state.storage.put("sessionIds", [...new Set([...sessionIds, payload.sessionId])]);
      return new Response(null, { status: 204 });
    }

    if (request.method === "DELETE") {
      await this.state.storage.put(
        "sessionIds",
        sessionIds.filter((sessionId) => sessionId !== payload.sessionId),
      );
      return new Response(null, { status: 204 });
    }

    return new Response("Method not allowed", { status: 405 });
  }

  private async handleRateLimit(request: Request) {
    const { limit, windowSeconds } = await request.json<{
      limit?: number;
      windowSeconds?: number;
    }>();
    if (!limit || !windowSeconds) {
      return jsonFromObject({ allowed: false, retryAfterSeconds: 60 }, { status: 400 });
    }

    const now = Date.now();
    const current = await this.state.storage.get<RateLimitRecord>("record");
    if (!current || now >= current.resetAt) {
      await this.state.storage.put("record", {
        count: 1,
        resetAt: now + windowSeconds * 1000,
      } satisfies RateLimitRecord);
      return jsonFromObject({ allowed: true, retryAfterSeconds: 0 });
    }

    const next = {
      ...current,
      count: current.count + 1,
    };
    await this.state.storage.put("record", next);
    return jsonFromObject({
      allowed: next.count <= limit,
      retryAfterSeconds: Math.max(1, Math.ceil((next.resetAt - now) / 1000)),
    });
  }
}

function jsonFromObject(payload: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...init.headers,
    },
  });
}

export default {
  fetch(request, env) {
    return route(request, env);
  },
} satisfies ExportedHandler<Env>;
