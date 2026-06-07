import { beforeEach, describe, expect, it } from "vitest";
import { acquireLocalOperationLock, resetLocalData } from "./db";
import { LocalOperationLockError, withLocalOperationLock } from "./local-operation-lock";

describe("local operation lock", () => {
  beforeEach(async () => {
    await resetLocalData();
  });

  it("uses the Web Locks API when a browser lock manager is available", async () => {
    const calls: string[] = [];
    const result = await withLocalOperationLock(
      "import",
      async () => {
        calls.push("callback");
        return "done";
      },
      {
        lockManager: {
          async request(name, options, callback) {
            calls.push(`${name}:${options.mode}:${String(options.ifAvailable)}`);
            return await callback({ name, mode: "exclusive" });
          },
        },
      },
    );

    expect(result).toBe("done");
    expect(calls).toEqual(["forage-local-data:exclusive:true", "callback"]);
  });

  it("reports a busy operation when Web Locks cannot acquire a lock", async () => {
    await expect(
      withLocalOperationLock("import", async () => "done", {
        lockManager: {
          async request(_name, _options, callback) {
            return await callback(null);
          },
        },
      }),
    ).rejects.toThrow(LocalOperationLockError);
  });

  it("falls back to IndexedDB locks when Web Locks are unavailable", async () => {
    await withLocalOperationLock(
      "reset",
      async () => {
        expect(
          await acquireLocalOperationLock("import", {
            ownerId: "blocked-owner",
          }),
        ).toMatchObject({
          acquired: false,
        });
      },
      {
        lockManager: null,
        heartbeatMs: 1_000,
      },
    );

    await expect(
      acquireLocalOperationLock("import", {
        ownerId: "after-release",
      }),
    ).resolves.toMatchObject({
      acquired: true,
    });
  });

  it("surfaces the active fallback operation in lock errors", async () => {
    await acquireLocalOperationLock("import", {
      ownerId: "import-owner",
    });

    await expect(
      withLocalOperationLock("reset", async () => undefined, {
        lockManager: null,
      }),
    ).rejects.toThrow("already importing");
  });
});
