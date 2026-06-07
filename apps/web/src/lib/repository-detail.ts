import type {
  CategoryMatch,
  CategoryMatchReason,
  ForageRepository,
  RepositoryAnalysis,
  ScoreExplanation,
  ScoreSet,
  ScoreValue,
} from "@forage/shared";

export interface ScoreBreakdownItem {
  key: keyof ScoreSet;
  label: string;
  value: number;
  weight: string | null;
  explanations: ScoreExplanation[];
}

export function getFoundationalScoreBreakdown(analysis: RepositoryAnalysis) {
  return [
    scoreBreakdownItem("activity", "Activity", "30%", analysis.scores.activity),
    scoreBreakdownItem("popularity", "Popularity", "25%", analysis.scores.popularity),
    scoreBreakdownItem("freshness", "Freshness", "20%", analysis.scores.freshness),
    scoreBreakdownItem("maintenance", "Maintenance", "25%", analysis.scores.maintenance),
  ];
}

export function getSupportingScoreBreakdown(analysis: RepositoryAnalysis) {
  return [
    optionalScoreBreakdownItem(
      "metadata_quality",
      "Metadata quality",
      analysis.scores.metadata_quality,
    ),
    optionalScoreBreakdownItem("topic_density", "Topic density", analysis.scores.topic_density),
    optionalScoreBreakdownItem("rediscovery", "Rediscovery", analysis.scores.rediscovery),
    optionalScoreBreakdownItem(
      "interestingness",
      "Interestingness",
      analysis.scores.interestingness,
    ),
  ].filter((item): item is ScoreBreakdownItem => Boolean(item));
}

export function getTopCategoryMatches(analysis: RepositoryAnalysis, limit = 6) {
  return analysis.categories.filter((category) => category.reasons.length > 0).slice(0, limit);
}

export function formatCategoryReason(reason: CategoryMatchReason) {
  return `${formatReasonField(reason.field)}: ${reason.value} (+${reason.weight})`;
}

export function formatScoreExplanation(explanation: ScoreExplanation) {
  return `${formatReasonField(explanation.signal)}: ${explanation.message}`;
}

export function getRepositoryFlags(repository: ForageRepository) {
  return [
    repository.archived ? "Archived" : null,
    repository.disabled ? "Disabled" : null,
    repository.fork ? "Fork" : null,
    repository.private ? "Private" : null,
  ].filter((flag): flag is string => Boolean(flag));
}

export function getRepositoryMetadata(repository: ForageRepository) {
  return [
    ["Owner", repository.owner],
    ["Default branch", repository.default_branch],
    ["License", repository.license ?? "Unknown"],
    ["Open issues", repository.open_issues.toLocaleString()],
    ["Forks", repository.forks.toLocaleString()],
    ["Watchers", repository.watchers.toLocaleString()],
    ["Created", formatDate(repository.created_at)],
    ["Updated", formatDate(repository.updated_at)],
    ["Pushed", repository.pushed_at ? formatDate(repository.pushed_at) : "Unknown"],
    ["Starred", formatDate(repository.starred_at)],
  ] as const;
}

export function getCategoryReasonSummary(category: CategoryMatch) {
  return category.reasons.map(formatCategoryReason).join(", ");
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function scoreBreakdownItem(
  key: keyof ScoreSet,
  label: string,
  weight: string | null,
  score: ScoreValue,
): ScoreBreakdownItem {
  return {
    key,
    label,
    value: score.value,
    weight,
    explanations: score.explanations,
  };
}

function optionalScoreBreakdownItem(
  key: keyof ScoreSet,
  label: string,
  score: ScoreValue | undefined,
) {
  if (!score) return null;
  return scoreBreakdownItem(key, label, null, score);
}

function formatReasonField(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
