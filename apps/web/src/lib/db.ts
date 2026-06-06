import type { ForageRepository, ImportEvent, RepositoryAnalysis } from "@forage/shared";
import Dexie, { type EntityTable } from "dexie";

const localLibraryProfileKey = "local-library-profile";

export interface LocalLibraryProfile {
  id: typeof localLibraryProfileKey;
  github_login: string | null;
  github_user_id: number | null;
  repository_count: number;
  updated_at: string;
}

interface ForageDatabase extends Dexie {
  repositories: EntityTable<ForageRepository, "github_id">;
  importEvents: EntityTable<ImportEvent, "id">;
  metadata: EntityTable<LocalLibraryProfile, "id">;
  analysisResults: EntityTable<RepositoryAnalysis, "repository_id">;
}

const db = new Dexie("forage") as ForageDatabase;

db.version(3).stores({
  repositories: "github_id, &full_name, primary_language, starred_at",
  importEvents: "id",
  metadata: "id",
  analysisResults: "repository_id, &repository_full_name, analysis_version",
});

export async function saveRepositories(repositories: ForageRepository[]) {
  await db.repositories.bulkPut(repositories);
}

export async function getAllRepositories() {
  return db.repositories.toArray();
}

export async function saveImportEvent(event: ImportEvent) {
  await db.importEvents.put(event);
}

export async function getImportEvents() {
  const events = await db.importEvents.toArray();
  return events.sort((left, right) => right.started_at.localeCompare(left.started_at));
}

export async function saveAnalysisResults(results: RepositoryAnalysis[]) {
  await db.analysisResults.bulkPut(results);
}

export async function getAllAnalysisResults() {
  return db.analysisResults.toArray();
}

export async function saveLocalLibraryProfile(profile: Omit<LocalLibraryProfile, "id">) {
  await db.metadata.put({ ...profile, id: localLibraryProfileKey });
}

export async function getLocalLibraryProfile() {
  return (await db.metadata.get(localLibraryProfileKey)) ?? null;
}

export async function resetLocalData() {
  await db.transaction(
    "rw",
    db.repositories,
    db.importEvents,
    db.analysisResults,
    db.metadata,
    async () => {
      await Promise.all([
        db.repositories.clear(),
        db.importEvents.clear(),
        db.analysisResults.clear(),
        db.metadata.clear(),
      ]);
    },
  );
}
