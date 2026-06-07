import { oauthStateTtlSeconds, sessionTtlSeconds } from "./constants";
import {
  coordinatorFetch,
  oauthStateObjectName,
  sessionObjectName,
  userSessionIndexObjectName,
} from "./coordinator-client";
import { decryptSession, encryptSession } from "./crypto";
import type {
  EncryptedSessionRecord,
  Env,
  OAuthStateRecord,
  Session,
  StoredSessionRecord,
} from "./types";

const sessions = new Map<string, Session>();
const oauthStateRecords = new Map<string, OAuthStateRecord>();
const userSessionIndexes = new Map<string, Set<string>>();

export async function saveOAuthState(state: string, record: OAuthStateRecord, env: Env) {
  if (env.AUTH_COORDINATOR) {
    await coordinatorFetch(env, oauthStateObjectName(state), "/oauth-state", {
      method: "PUT",
      body: JSON.stringify(record),
    });
    return;
  }

  if (!env.OAUTH_STATE_KV) {
    oauthStateRecords.set(state, record);
    return;
  }

  await env.OAUTH_STATE_KV.put(oauthStateKey(state), JSON.stringify(record), {
    expirationTtl: oauthStateTtlSeconds,
  });
}

export async function consumeOAuthState(state: string, env: Env) {
  if (env.AUTH_COORDINATOR) {
    const response = await coordinatorFetch(env, oauthStateObjectName(state), "/oauth-state", {
      method: "POST",
    });
    if (response.status === 404) return null;
    const record = (await response.json()) as OAuthStateRecord;
    return isFreshOAuthState(record) ? record : null;
  }

  if (!env.OAUTH_STATE_KV) {
    const record = oauthStateRecords.get(state);
    oauthStateRecords.delete(state);
    return record && isFreshOAuthState(record) ? record : null;
  }

  const key = oauthStateKey(state);
  const payload = await env.OAUTH_STATE_KV.get<OAuthStateRecord>(key, "json");
  await env.OAUTH_STATE_KV.delete(key);
  return payload && isFreshOAuthState(payload) ? payload : null;
}

export async function saveSession(sessionId: string, session: Session, env: Env) {
  sessions.set(sessionId, session);
  if (env.AUTH_COORDINATOR) {
    const record = await encryptSession(session, env);
    const storedSession: StoredSessionRecord = {
      record,
      expiresAt: sessionExpiresAt(session),
    };
    if (session.githubUserHash) storedSession.githubUserHash = session.githubUserHash;

    await coordinatorFetch(env, sessionObjectName(sessionId), "/session", {
      method: "PUT",
      body: JSON.stringify(storedSession),
    });
    if (session.githubUserHash) {
      await trackUserSession(session.githubUserHash, sessionId, env);
    }
    return;
  }

  if (!env.SESSION_KV) return;

  const record = await encryptSession(session, env);
  await env.SESSION_KV.put(sessionKey(sessionId), JSON.stringify(record), {
    expirationTtl: sessionTtlSeconds,
  });
  if (session.githubUserHash) {
    await trackUserSession(session.githubUserHash, sessionId, env);
  }
}

export async function loadSession(sessionId: string, env: Env) {
  if (env.AUTH_COORDINATOR) {
    const response = await coordinatorFetch(env, sessionObjectName(sessionId), "/session");
    if (response.status === 404) return null;
    const stored = (await response.json()) as StoredSessionRecord;
    try {
      return await decryptSession(stored.record, env);
    } catch {
      await coordinatorFetch(env, sessionObjectName(sessionId), "/session", { method: "DELETE" });
      return null;
    }
  }

  const memorySession = sessions.get(sessionId);
  if (memorySession) return memorySession;
  if (!env.SESSION_KV) return null;

  const record = await env.SESSION_KV.get<EncryptedSessionRecord>(sessionKey(sessionId), "json");
  if (!record) return null;

  try {
    const session = await decryptSession(record, env);
    sessions.set(sessionId, session);
    return session;
  } catch {
    await env.SESSION_KV.delete(sessionKey(sessionId));
    return null;
  }
}

export async function deleteSession(sessionId: string, env: Env, session?: Session) {
  const sessionToDelete = session ?? (await loadSession(sessionId, env));
  sessions.delete(sessionId);
  if (sessionToDelete?.githubUserHash) {
    await untrackUserSession(sessionToDelete.githubUserHash, sessionId, env);
  }
  if (env.AUTH_COORDINATOR) {
    await coordinatorFetch(env, sessionObjectName(sessionId), "/session", { method: "DELETE" });
    return;
  }
  if (env.SESSION_KV) await env.SESSION_KV.delete(sessionKey(sessionId));
}

export async function persistSessionIfNeeded(session: Session, env: Env) {
  for (const [sessionId, candidate] of sessions.entries()) {
    if (candidate === session) {
      await saveSession(sessionId, session, env);
      return;
    }
  }
}

export async function deleteSessionsForUser(githubUserHash: string, env: Env) {
  const sessionIds = await listUserSessions(githubUserHash, env);
  await Promise.all(sessionIds.map((sessionId) => deleteSession(sessionId, env)));
  if (env.AUTH_COORDINATOR) {
    await coordinatorFetch(env, userSessionIndexObjectName(githubUserHash), "/session-index/all", {
      method: "DELETE",
    });
    return;
  }

  userSessionIndexes.delete(githubUserHash);
  if (env.SESSION_KV) await env.SESSION_KV.delete(userSessionIndexKey(githubUserHash));
}

export function tokenExpiresAt(expiresInSeconds: number | undefined) {
  if (!expiresInSeconds) return undefined;
  return new Date(Date.now() + expiresInSeconds * 1000).toISOString();
}

export function isSessionExpired(session: Session) {
  return Date.now() >= sessionExpiresAt(session);
}

function isFreshOAuthState(record: OAuthStateRecord) {
  return Boolean(
    record.createdAt &&
      record.codeVerifier &&
      Date.now() - record.createdAt <= oauthStateTtlSeconds * 1000,
  );
}

function sessionExpiresAt(session: Session) {
  const sessionExpiry = Date.parse(session.createdAt) + sessionTtlSeconds * 1000;
  const tokenExpiry = session.accessTokenExpiresAt
    ? Date.parse(session.accessTokenExpiresAt)
    : sessionExpiry;
  return Math.min(sessionExpiry, tokenExpiry);
}

async function trackUserSession(githubUserHash: string, sessionId: string, env: Env) {
  if (env.AUTH_COORDINATOR) {
    await coordinatorFetch(env, userSessionIndexObjectName(githubUserHash), "/session-index", {
      method: "PUT",
      body: JSON.stringify({ sessionId }),
    });
    return;
  }

  const localIndex = userSessionIndexes.get(githubUserHash) ?? new Set<string>();
  localIndex.add(sessionId);
  userSessionIndexes.set(githubUserHash, localIndex);

  if (!env.SESSION_KV) return;
  const key = userSessionIndexKey(githubUserHash);
  const stored = (await env.SESSION_KV.get<string[]>(key, "json")) ?? [];
  await env.SESSION_KV.put(key, JSON.stringify([...new Set([...stored, sessionId])]), {
    expirationTtl: sessionTtlSeconds,
  });
}

async function untrackUserSession(githubUserHash: string, sessionId: string, env: Env) {
  if (env.AUTH_COORDINATOR) {
    await coordinatorFetch(env, userSessionIndexObjectName(githubUserHash), "/session-index", {
      method: "DELETE",
      body: JSON.stringify({ sessionId }),
    });
    return;
  }

  const localIndex = userSessionIndexes.get(githubUserHash);
  localIndex?.delete(sessionId);

  if (!env.SESSION_KV) return;
  const key = userSessionIndexKey(githubUserHash);
  const stored = (await env.SESSION_KV.get<string[]>(key, "json")) ?? [];
  await env.SESSION_KV.put(
    key,
    JSON.stringify(stored.filter((storedSessionId) => storedSessionId !== sessionId)),
    {
      expirationTtl: sessionTtlSeconds,
    },
  );
}

async function listUserSessions(githubUserHash: string, env: Env) {
  if (env.AUTH_COORDINATOR) {
    const response = await coordinatorFetch(
      env,
      userSessionIndexObjectName(githubUserHash),
      "/session-index",
    );
    if (response.status === 404) return [];
    const payload = (await response.json()) as { sessionIds?: string[] };
    return payload.sessionIds ?? [];
  }

  const localIndex = userSessionIndexes.get(githubUserHash);
  if (localIndex) return [...localIndex];
  if (!env.SESSION_KV) return [];
  return (await env.SESSION_KV.get<string[]>(userSessionIndexKey(githubUserHash), "json")) ?? [];
}

function sessionKey(sessionId: string) {
  return `session:${sessionId}`;
}

function oauthStateKey(state: string) {
  return `oauth-state:${state}`;
}

function userSessionIndexKey(githubUserHash: string) {
  return `user-sessions:${githubUserHash}`;
}
