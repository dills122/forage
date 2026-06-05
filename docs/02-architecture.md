
# Architecture

Frontend:
- Astro
- Astro Islands
- TypeScript
- Tailwind
- PWA Support

Backend:
- Cloudflare Workers
- Cloudflare KV
- Cloudflare D1

Backend responsibilities:
- GitHub authorization flow
- Token/session handling
- Minimal hashed user record
- Opt-in or opt-out preferences
- Small settings records
- Aggregate analytics if enabled

Backend non-responsibilities:
- Repository list storage
- Analysis result storage
- Export storage
- Report storage

Fallback:
- DigitalOcean

Monorepo:
- pnpm workspaces

apps/
  web/
  cli/

packages/
  core/
  github/
  analysis/
  reporting/
  shared/

Business logic remains inside shared packages.

Terminology:
- Cloudflare Worker means the hosted backend edge function.
- Browser Web Worker means local in-browser import or analysis processing.
