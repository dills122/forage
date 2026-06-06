import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(".");
const expectedPaths = [
  "AGENTS.md",
  ".codex/steering/repository-steering.md",
  ".codex/steering/javascript-esm-steering.md",
  ".codex/steering/testing-quality-gates-steering.md",
  ".codex/steering/frontend-design-steering.md",
  "apps/pre-mvp",
  "apps/web/package.json",
  "apps/web/astro.config.mjs",
  "apps/web/src/pages/index.astro",
  "apps/worker/package.json",
  "apps/worker/src/index.ts",
  "apps/worker/wrangler.toml",
  "packages/shared/src/index.ts",
  "packages/core/src/index.ts",
  "packages/github/src/index.ts",
  "packages/analysis/src/index.ts",
  "packages/reporting/src/index.ts",
  "docs/README.md",
  "docs/adr/0001-github-app-user-auth.md",
  "docs/17-ci-and-quality-gates.md",
  ".github/workflows/check.yml",
  ".github/pull_request_template.md",
  ".husky/pre-commit",
  ".lintstagedrc.json",
  ".prettierignore",
  ".prettierrc.json",
  "biome.json",
  "scripts/analysis/review-export.ts",
  "scripts/analysis/fixtures/forage-export.sample.json",
  "scripts/check-web-build.mjs",
  "scripts/dev/setup-codex-links.mjs",
];

const failures = [];

for (const path of expectedPaths) {
  if (!existsSync(join(root, path))) {
    failures.push(`Missing expected workspace path: ${path}`);
  }
}

const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
for (const scriptName of [
  "check",
  "check:docs",
  "check:scripts",
  "check:workspace",
  "check:web-smoke",
  "check:pre-mvp",
  "format",
  "format:astro",
  "format:astro:check",
  "lint",
  "lint:fix",
  "lint-staged",
  "prepare",
  "test",
  "test:coverage",
  "analysis:review",
  "check:analysis",
]) {
  if (!packageJson.scripts?.[scriptName]) {
    failures.push(`Missing package script: ${scriptName}`);
  }
}

if (!packageJson.scripts?.["codex:links"]) {
  failures.push("Missing package script: codex:links");
}

if (packageJson.packageManager !== "pnpm@10.23.0") {
  failures.push("packageManager must stay pinned to pnpm@10.23.0");
}

const workflow = await readFile(join(root, ".github/workflows/check.yml"), "utf8");
const expectedWorkflowSnippets = [
  "pull_request:",
  "branches:",
  "- main",
  "permissions:",
  "contents: read",
  "concurrency:",
  "pnpm/action-setup@v4",
  "actions/setup-node@v4",
  "node-version: 22",
  "cache: pnpm",
  "pnpm install --frozen-lockfile",
  "npm run check",
];

for (const snippet of expectedWorkflowSnippets) {
  if (!workflow.includes(snippet)) {
    failures.push(`CI workflow is missing required snippet: ${snippet}`);
  }
}

const expectedDevDependencies = [
  "@biomejs/biome",
  "husky",
  "lint-staged",
  "prettier",
  "prettier-plugin-astro",
  "typescript",
  "tsx",
];

for (const dependencyName of expectedDevDependencies) {
  if (!packageJson.devDependencies?.[dependencyName]) {
    failures.push(`Missing root devDependency: ${dependencyName}`);
  }
}

const huskyHook = await readFile(join(root, ".husky/pre-commit"), "utf8");
if (!huskyHook.includes("pnpm exec lint-staged")) {
  failures.push("Husky pre-commit hook must run pnpm exec lint-staged");
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Workspace checks passed.");
