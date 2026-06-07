import type { OAuthStateRecord, RateLimitRecord, StoredSessionRecord } from "./types";

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
