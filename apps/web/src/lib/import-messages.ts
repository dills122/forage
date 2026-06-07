import type { ImportRunState } from "@forage/core";
import type { ImportWorkerPhase } from "./import-worker";

export function getImportProgressText(
  importRun: ImportRunState,
  phase: ImportWorkerPhase,
  page: number,
) {
  if (phase === "analyzing") {
    return `Analyzing page ${page} in browser worker after importing ${importRun.repositories} repositories...`;
  }
  return `Importing page ${page}; ${importRun.repositories} repositories stored so far...`;
}

export function getImportTerminalText(importRun: ImportRunState) {
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

export function sortObservedFieldNames(observedFieldNames: Iterable<string>) {
  return Array.from(observedFieldNames).sort();
}
