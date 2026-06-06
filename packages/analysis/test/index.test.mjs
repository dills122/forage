import assert from "node:assert/strict";
import test from "node:test";
import {
  analysisVersion,
  analyzeRepository,
  matchCategories,
  scoreRepository,
  scoreVersion,
} from "../src/index.ts";

function createRepository(overrides = {}) {
  return {
    github_id: 1,
    node_id: "node-1",
    repo_name: "design-system",
    owner: "forage",
    full_name: "forage/design-system",
    url: "https://github.com/forage/design-system",
    description: "React component library for browser UI",
    homepage: "https://example.com",
    topics: ["frontend", "react", "component", "library"],
    primary_language: "TypeScript",
    license: "MIT",
    stars: 12_000,
    forks: 900,
    watchers: 500,
    open_issues: 24,
    archived: false,
    disabled: false,
    fork: false,
    private: false,
    default_branch: "main",
    owner_avatar_url: "https://example.com/avatar.png",
    created_at: "2025-01-01T00:00:00.000Z",
    updated_at: "2026-05-25T00:00:00.000Z",
    pushed_at: "2026-05-28T00:00:00.000Z",
    starred_at: "2026-06-01T00:00:00.000Z",
    imported_at: "2026-06-05T00:00:00.000Z",
    source_api_version: "2022-11-28",
    schema_version: 1,
    ...overrides,
  };
}

test("matches broad language, frontend, and library categories", () => {
  const matches = matchCategories(createRepository());
  const labels = matches.map((match) => match.label);

  assert.ok(labels.includes("TypeScript"));
  assert.ok(labels.includes("Frontend"));
  assert.ok(labels.includes("Library"));
});

test("generates versioned analysis with bounded foundational scores", () => {
  const analysis = analyzeRepository(createRepository(), new Date("2026-06-05T00:00:00.000Z"));

  assert.equal(analysis.analysis_version, analysisVersion);
  assert.equal(analysis.scores.version, scoreVersion);
  assert.ok(analysis.scores.overall.value >= 0);
  assert.ok(analysis.scores.overall.value <= 100);
  assert.ok(analysis.labels.some((label) => label.id === "worth-revisiting"));
});

test("penalizes archived stale repositories against active repositories", () => {
  const now = new Date("2026-06-05T00:00:00.000Z");
  const active = scoreRepository(createRepository(), now);
  const staleArchived = scoreRepository(
    createRepository({
      archived: true,
      created_at: "2018-01-01T00:00:00.000Z",
      updated_at: "2020-01-01T00:00:00.000Z",
      pushed_at: "2020-01-01T00:00:00.000Z",
      open_issues: 300,
      stars: 150,
    }),
    now,
  );

  assert.ok(active.overall.value > staleArchived.overall.value);
  assert.ok(
    staleArchived.maintenance.explanations.some((explanation) => explanation.signal === "archived"),
  );
});

test("handles missing timestamps and disabled repositories", () => {
  const analysis = analyzeRepository(
    createRepository({
      disabled: true,
      created_at: "",
      updated_at: "",
      pushed_at: null,
      stars: 0,
      forks: 0,
      open_issues: 0,
    }),
    new Date("2026-06-05T00:00:00.000Z"),
  );

  assert.equal(analysis.scores.activity.value, 0);
  assert.equal(analysis.scores.freshness.explanations[0].message, "No update timestamp available.");
  assert.ok(
    analysis.scores.maintenance.explanations.some(
      (explanation) => explanation.signal === "disabled",
    ),
  );
});
