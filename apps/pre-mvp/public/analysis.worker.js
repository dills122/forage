const categoryRules = [
  {
    id: "frontend",
    labels: ["Frontend"],
    languages: ["JavaScript", "TypeScript", "CSS", "HTML", "Svelte", "Vue"],
    keywords: ["react", "vue", "svelte", "frontend", "ui", "css", "component"],
  },
  {
    id: "backend",
    labels: ["Backend"],
    languages: ["Go", "Rust", "Java", "C#", "PHP", "Ruby", "Python"],
    keywords: ["api", "server", "backend", "database", "queue", "worker"],
  },
  {
    id: "devops",
    labels: ["DevOps"],
    languages: ["Go", "Shell", "HCL"],
    keywords: ["docker", "kubernetes", "terraform", "ci", "deploy", "observability"],
  },
  {
    id: "developer-tooling",
    labels: ["Developer Tooling"],
    languages: ["TypeScript", "Go", "Rust"],
    keywords: ["cli", "lint", "format", "build", "automation", "validation"],
  },
  {
    id: "data",
    labels: ["Data"],
    languages: ["Python", "R", "SQL", "Jupyter Notebook"],
    keywords: ["data", "analytics", "machine learning", "notebook", "pipeline"],
  },
  {
    id: "testing",
    labels: ["Testing"],
    languages: [],
    keywords: ["test", "testing", "mock", "fixture", "assertion", "e2e"],
  },
  {
    id: "security",
    labels: ["Security"],
    languages: ["Rust", "Go", "Python"],
    keywords: ["security", "auth", "oauth", "crypto", "vulnerability", "secret"],
  },
  {
    id: "learning",
    labels: ["Learning Resources"],
    languages: [],
    keywords: ["awesome", "examples", "tutorial", "guide", "course", "book"],
  },
];

function daysSince(value) {
  if (!value) return 9999;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 9999;
  return Math.max(0, (Date.now() - timestamp) / 86_400_000);
}

function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function scoreRepository(repo) {
  const pushedDays = daysSince(repo.pushed_at);
  const updatedDays = daysSince(repo.updated_at);
  const stars = Number(repo.stars || 0);
  const forks = Number(repo.forks || 0);
  const openIssues = Number(repo.open_issues || 0);

  const freshness = clamp(100 - pushedDays / 7);
  const activity = clamp(100 - updatedDays / 10);
  const popularity = clamp(Math.log10(stars + 1) * 22 + Math.log10(forks + 1) * 8);
  const issuePenalty = clamp(openIssues / 10, 0, 25);
  const archivePenalty = repo.archived || repo.disabled ? 35 : 0;
  const maintenance = clamp((freshness + activity) / 2 - issuePenalty - archivePenalty);
  const overall = clamp(freshness * 0.3 + activity * 0.25 + popularity * 0.25 + maintenance * 0.2);

  return {
    overall: Math.round(overall),
    freshness: Math.round(freshness),
    activity: Math.round(activity),
    popularity: Math.round(popularity),
    maintenance: Math.round(maintenance),
    version: "pre-mvp-0",
  };
}

function categorize(repo) {
  const text = [
    repo.full_name,
    repo.description,
    repo.primary_language,
    ...(repo.topics || []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const matches = [];

  for (const rule of categoryRules) {
    let score = 0;
    if (rule.languages.includes(repo.primary_language)) score += 2;
    for (const keyword of rule.keywords) {
      if (text.includes(keyword.toLowerCase())) score += 1;
    }
    if (score >= 2) {
      matches.push({ id: rule.id, label: rule.labels[0], confidence: score });
    }
  }

  if (repo.primary_language) {
    matches.unshift({
      id: `language:${repo.primary_language}`,
      label: repo.primary_language,
      confidence: 3,
    });
  }

  return matches.slice(0, 5);
}

self.onmessage = (event) => {
  const repositories = event.data.repositories || [];
  const analyzed = repositories.map((repo) => ({
    ...repo,
    categories: categorize(repo),
    scores: scoreRepository(repo),
  }));

  self.postMessage({
    analyzed,
    summary: {
      total: analyzed.length,
      categories: new Set(analyzed.flatMap((repo) => repo.categories.map((item) => item.id))).size,
      languages: new Set(analyzed.map((repo) => repo.primary_language).filter(Boolean)).size,
    },
  });
};
