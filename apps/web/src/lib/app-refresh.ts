import type { RepositoryAnalysis } from "@forage/shared";
import type { SessionResponse, SettingsResponse, WorkerConfig } from "./api";
import {
  type AppState,
  defaultSettings,
  getConfigStatus,
  getLocalLibraryOwner,
  getLocalLibraryStatus,
  getSettingsStatus,
  getUserDisplay,
  hasLocalLibraryConflict,
  type WorkerConfigStatusInput,
} from "./app-state";
import {
  getAllAnalysisResults,
  getAllRepositories,
  getImportEvents,
  getLocalLibraryProfile,
  type LocalLibraryProfile,
} from "./db";
import { createCurrentAnalysisMap, getTopLanguage, sortRepositoriesByStarredAt } from "./library";

export interface AppRefreshApi {
  getConfig: () => Promise<WorkerConfig>;
  getSession: () => Promise<SessionResponse>;
  getSettings: () => Promise<SettingsResponse>;
}

export async function loadAppStateSnapshot(api: AppRefreshApi): Promise<Partial<AppState>> {
  try {
    const [repositories, events, analysisResults, localLibraryProfile] = await Promise.all([
      getAllRepositories(),
      getImportEvents(),
      getAllAnalysisResults(),
      getLocalLibraryProfile(),
    ]);
    const configPromise: Promise<WorkerConfigStatusInput> = api
      .getConfig()
      .catch((error: Error) => ({
        error: error.message,
        has_github_client_id: false,
        has_github_client_secret: false,
      }));
    const sessionPromise = api.getSession().catch(
      (error: Error): SessionResponse => ({
        authenticated: false,
        error: error.message,
      }),
    );
    const [config, session] = await Promise.all([configPromise, sessionPromise]);
    const settingsResponse = session.authenticated
      ? await api.getSettings().catch(() => null)
      : null;

    return createAppStateSnapshotPatch({
      repositories,
      importEvents: events,
      analysisResults,
      localLibraryProfile,
      config,
      session,
      settingsResponse,
    });
  } catch (error) {
    return {
      configStatus: error instanceof Error ? error.message : "Worker unavailable",
      sessionStatus: "Unavailable",
      settings: defaultSettings(),
      settingsStatus: "Settings unavailable.",
    };
  }
}

export function createAppStateSnapshotPatch(input: {
  repositories: AppState["repositories"];
  importEvents: Array<{ status: string; repositories: number }>;
  analysisResults: RepositoryAnalysis[];
  localLibraryProfile: LocalLibraryProfile | null;
  config: WorkerConfigStatusInput;
  session: SessionResponse;
  settingsResponse: SettingsResponse | null;
}): Partial<AppState> {
  const localLibraryOwner = getLocalLibraryOwner(
    input.localLibraryProfile,
    input.repositories.length,
  );
  const localLibraryConflict = hasLocalLibraryConflict(
    input.localLibraryProfile,
    input.session.user,
  );

  return {
    configStatus: getConfigStatus(input.config),
    authenticated: input.session.authenticated,
    sessionUser: input.session.user ?? null,
    sessionStatus: input.session.authenticated
      ? "Authenticated"
      : input.session.error || "Disconnected",
    repositoryCount: input.repositories.length,
    latestImport: input.importEvents[0]
      ? `${input.importEvents[0].status} (${input.importEvents[0].repositories})`
      : "-",
    repositories: sortRepositoriesByStarredAt(input.repositories),
    analysisByRepositoryId: createCurrentAnalysisMap(input.analysisResults),
    topLanguage: getTopLanguage(input.repositories),
    localLibraryProfile: input.localLibraryProfile,
    localLibraryOwner,
    localLibraryConflict,
    user: getUserDisplay(input.session, input.localLibraryProfile, input.repositories.length),
    localLibraryStatus: getLocalLibraryStatus(
      input.repositories.length,
      input.session.authenticated,
      localLibraryConflict,
      localLibraryOwner,
      input.session.user?.login ?? null,
    ),
    settings: input.settingsResponse?.settings ?? defaultSettings(),
    settingsStatus: getSettingsStatus(
      input.session.authenticated,
      input.settingsResponse?.settings,
    ),
  };
}
