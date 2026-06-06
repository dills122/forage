export interface CategoryRule {
  id: string;
  label: string;
  family: CategoryFamily;
  threshold: number;
  deprecated?: boolean;
  topics?: WeightedTerm[];
  keywords?: WeightedTerm[];
  languages?: WeightedTerm[];
}

export type CategoryFamily =
  | "language"
  | "framework"
  | "frontend"
  | "backend"
  | "devops"
  | "data"
  | "testing"
  | "developer-tooling"
  | "documentation"
  | "mobile"
  | "desktop"
  | "infrastructure"
  | "security"
  | "learning"
  | "library"
  | "application";

export interface WeightedTerm {
  value: string;
  weight: number;
}

export interface CategoryMatch {
  id: string;
  label: string;
  family: CategoryFamily;
  confidence: number;
  reasons: CategoryMatchReason[];
}

export interface CategoryMatchReason {
  field: "topic" | "keyword" | "language" | "repo_name" | "description";
  value: string;
  weight: number;
}
