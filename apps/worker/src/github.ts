import type { GitHubRateLimitSnapshot } from "@forage/shared";
import { githubApiVersion } from "./env";
import type { Env, GitHubUserIdentity, Session } from "./types";

export async function getGitHubUserIdentity(session: Session, env: Env) {
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

export function githubHeaders(accessToken: string, apiVersion: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${accessToken}`,
    "User-Agent": "forage",
    "X-GitHub-Api-Version": apiVersion,
  };
}

export function rateLimitFromHeaders(headers: Headers): GitHubRateLimitSnapshot {
  return {
    limit: headers.get("x-ratelimit-limit"),
    remaining: headers.get("x-ratelimit-remaining"),
    reset: headers.get("x-ratelimit-reset"),
    used: headers.get("x-ratelimit-used"),
    resource: headers.get("x-ratelimit-resource"),
  };
}
