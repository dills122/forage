<script lang="ts">
  import { analysisVersion, analyzeRepository } from "@forage/analysis";
  import type { ImportRunState } from "@forage/core";
  import {
    createForageExport,
    serializeForageExportJson,
    serializeRepositoryAnalysisCsv,
  } from "@forage/reporting";
  import type { ApplicationSettings, ForageRepository, RepositoryAnalysis } from "@forage/shared";
  import { onMount } from "svelte";
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
    settings: ApplicationSettings;
    settingsStatus: string;
    repositories: ForageRepository[];
    analysisByRepositoryId: Map<number, RepositoryAnalysis>;
    topLanguage: string;
    searchQuery: string;
    languageFilter: string;
    categoryFilter: string;
    sortMode: "starred_at_desc" | "score_desc" | "stars_desc" | "name_asc";
    importRun: ImportRunState | null;
    observedFields: string;
  }

  type Theme = "light" | "dark";

  export let workerOrigin: string;
  const themeStorageKey = "forage-theme";

  let api: WorkerApi;
  let activeImportSession: RepositoryImportSession | null = null;
  let themeLabel = "Light";
  let isDarkTheme = false;
  let state: AppState = createInitialState(workerOrigin);

  $: importRunning = Boolean(activeImportSession) || state.importRun?.status === "running";
  $: filteredRepositories = getFilteredRepositories();
  $: visibleRepositories = filteredRepositories.slice(0, 24);
  $: librarySummary =
    state.repositoryCount > 0
      ? `${visibleRepositories.length} shown of ${filteredRepositories.length} matched`
      : "No repositories stored";
  $: languages = [
    ...new Set(state.repositories.map((repository) => repository.primary_language || "Unknown")),
  ].sort();
  $: categories = [
    ...new Set(
      state.repositories.flatMap((repository) =>
        getRepositoryAnalysis(repository).categories.map((category) => category.label),
      ),
    ),
  ].sort();

  onMount(() => {
    api = new WorkerApi(state.workerOrigin);
    applyTheme(getCurrentTheme());
    void refreshState();
  });

  function createInitialState(origin: string): AppState {
    return {
      workerOrigin: origin,
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
      settings: defaultSettings(),
      settingsStatus: "Connect GitHub to manage this setting.",
      repositories: [],
      analysisByRepositoryId: new Map(),
      topLanguage: "-",
      searchQuery: "",
      languageFilter: "",
      categoryFilter: "",
      sortMode: "starred_at_desc",
      importRun: null,
      observedFields: "Run an import to capture raw GitHub fields.",
    };
  }

  function patchState(patch: Partial<AppState>) {
    state = {
      ...state,
      ...patch,
    };
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
    isDarkTheme = theme === "dark";
    themeLabel = isDarkTheme ? "Dark" : "Light";
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
      const settingsResponse = session.authenticated
        ? await api.getSettings().catch(() => null)
        : null;

      patchState({
        configStatus:
          config.has_github_client_id && config.has_github_client_secret
            ? "Ready"
            : "Missing GitHub env",
        authenticated: session.authenticated,
        sessionUser: session.user ?? null,
        sessionStatus: session.authenticated ? "Authenticated" : session.error || "Disconnected",
        repositoryCount: repositories.length,
        latestImport: events[0] ? `${events[0].status} (${events[0].repositories})` : "-",
        repositories: sortRepositories(repositories),
        analysisByRepositoryId: createCurrentAnalysisMap(analysisResults),
        topLanguage: getTopLanguage(repositories),
        localLibraryProfile,
        localLibraryOwner: getLocalLibraryOwner(localLibraryProfile, repositories.length),
        localLibraryConflict: hasLocalLibraryConflict(localLibraryProfile, session.user),
        user: getUserDisplay(session, localLibraryProfile, repositories.length),
        localLibraryStatus: getLocalLibraryStatus(repositories.length, session.authenticated),
        settings: settingsResponse?.settings ?? defaultSettings(),
        settingsStatus: getSettingsStatus(session.authenticated, settingsResponse?.settings),
      });
    } catch (error) {
      patchState({
        configStatus: error instanceof Error ? error.message : "Worker unavailable",
        sessionStatus: "Unavailable",
        settings: defaultSettings(),
        settingsStatus: "Settings unavailable.",
      });
    }
  }

  async function logout() {
    await api.logout();
    patchState({ progress: "Logged out." });
    await refreshState();
  }

  async function importStars() {
    if (activeImportSession) return;

    if (state.localLibraryConflict) {
      patchState({
        progress: "This browser already has a local library for another GitHub account.",
      });
      return;
    }

    patchState({ progress: "Starting import..." });

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
      patchState({ progress: error instanceof Error ? error.message : "Import failed." });
    } finally {
      activeImportSession = null;
    }

    await refreshState();
  }

  function cancelActiveImport() {
    if (!activeImportSession || state.importRun?.status !== "running") return;
    patchState({ progress: "Cancelling import after current work stops..." });
    activeImportSession.cancel();
  }

  function applyImportProgress(message: ImportWorkerProgressMessage) {
    patchState({
      importRun: message.importRun,
      progress: message.message,
      observedFields: message.observedFieldNames.join(", ") || "-",
    });
  }

  function applyImportTerminal(message: ImportWorkerTerminalMessage) {
    patchState({
      importRun: message.importRun,
      progress: message.message,
      observedFields: message.observedFieldNames.join(", ") || "-",
    });
  }

  async function resetData() {
    await resetLocalData();
    patchState({ progress: "Local data reset." });
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

  async function updateAnalyticsSetting() {
    try {
      const response = await api.updateSettings({
        analytics_enabled: state.settings.analytics_enabled,
      });
      patchState({
        settings: response.settings,
        settingsStatus: getSettingsStatus(state.authenticated, response.settings),
        progress: "Settings updated.",
      });
    } catch (error) {
      patchState({
        progress: error instanceof Error ? error.message : "Settings update failed.",
      });
      await refreshState();
    }
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

  function defaultSettings(): ApplicationSettings {
    return {
      analytics_enabled: false,
      updated_at: null,
    };
  }

  function getSettingsStatus(authenticated: boolean, settings: ApplicationSettings | undefined) {
    if (!authenticated) return "Connect GitHub to manage this setting.";
    if (!settings?.analytics_enabled) return "Off. Repository data stays in this browser.";
    return "On. Anonymous product analytics only; repository data stays in this browser.";
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
</script>

<main class="shell" id="forage-app" data-worker-origin={state.workerOrigin}>
  <header class="topbar">
    <div>
      <p class="eyebrow">Forage</p>
      <h1>Starred repos, ready to sort through.</h1>
    </div>
    <div class="topbar-actions">
      <button
        id="theme-toggle"
        class="theme-toggle"
        type="button"
        aria-label={isDarkTheme ? "Switch to light mode" : "Switch to dark mode"}
        aria-pressed={String(isDarkTheme)}
        onclick={toggleTheme}
      >
        <span class="theme-toggle-track" aria-hidden="true">
          <span class="theme-toggle-thumb"></span>
        </span>
        <span id="theme-toggle-label">{themeLabel}</span>
      </button>
      <span id="session-badge" class:success={state.authenticated} class="status-badge">
        {state.authenticated ? "Authenticated" : state.sessionStatus}
      </span>
      {#if !state.authenticated}
        <a id="connect-link" href={api?.connectUrl() ?? `${state.workerOrigin}/auth/github`} class="button">
          Connect GitHub
        </a>
      {:else}
        <button id="logout-button" class="button secondary" type="button" onclick={logout}>
          Logout
        </button>
      {/if}
    </div>
  </header>

  <section class="metric-grid" aria-label="Library status">
    <article class="metric-panel">
      <span class="metric-label">Stored repos</span>
      <strong id="repository-count">{state.repositoryCount}</strong>
    </article>
    <article class="metric-panel">
      <span class="metric-label">Top language</span>
      <strong id="top-language">{state.topLanguage}</strong>
    </article>
    <article class="metric-panel">
      <span class="metric-label">Latest import</span>
      <strong id="latest-import">{state.latestImport}</strong>
    </article>
    <article class="metric-panel">
      <span class="metric-label">GitHub user</span>
      <strong id="github-user" class:muted-value={!state.authenticated}>{state.user}</strong>
    </article>
  </section>

  {#if state.repositoryCount > 0}
    <section id="local-library-notice" class="notice" class:warning={state.localLibraryConflict}>
      <strong id="local-library-notice-title">{getLocalLibraryNoticeTitle()}</strong>
      <span id="local-library-notice-body">{getLocalLibraryNoticeBody()}</span>
    </section>
  {/if}

  <section class="workspace-grid">
    <section class="panel import-panel">
      <div class="panel-heading">
        <div>
          <p class="section-kicker">Import</p>
          <h2>Refresh your starred repository library.</h2>
        </div>
        <span id="config-status" class="status-pill">{state.configStatus}</span>
      </div>
      <p id="progress-text" class="progress-text">{state.progress}</p>
      <div class="actions">
        <button
          id="import-button"
          class="button"
          type="button"
          disabled={importRunning || !state.authenticated || state.localLibraryConflict}
          onclick={importStars}
        >
          Import Stars
        </button>
        {#if importRunning}
          <button
            id="cancel-import-button"
            class="button secondary"
            type="button"
            onclick={cancelActiveImport}
          >
            Cancel Import
          </button>
        {/if}
        <button
          id="export-button"
          class="button secondary"
          type="button"
          disabled={importRunning || state.repositoryCount === 0}
          onclick={() => exportData("json")}
        >
          Export JSON
        </button>
        <button
          id="export-csv-button"
          class="button secondary"
          type="button"
          disabled={importRunning || state.repositoryCount === 0}
          onclick={() => exportData("csv")}
        >
          Export CSV
        </button>
        <button
          id="reset-button"
          class="button danger"
          type="button"
          disabled={importRunning || state.repositoryCount === 0}
          onclick={resetData}
        >
          Reset Local Data
        </button>
      </div>
    </section>

    <section class="panel diagnostics-panel">
      <div class="panel-heading">
        <div>
          <p class="section-kicker">Connection</p>
          <h2>Runtime details</h2>
        </div>
      </div>
      <dl class="detail-list">
        <dt>Worker</dt>
        <dd id="worker-origin">{state.workerOrigin}</dd>
        <dt>Session</dt>
        <dd id="session-status">{state.sessionStatus}</dd>
        <dt>Local owner</dt>
        <dd id="local-owner">{state.localLibraryOwner}</dd>
      </dl>
      <div class="settings-block">
        <div>
          <p class="section-kicker">Settings</p>
          <h2>Privacy preferences</h2>
        </div>
        <label class="setting-toggle">
          <input
            id="analytics-toggle"
            type="checkbox"
            bind:checked={state.settings.analytics_enabled}
            disabled={!state.authenticated}
            onchange={updateAnalyticsSetting}
          />
          <span>
            <strong>Share anonymous product analytics</strong>
            <small id="analytics-status">{state.settingsStatus}</small>
          </span>
        </label>
      </div>
      <details class="diagnostics">
        <summary>Diagnostics</summary>
        <dl class="detail-list">
          <dt>Repository data</dt>
          <dd id="repository-storage-status">{state.localLibraryStatus}</dd>
          <dt>Server storage</dt>
          <dd>Auth, session, settings, preferences only</dd>
          <dt>Observed fields</dt>
          <dd id="observed-fields">{state.observedFields}</dd>
        </dl>
      </details>
    </section>
  </section>

  <section class="panel library-panel">
    <div class="panel-heading">
      <div>
        <p class="section-kicker">Library</p>
        <h2>Recent stars</h2>
      </div>
      <span id="library-summary" class="status-pill">{librarySummary}</span>
    </div>
    <div class="library-controls" aria-label="Library controls">
      <label>
        <span>Search</span>
        <input
          id="library-search"
          type="search"
          placeholder="Repo, topic, description"
          bind:value={state.searchQuery}
        />
      </label>
      <label>
        <span>Language</span>
        <select id="language-filter" bind:value={state.languageFilter}>
          <option value="">All languages</option>
          {#each languages as language}
            <option value={language}>{language}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>Category</span>
        <select id="category-filter" bind:value={state.categoryFilter}>
          <option value="">All categories</option>
          {#each categories as category}
            <option value={category}>{category}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>Sort</span>
        <select id="library-sort" bind:value={state.sortMode}>
          <option value="starred_at_desc">Recently starred</option>
          <option value="score_desc">Highest score</option>
          <option value="stars_desc">Most stars</option>
          <option value="name_asc">Name</option>
        </select>
      </label>
    </div>
    {#if state.repositoryCount === 0}
      <div id="library-empty" class="empty-state">
        Connect GitHub and import stars to build the local library.
      </div>
    {:else if filteredRepositories.length === 0}
      <div id="library-empty" class="empty-state">No repositories match the current filters.</div>
    {/if}
    <div id="repo-list" class="repo-list" aria-live="polite">
      {#each visibleRepositories as repository (repository.github_id)}
        {@const analysis = getRepositoryAnalysis(repository)}
        <article class="repo-row">
          <div class="repo-main">
            <a href={repository.url} target="_blank" rel="noreferrer" class="repo-title">
              {repository.full_name}
            </a>
            <p class="repo-description">{repository.description || "No description provided."}</p>
            <div class="topic-row">
              {#each repository.topics.slice(0, 4) as topicName}
                <span class="topic">{topicName}</span>
              {/each}
            </div>
          </div>

          <div class="repo-meta">
            <span class="meta-value">
              <strong>{analysis.scores.overall.value}</strong>
              <small>Score</small>
            </span>
            <span class="meta-value">
              <strong>{repository.primary_language || "Unknown"}</strong>
              <small>Language</small>
            </span>
            <span class="meta-value">
              <strong>{repository.stars.toLocaleString()}</strong>
              <small>Stars</small>
            </span>
            <span class="meta-value">
              <strong>{formatDate(repository.starred_at)}</strong>
              <small>Starred</small>
            </span>
          </div>

          <div class="category-row">
            {#each analysis.categories.slice(0, 3) as categoryMatch}
              <span class="category">{categoryMatch.label}</span>
            {/each}
          </div>
        </article>
      {/each}
    </div>
  </section>
</main>
