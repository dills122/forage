import { afterEach, describe, expect, it, vi } from "vitest";
import { WorkerApi, type WorkerApiError } from "./api";

describe("WorkerApi", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("preserves retry-after metadata from worker errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            error: "Too many requests. Try again shortly.",
            retry_after_seconds: 42,
          }),
          { status: 429 },
        ),
      ),
    );

    await expect(new WorkerApi("https://worker.example").getSession()).rejects.toMatchObject({
      name: "WorkerApiError",
      status: 429,
      retryAfterSeconds: 42,
    } satisfies Partial<WorkerApiError>);
  });
});
