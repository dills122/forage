
# Categories

Categories are fully configuration-driven.

Status:
First v0.1 weighted-rule model drafted

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
- Tune category coverage against real imports
- Decide when to persist analysis results versus calculating on read
- Multi-category behavior
- Deprecated category handling
- Versioning and migration strategy for category changes
- Criteria for promoting narrower categories after real data review

Current v0.1 behavior:
- Category rules live in `packages/analysis`.
- Rules include `id`, `label`, `family`, `threshold`, optional `deprecated`, and weighted language/topic/keyword terms.
- A category matches when summed matching weights meet the threshold.
- Language rules use exact normalized language matches.
- Topic rules use exact normalized topic matches.
- Keyword rules search normalized repository name, full name, description, and homepage.
- Category matches include reasons with field, value, and weight.
- The first rule set intentionally favors broad families such as language, frontend, backend, developer tooling, devops, data, testing, documentation, security, learning resource, library, and application.

Future:
User-requested category submissions.
