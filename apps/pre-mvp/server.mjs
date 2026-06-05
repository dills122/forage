import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize, resolve } from "node:path";
import { randomBytes } from "node:crypto";

async function loadDotEnv() {
  const envPath = resolve(".env");
  if (!existsSync(envPath)) return;

  const content = await readFile(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separator = trimmed.indexOf("=");
    if (separator === -1) continue;

    const key = trimmed.slice(0, separator).trim();
    let value = trimmed.slice(separator + 1).trim();
    if (!key || process.env[key] !== undefined) continue;

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

await loadDotEnv();

const port = Number(process.env.PORT || 5173);
const host = process.env.HOST || "127.0.0.1";
const browserHost = process.env.BROWSER_HOST || "localhost";
const publicDir = resolve("apps/pre-mvp/public");
const githubClientId = process.env.GITHUB_CLIENT_ID || "";
const githubClientSecret = process.env.GITHUB_CLIENT_SECRET || "";
const redirectUri =
  process.env.GITHUB_REDIRECT_URI ||
  `http://localhost:${port}/auth/github/callback`;
const githubApiVersion = process.env.GITHUB_API_VERSION || "2022-11-28";

const sessions = new Map();
const oauthStates = new Map();

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

function createId() {
  return randomBytes(24).toString("base64url");
}

function parseCookies(header = "") {
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

function cookie(name, value, options = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "SameSite=Lax"];
  if (options.httpOnly !== false) parts.push("HttpOnly");
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  return parts.join("; ");
}

function sendJson(res, status, payload, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  });
  res.end(JSON.stringify(payload, null, 2));
}

function redirect(res, location, headers = {}) {
  res.writeHead(302, { Location: location, ...headers });
  res.end();
}

function getSession(req) {
  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies.forage_session;
  if (!sessionId) return null;
  return sessions.get(sessionId) || null;
}

async function serveStatic(req, res, url) {
  const requested = url.pathname === "/" ? "/index.html" : url.pathname;
  const normalizedPath = normalize(decodeURIComponent(requested)).replace(/^(\.\.[/\\])+/, "");
  const filePath = resolve(join(publicDir, normalizedPath));

  if (!filePath.startsWith(publicDir) || !existsSync(filePath)) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  const body = await readFile(filePath);
  res.writeHead(200, {
    "Content-Type": contentTypes[extname(filePath)] || "application/octet-stream",
  });
  res.end(body);
}

async function exchangeCodeForToken(code) {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: githubClientId,
      client_secret: githubClientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  const payload = await response.json();
  if (!response.ok || payload.error) {
    throw new Error(payload.error_description || payload.error || "GitHub token exchange failed");
  }
  return payload;
}

async function fetchGitHub(session, path) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github.star+json",
      Authorization: `Bearer ${session.accessToken}`,
      "User-Agent": "forage-pre-mvp-spike",
      "X-GitHub-Api-Version": githubApiVersion,
    },
  });

  const bodyText = await response.text();
  let payload = null;
  try {
    payload = bodyText ? JSON.parse(bodyText) : null;
  } catch {
    payload = { raw: bodyText };
  }

  return {
    ok: response.ok,
    status: response.status,
    payload,
    link: response.headers.get("link"),
    rateLimit: {
      limit: response.headers.get("x-ratelimit-limit"),
      remaining: response.headers.get("x-ratelimit-remaining"),
      reset: response.headers.get("x-ratelimit-reset"),
      used: response.headers.get("x-ratelimit-used"),
      resource: response.headers.get("x-ratelimit-resource"),
    },
  };
}

function parseNextPage(linkHeader) {
  if (!linkHeader) return null;
  const nextPart = linkHeader.split(",").find((part) => part.includes('rel="next"'));
  if (!nextPart) return null;
  const match = nextPart.match(/<([^>]+)>/);
  if (!match) return null;
  const nextUrl = new URL(match[1]);
  const page = nextUrl.searchParams.get("page");
  return page ? Number(page) : null;
}

async function route(req, res) {
  const url = new URL(req.url || "/", `http://${host}:${port}`);
  const requestHost = req.headers.host || "";

  if (requestHost.startsWith("127.0.0.1")) {
    redirect(res, `http://${browserHost}:${port}${url.pathname}${url.search}`);
    return;
  }

  if (url.pathname === "/api/config") {
    sendJson(res, 200, {
      hasGitHubConfig: Boolean(githubClientId && githubClientSecret),
      redirectUri,
      authType: "github-app-user-authorization",
      githubApiVersion,
    });
    return;
  }

  if (url.pathname === "/auth/github") {
    if (!githubClientId || !githubClientSecret) {
      sendJson(res, 500, {
        error: "Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET",
      });
      return;
    }

    const state = createId();
    oauthStates.set(state, Date.now());
    const authUrl = new URL("https://github.com/login/oauth/authorize");
    authUrl.searchParams.set("client_id", githubClientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("state", state);

    redirect(res, authUrl.toString(), {
      "Set-Cookie": cookie("forage_oauth_state", state, { maxAge: 600 }),
    });
    return;
  }

  if (url.pathname === "/auth/github/callback") {
    const state = url.searchParams.get("state");
    const code = url.searchParams.get("code");
    const cookies = parseCookies(req.headers.cookie);

    if (!state || !code || cookies.forage_oauth_state !== state || !oauthStates.has(state)) {
      sendJson(res, 400, { error: "Invalid GitHub auth state" });
      return;
    }

    oauthStates.delete(state);

    try {
      const tokenPayload = await exchangeCodeForToken(code);
      const sessionId = createId();
      sessions.set(sessionId, {
        accessToken: tokenPayload.access_token,
        tokenType: tokenPayload.token_type,
        scope: tokenPayload.scope,
        createdAt: new Date().toISOString(),
      });

      redirect(res, "/", {
        "Set-Cookie": [
          cookie("forage_session", sessionId, { maxAge: 60 * 60 * 8 }),
          cookie("forage_oauth_state", "", { maxAge: 0 }),
        ],
      });
    } catch (error) {
      sendJson(res, 502, { error: error.message });
    }
    return;
  }

  if (url.pathname === "/api/session") {
    const session = getSession(req);
    if (!session) {
      sendJson(res, 200, { authenticated: false });
      return;
    }

    const userResponse = await fetchGitHub(session, "/user");
    sendJson(res, userResponse.ok ? 200 : userResponse.status, {
      authenticated: userResponse.ok,
      user: userResponse.ok
        ? {
            login: userResponse.payload.login,
            id: userResponse.payload.id,
          }
        : null,
      tokenType: session.tokenType,
      scope: session.scope,
      rateLimit: userResponse.rateLimit,
    });
    return;
  }

  if (url.pathname === "/api/logout" && req.method === "POST") {
    const cookies = parseCookies(req.headers.cookie);
    if (cookies.forage_session) sessions.delete(cookies.forage_session);
    sendJson(
      res,
      200,
      { ok: true },
      { "Set-Cookie": cookie("forage_session", "", { maxAge: 0 }) },
    );
    return;
  }

  if (url.pathname === "/api/github/starred") {
    const session = getSession(req);
    if (!session) {
      sendJson(res, 401, { error: "Not authenticated" });
      return;
    }

    const page = Number(url.searchParams.get("page") || 1);
    const perPage = Math.min(Number(url.searchParams.get("per_page") || 100), 100);
    const sort = url.searchParams.get("sort") || "created";
    const direction = url.searchParams.get("direction") || "desc";
    const githubPath = `/user/starred?per_page=${perPage}&page=${page}&sort=${sort}&direction=${direction}`;
    const githubResponse = await fetchGitHub(session, githubPath);

    sendJson(res, githubResponse.ok ? 200 : githubResponse.status, {
      page,
      nextPage: parseNextPage(githubResponse.link),
      rateLimit: githubResponse.rateLimit,
      items: githubResponse.payload,
    });
    return;
  }

  await serveStatic(req, res, url);
}

const server = createServer((req, res) => {
  route(req, res).catch((error) => {
    console.error(error);
    sendJson(res, 500, { error: error.message || "Unexpected server error" });
  });
});

server.listen(port, host, () => {
  console.log(`Forage pre-MVP spike running at http://${browserHost}:${port}`);
  console.log(`GitHub callback URL: ${redirectUri}`);
});
