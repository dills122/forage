import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";

export default defineConfig({
  output: "static",
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
