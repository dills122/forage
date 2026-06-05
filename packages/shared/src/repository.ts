export interface ForageRepository {
  github_id: number;
  node_id: string;
  repo_name: string;
  owner: string;
  full_name: string;
  url: string;
  description: string | null;
  homepage: string | null;
  topics: string[];
  primary_language: string | null;
  license: string | null;
  stars: number;
  forks: number;
  watchers: number;
  open_issues: number;
  archived: boolean;
  disabled: boolean;
  fork: boolean;
  private: boolean;
  default_branch: string;
  owner_avatar_url: string;
  created_at: string;
  updated_at: string;
  pushed_at: string | null;
  starred_at: string;
  imported_at: string;
  source_api_version: string;
  schema_version: number;
}

export interface RepositoryFieldCoverage {
  field: keyof ForageRepository;
  present: number;
  total: number;
}
