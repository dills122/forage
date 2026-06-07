<script lang="ts">
  import { analyzeRepository } from "@forage/analysis";
  import type { ImportRunState } from "@forage/core";
  import {
    createForageExport,
    serializeForageExportJson,
    serializeRepositoryAnalysisCsv,
  } from "@forage/reporting";
  import type { ApplicationSettings, ForageRepository, RepositoryAnalysis } from "@forage/shared";
  import { LogOut, Moon, Sun } from "@lucide/svelte";
  import { onMount } from "svelte";
  import ImportPanel from "./ImportPanel.svelte";
  import LibraryFilters from "./LibraryFilters.svelte";
  import MetricGrid from "./MetricGrid.svelte";
  import RepositoryDetailPanel from "./RepositoryDetailPanel.svelte";
  import RepositoryList from "./RepositoryList.svelte";
  import type { SessionResponse, WorkerConfig } from "../lib/api";
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
  import {
    createCurrentAnalysisMap,
    filterRepositories,
    getCategoryOptions,
    getLanguageOptions,
    getLibrarySummary,
    getRepositoryAnalysis,
    getTopLanguage,
    type LibrarySortMode,
    sortRepositoriesByStarredAt,
  } from "../lib/library";

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
    sortMode: LibrarySortMode;
    selectedRepositoryId: number | null;
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
  $: filteredRepositories = filterRepositories(
    state.repositories,
    {
      searchQuery: state.searchQuery,
      languageFilter: state.languageFilter,
      categoryFilter: state.categoryFilter,
      sortMode: state.sortMode,
    },
    state.analysisByRepositoryId,
  );
  $: visibleRepositories = filteredRepositories.slice(0, 24);
  $: librarySummary = getLibrarySummary(
    state.repositoryCount,
    visibleRepositories.length,
    filteredRepositories.length,
  );
  $: languages = getLanguageOptions(state.repositories);
  $: categories = getCategoryOptions(state.repositories, state.analysisByRepositoryId);
  $: selectedRepository = getSelectedRepository(visibleRepositories, state.selectedRepositoryId);
  $: selectedRepositoryId = selectedRepository?.github_id ?? null;
  $: selectedAnalysis = selectedRepository
    ? getRepositoryAnalysis(selectedRepository, state.analysisByRepositoryId)
    : null;

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
      selectedRepositoryId: null,
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
      const [repositories, events, analysisResults, localLibraryProfile] = await Promise.all([
        getAllRepositories(),
        getImportEvents(),
        getAllAnalysisResults(),
        getLocalLibraryProfile(),
      ]);
      const [config, session] = await Promise.all([
        api.getConfig().catch((error: Error) => ({
          error: error.message,
          has_github_client_id: false,
          has_github_client_secret: false,
        })),
        api.getSession().catch(
          (error: Error): SessionResponse => ({
            authenticated: false,
            error: error.message,
          }),
        ),
      ]);
      const settingsResponse = session.authenticated
        ? await api.getSettings().catch(() => null)
        : null;
      const localLibraryOwner = getLocalLibraryOwner(localLibraryProfile, repositories.length);
      const localLibraryConflict = hasLocalLibraryConflict(localLibraryProfile, session.user);

      patchState({
        configStatus: getConfigStatus(config),
        authenticated: session.authenticated,
        sessionUser: session.user ?? null,
        sessionStatus: session.authenticated ? "Authenticated" : session.error || "Disconnected",
        repositoryCount: repositories.length,
        latestImport: events[0] ? `${events[0].status} (${events[0].repositories})` : "-",
        repositories: sortRepositoriesByStarredAt(repositories),
        analysisByRepositoryId: createCurrentAnalysisMap(analysisResults),
        topLanguage: getTopLanguage(repositories),
        localLibraryProfile,
        localLibraryOwner,
        localLibraryConflict,
        user: getUserDisplay(session, localLibraryProfile, repositories.length),
        localLibraryStatus: getLocalLibraryStatus(
          repositories.length,
          session.authenticated,
          localLibraryConflict,
          localLibraryOwner,
          session.user?.login ?? null,
        ),
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

  async function deleteServerAccount() {
    await api.deleteAccount();
    patchState({ progress: "Server account state deleted. Local repository data remains in this browser." });
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

  async function updateAnalyticsSetting(analyticsEnabled: boolean) {
    const previousSettings = state.settings;
    patchState({
      settings: {
        ...state.settings,
        analytics_enabled: analyticsEnabled,
      },
    });

    try {
      const response = await api.updateSettings({
        analytics_enabled: analyticsEnabled,
      });
      patchState({
        settings: response.settings,
        settingsStatus: getSettingsStatus(state.authenticated, response.settings),
        progress: "Settings updated.",
      });
    } catch (error) {
      patchState({
        settings: previousSettings,
        progress: error instanceof Error ? error.message : "Settings update failed.",
      });
      await refreshState();
    }
  }

  function getConfigStatus(config: Pick<WorkerConfig, "github_configured" | "has_github_client_id" | "has_github_client_secret"> & {
    error?: string;
  }) {
    if (config.error) return config.error;
    const configured =
      config.github_configured ?? Boolean(config.has_github_client_id && config.has_github_client_secret);
    return configured ? "Ready" : "Missing GitHub env";
  }

  function getLocalLibraryStatus(
    repositoryCount: number,
    authenticated: boolean,
    localLibraryConflict: boolean,
    localLibraryOwner: string,
    sessionLogin: string | null,
  ) {
    if (repositoryCount === 0) return "No repository data stored locally.";
    if (localLibraryConflict) {
      return `${repositoryCount} repositories stored locally for ${localLibraryOwner}; current GitHub session is ${sessionLogin}.`;
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

  function selectRepository(repositoryId: number) {
    patchState({ selectedRepositoryId: repositoryId });
  }

  function getSelectedRepository(
    repositories: ForageRepository[],
    selectedRepositoryId: number | null,
  ) {
    if (repositories.length === 0) return null;
    if (selectedRepositoryId === null) return repositories[0];
    return (
      repositories.find((repository) => repository.github_id === selectedRepositoryId) ??
      repositories[0]
    );
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
        {#if isDarkTheme}
          <Moon size={16} aria-hidden="true" />
        {:else}
          <Sun size={16} aria-hidden="true" />
        {/if}
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
          <LogOut size={16} aria-hidden="true" />
          Logout
        </button>
      {/if}
    </div>
  </header>

  <MetricGrid
    repositoryCount={state.repositoryCount}
    topLanguage={state.topLanguage}
    latestImport={state.latestImport}
    user={state.user}
    authenticated={state.authenticated}
  />

  {#if state.repositoryCount > 0}
    <section id="local-library-notice" class="notice" class:warning={state.localLibraryConflict}>
      <strong id="local-library-notice-title">{getLocalLibraryNoticeTitle()}</strong>
      <span id="local-library-notice-body">{getLocalLibraryNoticeBody()}</span>
    </section>
  {/if}

  <section class="workspace-grid">
    <ImportPanel
      configStatus={state.configStatus}
      progress={state.progress}
      {importRunning}
      authenticated={state.authenticated}
      localLibraryConflict={state.localLibraryConflict}
      repositoryCount={state.repositoryCount}
      settings={state.settings}
      settingsStatus={state.settingsStatus}
      workerOrigin={state.workerOrigin}
      sessionStatus={state.sessionStatus}
      localLibraryOwner={state.localLibraryOwner}
      localLibraryStatus={state.localLibraryStatus}
      observedFields={state.observedFields}
      onImport={importStars}
      onCancelImport={cancelActiveImport}
      onExport={exportData}
      onReset={resetData}
      onDeleteAccount={deleteServerAccount}
      onAnalyticsChange={updateAnalyticsSetting}
    />
  </section>

  <section class="panel library-panel">
    <div class="panel-heading">
      <div>
        <p class="section-kicker">Library</p>
        <h2>Recent stars</h2>
      </div>
      <span id="library-summary" class="status-pill">{librarySummary}</span>
    </div>
    <LibraryFilters
      bind:searchQuery={state.searchQuery}
      bind:languageFilter={state.languageFilter}
      bind:categoryFilter={state.categoryFilter}
      bind:sortMode={state.sortMode}
      {languages}
      {categories}
    />
    <RepositoryDetailPanel repository={selectedRepository} analysis={selectedAnalysis} />
    <RepositoryList
      repositoryCount={state.repositoryCount}
      {filteredRepositories}
      {visibleRepositories}
      analysisByRepositoryId={state.analysisByRepositoryId}
      {selectedRepositoryId}
      onSelectRepository={selectRepository}
    />
  </section>
</main>
