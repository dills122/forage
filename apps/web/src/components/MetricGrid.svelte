<script lang="ts">
  interface Props {
    repositoryCount: number;
    topLanguage: string;
    latestImport: string;
    user: string;
    authenticated: boolean;
  }

  let { repositoryCount, topLanguage, latestImport, user, authenticated }: Props = $props();

  const emptyMetric = { value: "-", detail: "No data yet" };

  function parseCountMetric(metric: string, singularLabel: string, pluralLabel: string) {
    const match = /^(?<value>.+?)\s+\((?<count>[0-9,]+)\)$/.exec(metric);
    if (!match?.groups) return metric === "-" ? emptyMetric : { value: metric, detail: "Most common" };

    const count = match.groups.count;
    const numericCount = Number.parseInt(count.replaceAll(",", ""), 10);
    const unit = numericCount === 1 ? singularLabel : pluralLabel;
    return {
      value: match.groups.value,
      detail: `${count} ${unit}`,
    };
  }

  function parseImportMetric(metric: string) {
    const match = /^(?<status>.+?)\s+\((?<count>[0-9,]+)\)$/.exec(metric);
    if (!match?.groups) return metric === "-" ? emptyMetric : { value: metric, detail: "Last import run" };

    return {
      value: toTitleCase(match.groups.status),
      detail: `${match.groups.count} repos imported`,
    };
  }

  function getUserMetric() {
    if (user === "-") return { value: "-", detail: "No GitHub session" };
    return {
      value: user.replace(" (not connected)", ""),
      detail: authenticated ? "Connected account" : "Local library owner",
    };
  }

  function toTitleCase(value: string) {
    return value.charAt(0).toUpperCase() + value.slice(1);
  }

  let topLanguageMetric = $derived(parseCountMetric(topLanguage, "repo", "repos"));
  let latestImportMetric = $derived(parseImportMetric(latestImport));
  let userMetric = $derived(getUserMetric());
</script>

<section class="metric-grid" aria-label="Library status">
  <article class="metric-panel">
    <span class="metric-label">Stored repos</span>
    <strong id="repository-count" class="metric-value">{repositoryCount.toLocaleString()}</strong>
    <span class="metric-detail">Browser-local records</span>
  </article>
  <article class="metric-panel">
    <span class="metric-label">Top language</span>
    <strong id="top-language" class="metric-value">{topLanguageMetric.value}</strong>
    <span class="metric-detail">{topLanguageMetric.detail}</span>
  </article>
  <article class="metric-panel">
    <span class="metric-label">Latest import</span>
    <strong id="latest-import" class="metric-value">{latestImportMetric.value}</strong>
    <span class="metric-detail">{latestImportMetric.detail}</span>
  </article>
  <article class="metric-panel">
    <span class="metric-label">GitHub user</span>
    <strong id="github-user" class="metric-value" class:muted-value={!authenticated}>{userMetric.value}</strong>
    <span class="metric-detail">{userMetric.detail}</span>
  </article>
</section>
