export type ImportStatus = "running" | "completed" | "failed" | "cancelled" | "rate_limited";

export interface GitHubRateLimitSnapshot {
  limit: string | null;
  remaining: string | null;
  reset: string | null;
  used: string | null;
  resource: string | null;
}

export interface ImportEvent {
  id: string;
  started_at: string;
  completed_at: string | null;
  status: ImportStatus;
  pages: number;
  repositories: number;
  rate_limits: GitHubRateLimitSnapshot[];
  errors: string[];
}
