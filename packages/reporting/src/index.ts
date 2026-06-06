import type { ForageRepository, ImportEvent, RepositoryAnalysis } from "@forage/shared";

export type ExportFormat = "json" | "csv" | "markdown" | "html";

export interface ExportPlan {
  mvp_formats: ExportFormat[];
  include_versions: true;
}

export const exportPlan: ExportPlan = {
  mvp_formats: ["json", "csv"],
  include_versions: true,
};

export const forageExportVersion = "forage-export-v0.1.0";

export interface LocalLibraryProfileExport {
  github_login: string | null;
  github_user_id: number | null;
  repository_count: number;
  updated_at: string;
}

export interface ForageExportPayload {
  export_version: typeof forageExportVersion;
  exported_at: string;
  repositories: ForageRepository[];
  analysis_results: RepositoryAnalysis[];
  latest_import_event: ImportEvent | null;
  local_library_profile: LocalLibraryProfileExport | null;
}

export interface CreateForageExportInput {
  exported_at?: string;
  repositories: ForageRepository[];
  analysis_results: RepositoryAnalysis[];
  latest_import_event: ImportEvent | null;
  local_library_profile: LocalLibraryProfileExport | null;
}

const csvColumns = [
  "full_name",
  "url",
  "description",
  "primary_language",
  "stars",
  "forks",
  "open_issues",
  "archived",
  "fork",
  "license",
  "topics",
  "categories",
  "overall_score",
  "activity_score",
  "popularity_score",
  "freshness_score",
  "maintenance_score",
  "starred_at",
  "updated_at",
  "pushed_at",
] as const;

export function createForageExport(input: CreateForageExportInput): ForageExportPayload {
  return {
    export_version: forageExportVersion,
    exported_at: input.exported_at ?? new Date().toISOString(),
    repositories: input.repositories,
    analysis_results: input.analysis_results,
    latest_import_event: input.latest_import_event,
    local_library_profile: input.local_library_profile,
  };
}

export function serializeForageExportJson(payload: ForageExportPayload) {
  return `${JSON.stringify(payload, null, 2)}\n`;
}

export function serializeRepositoryAnalysisCsv(payload: ForageExportPayload) {
  const analysisByRepositoryId = new Map(
    payload.analysis_results.map((analysis) => [analysis.repository_id, analysis]),
  );

  const rows = payload.repositories.map((repository) => {
    const analysis = analysisByRepositoryId.get(repository.github_id);
    return [
      repository.full_name,
      repository.url,
      repository.description ?? "",
      repository.primary_language ?? "",
      String(repository.stars),
      String(repository.forks),
      String(repository.open_issues),
      String(repository.archived),
      String(repository.fork),
      repository.license ?? "",
      repository.topics.join("|"),
      analysis?.categories.map((category) => category.label).join("|") ?? "",
      formatScore(analysis?.scores.overall.value),
      formatScore(analysis?.scores.activity.value),
      formatScore(analysis?.scores.popularity.value),
      formatScore(analysis?.scores.freshness.value),
      formatScore(analysis?.scores.maintenance.value),
      repository.starred_at,
      repository.updated_at,
      repository.pushed_at ?? "",
    ];
  });

  return `${[csvColumns, ...rows].map((row) => row.map(escapeCsvValue).join(",")).join("\n")}\n`;
}

function formatScore(score: number | undefined) {
  return typeof score === "number" ? String(score) : "";
}

function escapeCsvValue(value: string) {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replaceAll('"', '""')}"`;
}
