import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    env: { LOG_LEVEL: "silent" },
    // Every test file with a database boots its own PGlite, all at the same
    // time; under that load the first test of a file waits for it.
    testTimeout: 15_000,
    include: ["src/**/*.test.ts"],
  },
});
