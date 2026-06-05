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
