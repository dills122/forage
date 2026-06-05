export interface GitHubImportPlan {
  auth: "github-app-user";
  source: "authenticated-starred-repositories";
  per_page: 100;
}

export const githubImportPlan: GitHubImportPlan = {
  auth: "github-app-user",
  source: "authenticated-starred-repositories",
  per_page: 100,
};
