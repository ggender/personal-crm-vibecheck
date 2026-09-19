// The scenarios' own database (playwright.config.ts); `npm run db:reset`
// rebuilds it on every run, so the database `crm` stays untouched.
export const E2E_DATABASE_URL = "postgres://postgres@localhost:5433/crm_e2e";
