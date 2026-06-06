import { analyzeRepositories } from "@forage/analysis";
import type { AnalysisWorkerRequest, AnalysisWorkerResponse } from "../lib/analysis-worker";

self.addEventListener("message", (event: MessageEvent<AnalysisWorkerRequest>) => {
  if (event.data.type !== "analyze-repositories") return;

  try {
    const response: AnalysisWorkerResponse = {
      id: event.data.id,
      type: "analyze-repositories:success",
      analysis: analyzeRepositories(event.data.repositories),
    };
    self.postMessage(response);
  } catch (error) {
    const response: AnalysisWorkerResponse = {
      id: event.data.id,
      type: "analyze-repositories:failure",
      error: error instanceof Error ? error.message : "Analysis failed.",
    };
    self.postMessage(response);
  }
});
