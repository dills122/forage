import type { RepositoryAnalysis } from "@forage/shared";
import { db } from "./db-schema";

export async function saveAnalysisResults(results: RepositoryAnalysis[]) {
  await db.analysisResults.bulkPut(results);
}

export async function getAllAnalysisResults() {
  return db.analysisResults.toArray();
}
