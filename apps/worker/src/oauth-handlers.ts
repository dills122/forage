import { oauthStateTtlSeconds, sessionTtlSeconds } from "./constants";
import { createId, createPkceChallenge, createPkceVerifier, hashGitHubUserId } from "./crypto";
import { redirectUri, webOrigin } from "./env";
import { getGitHubUserIdentity } from "./github";
import { cookie, json, parseCookies, redirect } from "./http";
import { consumeOAuthState, saveOAuthState, saveSession, tokenExpiresAt } from "./session-store";
import { defaultSettings } from "./settings";
import type { Env, Session } from "./types";

export async function startGitHubAuth(request: Request, env: Env) {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) {
    return json(
      request,
      env,
      { error: "Missing GITHUB_CLIENT_ID or GITHUB_CLIENT_SECRET" },
      { status: 500 },
    );
  }

  const state = createId();
  const codeVerifier = createPkceVerifier();
  const codeChallenge = await createPkceChallenge(codeVerifier);
  await saveOAuthState(
    state,
    {
      createdAt: Date.now(),
      codeVerifier,
    },
    env,
  );

  const authUrl = new URL("https://github.com/login/oauth/authorize");
  authUrl.searchParams.set("client_id", env.GITHUB_CLIENT_ID);
  authUrl.searchParams.set("redirect_uri", redirectUri(request, env));
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("code_challenge", codeChallenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  return redirect(
    authUrl.toString(),
    [cookie(request, "forage_oauth_state", state, { maxAge: oauthStateTtlSeconds })],
    request,
    env,
  );
}

export async function finishGitHubAuth(request: Request, env: Env) {
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const cookies = parseCookies(request.headers.get("cookie"));

  const oauthState =
    state && code && cookies.forage_oauth_state === state
      ? await consumeOAuthState(state, env)
      : null;

  if (!oauthState || !code) {
    return json(request, env, { error: "Invalid GitHub auth state" }, { status: 400 });
  }

  try {
    const tokenPayload = await exchangeCodeForToken(request, env, code, oauthState.codeVerifier);
    const sessionId = createId();
    const session: Session = {
      accessToken: tokenPayload.access_token,
      tokenType: tokenPayload.token_type,
      scope: tokenPayload.scope,
      createdAt: new Date().toISOString(),
      csrfToken: createId(),
      settings: defaultSettings(),
    };
    const accessTokenExpiresAt = tokenExpiresAt(tokenPayload.expires_in);
    if (accessTokenExpiresAt) session.accessTokenExpiresAt = accessTokenExpiresAt;
    const identity = await getGitHubUserIdentity(session, env);
    if (identity.ok && identity.user.id !== null) {
      session.githubUserHash = await hashGitHubUserId(identity.user.id, env);
    }

    await saveSession(sessionId, session, env);

    return redirect(
      webOrigin(env),
      [
        cookie(request, "forage_session", sessionId, { maxAge: sessionTtlSeconds }),
        cookie(request, "forage_oauth_state", "", { maxAge: 0 }),
      ],
      request,
      env,
    );
  } catch (error) {
    return json(
      request,
      env,
      { error: error instanceof Error ? error.message : "GitHub token exchange failed" },
      { status: 502 },
    );
  }
}

async function exchangeCodeForToken(
  request: Request,
  env: Env,
  code: string,
  codeVerifier: string,
) {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri(request, env),
      code_verifier: codeVerifier,
    }),
  });

  const payload = (await response.json()) as {
    access_token?: string;
    token_type?: string;
    scope?: string;
    expires_in?: number;
    refresh_token?: string;
    refresh_token_expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!response.ok || payload.error || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || "GitHub token exchange failed");
  }

  return {
    access_token: payload.access_token,
    token_type: payload.token_type ?? "bearer",
    scope: payload.scope ?? "",
    expires_in: payload.expires_in,
  };
}
