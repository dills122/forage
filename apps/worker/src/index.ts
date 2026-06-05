interface Env {
  GITHUB_CLIENT_ID?: string;
  GITHUB_REDIRECT_URI?: string;
}

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

function json(payload: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(payload, null, 2), {
    ...init,
    headers: {
      ...jsonHeaders,
      ...init.headers,
    },
  });
}

function notFound() {
  return json({ error: "Not found" }, { status: 404 });
}

function route(request: Request, env: Env) {
  const url = new URL(request.url);

  if (url.pathname === "/health") {
    return json({
      ok: true,
      service: "forage-worker",
      privacy_boundary: "no repository data stored server-side",
    });
  }

  if (url.pathname === "/api/health") {
    return json({
      ok: true,
      service: "forage-worker",
      privacy_boundary: "no repository data stored server-side",
    });
  }

  if (url.pathname === "/api/config") {
    return json({
      auth_type: "github-app-user-authorization",
      has_github_client_id: Boolean(env.GITHUB_CLIENT_ID),
      redirect_uri: env.GITHUB_REDIRECT_URI ?? "/auth/github/callback",
      stores_repository_data: false,
    });
  }

  return notFound();
}

export default {
  fetch(request, env) {
    return route(request, env);
  },
} satisfies ExportedHandler<Env>;
