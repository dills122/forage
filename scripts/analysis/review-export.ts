import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import {
  analysisVersion,
  analyzeRepositories,
  categoryRulesVersion,
  scoreVersion,
} from "../../packages/analysis/src/index";
import type { ForageRepository, RepositoryAnalysis } from "../../packages/shared/src/index";

interface ForageExport {
  exported_at?: string;
  repositories?: ForageRepository[];
}

interface ScoredRepository {
  repository: ForageRepository;
  analysis: RepositoryAnalysis;
}

const exportPath = process.argv[2];
if (!exportPath) {
  console.error("Usage: pnpm analysis:review <path-to-forage-export.json>");
  process.exit(1);
}

const payload = JSON.parse(await readFile(resolve(exportPath), "utf8")) as ForageExport;
const repositories = payload.repositories;
if (!Array.isArray(repositories)) {
  console.error("Invalid Forage export: expected a top-level repositories array.");
  process.exit(1);
}

const asOf = payload.exported_at ? new Date(payload.exported_at) : new Date();
const analyses = analyzeRepositories(repositories, asOf);
const scored = repositories.map((repository, index) => ({
  repository,
  analysis: analyses[index],
}));

const scoreValues = scored.map((item) => item.analysis.scores.overall.value);
const uncategorized = scored.filter((item) => item.analysis.categories.length === 0);
const multiCategory = scored.filter((item) => item.analysis.categories.length >= 3);
const archived = scored.filter((item) => item.repository.archived);
const stalePopular = scored.filter((item) => {
  const pushedDays = daysBetween(item.repository.pushed_at ?? item.repository.updated_at, asOf);
  return item.repository.stars >= 1000 && pushedDays !== null && pushedDays > 730;
});

const lines = [
  `# Forage Analysis Review: ${basename(exportPath)}`,
  "",
  `Generated: ${new Date().toISOString()}`,
  `Analysis as of: ${asOf.toISOString()}`,
  `Repository count: ${repositories.length}`,
  `Analysis version: ${analysisVersion}`,
  `Category rules version: ${categoryRulesVersion}`,
  `Score version: ${scoreVersion}`,
  "",
  "## Score Summary",
  "",
  table([
    ["Metric", "Value"],
    ["Min", String(Math.min(...scoreValues))],
    ["Median", String(percentile(scoreValues, 0.5))],
    ["Average", average(scoreValues).toFixed(1)],
    ["Max", String(Math.max(...scoreValues))],
  ]),
  "",
  "## Score Buckets",
  "",
  table([
    ["Range", "Repositories"],
    ...bucketScores(scoreValues).map(([label, count]) => [label, String(count)]),
  ]),
  "",
  "## Category Coverage",
  "",
  table([
    ["Metric", "Value"],
    ["Categorized", `${repositories.length - uncategorized.length}`],
    ["Uncategorized", `${uncategorized.length}`],
    ["3+ categories", `${multiCategory.length}`],
  ]),
  "",
  "## Top Categories",
  "",
  table([["Category", "Repositories"], ...topCounts(categoryCounts(scored), 15)]),
  "",
  "## Top Languages",
  "",
  table([["Language", "Repositories"], ...topCounts(languageCounts(repositories), 15)]),
  "",
  "## Insight Labels",
  "",
  table([["Label", "Repositories"], ...topCounts(labelCounts(scored), 15)]),
  "",
  "## Highest Scores",
  "",
  repoTable(topByScore(scored, "desc", 10)),
  "",
  "## Lowest Scores",
  "",
  repoTable(topByScore(scored, "asc", 10)),
  "",
  "## Review Queues",
  "",
  "### Uncategorized Samples",
  "",
  repoTable(uncategorized.slice(0, 10)),
  "",
  "### Popular But Stale Samples",
  "",
  repoTable(stalePopular.slice(0, 10)),
  "",
  "### Archived Samples",
  "",
  repoTable(archived.slice(0, 10)),
  "",
];

console.log(lines.join("\n"));

function categoryCounts(scoredItems: ScoredRepository[]) {
  const counts = new Map<string, number>();
  for (const item of scoredItems) {
    for (const category of item.analysis.categories) {
      counts.set(category.label, (counts.get(category.label) ?? 0) + 1);
    }
  }
  return counts;
}

function languageCounts(repositoriesToCount: ForageRepository[]) {
  const counts = new Map<string, number>();
  for (const repository of repositoriesToCount) {
    const language = repository.primary_language || "Unknown";
    counts.set(language, (counts.get(language) ?? 0) + 1);
  }
  return counts;
}

function labelCounts(scoredItems: ScoredRepository[]) {
  const counts = new Map<string, number>();
  for (const item of scoredItems) {
    for (const label of item.analysis.labels) {
      counts.set(label.label, (counts.get(label.label) ?? 0) + 1);
    }
  }
  return counts;
}

function topCounts(counts: Map<string, number>, limit: number) {
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .slice(0, limit)
    .map(([label, count]) => [label, String(count)]);
}

function topByScore(scoredItems: ScoredRepository[], direction: "asc" | "desc", limit: number) {
  return [...scoredItems]
    .sort((left, right) => {
      const scoreDelta = left.analysis.scores.overall.value - right.analysis.scores.overall.value;
      return direction === "asc" ? scoreDelta : -scoreDelta;
    })
    .slice(0, limit);
}

function bucketScores(values: number[]) {
  const buckets = new Map([
    ["0-19", 0],
    ["20-39", 0],
    ["40-59", 0],
    ["60-79", 0],
    ["80-100", 0],
  ]);

  for (const value of values) {
    if (value < 20) buckets.set("0-19", (buckets.get("0-19") ?? 0) + 1);
    else if (value < 40) buckets.set("20-39", (buckets.get("20-39") ?? 0) + 1);
    else if (value < 60) buckets.set("40-59", (buckets.get("40-59") ?? 0) + 1);
    else if (value < 80) buckets.set("60-79", (buckets.get("60-79") ?? 0) + 1);
    else buckets.set("80-100", (buckets.get("80-100") ?? 0) + 1);
  }

  return [...buckets.entries()];
}

function repoTable(scoredItems: ScoredRepository[]) {
  if (scoredItems.length === 0) return "_No repositories matched._";

  return table([
    ["Repo", "Score", "Language", "Stars", "Categories"],
    ...scoredItems.map((item) => [
      item.repository.full_name,
      String(item.analysis.scores.overall.value),
      item.repository.primary_language || "Unknown",
      String(item.repository.stars),
      item.analysis.categories.map((category) => category.label).join(", ") || "-",
    ]),
  ]);
}

function table(rows: string[][]) {
  const escaped = rows.map((row) => row.map(escapeCell));
  const header = escaped[0];
  if (!header) return "";

  return [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...escaped.slice(1).map((row) => `| ${row.join(" | ")} |`),
  ].join("\n");
}

function escapeCell(value: string) {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function percentile(values: number[], ratio: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.floor((sorted.length - 1) * ratio);
  return sorted[index] ?? 0;
}

function daysBetween(value: string | null, now: Date) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return null;
  return Math.max(0, Math.floor((now.getTime() - timestamp) / 86_400_000));
}
