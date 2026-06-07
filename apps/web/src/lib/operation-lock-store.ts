import {
  db,
  type LocalOperationLock,
  type LocalOperationName,
  localOperationLockKey,
} from "./db-schema";

export const defaultLocalOperationLockTtlMs = 15 * 60 * 1000;

export async function acquireLocalOperationLock(
  operation: LocalOperationName,
  {
    ttlMs = defaultLocalOperationLockTtlMs,
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
    ttlMs = defaultLocalOperationLockTtlMs,
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
