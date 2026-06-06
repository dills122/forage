<script lang="ts">
  import type { ForageRepository, RepositoryAnalysis } from "@forage/shared";
  import { getRepositoryAnalysis } from "../lib/library";

  interface Props {
    repositoryCount: number;
    filteredRepositories: ForageRepository[];
    visibleRepositories: ForageRepository[];
    analysisByRepositoryId: Map<number, RepositoryAnalysis>;
  }

  let {
    repositoryCount,
    filteredRepositories,
    visibleRepositories,
    analysisByRepositoryId,
  }: Props = $props();

  function formatDate(value: string) {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }).format(new Date(value));
  }
</script>

{#if repositoryCount === 0}
  <div id="library-empty" class="empty-state">
    Connect GitHub and import stars to build the local library.
  </div>
{:else if filteredRepositories.length === 0}
  <div id="library-empty" class="empty-state">No repositories match the current filters.</div>
{/if}
<div id="repo-list" class="repo-list" aria-live="polite">
  {#each visibleRepositories as repository (repository.github_id)}
    {@const analysis = getRepositoryAnalysis(repository, analysisByRepositoryId)}
    <article class="repo-row">
      <div class="repo-main">
        <a href={repository.url} target="_blank" rel="noreferrer" class="repo-title">
          {repository.full_name}
        </a>
        <p class="repo-description">{repository.description || "No description provided."}</p>
        <div class="topic-row">
          {#each repository.topics.slice(0, 4) as topicName}
            <span class="topic">{topicName}</span>
          {/each}
        </div>
      </div>

      <div class="repo-meta">
        <span class="meta-value">
          <strong>{analysis.scores.overall.value}</strong>
          <small>Score</small>
        </span>
        <span class="meta-value">
          <strong>{repository.primary_language || "Unknown"}</strong>
          <small>Language</small>
        </span>
        <span class="meta-value">
          <strong>{repository.stars.toLocaleString()}</strong>
          <small>Stars</small>
        </span>
        <span class="meta-value">
          <strong>{formatDate(repository.starred_at)}</strong>
          <small>Starred</small>
        </span>
      </div>

      <div class="category-row">
        {#each analysis.categories.slice(0, 3) as categoryMatch}
          <span class="category">{categoryMatch.label}</span>
        {/each}
      </div>
    </article>
  {/each}
</div>
