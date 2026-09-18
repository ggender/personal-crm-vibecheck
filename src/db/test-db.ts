// Test helper: a fresh in-memory Postgres (PGlite) with all migrations applied.
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Db } from "./client";
import { MIGRATIONS_FOLDER } from "./run-migrations";
import * as schema from "./schema";

export type TestDb = Db & { $client: PGlite };

// Migrating takes ~0.7 s, copying a migrated database ~0.15 s:
// migrate once per test file and give every test its own copy.
let migrated: Promise<PGlite> | undefined;

function migratedTemplate(): Promise<PGlite> {
  migrated ??= (async () => {
    const client = new PGlite();
    await migrate(drizzle({ client }), { migrationsFolder: MIGRATIONS_FOLDER });
    return client;
  })();
  return migrated;
}

// Close it with db.$client.close() when the test is done.
export async function createTestDb(): Promise<TestDb> {
  const template = await migratedTemplate();
  // clone() is typed as the PGlite interface but returns a PGlite.
  const client = (await template.clone()) as PGlite;
  return drizzle({ client, schema });
}
