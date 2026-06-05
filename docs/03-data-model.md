
# Canonical Repository Model

Repository metadata should be normalized into a consistent internal model.

Status:
Discovery Required

The exact model should be finalized after testing the GitHub API response shape against real accounts. The model below is the starting point, not a locked schema.

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
- Confirm available fields from GitHub's starred repository endpoint.
- Decide whether per-repository detail calls are needed beyond the starred list response.
- Define nullable fields.
- Define IndexedDB schema and migration behavior.
- Define analysis result and export models separately from repository metadata.
