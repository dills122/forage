import type { ImportRunState } from "@forage/core";
import type { SessionResponse } from "./api";

export type ImportWorkerPhase = "importing" | "analyzing";

export interface StartRepositoryImportInput {
  workerOrigin: string;
  sessionUser: SessionResponse["user"] | null;
}

export interface ImportWorkerStartMessage extends StartRepositoryImportInput {
  id: string;
  type: "import:start";
}

export interface ImportWorkerCancelMessage {
  id: string;
  type: "import:cancel";
}

export type ImportWorkerRequest = ImportWorkerStartMessage | ImportWorkerCancelMessage;

export interface ImportWorkerProgressMessage {
  id: string;
  type: "import:progress";
  importRun: ImportRunState;
  phase: ImportWorkerPhase;
  page: number;
  message: string;
  observedFieldNames: string[];
}

export interface ImportWorkerCompleteMessage {
  id: string;
  type: "import:complete";
  importRun: ImportRunState;
  message: string;
  observedFieldNames: string[];
}

export interface ImportWorkerErrorMessage {
  id: string;
  type: "import:error";
  importRun: ImportRunState | null;
  message: string;
  observedFieldNames: string[];
}

export type ImportWorkerResponse =
  | ImportWorkerProgressMessage
  | ImportWorkerCompleteMessage
  | ImportWorkerErrorMessage;

export type ImportWorkerTerminalMessage = ImportWorkerCompleteMessage | ImportWorkerErrorMessage;

export interface RepositoryImportSession {
  id: string;
  done: Promise<ImportWorkerTerminalMessage>;
  cancel: () => void;
}

export function startRepositoryImport(
  input: StartRepositoryImportInput,
  onProgress: (message: ImportWorkerProgressMessage) => void,
): RepositoryImportSession {
  const id = crypto.randomUUID();
  const worker = new Worker(new URL("../workers/import.worker.ts", import.meta.url), {
    type: "module",
  });

  const done = new Promise<ImportWorkerTerminalMessage>((resolve, reject) => {
    worker.addEventListener("message", (event: MessageEvent<ImportWorkerResponse>) => {
      const message = event.data;
      if (message.id !== id) return;

      if (message.type === "import:progress") {
        onProgress(message);
        return;
      }

      worker.terminate();
      resolve(message);
    });

    worker.addEventListener("error", (event) => {
      worker.terminate();
      reject(new Error(event.message || "Import worker failed."));
    });

    worker.postMessage({
      id,
      type: "import:start",
      ...input,
    } satisfies ImportWorkerStartMessage);
  });

  return {
    id,
    done,
    cancel: () => {
      worker.postMessage({
        id,
        type: "import:cancel",
      } satisfies ImportWorkerCancelMessage);
    },
  };
}
