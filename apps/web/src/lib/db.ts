import type { ForageRepository, ImportEvent, RepositoryAnalysis } from "@forage/shared";
import Dexie, { type EntityTable } from "dexie";

const localLibraryProfileKey = "local-library-profile";
const localOperationLockKey = "local-operation-lock";

export type LocalOperationName = "import" | "reset";

export interface LocalLibraryProfile {
  id: typeof localLibraryProfileKey;
  github_login: string | null;
  github_user_id: number | null;
  repository_count: number;
  updated_at: string;
}

export interface LocalOperationLock {
  id: typeof localOperationLockKey;
  owner_id: string;
  operation: LocalOperationName;
  acquired_at: string;
  heartbeat_at: string;
  expires_at: string;
}

type MetadataRecord = LocalLibraryProfile | LocalOperationLock;

interface ForageDatabase extends Dexie {
  repositories: EntityTable<ForageRepository, "github_id">;
  importEvents: EntityTable<ImportEvent, "id">;
  metadata: EntityTable<MetadataRecord, "id">;
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

export async function saveLocalLibraryProfile(profile: Omit<LocalLibraryProfile, "id">) {
  await db.metadata.put({ ...profile, id: localLibraryProfileKey });
}

export async function getLocalLibraryProfile() {
  return (
    ((await db.metadata.get(localLibraryProfileKey)) as LocalLibraryProfile | undefined) ?? null
  );
}

export async function acquireLocalOperationLock(
  operation: LocalOperationName,
  {
    ttlMs = 15 * 60 * 1000,
    now = new Date(),
    ownerId = crypto.randomUUID(),
  }: {
    ttlMs?: number;
    now?: Date;
    ownerId?: string;
  } = {},
) {
  const nowMs = now.getTime();
  const lock: LocalOperationLock = {
    id: localOperationLockKey,
    owner_id: ownerId,
    operation,
    acquired_at: now.toISOString(),
    heartbeat_at: now.toISOString(),
    expires_at: new Date(nowMs + ttlMs).toISOString(),
  };

  const blockingLock = await db.transaction("rw", db.metadata, async () => {
    const existing = (await db.metadata.get(localOperationLockKey)) as
      | LocalOperationLock
      | undefined;
    if (existing && Date.parse(existing.expires_at) > nowMs) return existing;

    await db.metadata.put(lock);
    return null;
  });

  return blockingLock
    ? {
        acquired: false as const,
        lock: blockingLock,
      }
    : {
        acquired: true as const,
        lock,
      };
}

export async function refreshLocalOperationLock(
  ownerId: string,
  {
    ttlMs = 15 * 60 * 1000,
    now = new Date(),
  }: {
    ttlMs?: number;
    now?: Date;
  } = {},
) {
  await db.transaction("rw", db.metadata, async () => {
    const existing = (await db.metadata.get(localOperationLockKey)) as
      | LocalOperationLock
      | undefined;
    if (!existing || existing.owner_id !== ownerId) return;

    const refreshedLock: LocalOperationLock = {
      ...existing,
      heartbeat_at: now.toISOString(),
      expires_at: new Date(now.getTime() + ttlMs).toISOString(),
    };
    await db.metadata.put(refreshedLock);
  });
}

export async function releaseLocalOperationLock(ownerId: string) {
  await db.transaction("rw", db.metadata, async () => {
    const existing = (await db.metadata.get(localOperationLockKey)) as
      | LocalOperationLock
      | undefined;
    if (existing?.owner_id === ownerId) {
      await db.metadata.delete(localOperationLockKey);
    }
  });
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
