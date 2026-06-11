# Forage Documentation

This directory contains the product, architecture, implementation, hosting, and operations material for Forage.

## Start Here

- Product context: [Executive Summary](./00-executive-summary.md) -> [Product Overview](./01-product-overview.md)
- System shape: [Architecture](./02-architecture.md) -> [Auth And Privacy](./11-auth-and-privacy.md) -> [Local Storage Schema](./13-storage-schema.md)
- MVP behavior: [MVP Acceptance Criteria](./14-mvp-acceptance-criteria.md) -> [Import Pipeline](./12-import-pipeline.md) -> [Dashboard And UX](./08-dashboard-and-ux.md)
- Analysis model: [Categories](./04-categories.md) -> [Scoring And Insights](./05-scoring-and-insights.md) -> [Analysis Review](./18-analysis-review.md)
- Hosted operations: [Hosting And Security Plan](./20-hosting-and-security.md) -> [Hosting UI Setup](./21-hosting-ui-setup.md) -> [Infrastructure As Code](./22-infrastructure-as-code.md) -> [Deployment Automation](./23-deployment-automation.md) -> [Cloudflare Token Permissions](./24-cloudflare-token-permissions.md)
- Current implementation state: [Implementation Readiness](./16-implementation-readiness.md) -> [Code Audit](./19-code-audit.md) -> [CI And Quality Gates](./17-ci-and-quality-gates.md)

## Current Hosted Environments

- Staging web: `https://forage-staging.shrimpworks.dev`
- Staging API: `https://api-staging.forage.shrimpworks.dev`
- Staging Pages branch URL: `https://staging.forage-web.pages.dev`
- Production web: `https://forage.shrimpworks.dev`
- Production API: `https://api.forage.shrimpworks.dev`

Staging web is protected by Cloudflare Access. The staging API remains public for GitHub OAuth callbacks and credentialed CORS.

## Product And Architecture

- [Executive Summary](./00-executive-summary.md)
- [Product Overview](./01-product-overview.md)
- [Architecture](./02-architecture.md)
- [Data Model](./03-data-model.md)
- [Categories](./04-categories.md)
- [Scoring And Insights](./05-scoring-and-insights.md)
- [PWA And Storage](./06-pwa-and-storage.md)
- [Browser Web Workers And Processing](./07-workers-and-processing.md)
- [Dashboard And UX](./08-dashboard-and-ux.md)
- [Roadmap](./09-roadmap.md)
- [Open Questions](./10-open-questions.md)

## Implementation And Quality

- [Auth And Privacy](./11-auth-and-privacy.md)
- [Import Pipeline](./12-import-pipeline.md)
- [Storage Schema](./13-storage-schema.md)
- [MVP Acceptance Criteria](./14-mvp-acceptance-criteria.md)
- [Pre-MVP Spike Findings](./15-pre-mvp-spike-findings.md)
- [Implementation Readiness](./16-implementation-readiness.md)
- [CI And Quality Gates](./17-ci-and-quality-gates.md)
- [Analysis Review](./18-analysis-review.md)
- [Code Audit](./19-code-audit.md)

## Hosting And Operations

- [Hosting And Security Plan](./20-hosting-and-security.md)
- [Hosting UI Setup](./21-hosting-ui-setup.md)
- [Infrastructure As Code](./22-infrastructure-as-code.md)
- [Deployment Automation](./23-deployment-automation.md)
- [Cloudflare Token Permissions](./24-cloudflare-token-permissions.md)

## Architecture Decisions

- [ADR 0001: GitHub App User Auth](./adr/0001-github-app-user-auth.md)
- [ADR 0002: Local-First Repository Data](./adr/0002-local-first-repository-data.md)
- [ADR 0003: Pre-MVP Spike Outcome](./adr/0003-pre-mvp-spike-outcome.md)
