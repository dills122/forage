import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import MetricGrid from "./MetricGrid.svelte";

describe("MetricGrid", () => {
  it("renders formatted metric values with supporting details", () => {
    render(MetricGrid, {
      repositoryCount: 720,
      topLanguage: "JavaScript (150)",
      latestImport: "completed (720)",
      user: "dills122",
      authenticated: true,
    });

    expect(screen.getByText("720")).toBeTruthy();
    expect(screen.getByText("Browser-local records")).toBeTruthy();
    expect(screen.getByText("JavaScript")).toBeTruthy();
    expect(screen.getByText("150 repos")).toBeTruthy();
    expect(screen.getByText("Completed")).toBeTruthy();
    expect(screen.getByText("720 repos imported")).toBeTruthy();
    expect(screen.getByText("Connected account")).toBeTruthy();
  });
});
