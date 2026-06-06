import { GitHubApiError, fetchStarredRepositoriesPage } from "@forage/github";

interface Env {
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GITHUB_REDIRECT_URI?: string;
  GITHUB_API_VERSION?: string;
  WEB_ORIGIN?: string;
}

interface Session {
  accessToken: string;
  tokenType: string;
  scope: string;
  createdAt: string;
}

const sessions = new Map<string, Session>();
const oauthStates = new Map<string, number>();

const defaultApiVersion = "2022-11-28";
const defaultWebOrigin = "http://127.0.0.1:4321";

function route(request: Request, env: Env) {
  const url = new URL(request.url);

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(request, env) });
  }

  if (url.pathname === "/health" || url.pathname === "/api/health") {
    return json(
      request,
      env,
      {
        ok: true,
        service: "forage-worker",
        privacy_boundary: "no repository data stored server-side",
      },
    );
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
      session_store: "in-memory-dev",
    });
  }

  if (url.pathname === "/auth/github") {
    return startGitHubAuth(request, env);
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

  if (url.pathname === "/api/github/starred") {
    return fetchStarred(request, env);
  }

  return json(request, env, { error: "Not found" }, { status: 404 });
}

function startGitHubAuth(request: Request, env: Env) {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return json(
      request,
      env,
      { error: "Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET" },
      { status: 500 },
    );
  }

  const state = createId();
  oauthStates.set(state, Date.now());

  const authUrl = new URL("https://github.com/login/oauth/authorize");
  authUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri(request, env));
  authUrl.searchParams.set("state", state);

  return redirect(authUrl.toString(), [
    cookie(request, "forage_oauth_state", state, { maxAge: 600 }),
  ]);
}

async function finishGitHubAuth(request: Request, env: Env) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const cookies = parseCookies(request.headers.get("cookie"));

  if (!state || !code || cookies.forage_oauth_state !== state || !oauthStates.has(state)) {
    return json(request, env, { error: "Invalid GitHub auth state" }, { status: 400 });
  }

  oauthStates.delete(state);

  try {
    const tokenPayload = await exchangeCodeForToken(request, env, code);
    const sessionId = createId();
    sessions.set(sessionId, {
      accessToken: tokenPayload.access_token,
      tokenType: tokenPayload.token_type,
      scope: tokenPayload.scope,
      createdAt: new Date().toISOString(),
    });

    return redirect(webOrigin(env), [
      cookie(request, "forage_session", sessionId, { maxAge: 60 * 60 * 8 }),
      cookie(request, "forage_oauth_state", "", { maxAge: 0 }),
    ]);
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
  const session = getSession(request);
  if (!session) {
    return json(request, env, { authenticated: false });
  }

  const response = await fetch("https://api.github.com/user", {
    headers: githubHeaders(session.accessToken, githubApiVersion(env)),
  });
  const payload = (await response.json().catch(() => null)) as { login?: string; id?: number } | null;

  if (!response.ok) {
    return json(
      request,
      env,
      {
        authenticated: false,
        error: "GitHub session validation failed",
        rate_limit: rateLimitFromHeaders(response.headers),
      },
      { status: response.status },
    );
  }

  return json(request, env, {
    authenticated: true,
    user: {
      login: payload?.login ?? null,
      id: payload?.id ?? null,
    },
    token_type: session.tokenType,
    scope: session.scope,
    created_at: session.createdAt,
    rate_limit: rateLimitFromHeaders(response.headers),
  });
}

function logout(request: Request, env: Env) {
  const cookies = parseCookies(request.headers.get("cookie"));
  if (cookies.forage_session) {
    sessions.delete(cookies.forage_session);
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

async function fetchStarred(request: Request, env: Env) {
  const session = getSession(request);
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

function getSession(request: Request) {
  const cookies = parseCookies(request.headers.get("cookie"));
  const sessionId = cookies.forage_session;
  if (!sessionId) return null;
  return sessions.get(sessionId) ?? null;
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
      "Cache-Control": "no-store",
      ...corsHeaders(request, env),
      ...init.headers,
    },
  });
}

function redirect(location: string, cookies: string[] = []) {
  const headers = new Headers({ Location: location });
  for (const value of cookies) headers.append("Set-Cookie", value);
  return new Response(null, { status: 302, headers });
}

function corsHeaders(request: Request, env: Env) {
  const origin = request.headers.get("origin");
  const allowedOrigin = webOrigin(env);
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Credentials": "true",
  };

  if (origin === allowedOrigin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers.Vary = "Origin";
  }

  return headers;
}

function cookie(
  request: Request,
  name: string,
  value: string,
  options: { maxAge?: number } = {},
) {
  const url = new URL(request.url);
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
  ];
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
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
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
