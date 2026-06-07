import type { ApplicationSettings, GitHubRateLimitSnapshot } from "@forage/shared";

export interface Env {
  ENVIRONMENT?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GITHUB_REDIRECT_URI?: string;
  GITHUB_API_VERSION?: string;
  WEB_ORIGIN?: string;
  SETTINGS_HASH_SALT?: string;
  SESSION_ENCRYPTION_KEY?: string;
  SETTINGS_KV?: KVNamespace;
  SESSION_KV?: KVNamespace;
  OAUTH_STATE_KV?: KVNamespace;
  AUTH_COORDINATOR?: DurableObjectNamespace;
}

export interface Session {
  accessToken: string;
  tokenType: string;
  scope: string;
  createdAt: string;
  csrfToken: string;
  accessTokenExpiresAt?: string;
  settings: ApplicationSettings;
  githubUserHash?: string;
}

export interface OAuthStateRecord {
  createdAt: number;
  codeVerifier: string;
}

export interface EncryptedSessionRecord {
  version: 1;
  algorithm: "AES-GCM";
  iv: string;
  ciphertext: string;
}

export interface StoredSessionRecord {
  record: EncryptedSessionRecord;
  expiresAt: number;
  githubUserHash?: string;
}

export interface RateLimitRecord {
  count: number;
  resetAt: number;
}

export interface GitHubUserIdentity {
  id: number | null;
  login: string | null;
  rateLimit: GitHubRateLimitSnapshot;
}
