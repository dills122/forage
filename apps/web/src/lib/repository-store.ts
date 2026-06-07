import type { ForageRepository } from "@forage/shared";
import { db } from "./db-schema";

export async function saveRepositories(repositories: ForageRepository[]) {
  await db.repositories.bulkPut(repositories);
}

export async function getAllRepositories() {
  return db.repositories.toArray();
}

export async function reconcileImportedRepositories(importedGithubIds: Iterable<number>) {
  const retainedIds = new Set(importedGithubIds);

  await db.transaction("rw", db.repositories, db.analysisResults, async () => {
    const [repositories, analysisResults] = await Promise.all([
      db.repositories.toArray(),
      db.analysisResults.toArray(),
    ]);
    const staleRepositoryIds = repositories
      .map((repository) => repository.github_id)
      .filter((githubId) => !retainedIds.has(githubId));
    const staleAnalysisIds = analysisResults
      .map((analysis) => analysis.repository_id)
      .filter((repositoryId) => !retainedIds.has(repositoryId));

    await Promise.all([
      db.repositories.bulkDelete(staleRepositoryIds),
      db.analysisResults.bulkDelete(staleAnalysisIds),
    ]);
  });
}
