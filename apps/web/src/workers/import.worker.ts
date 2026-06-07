import { type ImportRunState, importRunStateToEvent } from "@forage/core";
import { saveImportEvent } from "../lib/db";
import {
  getImportProgressText,
  getImportTerminalText,
  sortObservedFieldNames,
} from "../lib/import-messages";
import { type ImportPipelineProgress, runRepositoryImportPipeline } from "../lib/import-pipeline";
import type {
  ImportWorkerCompleteMessage,
  ImportWorkerErrorMessage,
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

  const { importRun, observedFieldNames } = await runRepositoryImportPipeline(
    {
      workerOrigin: message.workerOrigin,
      sessionUser: message.sessionUser,
      signal: activeImportController.signal,
      isCancelRequested: () => cancelRequested,
    },
    (progress) => postProgress(message.id, progress),
  );

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
  { importRun, phase, page, observedFieldNames }: ImportPipelineProgress,
) {
  self.postMessage({
    id,
    type: "import:progress",
    importRun,
    phase,
    page,
    message: getImportProgressText(importRun, phase, page),
    observedFieldNames: sortObservedFieldNames(observedFieldNames),
  } satisfies ImportWorkerProgressMessage);
}

function postComplete(id: string, importRun: ImportRunState, observedFieldNames: Set<string>) {
  self.postMessage({
    id,
    type: "import:complete",
    importRun,
    message: getImportTerminalText(importRun),
    observedFieldNames: sortObservedFieldNames(observedFieldNames),
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
    observedFieldNames: sortObservedFieldNames(observedFieldNames),
  } satisfies ImportWorkerErrorMessage);
}
