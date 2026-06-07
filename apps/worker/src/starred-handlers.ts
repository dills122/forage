import { fetchStarredRepositoriesPage, GitHubApiError } from "@forage/github";
import { githubApiVersion } from "./env";
import { json } from "./http";
import { getSessionLookup } from "./request-session";
import type { Env } from "./types";

export async function fetchStarred(request: Request, env: Env) {
  const lookup = await getSessionLookup(request, env);
  if (!lookup.session) {
    return json(request, env, { error: "Not authenticated" }, { status: 401 });
  }

  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") || 1);
  const perPage = Number(url.searchParams.get("per_page") || 100);

  try {
    const pageResult = await fetchStarredRepositoriesPage({
      accessToken: lookup.session.accessToken,
      apiVersion: githubApiVersion(env),
      page,
      perPage,
      fetcher: fetch,
    });

    return json(request, env, {
      page: pageResult.page,
      next_page: pageResult.nextPage,
      repositories: pageResult.repositories,
      rate_limit: pageResult.rateLimit,
      raw_field_names: pageResult.rawFieldNames,
    });
  } catch (error) {
    if (error instanceof GitHubApiError) {
      return json(
        request,
        env,
        { error: error.message, rate_limit: error.rateLimit },
        { status: error.status },
      );
    }

    return json(
      request,
      env,
      { error: error instanceof Error ? error.message : "GitHub starred import failed" },
      { status: 502 },
    );
  }
}
