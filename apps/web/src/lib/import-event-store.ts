import type { ImportEvent } from "@forage/shared";
import { db } from "./db-schema";

export async function saveImportEvent(event: ImportEvent) {
  await db.importEvents.put(event);
}

export async function getImportEvents() {
  const events = await db.importEvents.toArray();
  return events.sort((left, right) => right.started_at.localeCompare(left.started_at));
}
