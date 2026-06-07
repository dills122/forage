import type { CategoryRule } from "@forage/shared";

const languageRuleThreshold = 2;
const languageRuleWeight = 2;
const broadCategoryThreshold = 3;
const supportingSignalWeight = 2;
const primarySignalWeight = 1;

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
    threshold: broadCategoryThreshold,
    languages: terms(["JavaScript", "TypeScript", "CSS", "HTML"], primarySignalWeight),
    topics: terms(
      ["frontend", "ui", "ux", "css", "html", "react", "vue", "svelte", "astro"],
      supportingSignalWeight,
    ),
    keywords: terms(
      ["frontend", "component", "design system", "browser", "web"],
      supportingSignalWeight,
    ),
  },
  {
    id: "backend",
    label: "Backend",
    family: "backend",
    threshold: broadCategoryThreshold,
    languages: terms(["Go", "Rust", "Python", "Java", "C#", "Ruby", "PHP"], primarySignalWeight),
    topics: terms(
      ["api", "server", "backend", "database", "queue", "worker"],
      supportingSignalWeight,
    ),
    keywords: terms(["api", "server", "backend", "service", "database"], supportingSignalWeight),
  },
  {
    id: "developer-tooling",
    label: "Developer Tooling",
    family: "developer-tooling",
    threshold: broadCategoryThreshold,
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
      supportingSignalWeight,
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
      supportingSignalWeight,
    ),
  },
  {
    id: "devops",
    label: "DevOps",
    family: "devops",
    threshold: broadCategoryThreshold,
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
      supportingSignalWeight,
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
      supportingSignalWeight,
    ),
  },
  {
    id: "data",
    label: "Data",
    family: "data",
    threshold: broadCategoryThreshold,
    languages: terms(["Python", "R", "Julia", "SQL"], primarySignalWeight),
    topics: terms(
      ["data", "analytics", "machine-learning", "ml", "database", "etl"],
      supportingSignalWeight,
    ),
    keywords: terms(
      ["data", "analytics", "machine learning", "database", "dataset"],
      supportingSignalWeight,
    ),
  },
  {
    id: "testing",
    label: "Testing",
    family: "testing",
    threshold: broadCategoryThreshold,
    topics: terms(
      ["test", "testing", "e2e", "mock", "fixture", "playwright", "vitest", "jest"],
      supportingSignalWeight,
    ),
    keywords: terms(["test", "testing", "mock", "fixture", "assertion"], supportingSignalWeight),
  },
  {
    id: "documentation",
    label: "Documentation",
    family: "documentation",
    threshold: broadCategoryThreshold,
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
      supportingSignalWeight,
    ),
    keywords: terms(
      ["documentation", "docs", "guide", "manual", "markdown", "markup"],
      supportingSignalWeight,
    ),
  },
  {
    id: "security",
    label: "Security",
    family: "security",
    threshold: broadCategoryThreshold,
    topics: terms(
      ["security", "auth", "oauth", "crypto", "vulnerability", "secrets"],
      supportingSignalWeight,
    ),
    keywords: terms(
      ["security", "authentication", "authorization", "oauth", "crypto"],
      supportingSignalWeight,
    ),
  },
  {
    id: "learning-resource",
    label: "Learning Resource",
    family: "learning",
    threshold: broadCategoryThreshold,
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
      supportingSignalWeight,
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
      supportingSignalWeight,
    ),
  },
  {
    id: "library",
    label: "Library",
    family: "library",
    threshold: broadCategoryThreshold,
    topics: terms(["library", "package", "sdk", "component", "plugin"], supportingSignalWeight),
    keywords: terms(
      ["library", "package", "sdk", "framework", "component"],
      supportingSignalWeight,
    ),
  },
  {
    id: "application",
    label: "Application",
    family: "application",
    threshold: broadCategoryThreshold,
    topics: terms(["app", "application", "desktop-app", "webapp"], supportingSignalWeight),
    keywords: terms(["application", "app", "client", "dashboard"], supportingSignalWeight),
  },
];

function languageRule(id: string, label: string, language: string): CategoryRule {
  return {
    id,
    label,
    family: "language",
    threshold: languageRuleThreshold,
    languages: terms([language], languageRuleWeight),
  };
}

function terms(values: string[], weight: number) {
  return values.map((value) => ({ value, weight }));
}
