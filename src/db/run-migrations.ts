import path from "node:path";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import type { ServerDb } from "./client";

// Also used by test-db.ts, which applies the same migrations to PGlite.
export const MIGRATIONS_FOLDER = path.join(process.cwd(), "src/db/migrations");

// Used by scripts only; the app never migrates on its own.
export async function runMigrations(db: ServerDb): Promise<void> {
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}
