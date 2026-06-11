
# Scoring & Insights

Status:
First v0.1 foundational scoring model implemented

Purpose:
Fun, explainable ranking system.

Scoring principle:
Base repository scores are user-agnostic. They should be calculated only from repository and GitHub metadata, not from the current user's preferences.

Future personalization:
A separate Match Score may weight the user-agnostic scores against user preferences. For example, a repository may have a low general score but a high match score for a user who strongly prefers that language, framework, category, or project style.

Signals:

- Activity Score
- Popularity Score
- Freshness Score
- Metadata Quality Score
- Topic Density Score
- Maintenance Health Score
- Rediscovery Score
- Interestingness Score

Recommended scoring model:
- Stable foundational scores should be versioned and change rarely.
- Experimental or flavor scores may change more often.
- Every generated score should include the scoring version used to calculate it.
- Score explanations should be stored with the computed score so old exports remain understandable.
- Match Score should be separate from foundational scores so personalization does not change the underlying repository evaluation.

Foundational score candidates:
- Activity Score
- Popularity Score
- Freshness Score
- Maintenance Health Score

Secondary score candidates:
- Metadata Quality Score
- Topic Density Score
- Rediscovery Score
- Interestingness Score

Future personalized score candidates:
- Match Score
- Preference Fit
- Category Affinity
- Language Affinity
- Framework Affinity

Formula requirements:
- Validate numeric ranges against real imports.
- Tune weights for each signal.
- Tune caps and normalization rules so very popular repositories do not dominate every ranking.
- Tune how archived, disabled, stale, and recently revived repositories affect scores.
- Keep score version changes explicit in local analysis results and exports.
- Keep user-agnostic scores separate from any future personalized match scoring.

Current v0.1 scoring behavior:
- Score version: `foundational-v0.1.0`.
- Range: 0-100 for every score.
- Overall score is a weighted blend:
  - Activity: 30%
  - Popularity: 25%
  - Freshness: 20%
  - Maintenance: 25%
- Popularity uses logarithmic star and fork normalization so large repositories do not fully dominate.
- Activity, freshness, and maintenance use age buckets from GitHub timestamps.
- Archived and disabled repositories receive maintenance penalties.
- Metadata Quality and Topic Density are calculated as secondary scores but do not affect the overall score yet.
- Each score includes at least one explanation.
- Labels are derived from score and metadata thresholds and include versioned reasons.

Example Labels:

💎 Forgotten Gem
🔥 Still Alive
🧠 Brain Worm
🚀 Worth Revisiting
🧰 Actually Useful
🧟 Dead But Interesting
🕯️ Ancient Relic
🗑️ Probably Noise

Every score must provide explanations.

Insight Types:

- Forgotten Gems
- Ancient Relics
- Most Active
- Most Popular
- Recently Revived
- Category Leaders
- Language Breakdown
- Interesting Oddities

Insights should be easy to add, modify, or remove.

Required follow-up:
Run real GitHub star data through candidate formulas before locking MVP weights.
