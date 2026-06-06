<script lang="ts">
  interface Props {
    repositoryCount: number;
    topLanguage: string;
    latestImport: string;
    user: string;
    authenticated: boolean;
  }

  let { repositoryCount, topLanguage, latestImport, user, authenticated }: Props = $props();
</script>

<section class="metric-grid" aria-label="Library status">
  <article class="metric-panel">
    <span class="metric-label">Stored repos</span>
    <strong id="repository-count">{repositoryCount}</strong>
  </article>
  <article class="metric-panel">
    <span class="metric-label">Top language</span>
    <strong id="top-language">{topLanguage}</strong>
  </article>
  <article class="metric-panel">
    <span class="metric-label">Latest import</span>
    <strong id="latest-import">{latestImport}</strong>
  </article>
  <article class="metric-panel">
    <span class="metric-label">GitHub user</span>
    <strong id="github-user" class:muted-value={!authenticated}>{user}</strong>
  </article>
</section>
