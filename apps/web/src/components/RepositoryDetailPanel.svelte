<script lang="ts">
  import type { ForageRepository, RepositoryAnalysis } from "@forage/shared";
  import { ExternalLink } from "@lucide/svelte";
  import {
    formatCategoryReason,
    formatScoreExplanation,
    getFoundationalScoreBreakdown,
    getRepositoryFlags,
    getRepositoryMetadata,
    getSupportingScoreBreakdown,
    getTopCategoryMatches,
  } from "../lib/repository-detail";

  interface Props {
    repository: ForageRepository | null;
    analysis: RepositoryAnalysis | null;
  }

  let { repository, analysis }: Props = $props();
</script>

<section id="repository-detail" class="repository-detail" aria-live="polite">
  {#if repository && analysis}
    {@const foundationalScores = getFoundationalScoreBreakdown(analysis)}
    {@const supportingScores = getSupportingScoreBreakdown(analysis)}
    {@const categoryMatches = getTopCategoryMatches(analysis)}
    {@const flags = getRepositoryFlags(repository)}
    <div class="repository-detail-header">
      <div>
        <p class="section-kicker">Repository detail</p>
        <h2>{repository.full_name}</h2>
        <p class="repo-description">{repository.description || "No description provided."}</p>
      </div>
      <a class="button secondary detail-link" href={repository.url} target="_blank" rel="noreferrer">
        <ExternalLink size={16} aria-hidden="true" />
        GitHub
      </a>
    </div>

    <div class="detail-score-row">
      <div class="overall-score">
        <span class="metric-label">Overall score</span>
        <strong>{analysis.scores.overall.value}</strong>
        <p>{analysis.scores.overall.explanations.map(formatScoreExplanation).join(" ")}</p>
      </div>
      <div class="detail-chip-row" aria-label="Repository labels and state">
        {#each analysis.labels as insightLabel}
          <span class="category">{insightLabel.label}</span>
        {/each}
        {#each flags as flag}
          <span class="topic">{flag}</span>
        {/each}
        {#if analysis.labels.length === 0 && flags.length === 0}
          <span class="topic">No special labels</span>
        {/if}
      </div>
    </div>

    <div class="score-breakdown-grid" aria-label="Foundational score breakdown">
      {#each foundationalScores as score}
        <article class="score-breakdown-item">
          <div>
            <strong>{score.label}</strong>
            <span>{score.weight} weight</span>
          </div>
          <b>{score.value}</b>
          <p>{score.explanations.map(formatScoreExplanation).join(" ")}</p>
        </article>
      {/each}
    </div>

    <div class="detail-columns">
      <section>
        <h3>Category matches</h3>
        {#if categoryMatches.length > 0}
          <div class="category-match-list">
            {#each categoryMatches as categoryMatch}
              <article class="category-match">
                <div>
                  <strong>{categoryMatch.label}</strong>
                  <span>{categoryMatch.confidence}% confidence</span>
                </div>
                <p>
                  {categoryMatch.reasons.map(formatCategoryReason).join(", ")}
                </p>
              </article>
            {/each}
          </div>
        {:else}
          <p class="detail-muted">No category rules matched this repository.</p>
        {/if}
      </section>

      <section>
        <h3>Supporting signals</h3>
        <div class="supporting-score-list">
          {#each supportingScores as score}
            <div>
              <span>{score.label}</span>
              <strong>{score.value}</strong>
            </div>
          {/each}
        </div>

        <h3>Repository metadata</h3>
        <dl class="detail-list compact">
          {#each getRepositoryMetadata(repository) as [label, value]}
            <dt>{label}</dt>
            <dd>{value}</dd>
          {/each}
        </dl>
      </section>
    </div>
  {:else}
    <div class="empty-state">Select a repository to inspect its score and category signals.</div>
  {/if}
</section>
