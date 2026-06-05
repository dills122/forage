export interface ScoreSet {
  version: string;
  overall: ScoreValue;
  activity: ScoreValue;
  popularity: ScoreValue;
  freshness: ScoreValue;
  maintenance: ScoreValue;
  metadata_quality?: ScoreValue;
  topic_density?: ScoreValue;
  rediscovery?: ScoreValue;
  interestingness?: ScoreValue;
}

export interface ScoreValue {
  value: number;
  explanations: ScoreExplanation[];
}

export interface ScoreExplanation {
  signal: string;
  message: string;
  impact: "positive" | "negative" | "neutral";
}

export interface InsightLabel {
  id: string;
  label: string;
  score_version: string;
  reasons: string[];
}
