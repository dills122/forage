import assert from "node:assert/strict";
import test from "node:test";
import { fetchStarredRepositoriesPage, GitHubApiError } from "../src/index.ts";

const apiVersion = "2022-11-28";

function createStarredPayload(overrides = {}) {
  return {
    starred_at: "2026-06-05T12:00:00.000Z",
    repo: {
      id: 123,
      node_id: "node-123",
      name: "demo",
      owner: {
        login: "forage",
        avatar_url: "https://example.com/avatar.png",
      },
      full_name: "forage/demo",
      html_url: "https://github.com/forage/demo",
      description: "Demo repository",
      homepage: "",
      topics: ["github-api", "import"],
      language: "TypeScript",
      license: {
        spdx_id: "MIT",
        key: "mit",
      },
      stargazers_count: 42,
      forks_count: 7,
      watchers_count: 5,
      open_issues_count: 2,
      archived: false,
      disabled: false,
      fork: false,
      private: false,
      default_branch: "main",
      created_at: "2025-01-01T00:00:00.000Z",
      updated_at: "2026-05-01T00:00:00.000Z",
      pushed_at: "2026-05-15T00:00:00.000Z",
      ...overrides,
    },
  };
}

function jsonResponse(body, init = {}) {
  const { headers: extraHeaders, ...responseInit } = init;
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "x-ratelimit-limit": "5000",
      "x-ratelimit-remaining": "4999",
      "x-ratelimit-reset": "1780000000",
      "x-ratelimit-used": "1",
      "x-ratelimit-resource": "core",
      ...extraHeaders,
    },
    ...responseInit,
  });
}

function textResponse(body, init = {}) {
  return new Response(body, {
    status: 200,
    headers: {
      "x-ratelimit-limit": "5000",
      ...init.headers,
    },
    ...init,
  });
}

test("fetches starred repositories with bounded page size and required headers", async () => {
  let requestedUrl;
  let requestedHeaders;
  const result = await fetchStarredRepositoriesPage({
    accessToken: "token",
    apiVersion,
    page: 3,
    perPage: 250,
    fetcher: async (url, init) => {
      requestedUrl = url;
      requestedHeaders = new Headers(init.headers);
      return jsonResponse([createStarredPayload()]);
    },
  });

  assert.equal(requestedUrl.searchParams.get("page"), "3");
  assert.equal(requestedUrl.searchParams.get("per_page"), "100");
  assert.equal(requestedUrl.searchParams.get("sort"), "created");
  assert.equal(requestedUrl.searchParams.get("direction"), "desc");
  assert.equal(requestedHeaders.get("accept"), "application/vnd.github.star+json");
  assert.equal(requestedHeaders.get("authorization"), "Bearer token");
  assert.equal(requestedHeaders.get("x-github-api-version"), apiVersion);
  assert.equal(result.repositories[0].full_name, "forage/demo");
  assert.equal(result.repositories[0].source_api_version, apiVersion);
});

test("parses pagination and rate limit response metadata", async () => {
  const result = await fetchStarredRepositoriesPage({
    accessToken: "token",
    apiVersion,
    fetcher: async () =>
      jsonResponse([createStarredPayload()], {
        headers: {
          link: '<https://api.github.com/user/starred?page=2>; rel="next"',
        },
      }),
  });

  assert.equal(result.nextPage, 2);
  assert.deepEqual(result.rateLimit, {
    limit: "5000",
    remaining: "4999",
    reset: "1780000000",
    used: "1",
    resource: "core",
  });
  assert.ok(result.rawFieldNames.includes("full_name"));
  assert.ok(result.rawFieldNames.includes("starred_at"));
});

test("handles non-array and invalid JSON success responses as empty pages", async () => {
  const objectResult = await fetchStarredRepositoriesPage({
    accessToken: "token",
    apiVersion,
    fetcher: async () => jsonResponse({ message: "not an array" }),
  });
  const textResult = await fetchStarredRepositoriesPage({
    accessToken: "token",
    apiVersion,
    fetcher: async () => textResponse("not-json"),
  });

  assert.equal(objectResult.nextPage, null);
  assert.deepEqual(objectResult.repositories, []);
  assert.equal(textResult.nextPage, null);
  assert.deepEqual(textResult.repositories, []);
});

test("normalizes optional repository fields with stable defaults", async () => {
  const result = await fetchStarredRepositoriesPage({
    accessToken: "token",
    apiVersion,
    fetcher: async () =>
      jsonResponse([
        createStarredPayload({
          homepage: null,
          topics: undefined,
          language: null,
          license: null,
          stargazers_count: undefined,
          forks_count: undefined,
          watchers_count: undefined,
          open_issues_count: undefined,
          archived: undefined,
          disabled: undefined,
          fork: undefined,
          private: undefined,
          default_branch: undefined,
          pushed_at: null,
        }),
      ]),
  });

  const repository = result.repositories[0];
  assert.equal(repository.homepage, null);
  assert.deepEqual(repository.topics, []);
  assert.equal(repository.primary_language, null);
  assert.equal(repository.license, null);
  assert.equal(repository.stars, 0);
  assert.equal(repository.forks, 0);
  assert.equal(repository.watchers, 0);
  assert.equal(repository.open_issues, 0);
  assert.equal(repository.archived, false);
  assert.equal(repository.disabled, false);
  assert.equal(repository.fork, false);
  assert.equal(repository.private, false);
  assert.equal(repository.default_branch, "");
  assert.equal(repository.pushed_at, null);
});

test("skips malformed starred items without failing the page", async () => {
  const result = await fetchStarredRepositoriesPage({
    accessToken: "token",
    apiVersion,
    fetcher: async () =>
      jsonResponse([
        { starred_at: "2026-06-05T12:00:00.000Z", repo: { id: 1 } },
        createStarredPayload({ id: 2, full_name: "forage/valid" }),
      ]),
  });

  assert.equal(result.repositories.length, 1);
  assert.equal(result.repositories[0].full_name, "forage/valid");
});

test("throws GitHubApiError with API message and rate limit metadata", async () => {
  await assert.rejects(
    fetchStarredRepositoriesPage({
      accessToken: "token",
      apiVersion,
      fetcher: async () =>
        jsonResponse(
          { message: "rate limited" },
          {
            status: 403,
            headers: {
              "x-ratelimit-remaining": "0",
            },
          },
        ),
    }),
    (error) => {
      assert.ok(error instanceof GitHubApiError);
      assert.equal(error.message, "rate limited");
      assert.equal(error.status, 403);
      assert.equal(error.rateLimit.remaining, "0");
      return true;
    },
  );
});

test("uses fallback API error message when GitHub omits one", async () => {
  await assert.rejects(
    fetchStarredRepositoriesPage({
      accessToken: "token",
      apiVersion,
      fetcher: async () => jsonResponse({}, { status: 500 }),
    }),
    (error) => {
      assert.ok(error instanceof GitHubApiError);
      assert.equal(error.message, "GitHub starred import failed with 500");
      assert.equal(error.status, 500);
      return true;
    },
  );
});
