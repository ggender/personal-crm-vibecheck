// Test helper: an in-memory Postgres (PGlite) with all migrations applied.
import { PGlite } from "@electric-sql/pglite";
import { sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import type { Db } from "./client";
import { MIGRATIONS_FOLDER } from "./run-migrations";
import * as schema from "./schema";

export type TestDb = Db & { $client: PGlite };

// Booting PGlite takes ~1 s, cloning a migrated one ~0.15 s, emptying its
// tables ~5 ms: migrate once per test file, clone once per database a file
// needs, and clear the tables between the tests that share one.
let migrated: Promise<PGlite> | undefined;

function migratedTemplate(): Promise<PGlite> {
  migrated ??= (async () => {
    const client = new PGlite();
    await migrate(drizzle({ client }), { migrationsFolder: MIGRATIONS_FOLDER });
    return client;
  })();
  return migrated;
}

// A migrated database of its own. Close it with db.$client.close().
export async function createTestDb(): Promise<TestDb> {
  const template = await migratedTemplate();
  // clone() is typed as the PGlite interface but returns a PGlite.
  const client = (await template.clone()) as PGlite;
  return drizzle({ client, schema });
}

// Every export of schema.ts is a table.
const tables: PgTable[] = Object.values(schema);

// Empties every table and restarts the ids, as in a database just migrated.
// Anything else a test did to the database (triggers, dropped schemas) stays.
export async function clearTestDb(db: Db): Promise<void> {
  await db.execute(
    sql`TRUNCATE ${sql.join(tables, sql`, `)} RESTART IDENTITY CASCADE`,
  );
}

// An account to own contacts in repository tests.
export async function createTestUser(db: Db, email: string): Promise<number> {
  const [{ id }] = await db
    .insert(schema.users)
    .values({ name: "", email, emailVerified: true })
    .returning({ id: schema.users.id });
  return id;
}
