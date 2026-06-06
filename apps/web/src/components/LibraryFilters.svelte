<script lang="ts">
  import type { LibrarySortMode } from "../lib/library";

  interface Props {
    searchQuery: string;
    languageFilter: string;
    categoryFilter: string;
    sortMode: LibrarySortMode;
    languages: string[];
    categories: string[];
  }

  let {
    searchQuery = $bindable(),
    languageFilter = $bindable(),
    categoryFilter = $bindable(),
    sortMode = $bindable(),
    languages,
    categories,
  }: Props = $props();
</script>

<div class="library-controls" aria-label="Library controls">
  <label>
    <span>Search</span>
    <input
      id="library-search"
      type="search"
      placeholder="Repo, topic, description"
      bind:value={searchQuery}
    />
  </label>
  <label>
    <span>Language</span>
    <select id="language-filter" bind:value={languageFilter}>
      <option value="">All languages</option>
      {#each languages as language}
        <option value={language}>{language}</option>
      {/each}
    </select>
  </label>
  <label>
    <span>Category</span>
    <select id="category-filter" bind:value={categoryFilter}>
      <option value="">All categories</option>
      {#each categories as category}
        <option value={category}>{category}</option>
      {/each}
    </select>
  </label>
  <label>
    <span>Sort</span>
    <select id="library-sort" bind:value={sortMode}>
      <option value="starred_at_desc">Recently starred</option>
      <option value="score_desc">Highest score</option>
      <option value="stars_desc">Most stars</option>
      <option value="name_asc">Name</option>
    </select>
  </label>
</div>
