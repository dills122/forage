import { access, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";

const root = resolve(".");
const webDist = join(root, "apps/web/dist");
const failures = [];

const indexHtml = await readRequiredFile(join(webDist, "index.html"), "web build index");

if (!indexHtml.includes('id="forage-app"')) {
  failures.push("Web build index is missing the Forage app root.");
}

if (!indexHtml.includes("Starred repos, ready to sort through.")) {
  failures.push("Web build index is missing the expected app heading.");
}

const moduleScripts = collectHtmlAssetPaths(
  indexHtml,
  /<script[^>]+type="module"[^>]+src="([^"]+)"/g,
);
if (moduleScripts.length === 0) {
  failures.push("Web build index is missing a module script entry.");
}

const cssAssets = collectHtmlAssetPaths(
  indexHtml,
  /<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g,
);
if (cssAssets.length === 0) {
  failures.push("Web build index is missing a stylesheet asset.");
}

for (const assetPath of [...moduleScripts, ...cssAssets]) {
  await assertExists(join(webDist, assetPath), `referenced web asset: ${assetPath}`);
}

const scriptContents = await Promise.all(
  moduleScripts.map((assetPath) => readRequiredFile(join(webDist, assetPath), assetPath)),
);
const appEntry = scriptContents.join("\n");

if (!appEntry.includes("new Worker")) {
  failures.push("Web app bundle is missing a browser Worker constructor.");
}

if (!appEntry.includes("import:start") || !appEntry.includes("import:cancel")) {
  failures.push("Web app bundle is missing import worker start/cancel message contracts.");
}

const workerAssets = new Set([
  ...collectJsAssetPaths(appEntry, /["'](\/_astro\/[^"']*import\.worker[^"']*\.js)["']/g),
  ...collectJsAssetPaths(appEntry, /new URL\(["']([^"']+import\.worker[^"']+\.js)["']/g),
]);

if (workerAssets.size === 0) {
  failures.push("Web app bundle does not reference an emitted import worker chunk.");
}

for (const workerAsset of workerAssets) {
  const workerSource = await readRequiredFile(join(webDist, workerAsset), workerAsset);
  for (const expectedContract of [
    "import:cancel",
    "import:progress",
    "import:complete",
    "import:error",
  ]) {
    if (!workerSource.includes(expectedContract)) {
      failures.push(`Import worker chunk ${workerAsset} is missing ${expectedContract}.`);
    }
  }
}

if (appEntry.includes("@forage/")) {
  failures.push("Web app bundle still contains unresolved @forage package aliases.");
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Web build smoke checks passed.");

function collectHtmlAssetPaths(contents, pattern) {
  return [...contents.matchAll(pattern)].map((match) => normalizeAssetPath(match[1]));
}

function collectJsAssetPaths(contents, pattern) {
  return [...contents.matchAll(pattern)].map((match) => normalizeAssetPath(match[1]));
}

function normalizeAssetPath(path) {
  return path.startsWith("/") ? path.slice(1) : path;
}

async function readRequiredFile(path, label) {
  try {
    return await readFile(path, "utf8");
  } catch (error) {
    failures.push(`Missing or unreadable ${label}: ${error.message}`);
    return "";
  }
}

async function assertExists(path, label) {
  try {
    await access(path);
  } catch {
    failures.push(`Missing ${label}.`);
  }
}
