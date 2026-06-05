import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(".");
const expectedPaths = [
  "apps/pre-mvp",
  "packages/shared/src/index.ts",
  "packages/core/src/index.ts",
  "packages/github/src/index.ts",
  "packages/analysis/src/index.ts",
  "packages/reporting/src/index.ts",
  "docs/README.md",
  "docs/adr/0001-github-app-user-auth.md",
  ".github/workflows/check.yml",
];

const failures = [];

for (const path of expectedPaths) {
  if (!existsSync(join(root, path))) {
    failures.push(`Missing expected workspace path: ${path}`);
  }
}

const packageJson = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
for (const scriptName of ["check", "check:docs", "check:workspace", "check:pre-mvp"]) {
  if (!packageJson.scripts?.[scriptName]) {
    failures.push(`Missing package script: ${scriptName}`);
  }
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Workspace checks passed.");
