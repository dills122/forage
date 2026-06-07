import type { ApplicationSettings } from "@forage/shared";
import { hashGitHubUserId } from "./crypto";
import { getGitHubUserIdentity } from "./github";
import { persistSessionIfNeeded } from "./session-store";
import type { Env, Session } from "./types";

export function defaultSettings(): ApplicationSettings {
  return {
    analytics_enabled: false,
    updated_at: null,
  };
}

export async function loadSettings(session: Session, env: Env): Promise<ApplicationSettings> {
  if (!env.SETTINGS_KV) return session.settings;

  const key = await settingsKey(session, env);
  if (!key) return session.settings;
  const storedSettings = await env.SETTINGS_KV.get<ApplicationSettings>(key, "json");
  session.settings = storedSettings ?? defaultSettings();
  return session.settings;
}

export async function saveSettings(session: Session, env: Env, settings: ApplicationSettings) {
  session.settings = settings;
  await persistSessionIfNeeded(session, env);
  if (!env.SETTINGS_KV) return;

  const key = await settingsKey(session, env);
  if (!key) return;
  await env.SETTINGS_KV.put(key, JSON.stringify(settings));
}

export async function ensureSessionUserHash(session: Session, env: Env) {
  if (session.githubUserHash) return session.githubUserHash;

  const identity = await getGitHubUserIdentity(session, env);
  if (!identity.ok || identity.user.id === null) return null;

  session.githubUserHash = await hashGitHubUserId(identity.user.id, env);
  await persistSessionIfNeeded(session, env);
  return session.githubUserHash;
}

export function settingsKeyFromHash(githubUserHash: string) {
  return `settings:${githubUserHash}`;
}

async function settingsKey(session: Session, env: Env) {
  if (session.githubUserHash) return `settings:${session.githubUserHash}`;

  const githubUserHash = await ensureSessionUserHash(session, env);
  return githubUserHash ? settingsKeyFromHash(githubUserHash) : null;
}
