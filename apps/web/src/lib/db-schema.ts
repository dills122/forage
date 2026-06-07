import type { ForageRepository, ImportEvent, RepositoryAnalysis } from "@forage/shared";
import Dexie, { type EntityTable } from "dexie";

export const localLibraryProfileKey = "local-library-profile";
export const localOperationLockKey = "local-operation-lock";

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

export const db = new Dexie("forage") as ForageDatabase;

db.version(3).stores({
  repositories: "github_id, &full_name, primary_language, starred_at",
  importEvents: "id",
  metadata: "id",
  analysisResults: "repository_id, &repository_full_name, analysis_version",
});
