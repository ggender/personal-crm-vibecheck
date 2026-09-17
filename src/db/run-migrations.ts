import path from "node:path";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import type { Db } from "./client";

// Used by scripts and tests only; the app never migrates on its own.
export function runMigrations(db: Db): void {
  migrate(db, {
    migrationsFolder: path.join(process.cwd(), "src/db/migrations"),
  });
}
