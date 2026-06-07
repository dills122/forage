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

export const analysisVersion = "analysis-v0.1.0";
export const categoryRulesVersion = "category-rules-v0.1.0";
export const scoreVersion = "foundational-v0.1.0";
