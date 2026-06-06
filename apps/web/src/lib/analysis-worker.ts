import type { ForageRepository, RepositoryAnalysis } from "@forage/shared";

export interface AnalyzeRepositoriesRequest {
  id: string;
  type: "analyze-repositories";
  repositories: ForageRepository[];
}

export interface AnalyzeRepositoriesSuccess {
  id: string;
  type: "analyze-repositories:success";
  analysis: RepositoryAnalysis[];
}

export interface AnalyzeRepositoriesFailure {
  id: string;
  type: "analyze-repositories:failure";
  error: string;
}

export type AnalysisWorkerRequest = AnalyzeRepositoriesRequest;
export type AnalysisWorkerResponse = AnalyzeRepositoriesSuccess | AnalyzeRepositoriesFailure;

export function analyzeRepositoriesInWorker(repositories: ForageRepository[]) {
  if (repositories.length === 0) return Promise.resolve([]);

  const request: AnalyzeRepositoriesRequest = {
    id: crypto.randomUUID(),
    type: "analyze-repositories",
    repositories,
  };

  return new Promise<RepositoryAnalysis[]>((resolve, reject) => {
    const worker = new Worker(new URL("../workers/analysis.worker.ts", import.meta.url), {
      type: "module",
    });

    worker.addEventListener("message", (event: MessageEvent<AnalysisWorkerResponse>) => {
      if (event.data.id !== request.id) return;
      worker.terminate();

      if (event.data.type === "analyze-repositories:success") {
        resolve(event.data.analysis);
        return;
      }

      reject(new Error(event.data.error));
    });

    worker.addEventListener("error", (event) => {
      worker.terminate();
      reject(new Error(event.message || "Analysis worker failed."));
    });

    worker.postMessage(request);
  });
}
