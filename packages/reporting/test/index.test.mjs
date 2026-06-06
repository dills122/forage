import assert from "node:assert/strict";
import test from "node:test";
import {
  createForageExport,
  forageExportVersion,
  serializeForageExportJson,
  serializeRepositoryAnalysisCsv,
} from "../src/index.ts";

const repository = {
  github_id: 1,
  node_id: "node-1",
  repo_name: "demo",
  owner: "forage",
  full_name: "forage/demo",
  url: "https://github.com/forage/demo",
  description: 'CSV "safe", local-first repo',
  homepage: null,
  topics: ["local-first", "csv"],
  primary_language: "TypeScript",
  license: "MIT",
  stars: 42,
  forks: 3,
  watchers: 2,
  open_issues: 1,
  archived: false,
  disabled: false,
  fork: false,
  private: false,
  default_branch: "main",
  owner_avatar_url: "https://example.com/avatar.png",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-02-01T00:00:00.000Z",
  pushed_at: "2026-03-01T00:00:00.000Z",
  starred_at: "2026-04-01T00:00:00.000Z",
  imported_at: "2026-05-01T00:00:00.000Z",
  source_api_version: "2022-11-28",
  schema_version: 1,
};

const analysis = {
  repository_id: repository.github_id,
  repository_full_name: repository.full_name,
  analysis_version: "analysis-v0.1.0",
  generated_at: "2026-05-01T00:00:00.000Z",
  categories: [
    {
      id: "frontend",
      label: "Frontend",
      family: "frontend",
      confidence: 100,
      reasons: [],
    },
  ],
  scores: {
    version: "foundational-v0.1.0",
    overall: { value: 81, explanations: [] },
    activity: { value: 75, explanations: [] },
    popularity: { value: 88, explanations: [] },
    freshness: { value: 80, explanations: [] },
    maintenance: { value: 70, explanations: [] },
  },
  labels: [],
};

test("creates versioned JSON export payloads", () => {
  const payload = createForageExport({
    exported_at: "2026-06-05T00:00:00.000Z",
    repositories: [repository],
    analysis_results: [analysis],
    latest_import_event: null,
    local_library_profile: null,
  });

  assert.equal(payload.export_version, forageExportVersion);
  assert.equal(
    JSON.parse(serializeForageExportJson(payload)).repositories[0].full_name,
    "forage/demo",
  );
});

test("serializes repository analysis CSV with escaped values", () => {
  const payload = createForageExport({
    repositories: [repository],
    analysis_results: [analysis],
    latest_import_event: null,
    local_library_profile: null,
  });

  const csv = serializeRepositoryAnalysisCsv(payload);

  assert.match(csv, /^full_name,url,description,/);
  assert.match(csv, /"CSV ""safe"", local-first repo"/);
  assert.match(csv, /local-first\|csv/);
  assert.match(csv, /Frontend,81,75,88,80,70/);
});

test("serializes empty score fields when analysis is missing", () => {
  const payload = createForageExport({
    repositories: [
      {
        ...repository,
        github_id: 2,
        description: null,
        primary_language: null,
        license: null,
        topics: [],
        pushed_at: null,
      },
    ],
    analysis_results: [],
    latest_import_event: null,
    local_library_profile: null,
  });

  const csv = serializeRepositoryAnalysisCsv(payload);
  const row = csv.trimEnd().split("\n")[1];

  assert.match(csv, /forage\/demo,https:\/\/github.com\/forage\/demo,,/);
  assert.equal(
    row,
    "forage/demo,https://github.com/forage/demo,,,42,3,1,false,false,,,,,,,,,2026-04-01T00:00:00.000Z,2026-02-01T00:00:00.000Z,",
  );
});

test("creates a current export timestamp when one is not supplied", () => {
  const payload = createForageExport({
    repositories: [],
    analysis_results: [],
    latest_import_event: null,
    local_library_profile: null,
  });

  assert.match(payload.exported_at, /^\d{4}-\d{2}-\d{2}T/);
});
