import { analyzeRepositories } from "@forage/analysis";
import {
  cancelImport,
  completeImport,
  createImportRunState,
  failImport,
  type ImportRunState,
  importRunStateToEvent,
  rateLimitImport,
  recordImportPage,
} from "@forage/core";
import { WorkerApi, WorkerApiError } from "../lib/api";
import {
  reconcileImportedRepositories,
  saveAnalysisResults,
  saveImportEvent,
  saveLocalLibraryProfile,
  saveRepositories,
} from "../lib/db";
import type {
  ImportWorkerCompleteMessage,
  ImportWorkerErrorMessage,
  ImportWorkerPhase,
  ImportWorkerProgressMessage,
  ImportWorkerRequest,
  ImportWorkerStartMessage,
} from "../lib/import-worker";

let activeImportId: string | null = null;
let activeImportController: AbortController | null = null;
let cancelRequested = false;

self.addEventListener("message", (event: MessageEvent<ImportWorkerRequest>) => {
  const message = event.data;

  if (message.type === "import:cancel") {
    if (message.id !== activeImportId) return;
    cancelRequested = true;
    activeImportController?.abort();
    return;
  }

  if (activeImportId) {
    postError(message.id, null, "An import is already running in this worker.", []);
    return;
  }

  void runImport(message);
});

async function runImport(message: ImportWorkerStartMessage) {
  activeImportId = message.id;
  activeImportController = new AbortController();
  cancelRequested = false;

  let importRun = createImportRunState();
  const observedFieldNames = new Set<string>();
  const importedRepositoryIds = new Set<number>();
  const api = new WorkerApi(message.workerOrigin);

  try {
    let page: number | null = 1;

    while (page) {
      postProgress(message.id, importRun, "importing", page, observedFieldNames);
      const result = await api.getStarredPage(page, 100, activeImportController.signal);

      await saveRepositories(result.repositories);
      for (const repository of result.repositories) {
        importedRepositoryIds.add(repository.github_id);
      }
      postProgress(message.id, importRun, "analyzing", page, observedFieldNames);
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
      github_login: message.sessionUser?.login ?? null,
      github_user_id: message.sessionUser?.id ?? null,
      repository_count: importRun.repositories,
      updated_at: completedAt,
    });
    importRun = completeImport(importRun, completedAt);
  } catch (error) {
    if (importRun.status === "running") {
      const errorMessage = error instanceof Error ? error.message : "Import failed.";
      if (cancelRequested || isAbortError(error)) {
        importRun = cancelImport(importRun);
      } else if (isRateLimitError(error)) {
        importRun = rateLimitImport(importRun, errorMessage, error.rateLimit);
      } else {
        importRun = failImport(importRun, errorMessage);
      }
    }
  }

  try {
    await saveImportEvent(importRunStateToEvent(message.id, importRun));
    postComplete(message.id, importRun, observedFieldNames);
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Import finished but local history could not be saved.";
    postError(message.id, importRun, errorMessage, observedFieldNames);
  } finally {
    activeImportId = null;
    activeImportController = null;
    cancelRequested = false;
  }
}

function postProgress(
  id: string,
  importRun: ImportRunState,
  phase: ImportWorkerPhase,
  page: number,
  observedFieldNames: Set<string>,
) {
  self.postMessage({
    id,
    type: "import:progress",
    importRun,
    phase,
    page,
    message: getImportProgressText(importRun, phase, page),
    observedFieldNames: Array.from(observedFieldNames).sort(),
  } satisfies ImportWorkerProgressMessage);
}

function postComplete(id: string, importRun: ImportRunState, observedFieldNames: Set<string>) {
  self.postMessage({
    id,
    type: "import:complete",
    importRun,
    message: getImportTerminalText(importRun),
    observedFieldNames: Array.from(observedFieldNames).sort(),
  } satisfies ImportWorkerCompleteMessage);
}

function postError(
  id: string,
  importRun: ImportRunState | null,
  message: string,
  observedFieldNames: Iterable<string>,
) {
  self.postMessage({
    id,
    type: "import:error",
    importRun,
    message,
    observedFieldNames: Array.from(observedFieldNames).sort(),
  } satisfies ImportWorkerErrorMessage);
}

function getImportProgressText(importRun: ImportRunState, phase: ImportWorkerPhase, page: number) {
  if (phase === "analyzing") {
    return `Analyzing page ${page} in browser worker after importing ${importRun.repositories} repositories...`;
  }
  return `Importing page ${page}; ${importRun.repositories} repositories stored so far...`;
}

function getImportTerminalText(importRun: ImportRunState) {
  if (importRun.status === "completed") {
    return `Imported ${importRun.repositories} repositories across ${importRun.pages} page(s).`;
  }
  if (importRun.status === "cancelled") {
    return `Import cancelled after ${importRun.pages} page(s) and ${importRun.repositories} repositories.`;
  }
  if (importRun.status === "rate_limited") {
    return `Import paused by GitHub rate limits after ${importRun.pages} page(s). Try again later.`;
  }
  if (importRun.status === "failed") {
    return importRun.errors[0] || "Import failed.";
  }
  return "Import running.";
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
