import type { ApplicationSettingsUpdate } from "@forage/shared";
import { settingsStore } from "./env";
import { hasValidCsrfToken, json } from "./http";
import { getSessionLookup } from "./request-session";
import { loadSettings, saveSettings } from "./settings";
import type { Env } from "./types";

export async function getSettings(request: Request, env: Env) {
  const lookup = await getSessionLookup(request, env);
  if (!lookup.session) {
    return json(request, env, { error: "Not authenticated" }, { status: 401 });
  }

  const settings = await loadSettings(lookup.session, env);
  return json(request, env, {
    settings,
    stores_repository_data: false,
    settings_store: settingsStore(env),
  });
}

export async function updateSettings(request: Request, env: Env) {
  const lookup = await getSessionLookup(request, env);
  if (!lookup.session) {
    return json(request, env, { error: "Not authenticated" }, { status: 401 });
  }
  if (!hasValidCsrfToken(request, lookup.session)) {
    return json(request, env, { error: "Invalid CSRF token" }, { status: 403 });
  }

  const payload = await request.json().catch(() => null);
  if (!isSettingsUpdate(payload)) {
    return json(request, env, { error: "Invalid settings payload" }, { status: 400 });
  }

  const settings = {
    analytics_enabled: payload.analytics_enabled,
    updated_at: new Date().toISOString(),
  };
  await saveSettings(lookup.session, env, settings);

  return json(request, env, {
    settings,
    stores_repository_data: false,
    settings_store: settingsStore(env),
  });
}

function isSettingsUpdate(payload: unknown): payload is ApplicationSettingsUpdate {
  return (
    typeof payload === "object" &&
    payload !== null &&
    "analytics_enabled" in payload &&
    typeof (payload as { analytics_enabled?: unknown }).analytics_enabled === "boolean"
  );
}
