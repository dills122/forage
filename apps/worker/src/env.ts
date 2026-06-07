import { defaultApiVersion, defaultWebOrigin } from "./constants";
import type { Env } from "./types";

export function isProduction(env: Env) {
  return env.ENVIRONMENT === "production";
}

export function redirectUri(request: Request, env: Env) {
  if (env.GITHUB_REDIRECT_URI) return env.GITHUB_REDIRECT_URI;
  const url = new URL(request.url);
  return `${url.origin}/auth/github/callback`;
}

export function githubApiVersion(env: Env) {
  return env.GITHUB_API_VERSION ?? defaultApiVersion;
}

export function webOrigin(env: Env) {
  return env.WEB_ORIGIN ?? defaultWebOrigin;
}

export function settingsStore(env: Env) {
  return env.SETTINGS_KV ? "cloudflare-kv" : "in-memory-dev";
}

export function sessionStore(env: Env) {
  if (env.AUTH_COORDINATOR) return "durable-object-encrypted";
  return env.SESSION_KV ? "cloudflare-kv-encrypted" : "in-memory-dev";
}

export function oauthStateStore(env: Env) {
  if (env.AUTH_COORDINATOR) return "durable-object";
  return env.OAUTH_STATE_KV ? "cloudflare-kv" : "in-memory-dev";
}
