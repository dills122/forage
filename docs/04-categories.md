
# Categories

Categories are fully configuration-driven.

Status:
Needs scoring/category design pass

MVP category strategy:
Start broad and general. The first category set should be wide enough to classify most repositories without getting stuck on highly specific niches.

Initial category families:
- Languages
- Frameworks
- Frontend
- Backend
- DevOps
- Data
- Testing
- Developer Tooling
- Documentation
- Mobile
- Desktop
- Infrastructure
- Security
- Learning Resources
- Libraries
- Applications

Categories may be:
- Added
- Modified
- Deprecated

Matching inputs:

- Topics
- Keywords
- Language
- Repository Name
- Description

Example:

developer-tooling

threshold: 3

topics:
- cli
- lint
- automation
- validation

languages:
- TypeScript
- Go
- Rust

Open design items:
- Category config schema
- Match weights by input type
- Threshold semantics
- Multi-category behavior
- Deprecated category handling
- Versioning and migration strategy for category changes
- Explanation format for why a repository matched a category
- Criteria for promoting narrower categories after real data review

Future:
User-requested category submissions.
