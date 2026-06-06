import { analyzeRepository } from "@forage/analysis";
import type { ForageRepository, ImportEvent } from "@forage/shared";
import { beforeEach, describe, expect, it } from "vitest";
import {
  getAllAnalysisResults,
  getAllRepositories,
  getImportEvents,
  getLocalLibraryProfile,
  reconcileImportedRepositories,
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
    errors: [],
  };
}
