import assert from "node:assert/strict";
import worker from "../src/index.ts";

export { worker };

export const baseEnv = {
  GITHUB_CLIENT_ID: "client-id",
  GITHUB_CLIENT_SECRET: "client-secret",
  GITHUB_REDIRECT_URI: "https://api.forage.test/auth/github/callback",
  WEB_ORIGIN: "https://forage.test",
  SETTINGS_HASH_SALT: "settings-salt",
  SESSION_ENCRYPTION_KEY: "session-encryption-key",
};

export async function createSessionCookie(env = baseEnv) {
  const authResponse = await worker.fetch(
    new Request("https://api.forage.test/auth/github"),
    env,
    {},
  );
  const authUrl = new URL(authResponse.headers.get("location"));
  const state = authUrl.searchParams.get("state");
  const callbackResponse = await worker.fetch(
    new Request(`https://api.forage.test/auth/github/callback?state=${state}&code=test-code`, {
      headers: {
        cookie: `forage_oauth_state=${state}`,
      },
    }),
    env,
    {},
  );

  return extractCookie(callbackResponse.headers.get("set-cookie"), "forage_session");
}

export function assertCookieIncludes(setCookieHeader, expectedParts) {
  assert.ok(setCookieHeader, "missing set-cookie header");
  for (const expectedPart of expectedParts) {
    assert.ok(
      setCookieHeader.includes(expectedPart),
      `expected cookie to include ${expectedPart}, got ${setCookieHeader}`,
    );
  }
}

export function createKvNamespace() {
  const store = new Map();
  return {
    get size() {
      return store.size;
    },
    async get(key, type) {
      const value = store.get(key) ?? null;
      return type === "json" && typeof value === "string" ? JSON.parse(value) : value;
    },
    async put(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
  };
}

export function mockGitHubFetch({ tokenExchangeBodies = [], expiresIn = 28_800 } = {}) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init = {}) => {
    const requestUrl = String(url);
    if (requestUrl === "https://github.com/login/oauth/access_token") {
      tokenExchangeBodies.push(JSON.parse(init.body));
      return jsonResponse({
        access_token: `github-token-${tokenExchangeBodies.length}`,
        token_type: "bearer",
        scope: "",
        expires_in: expiresIn,
        refresh_token: "refresh-token",
        refresh_token_expires_in: 15_897_600,
      });
    }

    if (requestUrl === "https://api.github.com/user") {
      return jsonResponse(
        {
          id: 122,
          login: "dills122",
        },
        {
          headers: {
            "x-ratelimit-limit": "5000",
            "x-ratelimit-remaining": "4999",
          },
        },
      );
    }

    throw new Error(`Unexpected fetch: ${requestUrl}`);
  };

  return () => {
    globalThis.fetch = originalFetch;
  };
}

function extractCookie(setCookieHeader, name) {
  const match = setCookieHeader.match(new RegExp(`${name}=([^;]+)`));
  assert.ok(match, `missing ${name} cookie`);
  return `${name}=${match[1]}`;
}

function jsonResponse(payload, init = {}) {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}
