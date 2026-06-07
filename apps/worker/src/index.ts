import { fetchStarredRepositoriesPage, GitHubApiError } from "@forage/github";
import type { ApplicationSettings, ApplicationSettingsUpdate } from "@forage/shared";

interface Env {
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
}

interface Session {
  accessToken: string;
  tokenType: string;
  scope: string;
  createdAt: string;
  settings: ApplicationSettings;
  githubUserHash?: string;
}

interface EncryptedSessionRecord {
  version: 1;
  algorithm: "AES-GCM";
  iv: string;
  ciphertext: string;
}

interface GitHubUserIdentity {
  id: number | null;
  login: string | null;
  rateLimit: ReturnType<typeof rateLimitFromHeaders>;
}

const sessions = new Map<string, Session>();
const oauthStates = new Map<string, number>();

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
    return json(request, env, {
      auth_type: "github-app-user-authorization",
      has_github_client_id: Boolean(env.GITHUB_CLIENT_ID),
      has_github_client_secret: Boolean(env.GITHUB_CLIENT_SECRET),
      redirect_uri: redirectUri(request, env),
      github_api_version: githubApiVersion(env),
      web_origin: webOrigin(env),
      stores_repository_data: false,
      session_store: sessionStore(env),
      oauth_state_store: oauthStateStore(env),
    });
  }

  if (url.pathname === "/auth/github") {
    return await startGitHubAuth(request, env);
  }

  if (url.pathname === "/auth/github/callback") {
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

  if (url.pathname === "/api/github/starred") {
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
  await saveOAuthState(state, env);

  const authUrl = new URL("https://github.com/login/oauth/authorize");
  authUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri(request, env));
  authUrl.searchParams.set("state", state);

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

  const validOAuthState =
    state && code && cookies.forage_oauth_state === state && (await consumeOAuthState(state, env));

  if (!validOAuthState) {
    return json(request, env, { error: "Invalid GitHub auth state" }, { status: 400 });
  }

  try {
    const tokenPayload = await exchangeCodeForToken(request, env, code);
    const sessionId = createId();
    await saveSession(
      sessionId,
      {
        accessToken: tokenPayload.access_token,
        tokenType: tokenPayload.token_type,
        scope: tokenPayload.scope,
        createdAt: new Date().toISOString(),
        settings: defaultSettings(),
      },
      env,
    );

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
  const session = await getSession(request, env);
  if (!session) {
    return json(request, env, { authenticated: false });
  }

  const identity = await getGitHubUserIdentity(session, env);
  if (!identity.ok) {
    return json(
      request,
      env,
      {
        authenticated: false,
        error: "GitHub session validation failed",
        rate_limit: identity.rateLimit,
      },
      { status: identity.status },
    );
  }

  return json(request, env, {
    authenticated: true,
    user: {
      login: identity.user.login,
      id: identity.user.id,
    },
    token_type: session.tokenType,
    scope: session.scope,
    created_at: session.createdAt,
    rate_limit: identity.user.rateLimit,
  });
}

async function logout(request: Request, env: Env) {
  const cookies = parseCookies(request.headers.get("cookie"));
  if (cookies.forage_session) {
    await deleteSession(cookies.forage_session, env);
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
  const session = await getSession(request, env);
  if (!session) {
    return json(request, env, { error: "Not authenticated" }, { status: 401 });
  }

  const settings = await loadSettings(session, env);
  return json(request, env, {
    settings,
    stores_repository_data: false,
    settings_store: settingsStore(env),
  });
}

async function updateSettings(request: Request, env: Env) {
  const session = await getSession(request, env);
  if (!session) {
    return json(request, env, { error: "Not authenticated" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  if (!isSettingsUpdate(payload)) {
    return json(request, env, { error: "Invalid settings payload" }, { status: 400 });
  }

  const settings = {
    analytics_enabled: payload.analytics_enabled,
    updated_at: new Date().toISOString(),
  };
  await saveSettings(session, env, settings);

  return json(request, env, {
    settings,
    stores_repository_data: false,
    settings_store: settingsStore(env),
  });
}

async function fetchStarred(request: Request, env: Env) {
  const session = await getSession(request, env);
  if (!session) {
    return json(request, env, { error: "Not authenticated" }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") || 1);
  const perPage = Number(url.searchParams.get("per_page") || 100);

  try {
    const pageResult = await fetchStarredRepositoriesPage({
      accessToken: session.accessToken,
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

async function exchangeCodeForToken(request: Request, env: Env, code: string) {
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
    }),
  });

  const payload = (await response.json()) as {
    access_token?: string;
    token_type?: string;
    scope?: string;
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
  };
}

async function getSession(request: Request, env: Env) {
  const cookies = parseCookies(request.headers.get("cookie"));
  const sessionId = cookies.forage_session;
  if (!sessionId) return null;
  return await loadSession(sessionId, env);
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
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
  };

  if (origin === allowedOrigin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  }

  return headers;
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

  const identity = await getGitHubUserIdentity(session, env);
  if (!identity.ok || identity.user.id === null) return null;

  session.githubUserHash = await hashGitHubUserId(identity.user.id, env);
  await persistSessionIfNeeded(session, env);
  return `settings:${session.githubUserHash}`;
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
  return env.SESSION_KV ? "cloudflare-kv-encrypted" : "in-memory-dev";
}

function oauthStateStore(env: Env) {
  return env.OAUTH_STATE_KV ? "cloudflare-kv" : "in-memory-dev";
}

async function saveOAuthState(state: string, env: Env) {
  const createdAt = Date.now();
  if (!env.OAUTH_STATE_KV) {
    oauthStates.set(state, createdAt);
    return;
  }

  await env.OAUTH_STATE_KV.put(oauthStateKey(state), JSON.stringify({ createdAt }), {
    expirationTtl: oauthStateTtlSeconds,
  });
}

async function consumeOAuthState(state: string, env: Env) {
  if (!env.OAUTH_STATE_KV) {
    const createdAt = oauthStates.get(state);
    oauthStates.delete(state);
    return Boolean(createdAt && Date.now() - createdAt <= oauthStateTtlSeconds * 1000);
  }

  const key = oauthStateKey(state);
  const payload = await env.OAUTH_STATE_KV.get<{ createdAt?: number }>(key, "json");
  await env.OAUTH_STATE_KV.delete(key);
  return Boolean(
    payload?.createdAt && Date.now() - payload.createdAt <= oauthStateTtlSeconds * 1000,
  );
}

async function saveSession(sessionId: string, session: Session, env: Env) {
  sessions.set(sessionId, session);
  if (!env.SESSION_KV) return;

  const record = await encryptSession(session, env);
  await env.SESSION_KV.put(sessionKey(sessionId), JSON.stringify(record), {
    expirationTtl: sessionTtlSeconds,
  });
}

async function loadSession(sessionId: string, env: Env) {
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

async function deleteSession(sessionId: string, env: Env) {
  sessions.delete(sessionId);
  if (env.SESSION_KV) await env.SESSION_KV.delete(sessionKey(sessionId));
}

async function persistSessionIfNeeded(session: Session, env: Env) {
  if (!env.SESSION_KV) return;

  for (const [sessionId, candidate] of sessions.entries()) {
    if (candidate === session) {
      await saveSession(sessionId, session, env);
      return;
    }
  }
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

export default {
  fetch(request, env) {
    return route(request, env);
  },
} satisfies ExportedHandler<Env>;
