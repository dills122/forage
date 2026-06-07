import { db } from "./db-schema";

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
