# Analysis Review

Status:
Initial real-export review command implemented

Purpose:
Use real Forage exports to inspect whether category matching and foundational scoring are directionally useful before building more dashboard UI on top of the model.

Command:

```sh
pnpm analysis:review <path-to-forage-export.json>
```

Input:
- A local JSON export created by the Forage web app.
- The export file should not be committed to the repository.

Output:
- Markdown report printed to stdout.
- Score summary and score buckets.
- Category coverage and top categories.
- Language breakdown.
- Insight label counts.
- Highest and lowest scored repositories.
- Review queues for uncategorized repositories, stale popular repositories, and archived repositories.

Current findings from the first real export pass:
- v0.1 scoring produces a wide enough score range to inspect ranking behavior.
- Category matching needed broader language coverage beyond the initial JavaScript/TypeScript/Python/Go/Rust/C#/C++ set.
- Several uncategorized repositories were obviously classifiable by language or broad tooling/docs/devops terms, so the first refinement expanded those rules.
- Real export category coverage improved from 566/719 to 679/719 after the first broad rule refinements.
- Developer Tooling increased materially after adding broad `git` and `tools` signals, so it needs human review for overmatching before we treat it as stable.
- The review command is covered by CI with a synthetic export fixture; real user exports remain local-only.

Next review questions:
- Are the top-scored repositories actually worth revisiting?
- Are stale but popular repositories penalized enough?
- Are language categories useful as first-class categories, or should they become facets only?
- Which broad non-language categories overmatch or undermatch?
- Which categories are missing before we build filtering and saved analysis views?
