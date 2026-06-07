import { analyzeRepository } from "@forage/analysis";
import type { ForageRepository } from "@forage/shared";
import { describe, expect, it } from "vitest";
import {
  formatCategoryReason,
  formatScoreExplanation,
  getCategoryReasonSummary,
  getFoundationalScoreBreakdown,
  getRepositoryFlags,
  getRepositoryMetadata,
  getSupportingScoreBreakdown,
  getTopCategoryMatches,
} from "./repository-detail";

describe("repository detail helpers", () => {
  it("builds stable foundational and supporting score breakdowns", () => {
    const analysis = analyzeRepository(createRepository());

    expect(getFoundationalScoreBreakdown(analysis).map((item) => [item.key, item.weight])).toEqual([
      ["activity", "30%"],
      ["popularity", "25%"],
      ["freshness", "20%"],
      ["maintenance", "25%"],
    ]);
    expect(getSupportingScoreBreakdown(analysis).map((item) => item.key)).toEqual([
      "metadata_quality",
      "topic_density",
    ]);
  });

  it("formats category and score reasons for the detail panel", () => {
    const analysis = analyzeRepository(createRepository());
    const category = getTopCategoryMatches(analysis).find((match) => match.label === "Frontend");

    expect(category).toBeDefined();
    expect(formatCategoryReason({ field: "topic", value: "frontend", weight: 2 })).toBe(
      "Topic: frontend (+2)",
    );
    if (!category) throw new Error("Expected Frontend category match");
    expect(getCategoryReasonSummary(category)).toContain("Topic: frontend");
    expect(formatScoreExplanation(analysis.scores.overall.explanations[0])).toContain(
      "Weighted blend",
    );
  });

  it("formats repository metadata and active flags", () => {
    const repository = createRepository({
      archived: true,
      fork: true,
      license: null,
      open_issues: 1200,
    });

    expect(getRepositoryFlags(repository)).toEqual(["Archived", "Fork"]);
    expect(getRepositoryMetadata(repository)).toContainEqual(["License", "Unknown"]);
    expect(getRepositoryMetadata(repository)).toContainEqual(["Open issues", "1,200"]);
  });
});

function createRepository(overrides: Partial<ForageRepository> = {}): ForageRepository {
  return {
    github_id: 1,
    node_id: "node-1",
    repo_name: "ui-kit",
    owner: "forage",
    full_name: "forage/ui-kit",
    url: "https://github.com/forage/ui-kit",
    description: "Reusable frontend component system",
    homepage: "https://example.com",
    topics: ["frontend", "svelte", "library"],
    primary_language: "TypeScript",
    license: "MIT",
    stars: 1200,
    forks: 80,
    watchers: 1200,
    open_issues: 12,
    archived: false,
    disabled: false,
    fork: false,
    private: false,
    default_branch: "main",
    owner_avatar_url: "https://example.com/avatar.png",
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2026-05-01T00:00:00.000Z",
    pushed_at: "2026-05-15T00:00:00.000Z",
    starred_at: "2026-06-01T00:00:00.000Z",
    imported_at: "2026-06-06T12:00:00.000Z",
    source_api_version: "2022-11-28",
    schema_version: 1,
    ...overrides,
  };
}
