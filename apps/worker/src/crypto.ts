import type { EncryptedSessionRecord, Env, Session } from "./types";

export function createId() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export function base64UrlEncode(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function base64UrlDecode(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), "=");
  return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
}

export async function hashGitHubUserId(userId: number, env: Env) {
  const salt = env.SETTINGS_HASH_SALT || env.GITHUB_CLIENT_SECRET || "forage-local-dev";
  const data = new TextEncoder().encode(`github-user:${userId}:${salt}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function operationalHash(value: string, env: Env) {
  const salt = env.SETTINGS_HASH_SALT || env.GITHUB_CLIENT_SECRET || "forage-local-dev";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${value}:${salt}`),
  );
  return base64UrlEncode(new Uint8Array(digest));
}

export function createPkceVerifier() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

export async function createPkceChallenge(verifier: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64UrlEncode(new Uint8Array(digest));
}

export async function encryptSession(session: Session, env: Env): Promise<EncryptedSessionRecord> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(session));
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
    },
    await sessionEncryptionKey(env),
    encoded,
  );

  return {
    version: 1,
    algorithm: "AES-GCM",
    iv: base64UrlEncode(iv),
    ciphertext: base64UrlEncode(new Uint8Array(ciphertext)),
  };
}

export async function decryptSession(record: EncryptedSessionRecord, env: Env): Promise<Session> {
  if (record.version !== 1 || record.algorithm !== "AES-GCM") {
    throw new Error("Unsupported session record");
  }

  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: base64UrlDecode(record.iv),
    },
    await sessionEncryptionKey(env),
    base64UrlDecode(record.ciphertext),
  );

  return JSON.parse(new TextDecoder().decode(plaintext)) as Session;
}

async function sessionEncryptionKey(env: Env) {
  const secret = env.SESSION_ENCRYPTION_KEY || env.GITHUB_CLIENT_SECRET;
  if (!secret) {
    throw new Error("Missing SESSION_ENCRYPTION_KEY or GITHUB_CLIENT_SECRET");
  }

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return await crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}
