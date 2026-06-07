import {
  acquireLocalOperationLock,
  type LocalOperationName,
  refreshLocalOperationLock,
  releaseLocalOperationLock,
} from "./db";

interface BrowserLock {
  name: string;
  mode: "exclusive" | "shared";
}

interface BrowserLockManager {
  request<T>(
    name: string,
    options: { mode?: "exclusive" | "shared"; ifAvailable?: boolean },
    callback: (lock: BrowserLock | null) => T | Promise<T>,
  ): Promise<T>;
}

interface LockOptions {
  lockManager?: BrowserLockManager | null;
  ttlMs?: number;
  heartbeatMs?: number;
}

const lockName = "forage-local-data";
const defaultTtlMs = 15 * 60 * 1000;
const defaultHeartbeatMs = 30 * 1000;

export class LocalOperationLockError extends Error {
  constructor(readonly operation: LocalOperationName | "unknown") {
    super(getLockMessage(operation));
    this.name = "LocalOperationLockError";
  }
}

export async function withLocalOperationLock<T>(
  operation: LocalOperationName,
  callback: () => Promise<T>,
  options: LockOptions = {},
) {
  const lockManager = options.lockManager ?? getBrowserLockManager();
  if (lockManager) {
    return withWebLock(callback, lockManager);
  }

  return withIndexedDbLock(operation, callback, options);
}

async function withWebLock<T>(callback: () => Promise<T>, lockManager: BrowserLockManager) {
  return lockManager.request(lockName, { mode: "exclusive", ifAvailable: true }, async (lock) => {
    if (!lock) throw new LocalOperationLockError("unknown");
    return await callback();
  });
}

async function withIndexedDbLock<T>(
  operation: LocalOperationName,
  callback: () => Promise<T>,
  {
    ttlMs = defaultTtlMs,
    heartbeatMs = defaultHeartbeatMs,
  }: {
    ttlMs?: number;
    heartbeatMs?: number;
  },
) {
  const lock = await acquireLocalOperationLock(operation, { ttlMs });
  if (!lock.acquired) throw new LocalOperationLockError(lock.lock.operation);

  const heartbeat = setInterval(() => {
    void refreshLocalOperationLock(lock.lock.owner_id, { ttlMs });
  }, heartbeatMs);

  try {
    return await callback();
  } finally {
    clearInterval(heartbeat);
    await releaseLocalOperationLock(lock.lock.owner_id);
  }
}

function getBrowserLockManager() {
  return typeof navigator !== "undefined" && "locks" in navigator
    ? ((navigator as Navigator & { locks?: BrowserLockManager }).locks ?? null)
    : null;
}

function getLockMessage(operation: LocalOperationName | "unknown") {
  if (operation === "import") {
    return "Another Forage tab is already importing. Wait for it to finish before starting another import.";
  }
  if (operation === "reset") {
    return "Another Forage tab is resetting local data. Wait for it to finish before changing the library.";
  }
  return "Another Forage tab is changing local data. Wait for it to finish before trying again.";
}
