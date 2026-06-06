import type { ForageRepository, GitHubRateLimitSnapshot, ImportEvent } from "@forage/shared";

export interface WorkerConfig {
  auth_type: string;
  has_github_client_id: boolean;
  has_github_client_secret: boolean;
  redirect_uri: string;
  github_api_version: string;
  web_origin: string;
  stores_repository_data: boolean;
  session_store: string;
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

  getStarredPage(page: number, perPage = 100) {
    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
    });
    return this.get<StarredPageResponse>(`/api/github/starred?${params}`);
  }

  private get<T>(path: string) {
    return this.request<T>(path, { method: "GET" });
  }

  private post<T>(path: string) {
    return this.request<T>(path, { method: "POST" });
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
      throw new Error(message);
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
