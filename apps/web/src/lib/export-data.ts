import { analyzeRepository } from "@forage/analysis";
import {
  createForageExport,
  serializeForageExportJson,
  serializeRepositoryAnalysisCsv,
} from "@forage/reporting";
import {
  getAllAnalysisResults,
  getAllRepositories,
  getImportEvents,
  getLocalLibraryProfile,
} from "./db";
import { createCurrentAnalysisMap } from "./library";

export type ExportFormat = "json" | "csv";

export async function exportLocalLibrary(format: ExportFormat) {
  const [repositories, events, analysisResults, localLibraryProfile] = await Promise.all([
    getAllRepositories(),
    getImportEvents(),
    getAllAnalysisResults(),
    getLocalLibraryProfile(),
  ]);
  const analysisByRepositoryId = createCurrentAnalysisMap(analysisResults);
  const payload = createForageExport({
    repositories,
    analysis_results: repositories.map(
      (repository) =>
        analysisByRepositoryId.get(repository.github_id) ?? analyzeRepository(repository),
    ),
    latest_import_event: events[0] ?? null,
    local_library_profile: localLibraryProfile,
  });
  const isJson = format === "json";
  const contents = isJson
    ? serializeForageExportJson(payload)
    : serializeRepositoryAnalysisCsv(payload);
  const mimeType = isJson ? "application/json" : "text/csv";
  const extension = isJson ? "json" : "csv";
  downloadText(
    contents,
    mimeType,
    `forage-export-${new Date().toISOString().slice(0, 10)}.${extension}`,
  );
}

export function downloadText(contents: string, mimeType: string, filename: string) {
  const blob = new Blob([contents], {
    type: mimeType,
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
