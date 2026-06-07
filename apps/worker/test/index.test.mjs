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

async function createSessionCookie() {
  const authResponse = await worker.fetch(
    new Request("https://api.forage.test/auth/github"),
    baseEnv,
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
    baseEnv,
    {},
  );

  return extractCookie(callbackResponse.headers.get("set-cookie"), "forage_session");
}

function extractCookie(setCookieHeader, name) {
  const match = setCookieHeader.match(new RegExp(`${name}=([^;]+)`));
  assert.ok(match, `missing ${name} cookie`);
  return `${name}=${match[1]}`;
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
