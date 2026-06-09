import { WorkerApiError } from "./api";

export const importRetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 750,
  maxDelayMs: 5_000,
  retryableStatuses: new Set([408, 500, 502, 503, 504]),
};

interface RetryOptions {
  signal: AbortSignal;
  sleep?: (delayMs: number, signal: AbortSignal) => Promise<void>;
}

export async function runImportRequestWithRetry<T>(
  request: () => Promise<T>,
  { signal, sleep = sleepWithAbort }: RetryOptions,
) {
  for (let attempt = 1; ; attempt += 1) {
    throwIfAborted(signal);

    try {
      return await request();
    } catch (error) {
      if (!shouldRetryImportRequest(error, attempt)) throw error;
      await sleep(getImportRetryDelayMs(error, attempt), signal);
    }
  }
}

export function shouldRetryImportRequest(error: unknown, attempt: number) {
  if (attempt >= importRetryPolicy.maxAttempts) return false;
  if (error instanceof WorkerApiError) {
    return importRetryPolicy.retryableStatuses.has(error.status);
  }
  return error instanceof TypeError;
}

export function getImportRetryDelayMs(error: unknown, attempt: number) {
  if (error instanceof WorkerApiError && error.retryAfterSeconds !== null) {
    return Math.min(error.retryAfterSeconds * 1000, importRetryPolicy.maxDelayMs);
  }

  const exponentialDelay = importRetryPolicy.baseDelayMs * 2 ** (attempt - 1);
  return Math.min(exponentialDelay, importRetryPolicy.maxDelayMs);
}

export function getRateLimitRetryAfterSeconds(error: WorkerApiError, nowMs = Date.now()) {
  if (error.retryAfterSeconds !== null) return error.retryAfterSeconds;
  const resetSeconds = Number(error.rateLimit?.reset);
  if (!Number.isFinite(resetSeconds)) return null;

  return Math.max(0, Math.ceil((resetSeconds * 1000 - nowMs) / 1000));
}

function sleepWithAbort(delayMs: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timeout = globalThis.setTimeout(resolve, delayMs);
    signal.addEventListener(
      "abort",
      () => {
        globalThis.clearTimeout(timeout);
        reject(new DOMException("Import cancelled.", "AbortError"));
      },
      { once: true },
    );
  });
}

function throwIfAborted(signal: AbortSignal) {
  if (signal.aborted) {
    throw new DOMException("Import cancelled.", "AbortError");
  }
}
