<script lang="ts">
  import { Database, LogOut, Moon, Sun } from "@lucide/svelte";
  import { onMount } from "svelte";
  import ImportPanel from "./ImportPanel.svelte";
  import LibraryFilters from "./LibraryFilters.svelte";
  import MetricGrid from "./MetricGrid.svelte";
  import RepositoryDetailPanel from "./RepositoryDetailPanel.svelte";
  import RepositoryList from "./RepositoryList.svelte";
  import {
    createInitialState,
    getLocalLibraryNoticeBody,
    getLocalLibraryNoticeTitle,
    getSelectedRepository,
    getSettingsStatus,
    type AppState,
  } from "../lib/app-state";
  import { WorkerApi } from "../lib/api";
  import { loadAppStateSnapshot } from "../lib/app-refresh";
  import { resetLocalData } from "../lib/db";
  import { type ExportFormat, exportLocalLibrary } from "../lib/export-data";
  import {
    type ImportWorkerProgressMessage,
    type ImportWorkerTerminalMessage,
    type RepositoryImportSession,
    startRepositoryImport,
  } from "../lib/import-worker";
  import { LocalOperationLockError, withLocalOperationLock } from "../lib/local-operation-lock";
  import {
    filterRepositories,
    getCategoryOptions,
    getLanguageOptions,
    getLibrarySummary,
    getRepositoryAnalysis,
  } from "../lib/library";
  import { applyTheme, getCurrentTheme, toggleStoredTheme } from "../lib/theme";

  export let workerOrigin: string;

  let api: WorkerApi;
  let activeImportSession: RepositoryImportSession | null = null;
  let themeLabel = "Light";
  let isDarkTheme = false;
  let initialLoadPending = true;
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
    updateThemeState(applyTheme(getCurrentTheme()));
    void refreshState({ initial: true });
  });

  function patchState(patch: Partial<AppState>) {
    state = {
      ...state,
      ...patch,
    };
  }

  function toggleTheme() {
    updateThemeState(toggleStoredTheme());
  }

  async function refreshState({ initial = false } = {}) {
    try {
      patchState(await loadAppStateSnapshot(api));
    } finally {
      if (initial) initialLoadPending = false;
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

    try {
      await withLocalOperationLock("import", async () => {
        patchState({ progress: "Starting import..." });
        activeImportSession = startRepositoryImport(
          {
            workerOrigin: state.workerOrigin,
            sessionUser: state.sessionUser,
          },
          applyImportProgress,
        );
        applyImportTerminal(await activeImportSession.done);
      });
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
    try {
      await withLocalOperationLock("reset", async () => {
        await resetLocalData();
        patchState({ progress: "Local data reset." });
      });
    } catch (error) {
      patchState({
        progress:
          error instanceof LocalOperationLockError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Local data reset failed.",
      });
    }
    await refreshState();
  }

  async function exportData(format: ExportFormat) {
    await exportLocalLibrary(format);
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

  function selectRepository(repositoryId: number) {
    patchState({ selectedRepositoryId: repositoryId });
  }

  function updateThemeState(themeState: ReturnType<typeof applyTheme>) {
    isDarkTheme = themeState.isDarkTheme;
    themeLabel = themeState.themeLabel;
  }
</script>

<main
  class="shell"
  id="forage-app"
  data-worker-origin={state.workerOrigin}
  aria-busy={initialLoadPending}
>
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
        {initialLoadPending ? "Loading" : state.authenticated ? "Authenticated" : state.sessionStatus}
      </span>
      {#if initialLoadPending}
        <button class="button secondary loading-action" type="button" disabled>
          <span class="loading-spinner compact" aria-hidden="true"></span>
          Loading
        </button>
      {:else if !state.authenticated}
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

  {#if initialLoadPending}
    <section class="loading-panel" aria-live="polite">
      <span class="loading-spinner" aria-hidden="true"></span>
      <div>
        <strong>Loading your browser library</strong>
        <span>Checking GitHub session, local data, settings, and saved analysis.</span>
      </div>
    </section>
  {/if}

  <MetricGrid
    repositoryCount={state.repositoryCount}
    topLanguage={state.topLanguage}
    latestImport={state.latestImport}
    user={state.user}
    authenticated={state.authenticated}
  />

  {#if state.repositoryCount > 0 && state.localLibraryConflict}
    <section id="local-library-notice" class="notice" class:warning={state.localLibraryConflict}>
      <strong id="local-library-notice-title">
        {getLocalLibraryNoticeTitle(state.localLibraryConflict, state.authenticated)}
      </strong>
      <span id="local-library-notice-body">
        {getLocalLibraryNoticeBody({
          authenticated: state.authenticated,
          localLibraryConflict: state.localLibraryConflict,
          localLibraryOwner: state.localLibraryOwner,
          sessionLogin: state.sessionUser?.login ?? null,
        })}
      </span>
    </section>
  {:else if state.repositoryCount > 0}
    <section id="local-library-notice" class="local-library-note" aria-label="Local library status">
      <Database size={15} aria-hidden="true" />
      <strong>Local data</strong>
      <span>
        {getLocalLibraryNoticeBody({
          authenticated: state.authenticated,
          localLibraryConflict: state.localLibraryConflict,
          localLibraryOwner: state.localLibraryOwner,
          sessionLogin: state.sessionUser?.login ?? null,
        })}
      </span>
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
