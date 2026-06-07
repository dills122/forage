import { describe, expect, it } from "vitest";
import type { SessionResponse } from "./api";
import {
  createInitialState,
  defaultSettings,
  getConfigStatus,
  getLocalLibraryNoticeBody,
  getLocalLibraryNoticeTitle,
  getLocalLibraryOwner,
  getLocalLibraryStatus,
  getSelectedRepository,
  getSettingsStatus,
  getUserDisplay,
  hasLocalLibraryConflict,
} from "./app-state";
import type { LocalLibraryProfile } from "./db";

describe("app state helpers", () => {
  it("creates a stable initial state", () => {
    const state = createInitialState("http://127.0.0.1:8787");

    expect(state.workerOrigin).toBe("http://127.0.0.1:8787");
    expect(state.configStatus).toBe("Checking");
    expect(state.settings).toEqual(defaultSettings());
    expect(state.repositories).toEqual([]);
    expect(state.analysisByRepositoryId.size).toBe(0);
  });

  it("formats worker config, settings, and local library status", () => {
    expect(getConfigStatus({ github_configured: true })).toBe("Ready");
    expect(
      getConfigStatus({
        has_github_client_id: true,
        has_github_client_secret: false,
      }),
    ).toBe("Missing GitHub env");
    expect(getConfigStatus({ error: "Worker unavailable" })).toBe("Worker unavailable");
    expect(getSettingsStatus(false, defaultSettings())).toBe(
      "Connect GitHub to manage this setting.",
    );
    expect(getSettingsStatus(true, defaultSettings())).toBe(
      "Off. Repository data stays in this browser.",
    );
    expect(getSettingsStatus(true, { analytics_enabled: true, updated_at: null })).toBe(
      "On. Anonymous product analytics only; repository data stays in this browser.",
    );
    expect(getLocalLibraryStatus(0, false, false, "-", null)).toBe(
      "No repository data stored locally.",
    );
    expect(getLocalLibraryStatus(12, true, false, "dills122", "dills122")).toBe(
      "12 repositories stored locally and ready to refresh.",
    );
    expect(getLocalLibraryStatus(12, false, false, "dills122", null)).toBe(
      "12 repositories stored locally; GitHub is disconnected.",
    );
    expect(getLocalLibraryStatus(12, true, true, "personal", "work")).toBe(
      "12 repositories stored locally for personal; current GitHub session is work.",
    );
  });

  it("handles connected, disconnected, and conflicting owners", () => {
    const profile: LocalLibraryProfile = {
      id: "local-library-profile",
      github_login: "dills122",
      github_user_id: 123,
      repository_count: 720,
      updated_at: "2026-06-06T12:00:00.000Z",
    };
    const authenticatedSession: SessionResponse = {
      authenticated: true,
      user: { login: "dills122", id: 123 },
    };
    const disconnectedSession: SessionResponse = { authenticated: false };

    expect(getLocalLibraryOwner(null, 0)).toBe("-");
    expect(getLocalLibraryOwner(profile, 720)).toBe("dills122");
    expect(getUserDisplay(authenticatedSession, profile, 720)).toBe("dills122");
    expect(getUserDisplay(disconnectedSession, profile, 720)).toBe("dills122 (not connected)");
    expect(hasLocalLibraryConflict(profile, authenticatedSession.user)).toBe(false);
    expect(hasLocalLibraryConflict(profile, { login: "work-user", id: 456 })).toBe(true);
    expect(getLocalLibraryNoticeTitle(true, true)).toBe("Different GitHub account connected");
    expect(getLocalLibraryNoticeTitle(false, true)).toBe("Local library synced to this browser");
    expect(
      getLocalLibraryNoticeBody({
        authenticated: false,
        localLibraryConflict: false,
        localLibraryOwner: "dills122",
        sessionLogin: null,
      }),
    ).toBe(
      "This browser has local data for dills122. Connect GitHub when you want to refresh imports.",
    );
  });

  it("selects the requested repository or falls back to the first visible repository", () => {
    const repositories = [
      { github_id: 1, full_name: "forage/one" },
      { github_id: 2, full_name: "forage/two" },
    ] as Parameters<typeof getSelectedRepository>[0];

    expect(getSelectedRepository([], null)).toBeNull();
    expect(getSelectedRepository(repositories, null)?.full_name).toBe("forage/one");
    expect(getSelectedRepository(repositories, 2)?.full_name).toBe("forage/two");
    expect(getSelectedRepository(repositories, 999)?.full_name).toBe("forage/one");
  });
});
