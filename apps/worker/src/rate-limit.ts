import { coordinatorFetch, rateLimitObjectName } from "./coordinator-client";
import { operationalHash } from "./crypto";
import { json } from "./http";
import type { Env, RateLimitRecord } from "./types";

const rateLimits = new Map<string, RateLimitRecord>();

export async function enforceRateLimit(
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
