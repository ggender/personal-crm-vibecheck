import { max } from "drizzle-orm";
import { bigint, pgSchema } from "drizzle-orm/pg-core";
import { getDb, type Db } from "@/db/client";
import journal from "@/db/migrations/meta/_journal.json";

// drizzle-orm's own record of applied migrations; created_at is the `when`
// of the journal entry. Not in schema.ts: drizzle-kit must not manage it.
const appliedMigrations = pgSchema("drizzle").table("__drizzle_migrations", {
  createdAt: bigint("created_at", { mode: "number" }),
});

// Postgres error code undefined_table: the database was never migrated.
const UNDEFINED_TABLE = "42P01";

function isUndefinedTable(error: unknown): boolean {
  let current: unknown = error;
  while (current instanceof Error) {
    if ((current as { code?: unknown }).code === UNDEFINED_TABLE) {
      return true;
    }
    current = current.cause;
  }
  return false;
}

// How many migrations of this code the database has not had yet. The rule
// is drizzle-orm's: a migration newer than the newest applied one is pending.
export async function countPendingMigrations(
  db: Db = getDb(),
): Promise<number> {
  let newestApplied = 0;
  try {
    const [row] = await db
      .select({ newest: max(appliedMigrations.createdAt) })
      .from(appliedMigrations);
    newestApplied = row?.newest ?? 0;
  } catch (error) {
    if (!isUndefinedTable(error)) {
      throw error;
    }
  }
  return journal.entries.filter((entry) => entry.when > newestApplied).length;
}
