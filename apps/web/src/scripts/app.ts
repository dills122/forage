import { analyzeRepository } from "@forage/analysis";
import type { ForageRepository } from "@forage/shared";
import type { SessionResponse } from "../lib/api";
import { createImportEvent, WorkerApi } from "../lib/api";
import {
  getAllRepositories,
  getImportEvents,
  resetLocalData,
  saveImportEvent,
  saveRepositories,
} from "../lib/db";

interface AppState {
  workerOrigin: string;
  configStatus: string;
  sessionStatus: string;
  user: string;
  repositoryCount: number;
  latestImport: string;
  progress: string;
  authenticated: boolean;
  repositories: ForageRepository[];
  topLanguage: string;
}

const state: AppState = {
  workerOrigin: "",
  configStatus: "Checking",
  sessionStatus: "Checking",
  user: "-",
  repositoryCount: 0,
  latestImport: "-",
  progress: "Ready.",
  authenticated: false,
  repositories: [],
  topLanguage: "-",
};

let api: WorkerApi;

function startForageApp() {
  const root = document.querySelector<HTMLElement>("#forage-app");
  if (!root) return;

  state.workerOrigin = root.dataset.workerOrigin || "http://127.0.0.1:8787";
  api = new WorkerApi(state.workerOrigin);

  bindEvents();
  void refreshState();
}

function bindEvents() {
  getElement<HTMLAnchorElement>("connect-link").href = api.connectUrl();
  getElement<HTMLButtonElement>("logout-button").addEventListener("click", logout);
  getElement<HTMLButtonElement>("import-button").addEventListener("click", importStars);
  getElement<HTMLButtonElement>("reset-button").addEventListener("click", resetData);
  getElement<HTMLButtonElement>("export-button").addEventListener("click", exportJson);
}

async function refreshState() {
  try {
    const [config, session, repositories, events] = await Promise.all([
      api.getConfig(),
      api.getSession().catch(
        (error: Error): SessionResponse => ({
          authenticated: false,
          error: error.message,
        }),
      ),
      getAllRepositories(),
      getImportEvents(),
    ]);

    state.configStatus =
      config.has_github_client_id && config.has_github_client_secret
        ? "Ready"
        : "Missing GitHub env";
    state.authenticated = session.authenticated;
    state.sessionStatus = session.authenticated ? "Authenticated" : session.error || "Disconnected";
    state.user = session.user?.login ?? "-";
    state.repositoryCount = repositories.length;
    state.latestImport = events[0] ? `${events[0].status} (${events[0].repositories})` : "-";
    state.repositories = sortRepositories(repositories);
    state.topLanguage = getTopLanguage(repositories);
  } catch (error) {
    state.configStatus = error instanceof Error ? error.message : "Worker unavailable";
    state.sessionStatus = "Unavailable";
  }

  render();
}

async function logout() {
  await api.logout();
  state.progress = "Logged out.";
  await refreshState();
}

async function importStars() {
  const event = createImportEvent();
  const fieldNames = new Set<string>();

  try {
    let page: number | null = 1;

    while (page) {
      state.progress = `Importing page ${page}...`;
      render();

      const result = await api.getStarredPage(page);
      await saveRepositories(result.repositories);

      event.pages += 1;
      event.repositories += result.repositories.length;
      event.rate_limits.push(result.rate_limit);
      for (const fieldName of result.raw_field_names) fieldNames.add(fieldName);

      page = result.next_page;
    }

    event.status = "completed";
    event.completed_at = new Date().toISOString();
    state.progress = `Imported ${event.repositories} repositories across ${event.pages} page(s).`;
  } catch (error) {
    event.status = "failed";
    event.completed_at = new Date().toISOString();
    event.errors.push(error instanceof Error ? error.message : "Import failed");
    state.progress = event.errors[0] || "Import failed.";
  }

  await saveImportEvent(event);
  await refreshState();
  getElement("observed-fields").textContent = Array.from(fieldNames).sort().join(", ") || "-";
}

async function resetData() {
  await resetLocalData();
  state.progress = "Local data reset.";
  await refreshState();
}

async function exportJson() {
  const [repositories, events] = await Promise.all([getAllRepositories(), getImportEvents()]);
  const payload = {
    exported_at: new Date().toISOString(),
    repositories,
    latest_import_event: events[0] ?? null,
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

function render() {
  setText("worker-origin", state.workerOrigin);
  setText("config-status", state.configStatus);
  setText("session-status", state.sessionStatus);
  setText("session-badge", state.authenticated ? "Authenticated" : state.sessionStatus);
  setText("github-user", state.user);
  setText("repository-count", String(state.repositoryCount));
  setText("top-language", state.topLanguage);
  setText("latest-import", state.latestImport);
  setText("progress-text", state.progress);
  setText(
    "library-summary",
    state.repositoryCount > 0
      ? `${Math.min(state.repositoryCount, 8)} shown`
      : "No repositories stored",
  );

  getElement("connect-link").toggleAttribute("hidden", state.authenticated);
  getElement("logout-button").toggleAttribute("hidden", !state.authenticated);
  getElement<HTMLButtonElement>("import-button").disabled = !state.authenticated;
  getElement<HTMLButtonElement>("export-button").disabled = state.repositoryCount === 0;
  getElement<HTMLButtonElement>("reset-button").disabled = state.repositoryCount === 0;

  const sessionBadge = getElement("session-badge");
  sessionBadge.className = `status-badge ${state.authenticated ? "success" : "neutral"}`;
  renderRepositories();
}

function renderRepositories() {
  const list = getElement("repo-list");
  const empty = getElement("library-empty");
  const repositories = state.repositories.slice(0, 8);

  empty.toggleAttribute("hidden", repositories.length > 0);
  list.replaceChildren(...repositories.map(createRepositoryRow));
}

function createRepositoryRow(repository: ForageRepository) {
  const row = document.createElement("article");
  row.className = "repo-row";

  const main = document.createElement("div");
  main.className = "repo-main";

  const title = document.createElement("a");
  title.href = repository.url;
  title.target = "_blank";
  title.rel = "noreferrer";
  title.className = "repo-title";
  title.textContent = repository.full_name;

  const description = document.createElement("p");
  description.className = "repo-description";
  description.textContent = repository.description || "No description provided.";

  const topics = document.createElement("div");
  topics.className = "topic-row";
  for (const topicName of repository.topics.slice(0, 4)) {
    const topic = document.createElement("span");
    topic.className = "topic";
    topic.textContent = topicName;
    topics.append(topic);
  }

  main.append(title, description, topics);

  const meta = document.createElement("div");
  meta.className = "repo-meta";
  const analysis = analyzeRepository(repository);
  meta.append(
    createMetaValue(String(analysis.scores.overall.value), "Score"),
    createMetaValue(repository.primary_language || "Unknown", "Language"),
    createMetaValue(repository.stars.toLocaleString(), "Stars"),
    createMetaValue(formatDate(repository.starred_at), "Starred"),
  );

  const categories = document.createElement("div");
  categories.className = "category-row";
  for (const categoryMatch of analysis.categories.slice(0, 3)) {
    const category = document.createElement("span");
    category.className = "category";
    category.textContent = categoryMatch.label;
    categories.append(category);
  }

  row.append(main, meta, categories);
  return row;
}

function createMetaValue(value: string, label: string) {
  const wrapper = document.createElement("span");
  wrapper.className = "meta-value";

  const strong = document.createElement("strong");
  strong.textContent = value;

  const small = document.createElement("small");
  small.textContent = label;

  wrapper.append(strong, small);
  return wrapper;
}

function sortRepositories(repositories: ForageRepository[]) {
  return [...repositories].sort((left, right) => right.starred_at.localeCompare(left.starred_at));
}

function getTopLanguage(repositories: ForageRepository[]) {
  const counts = new Map<string, number>();
  for (const repository of repositories) {
    const language = repository.primary_language || "Unknown";
    counts.set(language, (counts.get(language) ?? 0) + 1);
  }

  const [language, count] =
    [...counts.entries()].sort((left, right) => right[1] - left[1])[0] ?? [];
  return language && count ? `${language} (${count})` : "-";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function setText(id: string, value: string) {
  getElement(id).textContent = value;
}

function getElement<T extends HTMLElement = HTMLElement>(id: string) {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Missing element #${id}`);
  }
  return element as T;
}

startForageApp();
