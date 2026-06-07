# Forage

Forage is a privacy-first GitHub repository rediscovery tool.

The current repo contains planning docs plus a minimal pre-MVP spike app used to validate:

- GitHub App user authorization
- Authenticated starred repository import
- `starred_at` preservation
- GitHub field availability
- Local IndexedDB storage
- Browser Web Worker analysis
- JSON export

## Pre-MVP Spike

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

The real app is split into:

- `apps/web`: Astro browser app
- `apps/worker`: Cloudflare Worker auth/import API

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

Repository data imported through the real app is stored in browser IndexedDB, not in the Worker.

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
