import assert from "node:assert/strict";
import test from "node:test";
import worker from "../src/index.ts";

const baseEnv = {
  GITHUB_CLIENT_ID: "client-id",
  GITHUB_CLIENT_SECRET: "client-secret",
  GITHUB_REDIRECT_URI: "https://api.forage.test/auth/github/callback",
  WEB_ORIGIN: "https://forage.test",
  SETTINGS_HASH_SALT: "settings-salt",
  SESSION_ENCRYPTION_KEY: "session-encryption-key",
};

test("GitHub auth uses state and PKCE verifier during token exchange", async () => {
  const tokenExchangeBodies = [];
  const restoreFetch = mockGitHubFetch({ tokenExchangeBodies });

  try {
    const authResponse = await worker.fetch(
      new Request("https://api.forage.test/auth/github"),
      baseEnv,
      {},
    );
    assert.equal(authResponse.status, 302);

    const authUrl = new URL(authResponse.headers.get("location"));
    assert.equal(authUrl.origin, "https://github.com");
    assert.equal(authUrl.searchParams.get("code_challenge_method"), "S256");
    assert.match(authUrl.searchParams.get("code_challenge"), /^[A-Za-z0-9_-]{43}$/);

    const state = authUrl.searchParams.get("state");
    const callbackResponse = await worker.fetch(
      new Request(`https://api.forage.test/auth/github/callback?state=${state}&code=test-code`, {
        headers: {
          cookie: `forage_oauth_state=${state}`,
        },
      }),
      baseEnv,
      {},
    );

    assert.equal(callbackResponse.status, 302);
    assert.equal(callbackResponse.headers.get("location"), "https://forage.test");
    assert.equal(tokenExchangeBodies.length, 1);
    assert.equal(tokenExchangeBodies[0].code, "test-code");
    assert.match(tokenExchangeBodies[0].code_verifier, /^[A-Za-z0-9_-]{32,}$/);
  } finally {
    restoreFetch();
  }
});

test("authenticated mutations require the session CSRF token", async () => {
  const restoreFetch = mockGitHubFetch();

  try {
    const sessionCookie = await createSessionCookie();
    const sessionResponse = await worker.fetch(
      new Request("https://api.forage.test/api/session", {
        headers: {
          cookie: sessionCookie,
        },
      }),
      baseEnv,
      {},
    );
    const session = await sessionResponse.json();
    assert.equal(session.authenticated, true);
    assert.match(session.csrf_token, /^[A-Za-z0-9_-]+$/);

    const rejected = await worker.fetch(
      new Request("https://api.forage.test/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          cookie: sessionCookie,
        },
        body: JSON.stringify({ analytics_enabled: true }),
      }),
      baseEnv,
      {},
    );
    assert.equal(rejected.status, 403);

    const accepted = await worker.fetch(
      new Request("https://api.forage.test/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Forage-CSRF": session.csrf_token,
          cookie: sessionCookie,
        },
        body: JSON.stringify({ analytics_enabled: true }),
      }),
      baseEnv,
      {},
    );
    assert.equal(accepted.status, 200);
  } finally {
    restoreFetch();
  }
});

test("production config omits deployment diagnostics", async () => {
  const response = await worker.fetch(
    new Request("https://api.forage.test/api/config"),
    {
      ...baseEnv,
      ENVIRONMENT: "production",
    },
    {},
  );
  const payload = await response.json();

  assert.equal(payload.github_configured, true);
  assert.equal(payload.stores_repository_data, false);
  assert.equal("has_github_client_secret" in payload, false);
  assert.equal("redirect_uri" in payload, false);
});

test("expired GitHub sessions require reconnect", async () => {
  const restoreFetch = mockGitHubFetch({ expiresIn: -1 });

  try {
    const sessionCookie = await createSessionCookie();
    const response = await worker.fetch(
      new Request("https://api.forage.test/api/session", {
        headers: {
          cookie: sessionCookie,
        },
      }),
      baseEnv,
      {},
    );
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.authenticated, false);
    assert.match(payload.error, /expired/i);
  } finally {
    restoreFetch();
  }
});

test("CORS allows only the configured web origin", async () => {
  const allowed = await worker.fetch(
    new Request("https://api.forage.test/api/config", {
      headers: {
        Origin: "https://forage.test",
      },
    }),
    baseEnv,
    {},
  );
  assert.equal(allowed.headers.get("access-control-allow-origin"), "https://forage.test");
  assert.equal(allowed.headers.get("access-control-allow-credentials"), "true");

  const rejected = await worker.fetch(
    new Request("https://api.forage.test/api/config", {
      headers: {
        Origin: "https://not-forage.test",
      },
    }),
    baseEnv,
    {},
  );
  assert.equal(rejected.headers.has("access-control-allow-origin"), false);

  const preflight = await worker.fetch(
    new Request("https://api.forage.test/api/settings", {
      method: "OPTIONS",
      headers: {
        Origin: "https://forage.test",
        "Access-Control-Request-Method": "PUT",
        "Access-Control-Request-Headers": "Content-Type,X-Forage-CSRF",
      },
    }),
    baseEnv,
    {},
  );
  assert.equal(preflight.status, 204);
  assert.match(preflight.headers.get("access-control-allow-headers"), /X-Forage-CSRF/);
});

test("OAuth and session cookies use secure production attributes", async () => {
  const restoreFetch = mockGitHubFetch();

  try {
    const authResponse = await worker.fetch(
      new Request("https://api.forage.test/auth/github"),
      baseEnv,
      {},
    );
    assertCookieIncludes(authResponse.headers.get("set-cookie"), [
      "forage_oauth_state=",
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      "Secure",
      "Max-Age=600",
    ]);

    const authUrl = new URL(authResponse.headers.get("location"));
    const state = authUrl.searchParams.get("state");
    const callbackResponse = await worker.fetch(
      new Request(`https://api.forage.test/auth/github/callback?state=${state}&code=test-code`, {
        headers: {
          cookie: `forage_oauth_state=${state}`,
        },
      }),
      baseEnv,
      {},
    );
    assertCookieIncludes(callbackResponse.headers.get("set-cookie"), [
      "forage_session=",
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      "Secure",
      "Max-Age=28800",
    ]);
    assertCookieIncludes(callbackResponse.headers.get("set-cookie"), [
      "forage_oauth_state=",
      "Max-Age=0",
    ]);
  } finally {
    restoreFetch();
  }
});

test("session responses do not expose GitHub token material", async () => {
  const restoreFetch = mockGitHubFetch();

  try {
    const sessionCookie = await createSessionCookie();
    const response = await worker.fetch(
      new Request("https://api.forage.test/api/session", {
        headers: {
          cookie: sessionCookie,
        },
      }),
      baseEnv,
      {},
    );
    const body = await response.text();

    assert.equal(response.status, 200);
    assert.equal(body.includes("github-token"), false);
    assert.equal(body.includes("refresh-token"), false);
    assert.equal(body.includes("accessToken"), false);
    assert.equal(body.includes("client-secret"), false);
  } finally {
    restoreFetch();
  }
});

test("account deletion removes settings and invalidates the active session", async () => {
  const restoreFetch = mockGitHubFetch();
  const settingsKv = createKvNamespace();
  const env = {
    ...baseEnv,
    SETTINGS_KV: settingsKv,
  };

  try {
    const sessionCookie = await createSessionCookie(env);
    const sessionResponse = await worker.fetch(
      new Request("https://api.forage.test/api/session", {
        headers: {
          cookie: sessionCookie,
        },
      }),
      env,
      {},
    );
    const session = await sessionResponse.json();

    const settingsResponse = await worker.fetch(
      new Request("https://api.forage.test/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "X-Forage-CSRF": session.csrf_token,
          cookie: sessionCookie,
        },
        body: JSON.stringify({ analytics_enabled: true }),
      }),
      env,
      {},
    );
    assert.equal(settingsResponse.status, 200);
    assert.equal(settingsKv.size, 1);

    const deleteResponse = await worker.fetch(
      new Request("https://api.forage.test/api/account", {
        method: "DELETE",
        headers: {
          "X-Forage-CSRF": session.csrf_token,
          cookie: sessionCookie,
        },
      }),
      env,
      {},
    );
    const deletePayload = await deleteResponse.json();
    assert.equal(deleteResponse.status, 200);
    assert.equal(deletePayload.deleted_server_state, true);
    assert.equal(settingsKv.size, 0);
    assert.match(deleteResponse.headers.get("set-cookie"), /forage_session=;.*Max-Age=0/);

    const sessionAfterDelete = await worker.fetch(
      new Request("https://api.forage.test/api/session", {
        headers: {
          cookie: sessionCookie,
        },
      }),
      env,
      {},
    );
    const sessionAfterDeletePayload = await sessionAfterDelete.json();
    assert.equal(sessionAfterDeletePayload.authenticated, false);
  } finally {
    restoreFetch();
  }
});

test("auth start rate limiting returns retry metadata", async () => {
  let response;
  for (let requestIndex = 0; requestIndex < 21; requestIndex += 1) {
    response = await worker.fetch(
      new Request("https://api.forage.test/auth/github", {
        headers: {
          "cf-connecting-ip": "203.0.113.55",
        },
      }),
      baseEnv,
      {},
    );
  }

  const payload = await response.json();
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("retry-after"), "60");
  assert.equal(payload.retry_after_seconds, 60);
});

async function createSessionCookie(env = baseEnv) {
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

function extractCookie(setCookieHeader, name) {
  const match = setCookieHeader.match(new RegExp(`${name}=([^;]+)`));
  assert.ok(match, `missing ${name} cookie`);
  return `${name}=${match[1]}`;
}

function assertCookieIncludes(setCookieHeader, expectedParts) {
  assert.ok(setCookieHeader, "missing set-cookie header");
  for (const expectedPart of expectedParts) {
    assert.ok(
      setCookieHeader.includes(expectedPart),
      `expected cookie to include ${expectedPart}, got ${setCookieHeader}`,
    );
  }
}

function createKvNamespace() {
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

function mockGitHubFetch({ tokenExchangeBodies = [], expiresIn = 28_800 } = {}) {
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

function jsonResponse(payload, init = {}) {
  return new Response(JSON.stringify(payload), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}
