import {
  getAllRepositories,
  getImportEvents,
  resetLocalData,
  saveImportEvent,
  saveRepositories,
} from "./db.js";

const state = {
  config: null,
  session: null,
  repositories: [],
  analyzed: [],
  latestEvent: null,
  observedFields: new Set(),
  verification: {
    configPresent: false,
    authenticated: false,
    starredEndpoint: false,
    starredAtPreserved: false,
    fieldsObserved: false,
    storedLocally: false,
    workerAnalysis: false,
  },
};

const els = {
  connectionStatus: document.querySelector("#connectionStatus"),
  connectLink: document.querySelector("#connectLink"),
  logoutButton: document.querySelector("#logoutButton"),
  importButton: document.querySelector("#importButton"),
  analyzeButton: document.querySelector("#analyzeButton"),
  exportButton: document.querySelector("#exportButton"),
  resetButton: document.querySelector("#resetButton"),
  progressText: document.querySelector("#progressText"),
  verificationList: document.querySelector("#verificationList"),
  summaryList: document.querySelector("#summaryList"),
  fieldList: document.querySelector("#fieldList"),
  repoRows: document.querySelector("#repoRows"),
  eventOutput: document.querySelector("#eventOutput"),
};

function renderDefinitionList(element, rows) {
  element.innerHTML = rows
    .map(([term, description]) => `<dt>${term}</dt><dd>${description ?? "-"}</dd>`)
    .join("");
}

function render() {
  renderDefinitionList(els.connectionStatus, [
    ["GitHub config", state.config?.hasGitHubConfig ? "Present" : "Missing"],
    ["Auth type", state.config?.authType || "-"],
    ["Redirect URI", state.config?.redirectUri || "-"],
    ["Authenticated", state.session?.authenticated ? "Yes" : "No"],
    ["GitHub user", state.session?.user?.login || "-"],
    ["Rate limit", formatRateLimit(state.session?.rateLimit)],
  ]);

  renderDefinitionList(els.summaryList, [
    ["Stored repos", state.repositories.length],
    ["Analyzed repos", state.analyzed.length],
    [
      "Languages",
      new Set(state.repositories.map((repo) => repo.primary_language).filter(Boolean)).size,
    ],
    ["Latest import", state.latestEvent?.status || "-"],
  ]);

  els.verificationList.innerHTML = Object.entries({
    "GitHub App config present": state.verification.configPresent,
    "User authenticated": state.verification.authenticated,
    "Starred endpoint reachable": state.verification.starredEndpoint,
    "starred_at preserved": state.verification.starredAtPreserved,
    "GitHub fields observed": state.verification.fieldsObserved,
    "Repositories stored in IndexedDB": state.verification.storedLocally,
    "Browser worker analysis completed": state.verification.workerAnalysis,
  })
    .map(
      ([label, passed]) => `<li class="${passed ? "pass" : "pending"}"><span>${label}</span></li>`,
    )
    .join("");

  els.fieldList.innerHTML = Array.from(state.observedFields)
    .sort()
    .map((field) => `<span class="tag">${field}</span>`)
    .join("");

  const rows = (state.analyzed.length ? state.analyzed : state.repositories).slice(0, 25);
  els.repoRows.innerHTML = rows
    .map(
      (repo) => `<tr>
        <td><a href="${repo.url}" target="_blank" rel="noreferrer">${repo.full_name}</a></td>
        <td>${repo.primary_language || "-"}</td>
        <td>${repo.stars ?? "-"}</td>
        <td>${formatDate(repo.starred_at)}</td>
        <td>${(repo.categories || []).map((item) => item.label).join(", ") || "-"}</td>
        <td>${repo.scores?.overall ?? "-"}</td>
      </tr>`,
    )
    .join("");

  els.eventOutput.textContent = JSON.stringify(state.latestEvent || {}, null, 2);

  els.connectLink.style.display = state.session?.authenticated ? "none" : "inline-flex";
  els.logoutButton.style.display = state.session?.authenticated ? "inline-flex" : "none";
  els.importButton.disabled = !state.session?.authenticated;
  els.analyzeButton.disabled = state.repositories.length === 0;
  els.exportButton.disabled = state.repositories.length === 0;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function formatRateLimit(rateLimit) {
  if (!rateLimit?.limit) return "-";
  return `${rateLimit.remaining}/${rateLimit.limit} remaining`;
}

async function loadJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(payload.error || `Request failed: ${response.status}`);
  }
  return payload;
}

function normalizeStarredItem(item) {
  const repo = item.repo || item;
  for (const key of Object.keys(repo)) state.observedFields.add(key);
  if (item.starred_at) state.observedFields.add("starred_at");

  return {
    github_id: repo.id,
    node_id: repo.node_id,
    repo_name: repo.name,
    owner: repo.owner?.login,
    full_name: repo.full_name,
    url: repo.html_url,
    description: repo.description,
    homepage: repo.homepage,
    topics: repo.topics || [],
    primary_language: repo.language,
    license: repo.license?.spdx_id || repo.license?.key || null,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    watchers: repo.watchers_count,
    open_issues: repo.open_issues_count,
    archived: repo.archived,
    disabled: repo.disabled,
    fork: repo.fork,
    private: repo.private,
    default_branch: repo.default_branch,
    owner_avatar_url: repo.owner?.avatar_url,
    created_at: repo.created_at,
    updated_at: repo.updated_at,
    pushed_at: repo.pushed_at,
    starred_at: item.starred_at || null,
    imported_at: new Date().toISOString(),
    source_api_version: state.config?.githubApiVersion || "unknown",
    schema_version: 1,
  };
}

async function refreshLocalState() {
  state.repositories = await getAllRepositories();
  const events = await getImportEvents();
  state.latestEvent = events[0] || null;
  state.verification.storedLocally = state.repositories.length > 0;
  render();
}

async function loadConnection() {
  state.config = await loadJson("/api/config");
  state.verification.configPresent = state.config.hasGitHubConfig;
  state.session = await loadJson("/api/session");
  state.verification.authenticated = state.session.authenticated;
  render();
}

async function importStars() {
  const startedAt = new Date().toISOString();
  const event = {
    id: crypto.randomUUID(),
    started_at: startedAt,
    completed_at: null,
    status: "running",
    pages: 0,
    repositories: 0,
    rate_limits: [],
    errors: [],
  };

  try {
    let page = 1;
    let nextPage = 1;

    while (nextPage) {
      els.progressText.textContent = `Importing page ${page}...`;
      render();

      const payload = await loadJson(`/api/github/starred?page=${page}&per_page=100`);
      const items = Array.isArray(payload.items) ? payload.items : [];
      const repositories = items.map(normalizeStarredItem).filter((repo) => repo.github_id);

      await saveRepositories(repositories);

      event.pages += 1;
      event.repositories += repositories.length;
      event.rate_limits.push(payload.rateLimit);
      state.verification.starredEndpoint = true;
      state.verification.starredAtPreserved ||= repositories.some((repo) =>
        Boolean(repo.starred_at),
      );
      state.verification.fieldsObserved = state.observedFields.size > 0;

      nextPage = payload.nextPage;
      page = nextPage;
    }

    event.status = "completed";
    event.completed_at = new Date().toISOString();
    els.progressText.textContent = `Imported ${event.repositories} repositories across ${event.pages} page(s).`;
  } catch (error) {
    event.status = "failed";
    event.completed_at = new Date().toISOString();
    event.errors.push(error.message);
    els.progressText.textContent = error.message;
  }

  state.latestEvent = event;
  await saveImportEvent(event);
  await refreshLocalState();
}

async function runAnalysis() {
  const repositories = await getAllRepositories();
  const worker = new Worker("/analysis.worker.js");

  els.progressText.textContent = "Running browser worker analysis...";
  render();

  const result = await new Promise((resolve, reject) => {
    worker.onerror = () => reject(new Error("Analysis worker failed"));
    worker.onmessage = (event) => resolve(event.data);
    worker.postMessage({ repositories });
  });

  worker.terminate();
  state.analyzed = result.analyzed;
  state.verification.workerAnalysis = true;
  els.progressText.textContent = `Analyzed ${result.summary.total} repositories.`;
  render();
}

function exportJson() {
  const payload = {
    exported_at: new Date().toISOString(),
    repositories: state.analyzed.length ? state.analyzed : state.repositories,
    latest_import_event: state.latestEvent,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `forage-export-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

els.importButton.addEventListener("click", importStars);
els.analyzeButton.addEventListener("click", runAnalysis);
els.exportButton.addEventListener("click", exportJson);
els.logoutButton.addEventListener("click", async () => {
  await loadJson("/api/logout", { method: "POST" });
  state.session = { authenticated: false };
  await loadConnection();
});
els.resetButton.addEventListener("click", async () => {
  await resetLocalData();
  state.repositories = [];
  state.analyzed = [];
  state.latestEvent = null;
  state.observedFields = new Set();
  state.verification.storedLocally = false;
  state.verification.workerAnalysis = false;
  els.progressText.textContent = "Local data reset.";
  render();
});

await loadConnection();
await refreshLocalState();
