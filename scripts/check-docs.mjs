import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

const root = resolve(".");
const docsDir = join(root, "docs");
const failures = [];

async function listMarkdownFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(path)));
    } else if (entry.name.endsWith(".md")) {
      files.push(path);
    }
  }

  return files;
}

for (const file of await listMarkdownFiles(docsDir)) {
  const content = await readFile(file, "utf8");
  const relative = file.replace(`${root}/`, "");

  if (content.includes("RepoTrove")) {
    failures.push(`${relative}: contains stale product name RepoTrove`);
  }

  const localLinks = content.matchAll(/\[[^\]]+\]\((?!https?:\/\/|#)([^)]+\.md(?:#[^)]+)?)\)/g);
  for (const match of localLinks) {
    const target = match[1].split("#")[0];
    const targetPath = resolve(dirname(file), target);
    if (!existsSync(targetPath)) {
      failures.push(`${relative}: broken local doc link ${match[1]}`);
    }
  }
}

if (!existsSync(join(docsDir, "README.md"))) {
  failures.push("docs/README.md is required");
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Documentation checks passed.");
