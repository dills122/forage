import { analysisVersion, analyzeRepository } from "@forage/analysis";
import type { ImportRunState } from "@forage/core";
import {
  createForageExport,
  serializeForageExportJson,
  serializeRepositoryAnalysisCsv,
} from "@forage/reporting";
import type { ForageRepository, RepositoryAnalysis } from "@forage/shared";
import type { SessionResponse } from "../lib/api";
import { WorkerApi } from "../lib/api";
import {
  getAllAnalysisResults,
  getAllRepositories,
  getImportEvents,
  getLocalLibraryProfile,
  type LocalLibraryProfile,
  resetLocalData,
} from "../lib/db";
import {
  type ImportWorkerProgressMessage,
  type ImportWorkerTerminalMessage,
  type RepositoryImportSession,
  startRepositoryImport,
} from "../lib/import-worker";

interface AppState {
  workerOrigin: string;
  configStatus: string;
  sessionStatus: string;
  user: string;
  repositoryCount: number;
  latestImport: string;
  progress: string;
  localLibraryStatus: string;
  authenticated: boolean;
  sessionUser: SessionResponse["user"] | null;
  localLibraryProfile: LocalLibraryProfile | null;
  localLibraryOwner: string;
  localLibraryConflict: boolean;
  repositories: ForageRepository[];
  analysisByRepositoryId: Map<number, RepositoryAnalysis>;
  topLanguage: string;
  searchQuery: string;
  languageFilter: string;
  categoryFilter: string;
  sortMode: "starred_at_desc" | "score_desc" | "stars_desc" | "name_asc";
  importRun: ImportRunState | null;
}

type Theme = "light" | "dark";

const themeStorageKey = "forage-theme";

const state: AppState = {
  workerOrigin: "",
  configStatus: "Checking",
  sessionStatus: "Checking",
  user: "-",
  repositoryCount: 0,
  latestImport: "-",
  progress: "Ready.",
  localLibraryStatus: "No repository data stored locally.",
  authenticated: false,
  sessionUser: null,
  localLibraryProfile: null,
  localLibraryOwner: "-",
  localLibraryConflict: false,
  repositories: [],
  analysisByRepositoryId: new Map(),
  topLanguage: "-",
  searchQuery: "",
  languageFilter: "",
  categoryFilter: "",
  sortMode: "starred_at_desc",
  importRun: null,
};

let api: WorkerApi;
let activeImportSession: RepositoryImportSession | null = null;

function startForageApp() {
  const root = document.querySelector<HTMLElement>("#forage-app");
  if (!root) return;

  state.workerOrigin = root.dataset.workerOrigin || "http://127.0.0.1:8787";
  api = new WorkerApi(state.workerOrigin);

  bindEvents();
  initializeThemeToggle();
  void refreshState();
}

function bindEvents() {
  getElement<HTMLAnchorElement>("connect-link").href = api.connectUrl();
  getElement<HTMLButtonElement>("logout-button").addEventListener("click", logout);
  getElement<HTMLButtonElement>("import-button").addEventListener("click", importStars);
  getElement<HTMLButtonElement>("cancel-import-button").addEventListener(
    "click",
    cancelActiveImport,
  );
  getElement<HTMLButtonElement>("reset-button").addEventListener("click", resetData);
  getElement<HTMLButtonElement>("export-button").addEventListener("click", () =>
    exportData("json"),
  );
  getElement<HTMLButtonElement>("export-csv-button").addEventListener("click", () =>
    exportData("csv"),
  );
  getElement<HTMLInputElement>("library-search").addEventListener("input", updateLibrarySearch);
  getElement<HTMLSelectElement>("language-filter").addEventListener("change", updateLanguageFilter);
  getElement<HTMLSelectElement>("category-filter").addEventListener("change", updateCategoryFilter);
  getElement<HTMLSelectElement>("library-sort").addEventListener("change", updateLibrarySort);
  getElement<HTMLButtonElement>("theme-toggle").addEventListener("click", toggleTheme);
}

function initializeThemeToggle() {
  applyTheme(getCurrentTheme());
}

function toggleTheme() {
  const nextTheme: Theme = getCurrentTheme() === "dark" ? "light" : "dark";
  localStorage.setItem(themeStorageKey, nextTheme);
  applyTheme(nextTheme);
}

function getCurrentTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  const isDark = theme === "dark";
  const toggle = getElement<HTMLButtonElement>("theme-toggle");
  toggle.setAttribute("aria-pressed", String(isDark));
  toggle.setAttribute("aria-label", isDark ? "Switch to light mode" : "Switch to dark mode");
  setText("theme-toggle-label", isDark ? "Dark" : "Light");
}

async function refreshState() {
  try {
    const [config, session, repositories, events, analysisResults, localLibraryProfile] =
      await Promise.all([
        api.getConfig(),
        api.getSession().catch(
          (error: Error): SessionResponse => ({
            authenticated: false,
            error: error.message,
          }),
        ),
        getAllRepositories(),
        getImportEvents(),
        getAllAnalysisResults(),
        getLocalLibraryProfile(),
      ]);

    state.configStatus =
      config.has_github_client_id && config.has_github_client_secret
        ? "Ready"
        : "Missing GitHub env";
    state.authenticated = session.authenticated;
    state.sessionUser = session.user ?? null;
    state.sessionStatus = session.authenticated ? "Authenticated" : session.error || "Disconnected";
    state.repositoryCount = repositories.length;
    state.latestImport = events[0] ? `${events[0].status} (${events[0].repositories})` : "-";
    state.repositories = sortRepositories(repositories);
    state.analysisByRepositoryId = createCurrentAnalysisMap(analysisResults);
    state.topLanguage = getTopLanguage(repositories);
    state.localLibraryProfile = localLibraryProfile;
    state.localLibraryOwner = getLocalLibraryOwner(localLibraryProfile, repositories.length);
    state.localLibraryConflict = hasLocalLibraryConflict(localLibraryProfile, session.user);
    state.user = getUserDisplay(session, localLibraryProfile, repositories.length);
    state.localLibraryStatus = getLocalLibraryStatus(repositories.length, session.authenticated);
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
  if (activeImportSession) return;

  if (state.localLibraryConflict) {
    state.progress = "This browser already has a local library for another GitHub account.";
    render();
    return;
  }

  state.progress = "Starting import...";
  render();

  try {
    activeImportSession = startRepositoryImport(
      {
        workerOrigin: state.workerOrigin,
        sessionUser: state.sessionUser,
      },
      applyImportProgress,
    );
    applyImportTerminal(await activeImportSession.done);
  } catch (error) {
    state.progress = error instanceof Error ? error.message : "Import failed.";
  } finally {
    activeImportSession = null;
  }

  await refreshState();
}

function cancelActiveImport() {
  if (!activeImportSession || state.importRun?.status !== "running") return;
  state.progress = "Cancelling import after current work stops...";
  activeImportSession.cancel();
  render();
}

function applyImportProgress(message: ImportWorkerProgressMessage) {
  state.importRun = message.importRun;
  state.progress = message.message;
  getElement("observed-fields").textContent = message.observedFieldNames.join(", ") || "-";
  render();
}

function applyImportTerminal(message: ImportWorkerTerminalMessage) {
  state.importRun = message.importRun;
  state.progress = message.message;
  getElement("observed-fields").textContent = message.observedFieldNames.join(", ") || "-";
}

async function resetData() {
  await resetLocalData();
  state.progress = "Local data reset.";
  await refreshState();
}

async function exportData(format: "json" | "csv") {
  const [repositories, events, analysisResults, localLibraryProfile] = await Promise.all([
    getAllRepositories(),
    getImportEvents(),
    getAllAnalysisResults(),
    getLocalLibraryProfile(),
  ]);
  const analysisByRepositoryId = createCurrentAnalysisMap(analysisResults);
  const payload = createForageExport({
    repositories,
    analysis_results: repositories.map(
      (repository) =>
        analysisByRepositoryId.get(repository.github_id) ?? analyzeRepository(repository),
    ),
    latest_import_event: events[0] ?? null,
    local_library_profile: localLibraryProfile,
  });
  const isJson = format === "json";
  const contents = isJson
    ? serializeForageExportJson(payload)
    : serializeRepositoryAnalysisCsv(payload);
  const mimeType = isJson ? "application/json" : "text/csv";
  const extension = isJson ? "json" : "csv";
  downloadText(
    contents,
    mimeType,
    `forage-export-${new Date().toISOString().slice(0, 10)}.${extension}`,
  );
}

function downloadText(contents: string, mimeType: string, filename: string) {
  const blob = new Blob([contents], {
    type: mimeType,
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function updateLibrarySearch(event: Event) {
  state.searchQuery = (event.target as HTMLInputElement).value;
  renderRepositories();
}

function updateLanguageFilter(event: Event) {
  state.languageFilter = (event.target as HTMLSelectElement).value;
  renderRepositories();
}

function updateCategoryFilter(event: Event) {
  state.categoryFilter = (event.target as HTMLSelectElement).value;
  renderRepositories();
}

function updateLibrarySort(event: Event) {
  state.sortMode = (event.target as HTMLSelectElement).value as AppState["sortMode"];
  renderRepositories();
}

function render() {
  setText("worker-origin", state.workerOrigin);
  setText("config-status", state.configStatus);
  setText("session-status", state.sessionStatus);
  setText("session-badge", state.authenticated ? "Authenticated" : state.sessionStatus);
  setText("github-user", state.user);
  setText("local-owner", state.localLibraryOwner);
  setText("repository-count", String(state.repositoryCount));
  setText("top-language", state.topLanguage);
  setText("latest-import", state.latestImport);
  setText("progress-text", state.progress);
  setText("repository-storage-status", state.localLibraryStatus);
  setText("local-library-notice-title", getLocalLibraryNoticeTitle());
  setText("local-library-notice-body", getLocalLibraryNoticeBody());
  setText(
    "library-summary",
    state.repositoryCount > 0
      ? `${Math.min(getFilteredRepositories().length, 24)} shown`
      : "No repositories stored",
  );

  getElement("connect-link").toggleAttribute("hidden", state.authenticated);
  getElement("logout-button").toggleAttribute("hidden", !state.authenticated);
  const importRunning = Boolean(activeImportSession) || state.importRun?.status === "running";
  getElement<HTMLButtonElement>("import-button").disabled =
    importRunning || !state.authenticated || state.localLibraryConflict;
  getElement("cancel-import-button").toggleAttribute("hidden", !importRunning);
  getElement<HTMLButtonElement>("export-button").disabled =
    importRunning || state.repositoryCount === 0;
  getElement<HTMLButtonElement>("export-csv-button").disabled =
    importRunning || state.repositoryCount === 0;
  getElement<HTMLButtonElement>("reset-button").disabled =
    importRunning || state.repositoryCount === 0;
  getElement("local-library-notice").toggleAttribute("hidden", state.repositoryCount === 0);

  const sessionBadge = getElement("session-badge");
  sessionBadge.className = `status-badge ${state.authenticated ? "success" : "neutral"}`;
  getElement("github-user").classList.toggle("muted-value", !state.authenticated);
  getElement("local-library-notice").classList.toggle("warning", state.localLibraryConflict);
  renderFilterOptions();
  renderRepositories();
}

function renderRepositories() {
  const list = getElement("repo-list");
  const empty = getElement("library-empty");
  const filteredRepositories = getFilteredRepositories();
  const repositories = filteredRepositories.slice(0, 24);

  setText(
    "library-summary",
    state.repositoryCount > 0
      ? `${repositories.length} shown of ${filteredRepositories.length} matched`
      : "No repositories stored",
  );
  empty.toggleAttribute("hidden", state.repositoryCount > 0);
  empty.textContent =
    state.repositoryCount === 0
      ? "Connect GitHub and import stars to build the local library."
      : "No repositories match the current filters.";
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
  const analysis = getRepositoryAnalysis(repository);
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

function getFilteredRepositories() {
  const query = state.searchQuery.trim().toLowerCase();
  return sortVisibleRepositories(
    state.repositories.filter((repository) => {
      const analysis = getRepositoryAnalysis(repository);
      const language = repository.primary_language || "Unknown";
      const categoryLabels = analysis.categories.map((category) => category.label);
      const searchableText = [
        repository.full_name,
        repository.description ?? "",
        language,
        ...repository.topics,
        ...categoryLabels,
      ]
        .join(" ")
        .toLowerCase();

      return (
        (!query || searchableText.includes(query)) &&
        (!state.languageFilter || language === state.languageFilter) &&
        (!state.categoryFilter || categoryLabels.includes(state.categoryFilter))
      );
    }),
  );
}

function sortVisibleRepositories(repositories: ForageRepository[]) {
  return [...repositories].sort((left, right) => {
    if (state.sortMode === "score_desc") {
      return (
        getRepositoryAnalysis(right).scores.overall.value -
        getRepositoryAnalysis(left).scores.overall.value
      );
    }
    if (state.sortMode === "stars_desc") return right.stars - left.stars;
    if (state.sortMode === "name_asc") return left.full_name.localeCompare(right.full_name);
    return right.starred_at.localeCompare(left.starred_at);
  });
}

function renderFilterOptions() {
  const languages = [
    ...new Set(state.repositories.map((repo) => repo.primary_language || "Unknown")),
  ].sort();
  const categories = [
    ...new Set(
      state.repositories.flatMap((repository) =>
        getRepositoryAnalysis(repository).categories.map((category) => category.label),
      ),
    ),
  ].sort();

  updateSelectOptions(getElement<HTMLSelectElement>("language-filter"), "All languages", languages);
  updateSelectOptions(
    getElement<HTMLSelectElement>("category-filter"),
    "All categories",
    categories,
  );
}

function updateSelectOptions(select: HTMLSelectElement, defaultLabel: string, values: string[]) {
  const currentValue = select.value;
  select.replaceChildren(
    createOption("", defaultLabel),
    ...values.map((value) => createOption(value, value)),
  );
  select.value = values.includes(currentValue) ? currentValue : "";
}

function createOption(value: string, label: string) {
  const option = document.createElement("option");
  option.value = value;
  option.textContent = label;
  return option;
}

function getRepositoryAnalysis(repository: ForageRepository) {
  return state.analysisByRepositoryId.get(repository.github_id) ?? analyzeRepository(repository);
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

function createCurrentAnalysisMap(results: RepositoryAnalysis[]) {
  return new Map(
    results
      .filter((result) => result.analysis_version === analysisVersion)
      .map((result) => [result.repository_id, result]),
  );
}

function getLocalLibraryStatus(repositoryCount: number, authenticated: boolean) {
  if (repositoryCount === 0) return "No repository data stored locally.";
  if (state.localLibraryConflict) {
    return `${repositoryCount} repositories stored locally for ${state.localLibraryOwner}; current GitHub session is ${state.sessionUser?.login}.`;
  }
  if (authenticated) return `${repositoryCount} repositories stored locally and ready to refresh.`;
  return `${repositoryCount} repositories stored locally; GitHub is disconnected.`;
}

function getLocalLibraryOwner(profile: LocalLibraryProfile | null, repositoryCount: number) {
  if (repositoryCount === 0) return "-";
  return profile?.github_login ? profile.github_login : "Unknown local owner";
}

function getUserDisplay(
  session: SessionResponse,
  profile: LocalLibraryProfile | null,
  repositoryCount: number,
) {
  if (session.authenticated) return session.user?.login ?? "-";
  if (repositoryCount > 0 && profile?.github_login)
    return `${profile.github_login} (not connected)`;
  if (repositoryCount > 0) return "Not connected";
  return "-";
}

function hasLocalLibraryConflict(
  profile: LocalLibraryProfile | null,
  sessionUser: SessionResponse["user"] | undefined,
) {
  if (!profile?.github_login || !sessionUser?.login) return false;
  return profile.github_login.toLowerCase() !== sessionUser.login.toLowerCase();
}

function getLocalLibraryNoticeTitle() {
  if (state.localLibraryConflict) return "Different GitHub account connected";
  if (state.authenticated) return "Local library synced to this browser";
  return "Local library available";
}

function getLocalLibraryNoticeBody() {
  if (state.localLibraryConflict) {
    return `This browser has local data for ${state.localLibraryOwner}, but the current GitHub session is ${state.sessionUser?.login}. Export or reset local data before importing another account.`;
  }
  if (state.authenticated) {
    return `This browser has local data for ${state.localLibraryOwner}. Refresh imports when you want to update it.`;
  }
  return `This browser has local data for ${state.localLibraryOwner}. Connect GitHub when you want to refresh imports.`;
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
