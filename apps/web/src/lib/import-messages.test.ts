import { createImportRunState, recordImportPage } from "@forage/core";
import { describe, expect, it } from "vitest";
import {
  getImportProgressText,
  getImportTerminalText,
  sortObservedFieldNames,
} from "./import-messages";

const rateLimit = {
  limit: null,
  remaining: null,
  reset: null,
  resource: null,
  used: null,
};

describe("import worker messages", () => {
  it("formats progress text by phase", () => {
    const importRun = recordImportPage(createImportRunState(), {
      page: 1,
      repositories: 100,
      rate_limit: rateLimit,
    });

    expect(getImportProgressText(importRun, "importing", 2)).toBe(
      "Importing page 2; 100 repositories stored so far...",
    );
    expect(getImportProgressText(importRun, "analyzing", 2)).toBe(
      "Analyzing page 2 in browser worker after importing 100 repositories...",
    );
  });

  it("formats terminal import states", () => {
    const runningImport = createImportRunState();
    const importedPage = recordImportPage(runningImport, {
      page: 1,
      repositories: 100,
      rate_limit: rateLimit,
    });

    expect(getImportTerminalText({ ...importedPage, status: "completed" })).toBe(
      "Imported 100 repositories across 1 page(s).",
    );
    expect(getImportTerminalText({ ...importedPage, status: "cancelled" })).toBe(
      "Import cancelled after 1 page(s) and 100 repositories.",
    );
    expect(getImportTerminalText({ ...importedPage, status: "rate_limited" })).toBe(
      "Import paused by GitHub rate limits after 1 page(s). Try again later.",
    );
    expect(
      getImportTerminalText({
        ...importedPage,
        status: "failed",
        errors: ["GitHub request failed."],
      }),
    ).toBe("GitHub request failed.");
    expect(getImportTerminalText(runningImport)).toBe("Import running.");
  });

  it("sorts observed field names", () => {
    expect(sortObservedFieldNames(new Set(["updated_at", "full_name", "id"]))).toEqual([
      "full_name",
      "id",
      "updated_at",
    ]);
  });
});
