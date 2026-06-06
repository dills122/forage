import type { ForageRepository, GitHubRateLimitSnapshot } from "@forage/shared";

export interface GitHubImportPlan {
  auth: "github-app-user";
  source: "authenticated-starred-repositories";
  per_page: 100;
}

export const githubImportPlan: GitHubImportPlan = {
  auth: "github-app-user",
  source: "authenticated-starred-repositories",
  per_page: 100,
};

export interface GitHubFetchStarredPageOptions {
  accessToken: string;
  apiVersion: string;
  page?: number;
  perPage?: number;
  fetcher?: typeof fetch;
}

export interface GitHubStarredPage {
  page: number;
  nextPage: number | null;
  repositories: ForageRepository[];
  rateLimit: GitHubRateLimitSnapshot;
  rawFieldNames: string[];
}

interface GitHubOwner {
  login?: string;
  avatar_url?: string;
}

interface GitHubLicense {
  spdx_id?: string | null;
  key?: string | null;
}

interface GitHubRepositoryPayload {
  id?: number;
  node_id?: string;
  name?: string;
  owner?: GitHubOwner;
  full_name?: string;
  html_url?: string;
  description?: string | null;
  homepage?: string | null;
  topics?: string[];
  language?: string | null;
  license?: GitHubLicense | null;
  stargazers_count?: number;
  forks_count?: number;
  watchers_count?: number;
  open_issues_count?: number;
  archived?: boolean;
  disabled?: boolean;
  fork?: boolean;
  private?: boolean;
  default_branch?: string;
  created_at?: string;
  updated_at?: string;
  pushed_at?: string | null;
}

interface GitHubStarredPayload {
  starred_at?: string;
  repo?: GitHubRepositoryPayload;
}

export async function fetchStarredRepositoriesPage({
  accessToken,
  apiVersion,
  page = 1,
  perPage = 100,
  fetcher = fetch,
}: GitHubFetchStarredPageOptions): Promise<GitHubStarredPage> {
  const boundedPerPage = Math.max(1, Math.min(perPage, 100));
  const url = new URL("https://api.github.com/user/starred");
  url.searchParams.set("per_page", String(boundedPerPage));
  url.searchParams.set("page", String(page));
  url.searchParams.set("sort", "created");
  url.searchParams.set("direction", "desc");

  const response = await fetcher(url, {
    headers: {
      Accept: "application/vnd.github.star+json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "forage",
      "X-GitHub-Api-Version": apiVersion,
    },
  });

  const payload = await parseGitHubJson(response);
  if (!response.ok) {
    const message =
      typeof payload === "object" && payload && "message" in payload
        ? String(payload.message)
        : `GitHub starred import failed with ${response.status}`;
    throw new GitHubApiError(message, response.status, rateLimitFromHeaders(response.headers));
  }

  const items = Array.isArray(payload) ? (payload as GitHubStarredPayload[]) : [];
  const rawFieldNames = new Set<string>();
  const repositories = items
    .map((item) => normalizeStarredRepository(item, apiVersion, rawFieldNames))
    .filter((repo): repo is ForageRepository => Boolean(repo));

  return {
    page,
    nextPage: parseNextPage(response.headers.get("link")),
    repositories,
    rateLimit: rateLimitFromHeaders(response.headers),
    rawFieldNames: Array.from(rawFieldNames).sort(),
  };
}

export class GitHubApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly rateLimit: GitHubRateLimitSnapshot,
  ) {
    super(message);
    this.name = "GitHubApiError";
  }
}

function normalizeStarredRepository(
  item: GitHubStarredPayload,
  apiVersion: string,
  rawFieldNames: Set<string>,
): ForageRepository | null {
  const repo = item.repo;
  if (!repo?.id || !repo.full_name || !repo.name || !repo.owner?.login || !repo.html_url) {
    return null;
  }

  for (const key of Object.keys(repo)) rawFieldNames.add(key);
  if (item.starred_at) rawFieldNames.add("starred_at");

  return {
    github_id: repo.id,
    node_id: repo.node_id ?? "",
    repo_name: repo.name,
    owner: repo.owner.login,
    full_name: repo.full_name,
    url: repo.html_url,
    description: repo.description ?? null,
    homepage: repo.homepage || null,
    topics: repo.topics ?? [],
    primary_language: repo.language ?? null,
    license: repo.license?.spdx_id ?? repo.license?.key ?? null,
    stars: repo.stargazers_count ?? 0,
    forks: repo.forks_count ?? 0,
    watchers: repo.watchers_count ?? 0,
    open_issues: repo.open_issues_count ?? 0,
    archived: repo.archived ?? false,
    disabled: repo.disabled ?? false,
    fork: repo.fork ?? false,
    private: repo.private ?? false,
    default_branch: repo.default_branch ?? "",
    owner_avatar_url: repo.owner.avatar_url ?? "",
    created_at: repo.created_at ?? "",
    updated_at: repo.updated_at ?? "",
    pushed_at: repo.pushed_at ?? null,
    starred_at: item.starred_at ?? "",
    imported_at: new Date().toISOString(),
    source_api_version: apiVersion,
    schema_version: 1,
  };
}

function parseNextPage(linkHeader: string | null) {
  if (!linkHeader) return null;

  const nextPart = linkHeader.split(",").find((part) => part.includes('rel="next"'));
  if (!nextPart) return null;

  const match = nextPart.match(/<([^>]+)>/);
  if (!match) return null;

  const nextHref = match[1];
  if (!nextHref) return null;

  const nextUrl = new URL(nextHref);
  const page = nextUrl.searchParams.get("page");
  return page ? Number(page) : null;
}

function rateLimitFromHeaders(headers: Headers): GitHubRateLimitSnapshot {
  return {
    limit: headers.get("x-ratelimit-limit"),
    remaining: headers.get("x-ratelimit-remaining"),
    reset: headers.get("x-ratelimit-reset"),
    used: headers.get("x-ratelimit-used"),
    resource: headers.get("x-ratelimit-resource"),
  };
}

async function parseGitHubJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}
