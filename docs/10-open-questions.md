
# Open Questions

Items intentionally deferred.

- Exact scoring formulas
- Category weighting strategy
- Insight calculation algorithms
- Future personalized Match Score design
- Export format enhancements
- Category submission workflow
- Exact GitHub fields used in the canonical model
- IndexedDB schema and migration strategy
- UI details beyond the first functional dashboard

Current philosophy:

Do not over-engineer.

Build the engine.
Run real data.
Refine based on observations.

Resolved direction:
Use a GitHub App user authorization flow for the website. Forage should behave as an authorized website integration. Fall back to a standard OAuth App only if the GitHub App flow cannot cleanly support the starred repository import.

Base scoring direction:
Repository scores are user-agnostic. Any future preference-aware ranking should be represented as a separate Match Score rather than changing the base score.
