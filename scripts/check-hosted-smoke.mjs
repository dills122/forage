const webOrigin = normalizeOrigin(process.env.FORAGE_WEB_ORIGIN ?? process.env.WEB_ORIGIN ?? "");
const workerOrigin = normalizeOrigin(
  process.env.FORAGE_WORKER_ORIGIN ??
    process.env.WORKER_ORIGIN ??
    process.env.PUBLIC_WORKER_ORIGIN ??
    "",
);
const untrustedOrigin = normalizeOrigin(
  process.env.FORAGE_UNTRUSTED_ORIGIN ?? "https://forage-smoke.invalid",
);

const failures = [];

if (!webOrigin || !workerOrigin) {
  console.error(`Missing hosted smoke origins.

Set:
  FORAGE_WEB_ORIGIN=https://forage.example.com
  FORAGE_WORKER_ORIGIN=https://api.forage.example.com

Optional:
  FORAGE_UNTRUSTED_ORIGIN=https://untrusted.example.com
`);
  process.exit(1);
}

const webIsHttps = webOrigin.startsWith("https://");
const workerIsHttps = workerOrigin.startsWith("https://");

const health = await fetchJson(`${workerOrigin}/api/health`, {
  label: "Worker health",
});
if (health.payload?.ok !== true) {
  failures.push("Worker health response is missing ok: true.");
}
if (health.payload?.privacy_boundary !== "no repository data stored server-side") {
  failures.push("Worker health response is missing the repository privacy boundary.");
}
assertHeader(health.response, "cache-control", /no-store/i, "Worker health");
assertHeader(health.response, "x-content-type-options", /^nosniff$/i, "Worker health");
assertHeader(health.response, "x-frame-options", /^DENY$/i, "Worker health");
assertHeader(
  health.response,
  "referrer-policy",
  /^strict-origin-when-cross-origin$/i,
  "Worker health",
);
assertHeader(health.response, "permissions-policy", /camera=\(\)/i, "Worker health");

const allowedConfig = await fetchJson(`${workerOrigin}/api/config`, {
  label: "Worker config with allowed origin",
  headers: {
    Origin: webOrigin,
  },
});
assertHeader(allowedConfig.response, "access-control-allow-origin", webOrigin, "Worker config");
assertHeader(
  allowedConfig.response,
  "access-control-allow-credentials",
  /^true$/i,
  "Worker config",
);
if (allowedConfig.payload?.stores_repository_data !== false) {
  failures.push("Worker config must report stores_repository_data: false.");
}
if (Object.hasOwn(allowedConfig.payload ?? {}, "has_github_client_secret")) {
  failures.push("Production Worker config exposes has_github_client_secret diagnostics.");
}

const rejectedConfig = await fetchJson(`${workerOrigin}/api/config`, {
  label: "Worker config with untrusted origin",
  headers: {
    Origin: untrustedOrigin,
  },
});
if (rejectedConfig.response.headers.has("access-control-allow-origin")) {
  failures.push("Worker config returned Access-Control-Allow-Origin for an untrusted origin.");
}

const preflight = await fetch(`${workerOrigin}/api/settings`, {
  method: "OPTIONS",
  headers: {
    Origin: webOrigin,
    "Access-Control-Request-Method": "PUT",
    "Access-Control-Request-Headers": "Content-Type,X-Forage-CSRF",
  },
});
if (preflight.status !== 204) {
  failures.push(`Worker settings preflight returned ${preflight.status}; expected 204.`);
}
assertHeader(preflight, "access-control-allow-origin", webOrigin, "Worker settings preflight");
assertHeader(
  preflight,
  "access-control-allow-headers",
  /x-forage-csrf/i,
  "Worker settings preflight",
);

const webResponse = await fetch(webOrigin);
if (!webResponse.ok) {
  failures.push(`Web app returned ${webResponse.status}; expected 2xx.`);
}
const webHtml = await webResponse.text();
if (!webHtml.includes('id="forage-app"')) {
  failures.push("Web app HTML is missing the Forage app root.");
}
if (!webHtml.includes("Starred repos, ready to sort through.")) {
  failures.push("Web app HTML is missing the expected heading.");
}
if (!webHtml.includes(`connect-src 'self' ${workerOrigin}`)) {
  failures.push("Web app CSP meta tag does not include the configured Worker origin.");
}
assertHeader(webResponse, "x-content-type-options", /^nosniff$/i, "Web app");
assertHeader(webResponse, "x-frame-options", /^DENY$/i, "Web app");
assertHeader(webResponse, "referrer-policy", /^strict-origin-when-cross-origin$/i, "Web app");
assertHeader(webResponse, "permissions-policy", /camera=\(\)/i, "Web app");
assertHeader(webResponse, "content-security-policy", /frame-ancestors 'none'/i, "Web app");

if (webIsHttps) {
  assertHeader(webResponse, "strict-transport-security", /max-age=/i, "Web app");
}
if (workerIsHttps) {
  assertHeader(health.response, "strict-transport-security", /max-age=/i, "Worker health", {
    optional: true,
  });
}

if (failures.length > 0) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Hosted smoke checks passed.");

async function fetchJson(url, { label, headers = {} }) {
  const response = await fetch(url, { headers });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    failures.push(`${label} returned ${response.status}; expected 2xx.`);
  }
  if (!payload || typeof payload !== "object") {
    failures.push(`${label} did not return a JSON object.`);
  }
  return { response, payload };
}

function assertHeader(response, name, expected, label, { optional = false } = {}) {
  const actual = response.headers.get(name);
  if (!actual) {
    if (!optional) failures.push(`${label} is missing ${name}.`);
    return;
  }

  if (typeof expected === "string" && actual !== expected) {
    failures.push(`${label} ${name} was ${actual}; expected ${expected}.`);
    return;
  }

  if (expected instanceof RegExp && !expected.test(actual)) {
    failures.push(`${label} ${name} was ${actual}; expected ${expected}.`);
  }
}

function normalizeOrigin(origin) {
  return origin.trim().replace(/\/+$/, "");
}
