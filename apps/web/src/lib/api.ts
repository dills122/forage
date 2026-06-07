import type {
  ApplicationSettings,
  ApplicationSettingsUpdate,
  ForageRepository,
  GitHubRateLimitSnapshot,
  ImportEvent,
} from "@forage/shared";

export interface WorkerConfig {
  auth_type: string;
  has_github_client_id: boolean;
  has_github_client_secret: boolean;
  redirect_uri: string;
  github_api_version: string;
  web_origin: string;
  stores_repository_data: boolean;
  session_store: string;
  oauth_state_store: string;
}

export interface SessionResponse {
  authenticated: boolean;
  user?: {
    login: string | null;
    id: number | null;
  };
  token_type?: string;
  scope?: string;
  created_at?: string;
  rate_limit?: GitHubRateLimitSnapshot;
  error?: string;
}

export interface StarredPageResponse {
  page: number;
  next_page: number | null;
  repositories: ForageRepository[];
  rate_limit: GitHubRateLimitSnapshot;
  raw_field_names: string[];
}

export interface SettingsResponse {
  settings: ApplicationSettings;
  stores_repository_data: boolean;
  settings_store: string;
}

export class WorkerApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly rateLimit: GitHubRateLimitSnapshot | null,
  ) {
    super(message);
    this.name = "WorkerApiError";
  }
}

export class WorkerApi {
  constructor(readonly workerOrigin: string) {}

  connectUrl() {
    return `${this.workerOrigin}/auth/github`;
  }

  getConfig() {
    return this.get<WorkerConfig>("/api/config");
  }

  getSession() {
    return this.get<SessionResponse>("/api/session");
  }

  logout() {
    return this.post<{ ok: boolean }>("/api/logout");
  }

  getSettings() {
    return this.get<SettingsResponse>("/api/settings");
  }

  updateSettings(settings: ApplicationSettingsUpdate) {
    return this.put<SettingsResponse>("/api/settings", settings);
  }

  getStarredPage(page: number, perPage = 100, signal?: AbortSignal) {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    return this.get<StarredPageResponse>(`/api/github/starred?${params}`, { signal });
  }

  private get<T>(path: string, init: RequestInit = {}) {
    return this.request<T>(path, { ...init, method: "GET" });
  }

  private post<T>(path: string) {
    return this.request<T>(path, { method: "POST" });
  }

  private put<T>(path: string, body: unknown) {
    return this.request<T>(path, {
      method: "PUT",
      body: JSON.stringify(body),
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(`${this.workerOrigin}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...init.headers,
      },
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const message =
        typeof payload === "object" && payload && "error" in payload
          ? String(payload.error)
          : `Worker request failed with ${response.status}`;
      const rateLimit =
        typeof payload === "object" && payload && "rate_limit" in payload
          ? (payload.rate_limit as GitHubRateLimitSnapshot)
          : null;
      throw new WorkerApiError(message, response.status, rateLimit);
    }
    return payload as T;
  }
}

export function createImportEvent(): ImportEvent {
  return {
    id: crypto.randomUUID(),
    started_at: new Date().toISOString(),
    completed_at: null,
    status: "running",
    pages: 0,
    repositories: 0,
    rate_limits: [],
    errors: [],
  };
}
