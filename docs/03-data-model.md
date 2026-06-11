
# Canonical Repository Model

Repository metadata should be normalized into a consistent internal model.

Status:
Initial contract implemented

The repository model is implemented in `packages/shared/src/repository.ts` and populated from the GitHub REST starred repository response. The fields below are the current shared contract, with nullable values where GitHub can omit data.

Fields:

- github_id
- node_id
- repo_name
- owner
- full_name
- url
- description
- homepage
- topics
- primary_language
- license
- stars
- forks
- watchers
- open_issues
- archived
- disabled
- fork
- private
- default_branch
- owner_avatar_url
- created_at
- updated_at
- pushed_at
- starred_at
- imported_at
- source_api_version
- schema_version

Purpose:

Display Metadata:
- description
- homepage
- license

Scoring Metadata:
- stars
- forks
- watchers
- pushed_at
- updated_at
- archived

Category Metadata:
- topics
- language
- description
- repo name

Required follow-up:
- Continue validating nullable fields against larger real account imports.
- Avoid per-repository detail calls unless a specific MVP feature requires fields missing from the starred list response.
- Keep IndexedDB schema and migration behavior aligned with [Storage Schema](./13-storage-schema.md).
- Keep analysis result and export models separate from repository metadata.
- Update this document and `packages/shared` together when repository fields change.
