import type {
  CategoryMatch,
  CategoryMatchReason,
  CategoryRule,
  ForageRepository,
  InsightLabel,
  RepositoryAnalysis,
  ScoreExplanation,
  ScoreSet,
  ScoreValue,
} from "@forage/shared";

export interface AnalysisPlan {
  category_model: "weighted-rules";
  scoring_model: "user-agnostic-foundational";
  personalization: "deferred-match-score";
}

export const analysisPlan: AnalysisPlan = {
  category_model: "weighted-rules",
  scoring_model: "user-agnostic-foundational",
  personalization: "deferred-match-score",
};

export const analysisVersion = "analysis-v0.1.0";
export const categoryRulesVersion = "category-rules-v0.1.0";
export const scoreVersion = "foundational-v0.1.0";

export const defaultCategoryRules: CategoryRule[] = [
  languageRule("language-javascript", "JavaScript", "JavaScript"),
  languageRule("language-typescript", "TypeScript", "TypeScript"),
  languageRule("language-python", "Python", "Python"),
  languageRule("language-go", "Go", "Go"),
  languageRule("language-rust", "Rust", "Rust"),
  languageRule("language-csharp", "C#", "C#"),
  languageRule("language-cpp", "C++", "C++"),
  languageRule("language-c", "C", "C"),
  languageRule("language-css", "CSS", "CSS"),
  languageRule("language-html", "HTML", "HTML"),
  languageRule("language-java", "Java", "Java"),
  languageRule("language-ruby", "Ruby", "Ruby"),
  languageRule("language-shell", "Shell", "Shell"),
  languageRule("language-solidity", "Solidity", "Solidity"),
  languageRule("language-php", "PHP", "PHP"),
  languageRule("language-haskell", "Haskell", "Haskell"),
  languageRule("language-vim-script", "Vim Script", "Vim script"),
  languageRule("language-nim", "Nim", "Nim"),
  languageRule("language-objective-c", "Objective-C", "Objective-C"),
  languageRule("language-swift", "Swift", "Swift"),
  languageRule("language-kotlin", "Kotlin", "Kotlin"),
  languageRule("language-dart", "Dart", "Dart"),
  languageRule("language-lua", "Lua", "Lua"),
  languageRule("language-elixir", "Elixir", "Elixir"),
  languageRule("language-clojure", "Clojure", "Clojure"),
  languageRule("language-scala", "Scala", "Scala"),
  languageRule("language-assembly", "Assembly", "Assembly"),
  languageRule("language-dockerfile", "Dockerfile", "Dockerfile"),
  languageRule("language-apacheconf", "ApacheConf", "ApacheConf"),
  languageRule("language-zig", "Zig", "Zig"),
  languageRule("language-vue", "Vue", "Vue"),
  languageRule("language-stylus", "Stylus", "Stylus"),
  {
    id: "frontend",
    label: "Frontend",
    family: "frontend",
    threshold: 3,
    languages: terms(["JavaScript", "TypeScript", "CSS", "HTML"], 1),
    topics: terms(["frontend", "ui", "ux", "css", "html", "react", "vue", "svelte", "astro"], 2),
    keywords: terms(["frontend", "component", "design system", "browser", "web"], 2),
  },
  {
    id: "backend",
    label: "Backend",
    family: "backend",
    threshold: 3,
    languages: terms(["Go", "Rust", "Python", "Java", "C#", "Ruby", "PHP"], 1),
    topics: terms(["api", "server", "backend", "database", "queue", "worker"], 2),
    keywords: terms(["api", "server", "backend", "service", "database"], 2),
  },
  {
    id: "developer-tooling",
    label: "Developer Tooling",
    family: "developer-tooling",
    threshold: 3,
    topics: terms(
      [
        "cli",
        "lint",
        "linters",
        "lint-checking",
        "syntax-checker",
        "automation",
        "validation",
        "formatter",
        "compiler",
        "sdk",
        "git",
        "vim-plugin",
      ],
      2,
    ),
    keywords: terms(
      [
        "cli",
        "tool",
        "tools",
        "utility",
        "utilities",
        "developer",
        "automation",
        "lint",
        "build",
        "compiler",
        "git",
      ],
      2,
    ),
  },
  {
    id: "devops",
    label: "DevOps",
    family: "devops",
    threshold: 3,
    topics: terms(
      [
        "docker",
        "kubernetes",
        "terraform",
        "ci",
        "cd",
        "deploy",
        "observability",
        "tracing",
        "distributed-tracing",
      ],
      2,
    ),
    keywords: terms(
      [
        "deploy",
        "container",
        "infrastructure",
        "pipeline",
        "monitoring",
        "tracing",
        "observability",
      ],
      2,
    ),
  },
  {
    id: "data",
    label: "Data",
    family: "data",
    threshold: 3,
    languages: terms(["Python", "R", "Julia", "SQL"], 1),
    topics: terms(["data", "analytics", "machine-learning", "ml", "database", "etl"], 2),
    keywords: terms(["data", "analytics", "machine learning", "database", "dataset"], 2),
  },
  {
    id: "testing",
    label: "Testing",
    family: "testing",
    threshold: 3,
    topics: terms(["test", "testing", "e2e", "mock", "fixture", "playwright", "vitest", "jest"], 2),
    keywords: terms(["test", "testing", "mock", "fixture", "assertion"], 2),
  },
  {
    id: "documentation",
    label: "Documentation",
    family: "documentation",
    threshold: 3,
    topics: terms(
      [
        "docs",
        "documentation",
        "mdx",
        "markdown",
        "commonmark",
        "markup",
        "document",
        "publishing",
        "static-site",
      ],
      2,
    ),
    keywords: terms(["documentation", "docs", "guide", "manual", "markdown", "markup"], 2),
  },
  {
    id: "security",
    label: "Security",
    family: "security",
    threshold: 3,
    topics: terms(["security", "auth", "oauth", "crypto", "vulnerability", "secrets"], 2),
    keywords: terms(["security", "authentication", "authorization", "oauth", "crypto"], 2),
  },
  {
    id: "learning-resource",
    label: "Learning Resource",
    family: "learning",
    threshold: 3,
    topics: terms(
      [
        "awesome",
        "tutorial",
        "learning",
        "examples",
        "course",
        "book",
        "education",
        "learn-to-code",
        "training-materials",
        "programming",
      ],
      2,
    ),
    keywords: terms(
      [
        "awesome",
        "tutorial",
        "learn",
        "learning",
        "resources",
        "book",
        "guide",
        "examples",
        "courses",
      ],
      2,
    ),
  },
  {
    id: "library",
    label: "Library",
    family: "library",
    threshold: 3,
    topics: terms(["library", "package", "sdk", "component", "plugin"], 2),
    keywords: terms(["library", "package", "sdk", "framework", "component"], 2),
  },
  {
    id: "application",
    label: "Application",
    family: "application",
    threshold: 3,
    topics: terms(["app", "application", "desktop-app", "webapp"], 2),
    keywords: terms(["application", "app", "client", "dashboard"], 2),
  },
];

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
      [activity, 0.3],
      [popularity, 0.25],
      [freshness, 0.2],
      [maintenance, 0.25],
    ]),
  };
}

function scoreActivity(repository: ForageRepository, now: Date): ScoreValue {
  const pushedDays = daysSince(repository.pushed_at ?? repository.updated_at, now);
  const value = ageScore(pushedDays, [
    [30, 100],
    [90, 88],
    [180, 74],
    [365, 58],
    [730, 34],
  ]);
  return scoreValue(value, [
    explanation(
      "activity",
      pushedDays === null
        ? "No push timestamp available."
        : `Last pushed ${formatDays(pushedDays)} ago.`,
      value >= 58 ? "positive" : "negative",
    ),
  ]);
}

function scorePopularity(repository: ForageRepository): ScoreValue {
  const starScore = clamp(Math.round((Math.log10(repository.stars + 1) / 5) * 100), 0, 100);
  const forkScore = clamp(Math.round((Math.log10(repository.forks + 1) / 4) * 100), 0, 100);
  const value = Math.round(starScore * 0.75 + forkScore * 0.25);
  return scoreValue(value, [
    explanation(
      "popularity",
      `${repository.stars.toLocaleString()} stars and ${repository.forks.toLocaleString()} forks with logarithmic caps.`,
      value >= 50 ? "positive" : "neutral",
    ),
  ]);
}

function scoreFreshness(repository: ForageRepository, now: Date): ScoreValue {
  const createdDays = daysSince(repository.created_at, now);
  const updatedDays = daysSince(repository.updated_at, now);
  const createdScore = ageScore(createdDays, [
    [180, 88],
    [365, 78],
    [730, 62],
    [1460, 46],
    [2920, 30],
  ]);
  const updatedScore = ageScore(updatedDays, [
    [90, 100],
    [180, 84],
    [365, 68],
    [730, 48],
    [1460, 28],
  ]);
  const value = Math.round(createdScore * 0.35 + updatedScore * 0.65);
  return scoreValue(value, [
    explanation(
      "freshness",
      updatedDays === null
        ? "No update timestamp available."
        : `Last updated ${formatDays(updatedDays)} ago.`,
      value >= 55 ? "positive" : "neutral",
    ),
  ]);
}

function scoreMaintenance(repository: ForageRepository, now: Date): ScoreValue {
  const updatedDays = daysSince(repository.updated_at, now);
  let value = ageScore(updatedDays, [
    [90, 90],
    [180, 78],
    [365, 64],
    [730, 44],
    [1460, 24],
  ]);
  const explanations: ScoreExplanation[] = [
    explanation(
      "maintenance",
      updatedDays === null
        ? "No update timestamp available."
        : `Maintenance recency is ${formatDays(updatedDays)} old.`,
      value >= 64 ? "positive" : "neutral",
    ),
  ];

  if (repository.archived) {
    value -= 35;
    explanations.push(explanation("archived", "Repository is archived.", "negative"));
  }
  if (repository.disabled) {
    value -= 45;
    explanations.push(explanation("disabled", "Repository is disabled.", "negative"));
  }
  if (repository.open_issues > 200 && repository.stars < 1000) {
    value -= 10;
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
  const value = clamp(repository.topics.length * 14, 0, 100);
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

  if (scores.overall.value >= 80) {
    labels.push(label("worth-revisiting", "Worth Revisiting", ["High foundational score."]));
  }
  if (repository.stars >= 1000 && scores.activity.value >= 70) {
    labels.push(
      label("still-active", "Still Active", ["Popular repository with recent activity."]),
    );
  }
  if (repository.stars >= 1000 && pushedDays !== null && pushedDays > 730) {
    labels.push(
      label("dead-but-interesting", "Dead But Interesting", [
        "Popular repository with stale activity.",
      ]),
    );
  }
  if (
    repository.stars < 250 &&
    scores.metadata_quality?.value &&
    scores.metadata_quality.value >= 80
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

function languageRule(id: string, label: string, language: string): CategoryRule {
  return {
    id,
    label,
    family: "language",
    threshold: 2,
    languages: terms([language], 2),
  };
}

function terms(values: string[], weight: number) {
  return values.map((value) => ({ value, weight }));
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

  return 12;
}

function daysSince(value: string | null, now: Date) {
  if (!value) return null;

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return null;

  return Math.max(0, Math.floor((now.getTime() - timestamp) / 86_400_000));
}

function formatDays(days: number) {
  if (days === 0) return "today";
  if (days === 1) return "1 day";
  if (days < 365) return `${days} days`;
  return `${Math.floor(days / 365)} year(s)`;
}

function normalizeText(value: string) {
  return value.toLowerCase().trim();
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}
