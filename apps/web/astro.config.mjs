import { fileURLToPath } from "node:url";
import svelte from "@astrojs/svelte";
import { defineConfig } from "astro/config";

const workerOrigin = process.env.PUBLIC_WORKER_ORIGIN ?? "http://127.0.0.1:8787";

export default defineConfig({
  output: "static",
  integrations: [svelte()],
  markdown: {
    syntaxHighlight: false,
  },
  security: {
    csp: {
      directives: [
        "default-src 'self'",
        `connect-src 'self' ${workerOrigin}`,
        "img-src 'self' data:",
        "font-src 'self'",
        "object-src 'none'",
        "base-uri 'none'",
        "form-action 'self' https://github.com",
      ],
    },
  },
  vite: {
    resolve: {
      alias: {
        "@forage/analysis": fileURLToPath(
          new URL("../../packages/analysis/src/index.ts", import.meta.url),
        ),
        "@forage/core": fileURLToPath(new URL("../../packages/core/src/index.ts", import.meta.url)),
        "@forage/reporting": fileURLToPath(
          new URL("../../packages/reporting/src/index.ts", import.meta.url),
        ),
        "@forage/shared": fileURLToPath(
          new URL("../../packages/shared/src/index.ts", import.meta.url),
        ),
      },
    },
  },
});
