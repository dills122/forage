import type { Env } from "./types";

export function oauthStateObjectName(state: string) {
  return `oauth-state:${state}`;
}

export function sessionObjectName(sessionId: string) {
  return `session:${sessionId}`;
}

export function userSessionIndexObjectName(githubUserHash: string) {
  return `user-sessions:${githubUserHash}`;
}

export function rateLimitObjectName(bucket: string, key: string) {
  return `rate-limit:${bucket}:${key}`;
}

export async function coordinatorFetch(
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
