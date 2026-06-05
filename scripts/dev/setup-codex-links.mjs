#!/usr/bin/env node
import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "../..");
const skillsDir = path.join(repoRoot, ".codex", "skills");
const bundles = ["core", "engineering", "product", "planning", "frontend", "workflow"];
const reset = process.argv.includes("--reset");

function usage() {
  console.log(`Usage: node scripts/dev/setup-codex-links.mjs [--reset]

Creates local .codex/skills symlinks from AI Central.

Environment:
  AI_CENTRAL_HOME  Path to ai-central or ai-central/templates.
                   Defaults to ~/Documents/ai-central.

Options:
  --reset          Remove .codex/skills before recreating links.
  --help          Show this help.`);
}

if (process.argv.includes("--help") || process.argv.includes("-h")) {
  usage();
  process.exit(0);
}

function resolveAiCentralRoot() {
  const input = process.env.AI_CENTRAL_HOME ?? path.join(os.homedir(), "Documents/ai-central");
  const absolute = path.resolve(input);
  return path.basename(absolute) === "templates" ? path.dirname(absolute) : absolute;
}

async function pathExists(target) {
  try {
    await fs.lstat(target);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function findNonSymlinkSkillEntries() {
  if (!(await pathExists(skillsDir))) {
    return [];
  }

  const entries = await fs.readdir(skillsDir);
  const nonSymlinks = [];
  for (const entry of entries) {
    const fullPath = path.join(skillsDir, entry);
    const stat = await fs.lstat(fullPath);
    if (!stat.isSymbolicLink()) {
      nonSymlinks.push(fullPath);
    }
  }

  return nonSymlinks;
}

function runInstaller(installer, bundle) {
  return new Promise((resolve, reject) => {
    const child = spawn(installer, [repoRoot, "--bundle", bundle, "--mode", "link"], {
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${installer} exited with code ${code}`));
      }
    });
  });
}

async function summarizeLinks() {
  if (!(await pathExists(skillsDir))) {
    return { entries: 0, symlinks: 0, resolvedSkills: 0 };
  }

  const entries = await fs.readdir(skillsDir);
  let symlinks = 0;
  let resolvedSkills = 0;

  for (const entry of entries) {
    const fullPath = path.join(skillsDir, entry);
    const stat = await fs.lstat(fullPath);
    if (stat.isSymbolicLink()) {
      symlinks += 1;
    }

    try {
      await fs.stat(path.join(fullPath, "SKILL.md"));
      resolvedSkills += 1;
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw error;
      }
    }
  }

  return { entries: entries.length, symlinks, resolvedSkills };
}

async function main() {
  const aiCentralRoot = resolveAiCentralRoot();
  const installer = path.join(aiCentralRoot, "scripts", "install-skill-bundle.sh");

  if (!(await pathExists(installer))) {
    console.error(`AI Central installer not found: ${installer}`);
    console.error("Set AI_CENTRAL_HOME to your ai-central checkout or templates directory.");
    process.exitCode = 1;
    return;
  }

  if (reset) {
    await fs.rm(skillsDir, { recursive: true, force: true });
  } else {
    const nonSymlinks = await findNonSymlinkSkillEntries();
    if (nonSymlinks.length > 0) {
      console.error(".codex/skills contains real files or directories.");
      console.error(
        "Run `node scripts/dev/setup-codex-links.mjs --reset` to replace them with local symlinks.",
      );
      for (const entry of nonSymlinks.slice(0, 10)) {
        console.error(`- ${path.relative(repoRoot, entry)}`);
      }
      if (nonSymlinks.length > 10) {
        console.error(`- ...and ${nonSymlinks.length - 10} more`);
      }
      process.exitCode = 1;
      return;
    }
  }

  for (const bundle of bundles) {
    await runInstaller(installer, bundle);
  }

  const summary = await summarizeLinks();
  console.log(
    `Codex skill links ready: ${summary.symlinks}/${summary.entries} symlinks, ` +
      `${summary.resolvedSkills} SKILL.md files resolve.`,
  );
}

await main();
