import {
  githubApiVersion,
  isProduction,
  oauthStateStore,
  redirectUri,
  sessionStore,
  webOrigin,
} from "./env";
import type { Env, Session } from "./types";

export function json(request: Request, env: Env, payload: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(payload, null, 2), {
    ...init,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...responseHeaders(request, env),
      ...init.headers,
    },
  });
}

export function redirect(location: string, cookies: string[] = [], request: Request, env: Env) {
  const headers = new Headers({
    Location: location,
    ...responseHeaders(request, env),
  });
  for (const value of cookies) headers.append("Set-Cookie", value);
  return new Response(null, { status: 302, headers });
}

export function responseHeaders(request: Request, env: Env) {
  return {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    ...corsHeaders(request, env),
  };
}

export function corsHeaders(request: Request, env: Env) {
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

export function configPayload(request: Request, env: Env) {
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

export function hasValidCsrfToken(request: Request, session: Session) {
  return request.headers.get("x-forage-csrf") === session.csrfToken;
}

export function cookie(
  request: Request,
  name: string,
  value: string,
  options: { maxAge?: number } = {},
) {
  const url = new URL(request.url);
  const parts = [`${name}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax"];
  if (url.protocol === "https:") parts.push("Secure");
  if (options.maxAge !== undefined) parts.push(`Max-Age=${options.maxAge}`);
  return parts.join("; ");
}

export function parseCookies(header: string | null) {
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
