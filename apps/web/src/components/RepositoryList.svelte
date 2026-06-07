<script lang="ts">
  import type { ForageRepository, RepositoryAnalysis } from "@forage/shared";
  import { Info } from "@lucide/svelte";
  import { getRepositoryAnalysis } from "../lib/library";

  interface Props {
    repositoryCount: number;
    filteredRepositories: ForageRepository[];
    visibleRepositories: ForageRepository[];
    analysisByRepositoryId: Map<number, RepositoryAnalysis>;
    selectedRepositoryId: number | null;
    onSelectRepository: (repositoryId: number) => void;
  }

  let {
    repositoryCount,
    filteredRepositories,
    visibleRepositories,
    analysisByRepositoryId,
    selectedRepositoryId,
    onSelectRepository,
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
    {@const selected = selectedRepositoryId === repository.github_id}
    <article
      class="repo-row"
      class:selected
      aria-current={selected ? "true" : undefined}
      data-repository-id={repository.github_id}
    >
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

      <div class="repo-footer">
        <div class="category-row">
          {#each analysis.categories.slice(0, 3) as categoryMatch}
            <span class="category">{categoryMatch.label}</span>
          {/each}
        </div>
        <button
          class="repo-detail-button"
          type="button"
          data-repository-detail-button={repository.github_id}
          aria-pressed={String(selected)}
          onclick={() => onSelectRepository(repository.github_id)}
        >
          <Info size={14} aria-hidden="true" />
          {selected ? "Selected" : "Details"}
        </button>
      </div>
    </article>
  {/each}
</div>
