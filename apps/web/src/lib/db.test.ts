import { analyzeRepository } from "@forage/analysis";
import type { ForageRepository, ImportEvent } from "@forage/shared";
import { beforeEach, describe, expect, it } from "vitest";
import {
  acquireLocalOperationLock,
  getAllAnalysisResults,
  getAllRepositories,
  getImportEvents,
  getLocalLibraryProfile,
  reconcileImportedRepositories,
  refreshLocalOperationLock,
  releaseLocalOperationLock,
  resetLocalData,
  saveAnalysisResults,
  saveImportEvent,
  saveLocalLibraryProfile,
  saveRepositories,
} from "./db";

describe("local data store", () => {
  beforeEach(async () => {
    await resetLocalData();
  });

  it("saves repository, analysis, import event, and profile records", async () => {
    const repository = createRepository(1, "forage/one");
    const event = createImportEvent("event-newer", "2026-06-06T12:00:00.000Z");
    const olderEvent = createImportEvent("event-older", "2026-06-05T12:00:00.000Z");

    await saveRepositories([repository]);
    await saveAnalysisResults([analyzeRepository(repository)]);
    await saveImportEvent(olderEvent);
    await saveImportEvent(event);
    await saveLocalLibraryProfile({
      github_login: "dills122",
      github_user_id: 123,
      repository_count: 1,
      updated_at: "2026-06-06T12:00:00.000Z",
    });

    expect(await getAllRepositories()).toMatchObject([{ github_id: 1, full_name: "forage/one" }]);
    expect(await getAllAnalysisResults()).toMatchObject([
      { repository_id: 1, repository_full_name: "forage/one" },
    ]);
    expect((await getImportEvents()).map((importEvent) => importEvent.id)).toEqual([
      "event-newer",
      "event-older",
    ]);
    expect(await getLocalLibraryProfile()).toMatchObject({
      github_login: "dills122",
      repository_count: 1,
    });
  });

  it("reconciles completed imports by pruning stale repositories and analysis", async () => {
    const retainedRepository = createRepository(1, "forage/retained");
    const staleRepository = createRepository(2, "forage/stale");
    await saveRepositories([retainedRepository, staleRepository]);
    await saveAnalysisResults([
      analyzeRepository(retainedRepository),
      analyzeRepository(staleRepository),
    ]);

    await reconcileImportedRepositories([retainedRepository.github_id]);

    expect((await getAllRepositories()).map((repository) => repository.full_name)).toEqual([
      "forage/retained",
    ]);
    expect(
      (await getAllAnalysisResults()).map((analysis) => analysis.repository_full_name),
    ).toEqual(["forage/retained"]);
  });

  it("resets all local data stores", async () => {
    const repository = createRepository(1, "forage/reset");
    await saveRepositories([repository]);
    await saveAnalysisResults([analyzeRepository(repository)]);
    await saveImportEvent(createImportEvent("event-reset", "2026-06-06T12:00:00.000Z"));
    await saveLocalLibraryProfile({
      github_login: "dills122",
      github_user_id: 123,
      repository_count: 1,
      updated_at: "2026-06-06T12:00:00.000Z",
    });

    await resetLocalData();

    expect(await getAllRepositories()).toEqual([]);
    expect(await getAllAnalysisResults()).toEqual([]);
    expect(await getImportEvents()).toEqual([]);
    expect(await getLocalLibraryProfile()).toBeNull();
  });

  it("coordinates local operation locks through metadata", async () => {
    const firstLock = await acquireLocalOperationLock("import", {
      now: new Date("2026-06-06T12:00:00.000Z"),
      ownerId: "owner-one",
    });
    expect(firstLock.acquired).toBe(true);

    const blockedLock = await acquireLocalOperationLock("reset", {
      now: new Date("2026-06-06T12:01:00.000Z"),
      ownerId: "owner-two",
    });
    expect(blockedLock.acquired).toBe(false);
    if (!blockedLock.acquired) {
      expect(blockedLock.lock.operation).toBe("import");
    }

    await releaseLocalOperationLock("owner-one");
    const secondLock = await acquireLocalOperationLock("reset", {
      now: new Date("2026-06-06T12:02:00.000Z"),
      ownerId: "owner-two",
    });
    expect(secondLock.acquired).toBe(true);
  });

  it("replaces stale local operation locks and refreshes active locks", async () => {
    await acquireLocalOperationLock("import", {
      ttlMs: 1_000,
      now: new Date("2026-06-06T12:00:00.000Z"),
      ownerId: "stale-owner",
    });

    const replacement = await acquireLocalOperationLock("reset", {
      ttlMs: 1_000,
      now: new Date("2026-06-06T12:00:02.000Z"),
      ownerId: "replacement-owner",
    });
    expect(replacement.acquired).toBe(true);

    await refreshLocalOperationLock("replacement-owner", {
      ttlMs: 10_000,
      now: new Date("2026-06-06T12:00:03.000Z"),
    });

    const blocked = await acquireLocalOperationLock("import", {
      now: new Date("2026-06-06T12:00:05.000Z"),
      ownerId: "blocked-owner",
    });
    expect(blocked.acquired).toBe(false);
    if (!blocked.acquired) {
      expect(blocked.lock.owner_id).toBe("replacement-owner");
      expect(blocked.lock.expires_at).toBe("2026-06-06T12:00:13.000Z");
    }
  });
});

function createRepository(githubId: number, fullName: string): ForageRepository {
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
  };
}

function createImportEvent(id: string, startedAt: string): ImportEvent {
  return {
    id,
    started_at: startedAt,
    completed_at: startedAt,
    status: "completed",
    pages: 1,
    repositories: 1,
    rate_limits: [],
    retry_after_seconds: null,
    errors: [],
  };
}
