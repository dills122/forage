# Forage

Forage is a privacy-first GitHub repository rediscovery tool. Users authorize GitHub, import starred repositories into browser-local IndexedDB, run local analysis, review scores/categories, and export results without storing repository data server-side.

The current repo contains the real Astro/Svelte web app, Cloudflare Worker auth/import API, shared packages, infrastructure configuration, hosted smoke checks, and the retained pre-MVP spike.

## Documentation Map

Start with [docs/README.md](./docs/README.md) for the full link tree and current hosted environment map.

High-signal docs:

- [Architecture](./docs/02-architecture.md)
- [Auth And Privacy](./docs/11-auth-and-privacy.md)
- [Storage Schema](./docs/13-storage-schema.md)
- [Import Pipeline](./docs/12-import-pipeline.md)
- [Hosting UI Setup](./docs/21-hosting-ui-setup.md)
- [Cloudflare Token Permissions](./docs/24-cloudflare-token-permissions.md)

## Current App

The real app is split into:

- `apps/web`: Astro browser app with Svelte islands, IndexedDB storage, local analysis, dashboard, and exports.
- `apps/worker`: Cloudflare Worker for GitHub auth, session/settings, and GitHub API proxying.
- `packages/*`: shared contracts, core import state, GitHub normalization, analysis/scoring, and reporting.

Repository data imported through the real app is stored in browser IndexedDB, not in the Worker.

## Pre-MVP Spike

The minimal pre-MVP spike remains as a reference for the first proven vertical slice:

- GitHub App user authorization
- Authenticated starred repository import
- `starred_at` preservation
- GitHub field availability
- Local IndexedDB storage
- Browser Web Worker analysis
- JSON export

Copy `.env.example` to `.env` or export the variables in your shell:

```sh
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GITHUB_REDIRECT_URI=http://localhost:5173/auth/github/callback
```

Run:

```sh
npm run dev:pre-mvp
```

Then open:

```text
http://localhost:5173
```

This app is intentionally small and dependency-free. It is not the final Astro/Cloudflare implementation.

## Real App Local Dev

Copy the Worker env example:

```sh
cp apps/worker/.dev.vars.example apps/worker/.dev.vars
```

Set the GitHub App values in `apps/worker/.dev.vars`. The local callback URL is:

```text
http://127.0.0.1:8787/auth/github/callback
```

Run the Worker:

```sh
npm run dev:worker
```

Run the web app in another terminal:

```sh
npm run dev:web
```

Then open:

```text
http://127.0.0.1:4321
```

## Hosted Setup

Hosted testing uses Cloudflare Pages for `apps/web`, a Cloudflare Worker for `apps/worker`, a Durable Object for auth/session coordination, and KV only for small settings records.

Manual GitHub and Cloudflare UI setup is tracked in:

- [Hosting UI Setup](./docs/21-hosting-ui-setup.md)
- [Hosting And Security Plan](./docs/20-hosting-and-security.md)

## AI Central Context

This repo uses AI Central steering and local Codex skill links.

Tracked files:

- `AGENTS.md`
- `.codex/steering/*.md`

Ignored local links:

- `.codex/skills/`

Refresh local skill symlinks with:

```sh
npm run codex:links
```
