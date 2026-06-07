import type { ImportRunState } from "@forage/core";
import type { ApplicationSettings, ForageRepository, RepositoryAnalysis } from "@forage/shared";
import type { SessionResponse, WorkerConfig } from "./api";
import type { LocalLibraryProfile } from "./db";
import type { LibrarySortMode } from "./library";

export interface AppState {
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

export type WorkerConfigStatusInput = Pick<
  WorkerConfig,
  "github_configured" | "has_github_client_id" | "has_github_client_secret"
> & {
  error?: string;
};

export function createInitialState(workerOrigin: string): AppState {
  return {
    workerOrigin,
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

export function defaultSettings(): ApplicationSettings {
  return {
    analytics_enabled: false,
    updated_at: null,
  };
}

export function getConfigStatus(config: WorkerConfigStatusInput) {
  if (config.error) return config.error;
  const configured =
    config.github_configured ??
    Boolean(config.has_github_client_id && config.has_github_client_secret);
  return configured ? "Ready" : "Missing GitHub env";
}

export function getLocalLibraryStatus(
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

export function getLocalLibraryOwner(profile: LocalLibraryProfile | null, repositoryCount: number) {
  if (repositoryCount === 0) return "-";
  return profile?.github_login ? profile.github_login : "Unknown local owner";
}

export function getSettingsStatus(
  authenticated: boolean,
  settings: ApplicationSettings | undefined,
) {
  if (!authenticated) return "Connect GitHub to manage this setting.";
  if (!settings?.analytics_enabled) return "Off. Repository data stays in this browser.";
  return "On. Anonymous product analytics only; repository data stays in this browser.";
}

export function getUserDisplay(
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

export function hasLocalLibraryConflict(
  profile: LocalLibraryProfile | null,
  sessionUser: SessionResponse["user"] | undefined,
) {
  if (!profile?.github_login || !sessionUser?.login) return false;
  return profile.github_login.toLowerCase() !== sessionUser.login.toLowerCase();
}

export function getLocalLibraryNoticeTitle(localLibraryConflict: boolean, authenticated: boolean) {
  if (localLibraryConflict) return "Different GitHub account connected";
  if (authenticated) return "Local library synced to this browser";
  return "Local library available";
}

export function getLocalLibraryNoticeBody(input: {
  authenticated: boolean;
  localLibraryConflict: boolean;
  localLibraryOwner: string;
  sessionLogin: string | null;
}) {
  if (input.localLibraryConflict) {
    return `This browser has local data for ${input.localLibraryOwner}, but the current GitHub session is ${input.sessionLogin}. Export or reset local data before importing another account.`;
  }
  if (input.authenticated) {
    return `This browser has local data for ${input.localLibraryOwner}. Refresh imports when you want to update it.`;
  }
  return `This browser has local data for ${input.localLibraryOwner}. Connect GitHub when you want to refresh imports.`;
}

export function getSelectedRepository(
  repositories: ForageRepository[],
  selectedRepositoryId: number | null,
) {
  if (repositories.length === 0) return null;
  if (selectedRepositoryId === null) return repositories[0] ?? null;
  return (
    repositories.find((repository) => repository.github_id === selectedRepositoryId) ??
    repositories[0] ??
    null
  );
}
