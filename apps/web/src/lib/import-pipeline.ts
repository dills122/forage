import { analyzeRepositories } from "@forage/analysis";
import {
  cancelImport,
  completeImport,
  createImportRunState,
  failImport,
  type ImportRunState,
  rateLimitImport,
  recordImportPage,
} from "@forage/core";
import { WorkerApi, WorkerApiError } from "./api";
import {
  reconcileImportedRepositories,
  saveAnalysisResults,
  saveLocalLibraryProfile,
  saveRepositories,
} from "./db";
import type { ImportWorkerPhase, StartRepositoryImportInput } from "./import-worker";

export interface ImportPipelineInput extends StartRepositoryImportInput {
  signal: AbortSignal;
  isCancelRequested: () => boolean;
}

export interface ImportPipelineProgress {
  importRun: ImportRunState;
  phase: ImportWorkerPhase;
  page: number;
  observedFieldNames: Set<string>;
}

export interface ImportPipelineResult {
  importRun: ImportRunState;
  observedFieldNames: Set<string>;
}

export async function runRepositoryImportPipeline(
  input: ImportPipelineInput,
  onProgress: (progress: ImportPipelineProgress) => void,
): Promise<ImportPipelineResult> {
  let importRun = createImportRunState();
  const observedFieldNames = new Set<string>();
  const importedRepositoryIds = new Set<number>();
  const api = new WorkerApi(input.workerOrigin);

  try {
    let page: number | null = 1;

    while (page) {
      onProgress({ importRun, phase: "importing", page, observedFieldNames });
      const result = await api.getStarredPage(page, 100, input.signal);

      await saveRepositories(result.repositories);
      for (const repository of result.repositories) {
        importedRepositoryIds.add(repository.github_id);
      }
      onProgress({ importRun, phase: "analyzing", page, observedFieldNames });
      await saveAnalysisResults(analyzeRepositories(result.repositories));

      importRun = recordImportPage(importRun, {
        page,
        repositories: result.repositories.length,
        rate_limit: result.rate_limit,
      });
      for (const fieldName of result.raw_field_names) observedFieldNames.add(fieldName);

      page = result.next_page;
    }

    const completedAt = new Date().toISOString();
    await reconcileImportedRepositories(importedRepositoryIds);
    await saveLocalLibraryProfile({
      github_login: input.sessionUser?.login ?? null,
      github_user_id: input.sessionUser?.id ?? null,
      repository_count: importRun.repositories,
      updated_at: completedAt,
    });
    importRun = completeImport(importRun, completedAt);
  } catch (error) {
    if (importRun.status === "running") {
      const errorMessage = error instanceof Error ? error.message : "Import failed.";
      if (input.isCancelRequested() || isAbortError(error)) {
        importRun = cancelImport(importRun);
      } else if (isRateLimitError(error)) {
        importRun = rateLimitImport(importRun, errorMessage, error.rateLimit);
      } else {
        importRun = failImport(importRun, errorMessage);
      }
    }
  }

  return {
    importRun,
    observedFieldNames,
  };
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function isRateLimitError(error: unknown): error is WorkerApiError {
  return (
    error instanceof WorkerApiError &&
    (error.status === 429 || (error.status === 403 && error.rateLimit?.remaining === "0"))
  );
}
