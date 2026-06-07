import type { ForageRepository } from "@forage/shared";
import { describe, expect, it } from "vitest";
import { createAppStateSnapshotPatch } from "./app-refresh";

describe("app refresh helpers", () => {
  it("turns local and remote snapshots into an app state patch", () => {
    const olderRepository = createRepository(1, "forage/older", {
      primary_language: "Go",
      starred_at: "2026-01-01T00:00:00.000Z",
    });
    const newerRepository = createRepository(2, "forage/newer", {
      primary_language: "TypeScript",
      starred_at: "2026-02-01T00:00:00.000Z",
    });

    const patch = createAppStateSnapshotPatch({
      repositories: [olderRepository, newerRepository],
      importEvents: [{ status: "completed", repositories: 2 }],
      analysisResults: [],
      localLibraryProfile: {
        id: "local-library-profile",
        github_login: "dills122",
        github_user_id: 123,
        repository_count: 2,
        updated_at: "2026-06-06T12:00:00.000Z",
      },
      config: { github_configured: true },
      session: {
        authenticated: true,
        user: { login: "dills122", id: 123 },
      },
      settingsResponse: {
        settings: {
          analytics_enabled: true,
          updated_at: "2026-06-06T12:00:00.000Z",
        },
        settings_store: "durable_object",
        stores_repository_data: false,
      },
    });

    expect(patch.configStatus).toBe("Ready");
    expect(patch.sessionStatus).toBe("Authenticated");
    expect(patch.latestImport).toBe("completed (2)");
    expect(patch.repositoryCount).toBe(2);
    expect(patch.repositories?.map((repository) => repository.full_name)).toEqual([
      "forage/newer",
      "forage/older",
    ]);
    expect(patch.user).toBe("dills122");
    expect(patch.localLibraryConflict).toBe(false);
    expect(patch.settingsStatus).toBe(
      "On. Anonymous product analytics only; repository data stays in this browser.",
    );
  });
});

function createRepository(
  githubId: number,
  fullName: string,
  overrides: Partial<ForageRepository> = {},
): ForageRepository {
  const importedAt = "2026-06-06T12:00:00.000Z";
  const [owner, repoName] = fullName.split("/");

  return {
    github_id: githubId,
    node_id: `node-${githubId}`,
    repo_name: repoName ?? "repo",
    owner: owner ?? "forage",
    full_name: fullName,
    url: `https://github.com/${fullName}`,
    description: "Repository fixture",
    homepage: null,
    topics: ["testing"],
    primary_language: "TypeScript",
    license: "MIT",
    stars: 10,
    forks: 1,
    watchers: 10,
    open_issues: 0,
    archived: false,
    disabled: false,
    fork: false,
    private: false,
    default_branch: "main",
    owner_avatar_url: "https://example.com/avatar.png",
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: importedAt,
    pushed_at: importedAt,
    starred_at: importedAt,
    imported_at: importedAt,
    source_api_version: "2022-11-28",
    schema_version: 1,
    ...overrides,
  };
}
