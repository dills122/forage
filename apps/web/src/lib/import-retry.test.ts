import { describe, expect, it, vi } from "vitest";
import { WorkerApiError } from "./api";
import {
  getImportRetryDelayMs,
  getRateLimitRetryAfterSeconds,
  runImportRequestWithRetry,
  shouldRetryImportRequest,
} from "./import-retry";

const rateLimit = {
  limit: "5000",
  remaining: "0",
  reset: "1780000000",
  resource: "core",
  used: "5000",
};

describe("import retry helpers", () => {
  it("retries bounded transient failures", async () => {
    const request = vi
      .fn()
      .mockRejectedValueOnce(new WorkerApiError("unavailable", 503, null))
      .mockResolvedValueOnce("ok");
    const sleep = vi.fn().mockResolvedValue(undefined);

    await expect(
      runImportRequestWithRetry(request, { signal: new AbortController().signal, sleep }),
    ).resolves.toBe("ok");

    expect(request).toHaveBeenCalledTimes(2);
    expect(request).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(sleep).toHaveBeenCalledWith(500, expect.any(AbortSignal));
  });

  it("does not retry auth, validation, or rate-limit failures", () => {
    expect(shouldRetryImportRequest(new WorkerApiError("auth", 401, null), 1)).toBe(false);
    expect(shouldRetryImportRequest(new WorkerApiError("rate", 429, null, 60), 1)).toBe(false);
    expect(shouldRetryImportRequest(new WorkerApiError("temporary", 502, null), 2)).toBe(false);
  });

  it("retries page request timeouts without treating user cancellation as retryable", () => {
    expect(
      shouldRetryImportRequest(
        new DOMException("Import page request timed out.", "TimeoutError"),
        1,
      ),
    ).toBe(true);
    expect(shouldRetryImportRequest(new DOMException("Import cancelled.", "AbortError"), 1)).toBe(
      false,
    );
  });

  it("uses retry-after metadata before exponential fallback", () => {
    expect(getImportRetryDelayMs(new WorkerApiError("temporary", 503, null, 2), 1)).toBe(2_000);
    expect(getImportRetryDelayMs(new WorkerApiError("temporary", 503, null), 2)).toBe(1_000);
  });

  it("estimates rate-limit retry timing from GitHub reset metadata", () => {
    expect(
      getRateLimitRetryAfterSeconds(
        new WorkerApiError("limited", 403, rateLimit),
        1_779_999_940_000,
      ),
    ).toBe(60);
    expect(getRateLimitRetryAfterSeconds(new WorkerApiError("limited", 429, null, 10))).toBe(10);
  });
});
