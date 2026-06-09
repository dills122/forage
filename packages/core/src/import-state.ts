import type { GitHubRateLimitSnapshot, ImportEvent, ImportStatus } from "@forage/shared";

export interface ImportRunState {
  status: ImportStatus;
  started_at: string;
  completed_at: string | null;
  pages: number;
  repositories: number;
  rate_limits: GitHubRateLimitSnapshot[];
  retry_after_seconds: number | null;
  errors: string[];
  current_page: number | null;
  can_cancel: boolean;
}

export interface ImportPageResult {
  page: number;
  repositories: number;
  rate_limit: GitHubRateLimitSnapshot;
}

export function createImportRunState(startedAt = new Date().toISOString()): ImportRunState {
  return {
    status: "running",
    started_at: startedAt,
    completed_at: null,
    pages: 0,
    repositories: 0,
    rate_limits: [],
    retry_after_seconds: null,
    errors: [],
    current_page: 1,
    can_cancel: true,
  };
}

export function recordImportPage(state: ImportRunState, result: ImportPageResult): ImportRunState {
  assertRunning(state);
  return {
    ...state,
    pages: state.pages + 1,
    repositories: state.repositories + result.repositories,
    rate_limits: [...state.rate_limits, result.rate_limit],
    current_page: result.page + 1,
  };
}

export function completeImport(
  state: ImportRunState,
  completedAt = new Date().toISOString(),
): ImportRunState {
  assertRunning(state);
  return terminalState(state, "completed", completedAt);
}

export function failImport(
  state: ImportRunState,
  error: string,
  completedAt = new Date().toISOString(),
): ImportRunState {
  assertRunning(state);
  return terminalState(state, "failed", completedAt, error);
}

export function cancelImport(
  state: ImportRunState,
  completedAt = new Date().toISOString(),
): ImportRunState {
  assertRunning(state);
  return terminalState(state, "cancelled", completedAt);
}

export function rateLimitImport(
  state: ImportRunState,
  error: string,
  rateLimit: GitHubRateLimitSnapshot | null,
  retryAfterSeconds: number | null = null,
  completedAt = new Date().toISOString(),
): ImportRunState {
  assertRunning(state);
  return {
    ...terminalState(state, "rate_limited", completedAt, error),
    rate_limits: rateLimit ? [...state.rate_limits, rateLimit] : state.rate_limits,
    retry_after_seconds: retryAfterSeconds,
  };
}

export function importRunStateToEvent(id: string, state: ImportRunState): ImportEvent {
  return {
    id,
    started_at: state.started_at,
    completed_at: state.completed_at,
    status: state.status,
    pages: state.pages,
    repositories: state.repositories,
    rate_limits: state.rate_limits,
    retry_after_seconds: state.retry_after_seconds,
    errors: state.errors,
  };
}

function terminalState(
  state: ImportRunState,
  status: ImportStatus,
  completedAt: string,
  error?: string,
): ImportRunState {
  return {
    ...state,
    status,
    completed_at: completedAt,
    current_page: null,
    can_cancel: false,
    errors: error ? [...state.errors, error] : state.errors,
  };
}

function assertRunning(state: ImportRunState) {
  if (state.status !== "running") {
    throw new Error(`Cannot update import after terminal status: ${state.status}`);
  }
}
