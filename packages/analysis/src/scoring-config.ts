export const scoreWeights = {
  activity: 0.3,
  popularity: 0.25,
  freshness: 0.2,
  maintenance: 0.25,
} as const;

export const scoreAgeThresholds = {
  activityPushedDays: [
    [30, 100],
    [90, 88],
    [180, 74],
    [365, 58],
    [730, 34],
  ],
  freshnessCreatedDays: [
    [180, 88],
    [365, 78],
    [730, 62],
    [1460, 46],
    [2920, 30],
  ],
  freshnessUpdatedDays: [
    [90, 100],
    [180, 84],
    [365, 68],
    [730, 48],
    [1460, 28],
  ],
  maintenanceUpdatedDays: [
    [90, 90],
    [180, 78],
    [365, 64],
    [730, 44],
    [1460, 24],
  ],
} satisfies Record<string, Array<[number, number]>>;

export const defaultStaleAgeScore = 12;

export const popularityScoreConfig = {
  starLogCap: 5,
  forkLogCap: 4,
  starWeight: 0.75,
  forkWeight: 0.25,
} as const;

export const freshnessScoreConfig = {
  createdWeight: 0.35,
  updatedWeight: 0.65,
} as const;

export const maintenancePenaltyConfig = {
  archived: 35,
  disabled: 45,
  highIssueLoad: 10,
  highIssueLoadOpenIssues: 200,
  highIssueLoadStars: 1000,
} as const;

export const scoreImpactThresholds = {
  activityPositive: 58,
  popularityPositive: 50,
  freshnessPositive: 55,
  maintenancePositive: 64,
} as const;

export const topicDensityConfig = {
  perTopicPoints: 14,
} as const;

export const insightLabelConfig = {
  worthRevisitingOverall: 80,
  stillActiveStars: 1000,
  stillActiveActivity: 70,
  deadButInterestingStars: 1000,
  deadButInterestingPushedDays: 730,
  smallPolishedStars: 250,
  smallPolishedMetadataQuality: 80,
} as const;

export const dayMs = 86_400_000;
export const yearDays = 365;
