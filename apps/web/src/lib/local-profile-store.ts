import { db, type LocalLibraryProfile, localLibraryProfileKey } from "./db-schema";

export async function saveLocalLibraryProfile(profile: Omit<LocalLibraryProfile, "id">) {
  await db.metadata.put({ ...profile, id: localLibraryProfileKey });
}

export async function getLocalLibraryProfile() {
  return (
    ((await db.metadata.get(localLibraryProfileKey)) as LocalLibraryProfile | undefined) ?? null
  );
}
