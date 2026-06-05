export interface AnalysisPlan {
  category_model: "weighted-rules";
  scoring_model: "user-agnostic-foundational";
  personalization: "deferred-match-score";
}

export const analysisPlan: AnalysisPlan = {
  category_model: "weighted-rules",
  scoring_model: "user-agnostic-foundational",
  personalization: "deferred-match-score",
};
