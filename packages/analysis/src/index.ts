import type {
  CategoryMatch,
  CategoryMatchReason,
  ForageRepository,
  InsightLabel,
  RepositoryAnalysis,
  ScoreExplanation,
  ScoreSet,
  ScoreValue,
} from "@forage/shared";
import {
  type AnalysisPlan,
  analysisPlan,
  analysisVersion,
  categoryRulesVersion,
  scoreVersion,
} from "./analysis-config";
import { defaultCategoryRules } from "./category-config";
import {
  dayMs,
  defaultStaleAgeScore,
  freshnessScoreConfig,
  insightLabelConfig,
  maintenancePenaltyConfig,
  popularityScoreConfig,
  scoreAgeThresholds,
  scoreImpactThresholds,
  scoreWeights,
  topicDensityConfig,
  yearDays,
} from "./scoring-config";

export type { AnalysisPlan };
export { analysisPlan, analysisVersion, categoryRulesVersion, defaultCategoryRules, scoreVersion };

export function analyzeRepository(
  repository: ForageRepository,
  now = new Date(),
  rules = defaultCategoryRules,
): RepositoryAnalysis {
  const scores = scoreRepository(repository, now);
  return {
    repository_id: repository.github_id,
    repository_full_name: repository.full_name,
    analysis_version: analysisVersion,
    generated_at: now.toISOString(),
    categories: matchCategories(repository, rules),
    scores,
    labels: buildLabels(repository, scores, now),
  };
}

export function analyzeRepositories(repositories: ForageRepository[], now = new Date()) {
  return repositories.map((repository) => analyzeRepository(repository, now));
}

export function matchCategories(
  repository: ForageRepository,
  rules = defaultCategoryRules,
): CategoryMatch[] {
  const searchableText = normalizeText(
    [
      repository.full_name,
      repository.repo_name,
      repository.description ?? "",
      repository.homepage ?? "",
    ].join(" "),
  );
  const topicSet = new Set(repository.topics.map(normalizeText));
  const language = normalizeText(repository.primary_language ?? "");

  return rules
    .filter((rule) => !rule.deprecated)
    .map((rule) => {
      const reasons: CategoryMatchReason[] = [];

      for (const term of rule.languages ?? []) {
        if (language === normalizeText(term.value)) {
          reasons.push({ field: "language", value: term.value, weight: term.weight });
        }
      }

      for (const term of rule.topics ?? []) {
        if (topicSet.has(normalizeText(term.value))) {
          reasons.push({ field: "topic", value: term.value, weight: term.weight });
        }
      }

      for (const term of rule.keywords ?? []) {
        const normalizedTerm = normalizeText(term.value);
        if (searchableText.includes(normalizedTerm)) {
          reasons.push({ field: "keyword", value: term.value, weight: term.weight });
        }
      }

      const weight = reasons.reduce((total, reason) => total + reason.weight, 0);
      return {
        id: rule.id,
        label: rule.label,
        family: rule.family,
        confidence: clamp(Math.round((weight / rule.threshold) * 100), 0, 100),
        reasons,
      };
    })
    .filter((match) => match.confidence >= 100)
    .sort(
      (left, right) =>
        right.reasons.length - left.reasons.length || left.label.localeCompare(right.label),
    );
}

export function scoreRepository(repository: ForageRepository, now = new Date()): ScoreSet {
  const activity = scoreActivity(repository, now);
  const popularity = scorePopularity(repository);
  const freshness = scoreFreshness(repository, now);
  const maintenance = scoreMaintenance(repository, now);

  return {
    version: scoreVersion,
    activity,
    popularity,
    freshness,
    maintenance,
    metadata_quality: scoreMetadataQuality(repository),
    topic_density: scoreTopicDensity(repository),
    overall: combineScores([
      [activity, scoreWeights.activity],
      [popularity, scoreWeights.popularity],
      [freshness, scoreWeights.freshness],
      [maintenance, scoreWeights.maintenance],
    ]),
  };
}

function scoreActivity(repository: ForageRepository, now: Date): ScoreValue {
  const pushedDays = daysSince(repository.pushed_at ?? repository.updated_at, now);
  const value = ageScore(pushedDays, scoreAgeThresholds.activityPushedDays);
  return scoreValue(value, [
    explanation(
      "activity",
      pushedDays === null
        ? "No push timestamp available."
        : `Last pushed ${formatDays(pushedDays)} ago.`,
      value >= scoreImpactThresholds.activityPositive ? "positive" : "negative",
    ),
  ]);
}

function scorePopularity(repository: ForageRepository): ScoreValue {
  const starScore = clamp(
    Math.round((Math.log10(repository.stars + 1) / popularityScoreConfig.starLogCap) * 100),
    0,
    100,
  );
  const forkScore = clamp(
    Math.round((Math.log10(repository.forks + 1) / popularityScoreConfig.forkLogCap) * 100),
    0,
    100,
  );
  const value = Math.round(
    starScore * popularityScoreConfig.starWeight + forkScore * popularityScoreConfig.forkWeight,
  );
  return scoreValue(value, [
    explanation(
      "popularity",
      `${repository.stars.toLocaleString()} stars and ${repository.forks.toLocaleString()} forks with logarithmic caps.`,
      value >= scoreImpactThresholds.popularityPositive ? "positive" : "neutral",
    ),
  ]);
}

function scoreFreshness(repository: ForageRepository, now: Date): ScoreValue {
  const createdDays = daysSince(repository.created_at, now);
  const updatedDays = daysSince(repository.updated_at, now);
  const createdScore = ageScore(createdDays, scoreAgeThresholds.freshnessCreatedDays);
  const updatedScore = ageScore(updatedDays, scoreAgeThresholds.freshnessUpdatedDays);
  const value = Math.round(
    createdScore * freshnessScoreConfig.createdWeight +
      updatedScore * freshnessScoreConfig.updatedWeight,
  );
  return scoreValue(value, [
    explanation(
      "freshness",
      updatedDays === null
        ? "No update timestamp available."
        : `Last updated ${formatDays(updatedDays)} ago.`,
      value >= scoreImpactThresholds.freshnessPositive ? "positive" : "neutral",
    ),
  ]);
}

function scoreMaintenance(repository: ForageRepository, now: Date): ScoreValue {
  const updatedDays = daysSince(repository.updated_at, now);
  let value = ageScore(updatedDays, scoreAgeThresholds.maintenanceUpdatedDays);
  const explanations: ScoreExplanation[] = [
    explanation(
      "maintenance",
      updatedDays === null
        ? "No update timestamp available."
        : `Maintenance recency is ${formatDays(updatedDays)} old.`,
      value >= scoreImpactThresholds.maintenancePositive ? "positive" : "neutral",
    ),
  ];

  if (repository.archived) {
    value -= maintenancePenaltyConfig.archived;
    explanations.push(explanation("archived", "Repository is archived.", "negative"));
  }
  if (repository.disabled) {
    value -= maintenancePenaltyConfig.disabled;
    explanations.push(explanation("disabled", "Repository is disabled.", "negative"));
  }
  if (
    repository.open_issues > maintenancePenaltyConfig.highIssueLoadOpenIssues &&
    repository.stars < maintenancePenaltyConfig.highIssueLoadStars
  ) {
    value -= maintenancePenaltyConfig.highIssueLoad;
    explanations.push(
      explanation("issue-load", "High open issue count relative to popularity.", "negative"),
    );
  }

  return scoreValue(value, explanations);
}

function scoreMetadataQuality(repository: ForageRepository): ScoreValue {
  const checks = [
    Boolean(repository.description),
    Boolean(repository.homepage),
    repository.topics.length > 0,
    Boolean(repository.license),
    Boolean(repository.primary_language),
  ];
  const present = checks.filter(Boolean).length;
  return scoreValue(Math.round((present / checks.length) * 100), [
    explanation(
      "metadata",
      `${present} of ${checks.length} metadata quality signals are present.`,
      "neutral",
    ),
  ]);
}

function scoreTopicDensity(repository: ForageRepository): ScoreValue {
  const value = clamp(repository.topics.length * topicDensityConfig.perTopicPoints, 0, 100);
  return scoreValue(value, [
    explanation(
      "topics",
      `${repository.topics.length} GitHub topic tags are available.`,
      "neutral",
    ),
  ]);
}

function buildLabels(repository: ForageRepository, scores: ScoreSet, now: Date): InsightLabel[] {
  const labels: InsightLabel[] = [];
  const pushedDays = daysSince(repository.pushed_at ?? repository.updated_at, now);

  if (scores.overall.value >= insightLabelConfig.worthRevisitingOverall) {
    labels.push(label("worth-revisiting", "Worth Revisiting", ["High foundational score."]));
  }
  if (
    repository.stars >= insightLabelConfig.stillActiveStars &&
    scores.activity.value >= insightLabelConfig.stillActiveActivity
  ) {
    labels.push(
      label("still-active", "Still Active", ["Popular repository with recent activity."]),
    );
  }
  if (
    repository.stars >= insightLabelConfig.deadButInterestingStars &&
    pushedDays !== null &&
    pushedDays > insightLabelConfig.deadButInterestingPushedDays
  ) {
    labels.push(
      label("dead-but-interesting", "Dead But Interesting", [
        "Popular repository with stale activity.",
      ]),
    );
  }
  if (
    repository.stars < insightLabelConfig.smallPolishedStars &&
    scores.metadata_quality?.value &&
    scores.metadata_quality.value >= insightLabelConfig.smallPolishedMetadataQuality
  ) {
    labels.push(
      label("small-polished", "Small But Polished", [
        "Low star count with strong metadata quality.",
      ]),
    );
  }

  return labels;
}

function combineScores(weightedScores: Array<[ScoreValue, number]>): ScoreValue {
  const value = Math.round(
    weightedScores.reduce((total, [score, weight]) => total + score.value * weight, 0),
  );
  return scoreValue(value, [
    explanation(
      "overall",
      "Weighted blend of activity, popularity, freshness, and maintenance.",
      "neutral",
    ),
  ]);
}

function scoreValue(value: number, explanations: ScoreExplanation[]): ScoreValue {
  return {
    value: clamp(value, 0, 100),
    explanations,
  };
}

function explanation(
  signal: string,
  message: string,
  impact: ScoreExplanation["impact"],
): ScoreExplanation {
  return { signal, message, impact };
}

function label(id: string, labelText: string, reasons: string[]): InsightLabel {
  return {
    id,
    label: labelText,
    score_version: scoreVersion,
    reasons,
  };
}

function ageScore(days: number | null, thresholds: Array<[number, number]>) {
  if (days === null) return 0;

  for (const [maxDays, value] of thresholds) {
    if (days <= maxDays) return value;
  }

  return defaultStaleAgeScore;
}

function daysSince(value: string | null, now: Date) {
  if (!value) return null;

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return null;

  return Math.max(0, Math.floor((now.getTime() - timestamp) / dayMs));
}

function formatDays(days: number) {
  if (days === 0) return "today";
  if (days === 1) return "1 day";
  if (days < yearDays) return `${days} days`;
  return `${Math.floor(days / yearDays)} year(s)`;
}

function normalizeText(value: string) {
  return value.toLowerCase().trim();
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}
