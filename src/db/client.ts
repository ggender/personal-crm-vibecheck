import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { Pool } from "pg";
import { log } from "@/lib/log";
import * as schema from "./schema";

// Repositories work with any Postgres driver: pg in the app, PGlite in tests.
export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;
export type ServerDb = NodePgDatabase<typeof schema> & { $client: Pool };

export function databaseUrl(): string {
  return (
    process.env.CRM_DATABASE_URL ?? "postgres://postgres@localhost:5433/crm"
  );
}

// Connects lazily, on the first query. Scripts close it with db.$client.end().
export function openDatabase(url: string): ServerDb {
  const pool = new Pool({ connectionString: url });
  // An idle connection breaks when Postgres restarts or the database is
  // reset; without a listener that error would stop the whole process.
  pool.on("error", (error) => log.error("db", "db.pool_error", error));
  return drizzle({ client: pool, schema });
}

// Next.js reloads modules in development; keep one pool per process.
const globalForDb = globalThis as typeof globalThis & { crmDb?: ServerDb };

export function getDb(): ServerDb {
  if (!globalForDb.crmDb) {
    globalForDb.crmDb = openDatabase(databaseUrl());
    log.info("db", "db.pool_created");
  }
  return globalForDb.crmDb;
}
