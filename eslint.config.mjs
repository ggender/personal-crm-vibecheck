import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

// Only the data layer and database scripts may talk to the database.
const databaseImports = {
  paths: [
    {
      name: "pg",
      message: "Only src/db/ and features/*/data/ may use the database.",
    },
    {
      name: "@electric-sql/pglite",
      message: "Only src/db/ and features/*/data/ may use the database.",
    },
  ],
  patterns: [
    {
      group: [
        "@/db/*",
        "**/db/client",
        "**/db/schema",
        "drizzle-orm",
        "drizzle-orm/*",
      ],
      message: "Only src/db/ and features/*/data/ may use the database.",
    },
  ],
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/db/**", "src/features/*/data/**"],
    rules: {
      "no-restricted-imports": ["error", databaseImports],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Project files that are not app code:
    ".claude/**",
    "specs/**",
    "data/**",
  ]),
]);

export default eslintConfig;
