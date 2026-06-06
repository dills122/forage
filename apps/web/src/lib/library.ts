import { analysisVersion, analyzeRepository } from "@forage/analysis";
import type { ForageRepository, RepositoryAnalysis } from "@forage/shared";

export type LibrarySortMode = "starred_at_desc" | "score_desc" | "stars_desc" | "name_asc";

export interface LibraryFilters {
  searchQuery: string;
  languageFilter: string;
  categoryFilter: string;
  sortMode: LibrarySortMode;
}

export function sortRepositoriesByStarredAt(repositories: ForageRepository[]) {
  return [...repositories].sort((left, right) => right.starred_at.localeCompare(left.starred_at));
}

export function filterRepositories(
  repositories: ForageRepository[],
  filters: LibraryFilters,
  analysisByRepositoryId: Map<number, RepositoryAnalysis>,
) {
  const query = filters.searchQuery.trim().toLowerCase();
  return sortVisibleRepositories(
    repositories.filter((repository) => {
      const analysis = getRepositoryAnalysis(repository, analysisByRepositoryId);
      const language = getRepositoryLanguage(repository);
      const categoryLabels = analysis.categories.map((category) => category.label);
      const searchableText = [
        repository.full_name,
        repository.description ?? "",
        language,
        ...repository.topics,
        ...categoryLabels,
      ]
        .join(" ")
        .toLowerCase();

      return (
        (!query || searchableText.includes(query)) &&
        (!filters.languageFilter || language === filters.languageFilter) &&
        (!filters.categoryFilter || categoryLabels.includes(filters.categoryFilter))
      );
    }),
    filters.sortMode,
    analysisByRepositoryId,
  );
}

export function sortVisibleRepositories(
  repositories: ForageRepository[],
  sortMode: LibrarySortMode,
  analysisByRepositoryId: Map<number, RepositoryAnalysis>,
) {
  return [...repositories].sort((left, right) => {
    if (sortMode === "score_desc") {
      return (
        getRepositoryAnalysis(right, analysisByRepositoryId).scores.overall.value -
        getRepositoryAnalysis(left, analysisByRepositoryId).scores.overall.value
      );
    }
    if (sortMode === "stars_desc") return right.stars - left.stars;
    if (sortMode === "name_asc") return left.full_name.localeCompare(right.full_name);
    return right.starred_at.localeCompare(left.starred_at);
  });
}

export function getRepositoryAnalysis(
  repository: ForageRepository,
  analysisByRepositoryId: Map<number, RepositoryAnalysis>,
) {
  return analysisByRepositoryId.get(repository.github_id) ?? analyzeRepository(repository);
}

export function createCurrentAnalysisMap(results: RepositoryAnalysis[]) {
  return new Map(
    results
      .filter((result) => result.analysis_version === analysisVersion)
      .map((result) => [result.repository_id, result]),
  );
}

export function getTopLanguage(repositories: ForageRepository[]) {
  const counts = new Map<string, number>();
  for (const repository of repositories) {
    const language = getRepositoryLanguage(repository);
    counts.set(language, (counts.get(language) ?? 0) + 1);
  }

  const [language, count] =
    [...counts.entries()].sort((left, right) => right[1] - left[1])[0] ?? [];
  return language && count ? `${language} (${count})` : "-";
}

export function getLanguageOptions(repositories: ForageRepository[]) {
  return [...new Set(repositories.map(getRepositoryLanguage))].sort();
}

export function getCategoryOptions(
  repositories: ForageRepository[],
  analysisByRepositoryId: Map<number, RepositoryAnalysis>,
) {
  return [
    ...new Set(
      repositories.flatMap((repository) =>
        getRepositoryAnalysis(repository, analysisByRepositoryId).categories.map(
          (category) => category.label,
        ),
      ),
    ),
  ].sort();
}

export function getLibrarySummary(
  repositoryCount: number,
  visibleCount: number,
  matchedCount: number,
) {
  if (repositoryCount === 0) return "No repositories stored";
  return `${visibleCount} shown of ${matchedCount} matched`;
}

function getRepositoryLanguage(repository: ForageRepository) {
  return repository.primary_language || "Unknown";
}
