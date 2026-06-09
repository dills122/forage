import assert from "node:assert/strict";
import test from "node:test";
import {
  cancelImport,
  completeImport,
  createImportRunState,
  failImport,
  importRunStateToEvent,
  rateLimitImport,
  recordImportPage,
} from "../src/index.ts";

const rateLimit = {
  limit: "5000",
  remaining: "4999",
  reset: "1780000000",
  used: "1",
  resource: "core",
};

test("records page progress and converts to import event", () => {
  const startedAt = "2026-06-05T00:00:00.000Z";
  const completedAt = "2026-06-05T00:01:00.000Z";
  const running = createImportRunState(startedAt);
  const withPage = recordImportPage(running, {
    page: 1,
    repositories: 100,
    rate_limit: rateLimit,
  });
  const completed = completeImport(withPage, completedAt);

  assert.equal(withPage.pages, 1);
  assert.equal(withPage.repositories, 100);
  assert.equal(withPage.current_page, 2);
  assert.equal(completed.status, "completed");
  assert.equal(completed.can_cancel, false);
  assert.deepEqual(importRunStateToEvent("event-1", completed), {
    id: "event-1",
    started_at: startedAt,
    completed_at: completedAt,
    status: "completed",
    pages: 1,
    repositories: 100,
    rate_limits: [rateLimit],
    retry_after_seconds: null,
    errors: [],
  });
});

test("captures failed, cancelled, and rate-limited terminal states", () => {
  const failed = failImport(
    createImportRunState(),
    "GitHub unavailable",
    "2026-06-05T00:00:00.000Z",
  );
  const cancelled = cancelImport(createImportRunState(), "2026-06-05T00:00:00.000Z");
  const rateLimited = rateLimitImport(
    createImportRunState(),
    "Rate limit exceeded",
    rateLimit,
    60,
    "2026-06-05T00:00:00.000Z",
  );

  assert.equal(failed.status, "failed");
  assert.deepEqual(failed.errors, ["GitHub unavailable"]);
  assert.equal(cancelled.status, "cancelled");
  assert.equal(rateLimited.status, "rate_limited");
  assert.deepEqual(rateLimited.errors, ["Rate limit exceeded"]);
  assert.deepEqual(rateLimited.rate_limits, [rateLimit]);
  assert.equal(rateLimited.retry_after_seconds, 60);
});

test("rejects updates after terminal states", () => {
  const completed = completeImport(createImportRunState());

  assert.throws(
    () => recordImportPage(completed, { page: 2, repositories: 1, rate_limit: rateLimit }),
    /Cannot update import after terminal status: completed/,
  );
  assert.throws(() => completeImport(completed), /terminal status: completed/);
});
