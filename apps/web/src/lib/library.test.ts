import { analysisVersion, analyzeRepository } from "@forage/analysis";
import type { ForageRepository, RepositoryAnalysis } from "@forage/shared";
import { describe, expect, it } from "vitest";
import {
  createCurrentAnalysisMap,
  filterRepositories,
  getCategoryOptions,
  getLanguageOptions,
  getLibrarySummary,
  getRepositoryAnalysis,
  getTopLanguage,
  sortRepositoriesByStarredAt,
} from "./library";

describe("library helpers", () => {
  it("filters by search text, language, and category", () => {
    const repositories = [
      createRepository(1, "forage/ui-kit", {
        description: "Reusable frontend components",
        primary_language: "TypeScript",
        topics: ["svelte", "components"],
      }),
      createRepository(2, "forage/api-service", {
        description: "Backend worker",
        primary_language: "Go",
        topics: ["api"],
      }),
    ];
    const analysisByRepositoryId = new Map(
      repositories.map((repository) => [repository.github_id, analyzeRepository(repository)]),
    );

    const results = filterRepositories(
      repositories,
      {
        searchQuery: "components",
        languageFilter: "TypeScript",
        categoryFilter: "Frontend",
        sortMode: "starred_at_desc",
      },
      analysisByRepositoryId,
    );

    expect(results.map((repository) => repository.full_name)).toEqual(["forage/ui-kit"]);
  });

  it("sorts visible repositories by score, stars, name, and starred date", () => {
    const older = createRepository(1, "forage/older", {
      stars: 10,
      starred_at: "2026-01-01T00:00:00.000Z",
    });
    const newer = createRepository(2, "forage/newer", {
      stars: 100,
      starred_at: "2026-02-01T00:00:00.000Z",
    });
    const repositories = [older, newer];
    const analysisByRepositoryId = new Map([
      [older.github_id, createAnalysis(older, 90)],
      [newer.github_id, createAnalysis(newer, 70)],
    ]);

    expect(
      sortRepositoriesByStarredAt(repositories).map((repository) => repository.full_name),
    ).toEqual(["forage/newer", "forage/older"]);
    expect(
      filterRepositories(repositories, emptyFilters("score_desc"), analysisByRepositoryId).map(
        (repository) => repository.full_name,
      ),
    ).toEqual(["forage/older", "forage/newer"]);
    expect(
      filterRepositories(repositories, emptyFilters("stars_desc"), analysisByRepositoryId).map(
        (repository) => repository.full_name,
      ),
    ).toEqual(["forage/newer", "forage/older"]);
    expect(
      filterRepositories(repositories, emptyFilters("name_asc"), analysisByRepositoryId).map(
        (repository) => repository.full_name,
      ),
    ).toEqual(["forage/newer", "forage/older"]);
  });

  it("builds library options and summary text", () => {
    const repositories = [
      createRepository(1, "forage/frontend", {
        primary_language: "TypeScript",
        topics: ["frontend"],
      }),
      createRepository(2, "forage/backend", {
        primary_language: "Go",
        topics: ["api"],
      }),
      createRepository(3, "forage/no-language", {
        primary_language: null,
        topics: [],
      }),
    ];
    const analysisByRepositoryId = new Map(
      repositories.map((repository) => [repository.github_id, analyzeRepository(repository)]),
    );

    expect(getTopLanguage(repositories)).toBe("TypeScript (1)");
    expect(getLanguageOptions(repositories)).toEqual(["Go", "TypeScript", "Unknown"]);
    expect(getCategoryOptions(repositories, analysisByRepositoryId)).toContain("Frontend");
    expect(getLibrarySummary(0, 0, 0)).toBe("No repositories stored");
    expect(getLibrarySummary(20, 8, 12)).toBe("8 shown of 12 matched");
  });

  it("uses only current analysis versions and falls back to fresh analysis", () => {
    const repository = createRepository(1, "forage/current", {
      topics: ["frontend"],
    });
    const staleAnalysis = createAnalysis(repository, 1, "old-analysis");
    const currentAnalysis = createAnalysis(repository, 88, analysisVersion);
    const analysisByRepositoryId = createCurrentAnalysisMap([staleAnalysis, currentAnalysis]);

    expect(getRepositoryAnalysis(repository, analysisByRepositoryId).scores.overall.value).toBe(88);
    expect(
      getRepositoryAnalysis(createRepository(2, "forage/fallback"), analysisByRepositoryId)
        .repository_full_name,
    ).toBe("forage/fallback");
  });
});

function emptyFilters(sortMode: "starred_at_desc" | "score_desc" | "stars_desc" | "name_asc") {
  return {
    searchQuery: "",
    languageFilter: "",
    categoryFilter: "",
    sortMode,
  };
}

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
    topics: [],
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

function createAnalysis(
  repository: ForageRepository,
  overallScore: number,
  version = analysisVersion,
): RepositoryAnalysis {
  const analysis = analyzeRepository(repository);
  return {
    ...analysis,
    analysis_version: version,
    scores: {
      ...analysis.scores,
      overall: {
        ...analysis.scores.overall,
        value: overallScore,
      },
    },
  };
}
