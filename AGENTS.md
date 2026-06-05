# Forage Agent Guide

This file is the root AI-agent guidance for `forage`.

## Scope

- Applies to the full monorepo unless a nested `AGENTS.md` is closer to the edited file.
- Use `.codex/steering/*` for reusable repo-wide standards and skill context.
- Local skill links under `.codex/skills/` are generated from AI Central and are not source files.

## Project Summary

Forage is a privacy-first GitHub repository rediscovery tool. Users authorize GitHub, import starred repositories into browser storage, run local analysis, explore a dashboard, and export results.

Core priorities:

- Preserve the privacy boundary: server-side code must not store repository lists, analysis results, reports, or exports.
- Keep GitHub authorization, token/session handling, settings, preferences, and aggregate analytics separate from local repository data.
- Keep base repository scoring user-agnostic; future personalized match scoring must be separate.
- Prefer narrow, explicit changes over broad refactors.
- Update docs when setup, commands, data contracts, auth behavior, storage semantics, or architecture direction change.

## Canonical Docs

Read these before changing architecture or behavior:

- `docs/00-executive-summary.md`
- `docs/02-architecture.md`
- `docs/03-data-model.md`
- `docs/05-scoring-and-insights.md`
- `docs/11-auth-and-privacy.md`
- `docs/12-import-pipeline.md`
- `docs/13-storage-schema.md`
- `docs/14-mvp-acceptance-criteria.md`
- `docs/15-pre-mvp-spike-findings.md`
- `docs/16-implementation-readiness.md`
- `docs/adr/`

## Architecture Boundaries

Primary areas:

- `apps/pre-mvp/`: dependency-light validation spike; keep until the real app reproduces the same vertical slice.
- `apps/web/`: future Astro/PWA browser application, IndexedDB storage, dashboard, local analysis workers, and exports.
- `apps/worker/`: future Cloudflare Worker for GitHub auth, session, settings, preferences, and aggregate analytics only.
- `packages/shared/`: shared contracts for repositories, import events, categories, scoring, and insights.
- `packages/github/`: GitHub API import, pagination, normalization, and rate-limit handling.
- `packages/analysis/`: category matching, foundational scoring, labels, and insights.
- `packages/reporting/`: JSON, CSV, Markdown, and HTML export logic.
- `docs/`: product planning, architecture, ADRs, readiness notes, and spike findings.

When a change spans areas, preserve ownership boundaries and update shared contracts first.

## Contract-First Files

Treat these as contracts before implementation details:

- `packages/shared/src/repository.ts`
- `packages/shared/src/import.ts`
- `packages/shared/src/categories.ts`
- `packages/shared/src/scoring.ts`
- `docs/03-data-model.md`
- `docs/11-auth-and-privacy.md`
- `docs/12-import-pipeline.md`
- `docs/13-storage-schema.md`
- `docs/adr/`

If behavior changes, update the relevant contract and docs in the same change.

## Required Privacy Rules

- Do not persist imported repository data in Cloudflare.
- Do not add server-side report or export storage without an explicit architecture decision.
- Do not log GitHub tokens or raw auth secrets.
- Keep `.env` and local exports out of git.
- Prefer user-initiated refresh until rate-limit behavior is measured in the real app.

## Repository Conventions

- Follow `.codex/steering/repository-steering.md` for repo scope and boundaries.
- Follow `.codex/steering/javascript-esm-steering.md` for JavaScript and TypeScript code.
- Follow `.codex/steering/frontend-design-steering.md` for user-facing UI work.
- Follow `.codex/steering/testing-quality-gates-steering.md` for verification expectations.
- Prefer existing helper APIs and local patterns.
- Add focused tests for behavior changes.
- Avoid unrelated refactors and generated artifact churn.

## Useful Commands

- Check current repo: `npm run check`
- Check pre-MVP spike syntax: `npm run check:pre-mvp`
- Check docs: `npm run check:docs`
- Check workspace shape: `npm run check:workspace`
- Run pre-MVP spike: `npm run dev:pre-mvp`
- Refresh local AI Central skill links: `npm run codex:links`

## Branch And PR Metadata

- Use feature branches for behavior, contract, test, or documentation changes unless explicitly asked to work on `main`.
- When work is ready, provide:
  - branch name
  - PR title
  - PR summary
  - test evidence
